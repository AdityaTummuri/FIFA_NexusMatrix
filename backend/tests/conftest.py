import os
import sys
import pytest
from fastapi.testclient import TestClient

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.main import app

@pytest.fixture(scope="module")
def client():
    """
    Standard test client for checking FastAPI routers.
    """
    with TestClient(app) as c:
        yield c
