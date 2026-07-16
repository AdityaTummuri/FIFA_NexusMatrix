import pytest
from fastapi.testclient import TestClient

def test_vision_endpoint_menu_translation(client):
    """Verify that menu translation mode generates translated options and order link."""
    payload = {
        "request_id": "test-req-1",
        "mode": "MENU_TRANSLATION",
        "zone_id": "C3",
        "image_b64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
    }
    response = client.post("/api/vision", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "result" in data
    assert "translations" in data["result"]
    assert len(data["result"]["translations"]) > 0

def test_vision_endpoint_wayfinding(client):
    """Verify that wayfinding mode generates direction angle and distance fields."""
    payload = {
        "request_id": "test-req-2",
        "mode": "WAYFINDING",
        "zone_id": "C3",
        "image_b64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
    }
    response = client.post("/api/vision", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "wayfinding_vector" in data["result"]
    assert "angle_deg" in data["result"]["wayfinding_vector"]
    assert "distance_m" in data["result"]["wayfinding_vector"]

def test_vision_endpoint_seat_delivery(client):
    """Verify that seat delivery returns order URL links."""
    payload = {
        "request_id": "test-req-3",
        "mode": "SEAT_DELIVERY",
        "zone_id": "C3",
        "image_b64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
    }
    response = client.post("/api/vision", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "order_url" in data["result"]

def test_vision_endpoint_payload_too_large(client):
    """Verify that base64 payloads exceeding 5MB result in a 413 Payload Too Large error."""
    # Create base64 payload larger than MAX_BASE64_CHARS (approx 6.99 million characters)
    huge_b64 = "a" * (8 * 1024 * 1024) # 8 million chars
    payload = {
        "request_id": "test-req-huge",
        "mode": "WAYFINDING",
        "zone_id": "C3",
        "image_b64": huge_b64
    }
    response = client.post("/api/vision", json=payload)
    assert response.status_code == 413
    assert "exceeds" in response.json()["detail"]
