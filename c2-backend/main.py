# backend/main.py
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio
import json
import logging
from typing import List
import uvicorn

from database import engine, Base, get_db
from config import settings
from websocket_manager import ConnectionManager
from api import events, devices, zones, actuators, cameras
from mock_devices import start_mock_devices
from models import Event, Device, Zone

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

manager = ConnectionManager()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create database tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Start mock devices in background
    if settings.ENABLE_MOCK_DEVICES:
        asyncio.create_task(start_mock_devices(manager))
    
    yield

app = FastAPI(
    title="C2 Perimeter Security API",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3003", "http://localhost:3000"],  # Allow frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(events.router, prefix="/api/events", tags=["events"])
app.include_router(devices.router, prefix="/api/devices", tags=["devices"])
app.include_router(zones.router, prefix="/api/zones", tags=["zones"])
app.include_router(actuators.router, prefix="/api/actuators", tags=["actuators"])
app.include_router(cameras.router, prefix="/api/cameras", tags=["cameras"])

@app.get("/")
async def root():
    return {"message": "C2 Perimeter Security API", "status": "online"}

@app.get("/health")
async def health():
    return {"status": "healthy", "timestamp": "2025-09-18T06:40:00Z"}

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket, client_id)
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Handle different message types
            if message.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
            elif message.get("type") == "subscribe":
                # Handle subscription to specific event types
                await manager.add_subscription(client_id, message.get("topic"))
                
    except WebSocketDisconnect:
        manager.disconnect(client_id)
        logger.info(f"Client {client_id} disconnected")

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )