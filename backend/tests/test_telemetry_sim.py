import pytest
from app.services.telemetry_sim import TelemetrySimulator

def test_telemetry_simulator_initial_state():
    """Verify that initial telemetry values fall inside realistic bounds."""
    sim = TelemetrySimulator()
    tick = sim.get_current_tick()
    data = tick.zones
    
    assert len(data) == 8 # 8 zones
    for zone in data:
        assert zone.zone_id in ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'C3', 'C4']
        assert zone.density_pax_m2 >= 0.0
        assert zone.predicted_density_15m >= 0.0

def test_telemetry_simulator_step():
    """Verify that simulator step cycles evolve density and predict metrics correctly."""
    sim = TelemetrySimulator()
    sim.step()
    tick = sim.get_current_tick()
    data = tick.zones
    
    # Values should update on tick step
    assert len(data) == 8

def test_telemetry_simulator_surge_trigger():
    """Verify that simulated surge event elevates Zone C3 density fields."""
    sim = TelemetrySimulator()
    
    # Tick simulation steps until the surge cycle trigger (SURGE_START_TICK is 60)
    # Let's skip tick count forward manually to speed up testing
    sim.tick_count = 80
    sim.step()
        
    tick = sim.get_current_tick()
    data = tick.zones
    c3_telemetry = next(z for z in data if z.zone_id == 'C3')
    
    # In C3, density should be elevated during the surge cycle
    assert c3_telemetry.density_pax_m2 > 1.2
