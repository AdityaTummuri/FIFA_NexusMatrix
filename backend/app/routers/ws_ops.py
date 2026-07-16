import asyncio
import json
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import List, Dict
from app.services.telemetry_sim import simulator_instance
from app.services.fluid_solver import predict_bottleneck_path
from app.webhooks.triggers import dispatch_surge_alert

logger = logging.getLogger("nexus-ws")
router = APIRouter()

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"New client connected. Total clients: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"Client disconnected. Total clients: {len(self.active_connections)}")

    async def broadcast(self, message: str):
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.error(f"Error sending message to client: {e}")
                disconnected.append(connection)
        for conn in disconnected:
            self.disconnect(conn)

manager = ConnectionManager()

# Global state to track last alert timestamp for each zone to satisfy 60s rate limit
# keys: zone_id, values: float (timestamp)
last_surge_timestamps: Dict[str, float] = {}

# Keep track of latest telemetry tick for the static /api/stadium-state endpoint
latest_telemetry_cache: Dict[str, any] = {}

async def telemetry_broadcast_loop():
    """
    Simulates telemetry and broadcasts ticks to all connected clients at 1Hz.
    Triggers surge alerts when density threshold is breached.
    """
    global latest_telemetry_cache
    logger.info("Starting simulation telemetry broadcast loop...")
    async for tick in simulator_instance.run():
        try:
            # Cache the latest tick
            latest_telemetry_cache["tick"] = tick.model_dump()
            
            # Broadcast tick to all WebSocket clients
            await manager.broadcast(tick.model_dump_json())
            
            # Check zones for predictive density surge (threshold = 2.2)
            for zone in tick.zones:
                if zone.predicted_density_15m >= 2.2:
                    current_time = asyncio.get_event_loop().time()
                    last_alert_time = last_surge_timestamps.get(zone.zone_id, 0.0)
                    
                    # 60s rate limit per zone
                    if current_time - last_alert_time >= 60.0:
                        # Find the least congested neighbor as the destination zone
                        path = predict_bottleneck_path(zone.zone_id, tick.zones)
                        # The destination is the end of the recommended walk path
                        destination_zone = path[-1] if path else "A1"
                        
                        alert = dispatch_surge_alert(
                            zone_id=zone.zone_id,
                            predicted_density=zone.predicted_density_15m,
                            destination_zone=destination_zone
                        )
                        # Broadcast the surge alert to all websocket clients
                        await manager.broadcast(alert.model_dump_json())
                        # Update timestamp
                        last_surge_timestamps[zone.zone_id] = current_time
        except Exception as e:
            logger.error(f"Error in telemetry broadcast loop: {e}", exc_info=True)

# Start telemetry loop on app startup
@router.on_event("startup")
async def startup_event():
    asyncio.create_task(telemetry_broadcast_loop())

@router.websocket("/ws/ops")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # Keep connection open. If client sends anything, discard or log.
        while True:
            data = await websocket.receive_text()
            logger.debug(f"Received data from websocket client: {data}")
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket connection error: {e}")
        manager.disconnect(websocket)
