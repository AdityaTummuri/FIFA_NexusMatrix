import pytest
from unittest.mock import AsyncMock
from app.routers.ws_ops import ConnectionManager

@pytest.mark.asyncio
async def test_connection_manager_connect_disconnect():
    """Verify that ConnectionManager correctly registers and drops active connections."""
    manager = ConnectionManager()
    
    mock_ws_1 = AsyncMock()
    mock_ws_2 = AsyncMock()
    
    # Connect two clients
    await manager.connect(mock_ws_1)
    await manager.connect(mock_ws_2)
    
    assert len(manager.active_connections) == 2
    assert mock_ws_1 in manager.active_connections
    
    # Disconnect one client
    manager.disconnect(mock_ws_1)
    assert len(manager.active_connections) == 1
    assert mock_ws_2 in manager.active_connections
    assert mock_ws_1 not in manager.active_connections

@pytest.mark.asyncio
async def test_connection_manager_limit_exceeded():
    """Verify that connection limits close the connection with 1008 code."""
    manager = ConnectionManager()
    
    from app.routers.ws_ops import MAX_CONNECTIONS
    
    # Fill the manager up to MAX_CONNECTIONS
    for _ in range(MAX_CONNECTIONS):
        manager.active_connections.append(AsyncMock())
        
    mock_ws_extra = AsyncMock()
    await manager.connect(mock_ws_extra)
    
    # Verify close was called and it wasn't added to active_connections
    mock_ws_extra.close.assert_called_once_with(code=1008, reason="Max connection limit reached")
    assert mock_ws_extra not in manager.active_connections

@pytest.mark.asyncio
async def test_connection_manager_broadcast():
    """Verify broadcast dispatches message payloads to all active clients."""
    manager = ConnectionManager()
    mock_ws_1 = AsyncMock()
    mock_ws_2 = AsyncMock()
    
    await manager.connect(mock_ws_1)
    await manager.connect(mock_ws_2)
    
    # Broadcast message payload
    message = '{"data": "test_broadcast"}'
    await manager.broadcast(message)
    
    # Verify that send_text was called on both WebSocket instances
    mock_ws_1.send_text.assert_called_once_with(message)
    mock_ws_2.send_text.assert_called_once_with(message)

def test_websocket_json_validation(client):
    """Verify malformed JSON payloads are rejected gracefully."""
    with client.websocket_connect("/ws/ops") as websocket:
        # Send malformed JSON (not a dict)
        websocket.send_text("[\"not\", \"a\", \"dict\"]")
        response = websocket.receive_json()
        assert "error" in response
        assert response["error"] == "Payload must be a JSON object"
        
        # Send invalid JSON
        websocket.send_text("this is not json")
        response = websocket.receive_json()
        assert "error" in response
        assert response["error"] == "Malformed JSON payload"
