"""
The FIFA Nexus Matrix - Fluid Dynamics & Crowd Continuity Solver.

Implements macroscopic crowd flow predictions by modeling crowd density conservation
and walking velocity decay according to the Lighthill-Whitham-Richards (LWR) model.
Specifically, it solves:
    d(rho)/dt + div(rho * V) = 0
where density (rho) conservation maps bottle-neck propagation 15 minutes in advance.
"""

import math
from typing import List, Dict, Any
import logging

logger = logging.getLogger("nexus-solver")

# Grid scale & distance constants
GRID_SCALE_METERS = 80.0          # Physical distance scale between adjacent grid quadrants
DEFAULT_DISTANCE = 999.0          # Sentinel distance value for missing zones
NEIGHBOR_ADJACENT_LIMIT = 1.1     # Neighbor distance threshold on the coordinate grid
PATH_ADJACENT_LIMIT = 1.5         # Adjacency threshold for routing transitions
PATH_MAX_HOPS = 8                 # Maximum steps allowed in min-density greedy path search
UNDERUTILIZED_THRESHOLD = 1.0     # Density threshold below which a zone is under-utilized

# Fluid prediction bounds & model parameters
JAM_DENSITY = 4.5                 # Critical crowd jam density (pax/m^2) where velocity reaches 0
PREDICTION_WINDOW_S = 15 * 60     # Time projection window in seconds (15 minutes)
MIN_DENSITY_BOUND = 0.0           # Minimum physical crowd density
MAX_DENSITY_BOUND = 5.0           # Maximum physical crowd density cap

# Zone grid mapping for spatial finite-difference divergence calculations
ZONE_GRID: Dict[str, tuple[int, int]] = {
    "A1": (0, 0), "A2": (1, 0), "A3": (2, 0),
    "B1": (0, 1), "B2": (1, 1), "B3": (2, 1),
    "C1": (0, 2), "C2": (1, 2), "C3": (2, 2), "C4": (3, 2)
}

def get_distance(z1: str, z2: str) -> float:
    """
    Computes the straight-line grid distance between two stadium zones.
    """
    p1 = ZONE_GRID.get(z1)
    p2 = ZONE_GRID.get(z2)
    if not p1 or not p2:
        return DEFAULT_DISTANCE
    return math.sqrt((p1[0] - p2[0])**2 + (p1[1] - p2[1])**2)

def predict_density_15m(zone_id: str, all_zones: List[Any] = None) -> float:
    """
    Predicts the local crowd density 15 minutes into the future.
    Uses finite-difference spatial derivatives of the velocity field
    to estimate flow divergence (div V) and updates density via:
        d(rho)/dt = - rho * div(V)
    under the LWR model velocity damping conditions.
    """
    # If no other zones are provided, we cannot compute spatial derivatives.
    # Return a default extrapolation.
    if not all_zones:
        return 1.0

    # Build a lookup for quick access
    zone_lookup = {z.zone_id: z for z in all_zones}
    self_telemetry = zone_lookup.get(zone_id)
    if not self_telemetry:
        return MIN_DENSITY_BOUND

    rho = self_telemetry.density_pax_m2
    vx = self_telemetry.velocity_vector.vx
    vy = self_telemetry.velocity_vector.vy

    # Approximate divergence of velocity field using neighbors: div(v) = dvx/dx + dvy/dy
    dvx_dx_estimates = []
    dvy_dy_estimates = []

    pos_self = ZONE_GRID.get(zone_id, (0, 0))

    for neighbor_id, pos_neigh in ZONE_GRID.items():
        if neighbor_id == zone_id:
            continue
        # Check if they are adjacent on the grid (distance == 1)
        dist = math.sqrt((pos_neigh[0] - pos_self[0])**2 + (pos_neigh[1] - pos_self[1])**2)
        if dist <= NEIGHBOR_ADJACENT_LIMIT:
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
    damping = max(0.0, 1.0 - (rho / JAM_DENSITY))
    drho_dt_damped = drho_dt * damping

    # 15 minutes prediction window in seconds
    rho_predicted = rho + drho_dt_damped * PREDICTION_WINDOW_S

    # Keep density within physical bounds
    return max(MIN_DENSITY_BOUND, min(MAX_DENSITY_BOUND, round(rho_predicted, 2)))

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
    for _ in range(PATH_MAX_HOPS):
        current_telemetry = zone_lookup.get(current)
        if not current_telemetry:
            break
        # Stop if we reached an under-utilized zone
        if current_telemetry.density_pax_m2 < UNDERUTILIZED_THRESHOLD and current != zone_id:
            break

        # Find adjacent zones
        neighbors = []
        for zid in ZONE_GRID:
            if zid in visited or zid not in zone_lookup:
                continue
            if get_distance(current, zid) <= PATH_ADJACENT_LIMIT:  # Adjacent grid coordinates
                neighbors.append(zone_lookup[zid])

        if not neighbors:
            break

        # Greedy choice: select neighbor with the minimum density
        next_zone = min(neighbors, key=lambda z: z.density_pax_m2)
        current = next_zone.zone_id
        path.append(current)
        visited.add(current)

    return path
