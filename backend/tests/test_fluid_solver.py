import pytest
from app.services.fluid_solver import (
    get_distance,
    predict_density_15m,
    predict_bottleneck_path
)

def test_get_distance():
    """Verify distance calculation between stadium zones."""
    dist = get_distance("A1", "A2")
    assert dist > 0.0
    
    # Same zone distance should be 0
    assert get_distance("A1", "A1") == 0.0

def test_predict_density_15m():
    """Verify 15-minute crowd density prediction outputs."""
    class MockVector:
        def __init__(self, vx, vy):
            self.vx = vx
            self.vy = vy

    class MockZone:
        def __init__(self, zone_id, density):
            self.zone_id = zone_id
            self.density_pax_m2 = density
            self.velocity_vector = MockVector(0.5, 0.5)

    all_zones = [
        MockZone("A1", 1.2),
        MockZone("A2", 0.8),
        MockZone("B1", 1.5)
    ]
    
    # Run prediction for A1
    pred = predict_density_15m("A1", all_zones)
    assert pred >= 0.0

def test_predict_bottleneck_path():
    """Verify path prediction for bottleneck quadrants."""
    class MockVector:
        def __init__(self, vx, vy):
            self.vx = vx
            self.vy = vy

    class MockZone:
        def __init__(self, zone_id, density):
            self.zone_id = zone_id
            self.density_pax_m2 = density
            self.velocity_vector = MockVector(0.5, 0.5)

    all_zones = [
        MockZone("A1", 1.2),
        MockZone("A2", 2.5), # High density bottleneck
        MockZone("B1", 0.5)
    ]
    
    path = predict_bottleneck_path("A1", all_zones)
    assert isinstance(path, list)

def test_predict_density_zero_rho():
    class MockVector:
        def __init__(self, vx, vy):
            self.vx = vx; self.vy = vy
    class MockZone:
        def __init__(self, zone_id, density):
            self.zone_id = zone_id; self.density_pax_m2 = density; self.velocity_vector = MockVector(0.5, 0.5)
    all_zones = [MockZone("A1", 0.0), MockZone("A2", 0.0)]
    pred = predict_density_15m("A1", all_zones)
    assert pred == 0.0

def test_predict_density_at_jam():
    class MockVector:
        def __init__(self, vx, vy):
            self.vx = vx; self.vy = vy
    class MockZone:
        def __init__(self, zone_id, density):
            self.zone_id = zone_id; self.density_pax_m2 = density; self.velocity_vector = MockVector(0.5, 0.5)
    all_zones = [MockZone("A1", 4.5), MockZone("A2", 4.5)]
    pred = predict_density_15m("A1", all_zones)
    assert pred == 4.5

def test_predict_density_extreme_high():
    class MockVector:
        def __init__(self, vx, vy):
            self.vx = vx; self.vy = vy
    class MockZone:
        def __init__(self, zone_id, density):
            self.zone_id = zone_id; self.density_pax_m2 = density; self.velocity_vector = MockVector(0.5, 0.5)
    all_zones = [MockZone("A1", 10.0), MockZone("A2", 10.0)]
    pred = predict_density_15m("A1", all_zones)
    assert pred == 5.0 # Max boundary is 5.0

def test_predict_bottleneck_isolated_zone():
    class MockVector:
        def __init__(self, vx, vy):
            self.vx = vx; self.vy = vy
    class MockZone:
        def __init__(self, zone_id, density):
            self.zone_id = zone_id; self.density_pax_m2 = density; self.velocity_vector = MockVector(0.5, 0.5)
    # Zone not in grid or with no neighbors
    all_zones = [MockZone("Isolated", 2.0)]
    path = predict_bottleneck_path("Isolated", all_zones)
    assert path == ["Isolated"]
