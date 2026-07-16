import pytest
from pydantic import ValidationError
from app.models.schemas import VisionRequest, ZoneTelemetry, SurgeAlert

def test_vision_request_valid():
    """Verify that a valid VisionRequest parses correctly."""
    req = VisionRequest(
        request_id="req-123",
        mode="WAYFINDING",
        zone_id="C3",
        image_b64="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
    )
    assert req.request_id == "req-123"
    assert req.mode == "WAYFINDING"

def test_vision_request_invalid_mode():
    """Verify that unsupported modes trigger validation errors."""
    with pytest.raises(ValidationError):
        VisionRequest(
            request_id="req-123",
            mode="INVALID_MODE",
            zone_id="C3",
            image_b64="some-base64"
        )

def test_zone_telemetry_valid():
    """Verify that ZoneTelemetry serializes and checks bounds correctly."""
    telemetry = ZoneTelemetry(
        zone_id="A1",
        coordinates={"lat": 40.8130, "lon": -74.0750},
        density_pax_m2=1.45,
        velocity_vector={"vx": 0.4, "vy": -0.2},
        predicted_density_15m=1.95,
        status="SAFE"
    )
    assert telemetry.zone_id == "A1"
    assert telemetry.density_pax_m2 == 1.45

def test_surge_alert_valid():
    """Verify that SurgeAlert Pydantic schemas enforce correct nested objects structure."""
    alert_payload = {
        "event": "surge_alert",
        "timestamp": "2026-07-16T15:00:00Z",
        "zone_id": "C3",
        "severity": "CRITICAL",
        "predicted_density_15m": 2.84,
        "triggers": {
            "hvac": {
                "action": "LOWER_THRESHOLD",
                "zone": "C3",
                "target_temp_c": 19.5
            },
            "restock": {
                "action": "DISPATCH_ALERT",
                "concession_point": "Stand-C3",
                "items": ["water", "drinks"]
            },
            "fan_incentive": {
                "type": "WebAR_VOUCHER",
                "voucher_code": "NEXUS-C3-25",
                "discount_pct": 25,
                "destination_zone": "A2",
                "message": "Move to Zone A2 to clear bottlenecks and get 25% off",
                "expires_in_seconds": 300
            }
        }
    }
    alert = SurgeAlert(**alert_payload)
    assert alert.zone_id == "C3"
    assert alert.severity == "CRITICAL"
    assert alert.triggers.fan_incentive.voucher_code == "NEXUS-C3-25"
