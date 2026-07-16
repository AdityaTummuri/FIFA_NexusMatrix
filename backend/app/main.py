"""
The FIFA Nexus Matrix - Backend Core Application Entrypoint.
Initializes FastAPI, configures secure CORS policies, includes router endpoints,
and manages server lifecycle tasks.
"""

import os
from contextlib import asynccontextmanager
import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from app.routers import ws_ops, vision
from app.routers.ws_ops import telemetry_broadcast_loop

load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Manages the lifecycle of the FastAPI application.
    Starts the telemetry background simulation on startup.
    """
    task = asyncio.create_task(telemetry_broadcast_loop())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

app = FastAPI(
    title="The FIFA Nexus Matrix - Predictive Operator Core",
    lifespan=lifespan
)

# Include Routers
app.include_router(ws_ops.router)
app.include_router(vision.router)

# CORS Configuration - Restrict to allowed origins
allowed_origins_str = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,https://fifa-nexus-matrix.vercel.app"
)
origins = [origin.strip() for origin in allowed_origins_str.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from typing import Dict

@app.get("/health")
async def health_check() -> Dict[str, str]:
    """
    Service health check endpoint.
    """
    return {
        "status": "ok",
        "service": "nexus-predictive-core"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

