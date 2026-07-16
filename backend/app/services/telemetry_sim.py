"""
The FIFA Nexus Matrix - Stadium Telemetry Simulator.

Simulates crowd densities and movement velocity vectors across key stadium zones at 1Hz,
including a scripted crowd surge incident in Zone C3 to test operational loop triggers.
"""

import asyncio
import numpy as np
from datetime import datetime, timezone
from typing import List, Dict, AsyncGenerator
from app.models.schemas import TelemetryTick, ZoneTelemetry, ZoneCoordinates, VelocityVector
from app.services.fluid_solver import predict_density_15m

# Configuration Constants
ZONES_LIST: List[str] = ["A1", "A2", "B1", "B2", "C1", "C2", "C3", "C4"]

# Simulator state bounds
MIN_DENSITY_BOUND = 0.2
MAX_DENSITY_BOUND = 3.5
MIN_VELOCITY_BOUND = -0.8
MAX_VELOCITY_BOUND = 0.8

# Threat assessment thresholds
CRITICAL_DENSITY_THRESHOLD = 2.2
WARNING_DENSITY_THRESHOLD = 1.5

# Scripted surge timeline in ticks
SURGE_START_TICK = 60
SURGE_PEAK_TICK = 120
SURGE_END_TICK = 240

# Scripted surge density milestones
C3_BASELINE_DENSITY = 1.2
C3_PEAK_DENSITY = 2.8
C3_SUBSIDED_DENSITY = 0.8

ZONE_COORDS: Dict[str, ZoneCoordinates] = {
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
    """
    Simulates real-time crowd dynamics, updating walking speeds and local densities
    for all stadium zones, incorporating realistic noise and a test crowd bottleneck.
    """
    def __init__(self) -> None:
        self.tick_count: int = 0
        # Initialize baseline densities and velocities
        self.densities: Dict[str, float] = {
            "A1": 0.8, "A2": 1.2,
            "B1": 0.9, "B2": 1.4,
            "C1": 0.7, "C2": 1.1,
            "C3": 1.2, "C4": 0.6
        }
        # Velocities: (vx, vy)
        self.velocities: Dict[str, tuple[float, float]] = {
            "A1": (-0.1, 0.2), "A2": (0.1, -0.1),
            "B1": (-0.2, 0.1), "B2": (0.2, 0.3),
            "C1": (-0.1, -0.1), "C2": (0.1, 0.2),
            "C3": (0.3, -0.2), "C4": (-0.2, -0.3)
        }

    def step(self) -> None:
        """
        Advances the simulation by one tick, updating densities and velocity vectors
        under a mixture of random-walk fluctuations and the scripted Zone C3 surge.
        """
        self.tick_count += 1
        
        # Evolve each zone density
        for zone in ZONES_LIST:
            # Base velocity and density
            vx, vy = self.velocities[zone]
            rho = self.densities[zone]
            
            # Scripted surge in zone C3
            if zone == "C3" and SURGE_START_TICK <= self.tick_count <= SURGE_PEAK_TICK:
                # Linear ramp up to Peak Density at peak tick
                ramp_ticks = SURGE_PEAK_TICK - SURGE_START_TICK
                progress = (self.tick_count - SURGE_START_TICK) / float(ramp_ticks)
                target_rho = C3_BASELINE_DENSITY + progress * (C3_PEAK_DENSITY - C3_BASELINE_DENSITY)
                self.densities[zone] = target_rho
                # Increase velocity to simulate hurried fan movement
                self.velocities[zone] = (0.5 + progress * 0.3, -0.4 - progress * 0.2)
            elif zone == "C3" and SURGE_PEAK_TICK < self.tick_count <= SURGE_END_TICK:
                # Slowly subside after peak tick
                decay_ticks = SURGE_END_TICK - SURGE_PEAK_TICK
                progress = (self.tick_count - SURGE_PEAK_TICK) / float(decay_ticks)
                self.densities[zone] = C3_PEAK_DENSITY - progress * (C3_PEAK_DENSITY - C3_SUBSIDED_DENSITY)
                self.velocities[zone] = (0.8 - progress * 0.7, -0.6 + progress * 0.5)
            else:
                # Standard crowd evolution with slight random noise
                noise = np.random.normal(0, 0.04)
                # Keep densities within bounds
                self.densities[zone] = max(MIN_DENSITY_BOUND, min(MAX_DENSITY_BOUND, rho + noise))
                
                # Small fluctuations to velocities
                vx_n = max(MIN_VELOCITY_BOUND, min(MAX_VELOCITY_BOUND, vx + np.random.normal(0, 0.02)))
                vy_n = max(MIN_VELOCITY_BOUND, min(MAX_VELOCITY_BOUND, vy + np.random.normal(0, 0.02)))
                self.velocities[zone] = (vx_n, vy_n)

    def get_current_tick(self) -> TelemetryTick:
        """
        Calculates and maps future 15-minute crowd density predictions and statuses,
        producing a complete stadium-wide TelemetryTick data schema.
        """
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
            if pred_density >= CRITICAL_DENSITY_THRESHOLD:
                status = "CRITICAL"
            elif pred_density >= WARNING_DENSITY_THRESHOLD:
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

    async def run(self) -> AsyncGenerator[TelemetryTick, None]:
        """
        Asynchronous generator yielding simulated telemetry ticks at a 1Hz frequency.
        """
        while True:
            self.step()
            yield self.get_current_tick()
            await asyncio.sleep(1.0)

# Singleton instance for simple sharing
simulator_instance = TelemetrySimulator()

