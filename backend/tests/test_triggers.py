import pytest
from app.webhooks.triggers import dispatch_surge_alert
from app.models.schemas import SurgeAlert

def test_dispatch_surge_alert():
    """Verify that dispatch_surge_alert constructs a valid SurgeAlert object."""
    alert = dispatch_surge_alert("C3", 2.85, "A2")
    
    assert isinstance(alert, SurgeAlert)
    assert alert.zone_id == "C3"
    assert alert.severity == "HIGH"
    assert alert.predicted_density_15m == 2.85
    
    # Check automated triggers
    assert alert.triggers.hvac.zone == "C3"
    assert alert.triggers.hvac.target_temp_c == 20.0
    
    assert alert.triggers.restock.concession_point == "Stand-C3"
    assert "water" in alert.triggers.restock.items
    
    assert alert.triggers.fan_incentive.voucher_code == "NEXUS-C3-15OFF"
    assert alert.triggers.fan_incentive.discount_pct == 15
    assert alert.triggers.fan_incentive.destination_zone == "A2"
