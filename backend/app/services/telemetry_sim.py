import asyncio
import numpy as np
from datetime import datetime, timezone
from typing import List, Dict
from app.models.schemas import TelemetryTick, ZoneTelemetry, ZoneCoordinates, VelocityVector
from app.services.fluid_solver import predict_density_15m

ZONES_LIST = ["A1", "A2", "B1", "B2", "C1", "C2", "C3", "C4"]

ZONE_COORDS = {
    "A1": ZoneCoordinates(lat=40.8130, lon=-74.0750),
    "A2": ZoneCoordinates(lat=40.8135, lon=-74.0740),
    "B1": ZoneCoordinates(lat=40.8140, lon=-74.0750),
    "B2": ZoneCoordinates(lat=40.8145, lon=-74.0740),
    "C1": ZoneCoordinates(lat=40.8150, lon=-74.0750),
    "C2": ZoneCoordinates(lat=40.8155, lon=-74.0740),
    "C3": ZoneCoordinates(lat=40.8160, lon=-74.0730),
    "C4": ZoneCoordinates(lat=40.8165, lon=-74.0720)
}

class TelemetrySimulator:
    def __init__(self):
        self.tick_count = 0
        # Initialize baseline densities and velocities
        self.densities = {
            "A1": 0.8, "A2": 1.2,
            "B1": 0.9, "B2": 1.4,
            "C1": 0.7, "C2": 1.1,
            "C3": 1.2, "C4": 0.6
        }
        # Velocities: (vx, vy)
        self.velocities = {
            "A1": (-0.1, 0.2), "A2": (0.1, -0.1),
            "B1": (-0.2, 0.1), "B2": (0.2, 0.3),
            "C1": (-0.1, -0.1), "C2": (0.1, 0.2),
            "C3": (0.3, -0.2), "C4": (-0.2, -0.3)
        }

    def step(self):
        self.tick_count += 1
        
        # Evolve each zone density
        for zone in ZONES_LIST:
            # Base velocity and density
            vx, vy = self.velocities[zone]
            rho = self.densities[zone]
            
            # Scripted surge in zone C3
            if zone == "C3" and 60 <= self.tick_count <= 120:
                # Linear ramp up to 2.8 at t=120
                progress = (self.tick_count - 60) / 60.0
                target_rho = 1.2 + progress * (2.8 - 1.2)
                self.densities[zone] = target_rho
                # Increase velocity to simulate hurried fan movement
                self.velocities[zone] = (0.5 + progress * 0.3, -0.4 - progress * 0.2)
            elif zone == "C3" and 120 < self.tick_count <= 240:
                # Slowly subside after t=120
                progress = (self.tick_count - 120) / 120.0
                self.densities[zone] = 2.8 - progress * (2.8 - 0.8)
                self.velocities[zone] = (0.8 - progress * 0.7, -0.6 + progress * 0.5)
            else:
                # Standard crowd evolution with slight random noise
                # Approximation: divergence of flow field causes density shift
                # div = dvx/dx + dvy/dy. Since velocities are static/slowly varying,
                # we just use a small random walk to simulate fans moving
                noise = np.random.normal(0, 0.04)
                # Keep densities within bounds [0.2, 3.5]
                self.densities[zone] = max(0.2, min(3.5, rho + noise))
                
                # Small fluctuations to velocities
                vx_n = max(-0.8, min(0.8, vx + np.random.normal(0, 0.02)))
                vy_n = max(-0.8, min(0.8, vy + np.random.normal(0, 0.02)))
                self.velocities[zone] = (vx_n, vy_n)

    def get_current_tick(self) -> TelemetryTick:
        timestamp = datetime.now(timezone.utc).isoformat()
        
        # First build a preliminary list of ZoneTelemetry with raw predicted density 0.0
        # so fluid_solver has the other zones' current state to compute divergence.
        preliminary_zones = []
        for zone in ZONES_LIST:
            vx, vy = self.velocities[zone]
            preliminary_zones.append(
                ZoneTelemetry(
                    zone_id=zone,
                    coordinates=ZONE_COORDS[zone],
                    density_pax_m2=round(self.densities[zone], 2),
                    velocity_vector=VelocityVector(vx=round(vx, 2), vy=round(vy, 2)),
                    predicted_density_15m=0.0,
                    status="SAFE"
                )
            )
            
        # Now compute correct predictions with neighbors context
        final_zones = []
        for zone_tel in preliminary_zones:
            pred_density = predict_density_15m(zone_tel.zone_id, preliminary_zones)
            
            # Determine status threshold
            if pred_density >= 2.2:
                status = "CRITICAL"
            elif pred_density >= 1.5:
                status = "WARNING"
            else:
                status = "SAFE"
                
            zone_tel.predicted_density_15m = pred_density
            zone_tel.status = status
            final_zones.append(zone_tel)
            
        return TelemetryTick(
            timestamp=timestamp,
            stadium_id="metlife_stadium",
            zones=final_zones
        )

    async def run(self):
        while True:
            self.step()
            yield self.get_current_tick()
            await asyncio.sleep(1.0)

# Singleton instance for simple sharing
simulator_instance = TelemetrySimulator()
