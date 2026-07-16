import math
from typing import List, Dict, Any
import logging

logger = logging.getLogger("nexus-solver")

# Zone grid mapping for distance calculations
# We assume coordinates on a grid for divergence calculations
ZONE_GRID = {
    "A1": (0, 0), "A2": (1, 0), "A3": (2, 0),
    "B1": (0, 1), "B2": (1, 1), "B3": (2, 1),
    "C1": (0, 2), "C2": (1, 2), "C3": (2, 2), "C4": (3, 2)
}

def get_distance(z1: str, z2: str) -> float:
    p1 = ZONE_GRID.get(z1)
    p2 = ZONE_GRID.get(z2)
    if not p1 or not p2:
        return 999.0
    return math.sqrt((p1[0] - p2[0])**2 + (p1[1] - p2[1])**2)

def predict_density_15m(zone_id: str, all_zones: List[Any] = None) -> float:
    # If no other zones are provided, we cannot compute spatial derivatives.
    # Return a default extrapolation.
    if not all_zones:
        return 1.0

    # Build a lookup for quick access
    zone_lookup = {z.zone_id: z for z in all_zones}
    self_telemetry = zone_lookup.get(zone_id)
    if not self_telemetry:
        return 0.0

    rho = self_telemetry.density_pax_m2
    vx = self_telemetry.velocity_vector.vx
    vy = self_telemetry.velocity_vector.vy

    # Approximate divergence of velocity field using neighbors: div(v) = dvx/dx + dvy/dy
    dvx_dx_estimates = []
    dvy_dy_estimates = []

    pos_self = ZONE_GRID.get(zone_id, (0, 0))
    GRID_SCALE_METERS = 80.0  # Physical distance scale in meters between adjacent zones

    for neighbor_id, pos_neigh in ZONE_GRID.items():
        if neighbor_id == zone_id:
            continue
        # Check if they are adjacent on the grid (distance == 1)
        dist = math.sqrt((pos_neigh[0] - pos_self[0])**2 + (pos_neigh[1] - pos_self[1])**2)
        if dist <= 1.1:
            neigh_telemetry = zone_lookup.get(neighbor_id)
            if not neigh_telemetry:
                continue

            dx = (pos_neigh[0] - pos_self[0]) * GRID_SCALE_METERS
            dy = (pos_neigh[1] - pos_self[1]) * GRID_SCALE_METERS

            if dx != 0:
                # dvx/dx estimate
                dvx_dx = (neigh_telemetry.velocity_vector.vx - vx) / dx
                dvx_dx_estimates.append(dvx_dx)
            if dy != 0:
                # dvy/dy estimate
                dvy_dy = (neigh_telemetry.velocity_vector.vy - vy) / dy
                dvy_dy_estimates.append(dvy_dy)

    # Average the estimates
    avg_dvx_dx = sum(dvx_dx_estimates) / len(dvx_dx_estimates) if dvx_dx_estimates else 0.0
    avg_dvy_dy = sum(dvy_dy_estimates) / len(dvy_dy_estimates) if dvy_dy_estimates else 0.0

    # Divergence: div(V) = dvx/dx + dvy/dy
    div_v = avg_dvx_dx + avg_dvy_dy

    # Continuity equation: drho/dt = - div(rho * V) = - (rho * div_v + V * grad_rho)
    # Under local simplification: drho/dt ≈ - rho * div_v
    drho_dt = - rho * div_v

    # LWR Model (Lighthill-Whitham-Richards) crowd speed damping factor
    # As density approaches critical jam density (e.g., 4.5 pax/m2), flow slows down.
    JAM_DENSITY = 4.5
    damping = max(0.0, 1.0 - (rho / JAM_DENSITY))
    drho_dt_damped = drho_dt * damping

    # 15 minutes prediction window = 15 * 60 seconds
    dt = 15 * 60
    rho_predicted = rho + drho_dt_damped * dt

    # Keep density within physical bounds [0, 5.0]
    return max(0.0, min(5.0, round(rho_predicted, 2)))

def predict_bottleneck_path(zone_id: str, all_zones: List[Any]) -> List[str]:
    """
    Returns an ordered list of zone_ids forming the least-density path from the surge zone
    to the nearest under-utilized zone (density < 1.0). Use a simple greedy min-density walk.
    """
    zone_lookup = {z.zone_id: z for z in all_zones}
    if zone_id not in zone_lookup:
        return [zone_id]

    path = [zone_id]
    visited = {zone_id}
    current = zone_id

    # Maximum path length to avoid cycles/infinite loops
    for _ in range(8):
        current_telemetry = zone_lookup.get(current)
        if not current_telemetry:
            break
        # Stop if we reached an under-utilized zone
        if current_telemetry.density_pax_m2 < 1.0 and current != zone_id:
            break

        # Find adjacent zones
        neighbors = []
        for zid in ZONE_GRID:
            if zid in visited or zid not in zone_lookup:
                continue
            if get_distance(current, zid) <= 1.5:  # Adjacent grid coordinates
                neighbors.append(zone_lookup[zid])

        if not neighbors:
            break

        # Greedy choice: select neighbor with the minimum density
        next_zone = min(neighbors, key=lambda z: z.density_pax_m2)
        current = next_zone.zone_id
        path.append(current)
        visited.add(current)

    return path
