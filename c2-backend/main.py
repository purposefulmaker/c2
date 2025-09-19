# backend/main.py
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio
import json
import logging
from typing import List
import uvicorn
import redis.asyncio as redis
import httpx

from database import engine, Base, get_db
from config import settings
from websocket_manager import ConnectionManager
from api import events, devices, zones, actuators, cameras
from auth_integration import require_any_role
from mock_devices import start_mock_devices
from models import Event, Device, Zone

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

manager = ConnectionManager()

# Redis connection for vendor service integration
redis_client = None

async def init_redis():
    """Initialize Redis connection for vendor service integration"""
    global redis_client
    try:
        # Prefer environment-configured URL (e.g., redis://dragonfly:6379 in Docker)
        redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
        await redis_client.ping()
        logger.info("✅ Connected to DragonflyDB")
        
        # Subscribe to vendor service events
        asyncio.create_task(subscribe_to_vendor_events())
        
    except Exception as e:
        logger.warning(f"⚠️ DragonflyDB not available: {e}")
        redis_client = None

async def subscribe_to_vendor_events():
    """Subscribe to events from vendor services"""
    if not redis_client:
        return
        
    try:
        pubsub = redis_client.pubsub()
        await pubsub.subscribe(
            "boomerang:alarms",
            "events:camera", 
            "events:thermal",
            "lrad:activated",
            "ptz:status"
        )
        
        logger.info("📡 Subscribed to vendor service events")
        
        async for message in pubsub.listen():
            if message['type'] == 'message':
                await process_vendor_event(message['channel'], message['data'])
                
    except Exception as e:
        logger.error(f"Error in vendor event subscription: {e}")

async def process_vendor_event(channel: str, data: str):
    """Process events from vendor services and forward to WebSocket clients"""
    try:
        event_data = json.loads(data)
        
        # Forward to WebSocket clients
        await manager.broadcast(json.dumps({
            "source": "vendor_service",
            "channel": channel,
            "data": event_data,
            "timestamp": event_data.get("timestamp")
        }))
        
        logger.info(f"📡 Forwarded vendor event from {channel}")
        
    except Exception as e:
        logger.error(f"Error processing vendor event: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create database tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Initialize Redis connection for vendor services
    await init_redis()
    
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
    allow_origins=[
        "http://localhost:3003",
        "http://localhost:3000",
        "http://localhost:3006",  # new frontend port
    ],  # Allow frontend
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

# Vendor Service Integration Endpoints

@app.post("/api/vendor/bun/trigger")
async def trigger_bun_event(event_type: str = "gunshot"):
    """Trigger test events via Bun WebSocket service"""
    try:
        # Call bun-websocket service via Docker network (internal port 3000)
        async with httpx.AsyncClient() as client:
            response = await client.post("http://bun-websocket:3000/api/trigger")
            return response.json()
    except Exception as e:
        logger.error(f"Failed to trigger Bun event: {e}")
        raise HTTPException(status_code=503, detail="Bun service unavailable")

@app.get("/api/vendor/onvif/cameras")
async def get_onvif_cameras():
    """Get cameras from ONVIF wrapper service"""
    try:
        # Call ONVIF wrapper via service name
        async with httpx.AsyncClient() as client:
            response = await client.get("http://onvif-wrapper:8082/api/cameras")
            return response.json()
    except Exception as e:
        logger.error(f"Failed to get ONVIF cameras: {e}")
        raise HTTPException(status_code=503, detail="ONVIF service unavailable")

@app.post("/api/vendor/ptz/preset")
async def execute_ptz_preset(camera_id: str, preset: int):
    """Execute PTZ preset via Slew2 driver"""
    try:
        # Call Slew2 driver via service name
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "http://slew2-driver:8090/api/ptz/preset",
                json={"camera_id": camera_id, "preset": preset}
            )
            return response.json()
    except Exception as e:
        logger.error(f"Failed to execute PTZ preset: {e}")
        raise HTTPException(status_code=503, detail="PTZ service unavailable")

@app.post("/api/vendor/lrad/activate")
async def activate_lrad(duration: int = 10, pattern: str = "deterrent", spl: int = 95):
    """Activate LRAD via Slew2 driver"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "http://slew2-driver:8090/api/lrad/activate",
                json={"duration": duration, "pattern": pattern, "spl": spl}
            )
            return response.json()
    except Exception as e:
        logger.error(f"Failed to activate LRAD: {e}")
        raise HTTPException(status_code=503, detail="LRAD service unavailable")

@app.get("/api/vendor/status")
async def get_vendor_services_status():
    """Get status of all vendor services"""
    services = {
        "bun_websocket": {"url": "http://bun-websocket:3000", "status": "unknown"},
        "onvif_wrapper": {"url": "http://onvif-wrapper:8082", "status": "unknown"},
        "slew2_driver": {"url": "http://slew2-driver:8090", "status": "unknown"},
        "dragonfly": {"url": settings.REDIS_URL, "status": "unknown"}
    }
    
    # Check each service
    async with httpx.AsyncClient(timeout=5.0) as client:
        for service, info in services.items():
            try:
                if service == "dragonfly":
                    if redis_client:
                        await redis_client.ping()
                        services[service]["status"] = "healthy"
                    else:
                        services[service]["status"] = "offline"
                else:
                    response = await client.get(f"{info['url']}/health")
                    if response.status_code == 200:
                        services[service]["status"] = "healthy"
                        services[service]["data"] = response.json()
                    else:
                        services[service]["status"] = "error"
            except Exception as e:
                services[service]["status"] = "offline"
                services[service]["error"] = str(e)
    
    return {
        "vendor_services": services,
        "integration_status": "active" if redis_client else "limited"
    }

@app.get("/")
async def root():
    return {"message": "C2 Perimeter Security API", "status": "online"}

@app.get("/health")
async def health():
    return {"status": "healthy", "timestamp": "2025-09-18T06:40:00Z"}

# Admin-only test endpoint to verify RBAC wiring
@app.get("/api/admin/ping")
async def admin_ping(user = Depends(require_any_role(["super_admin", "system_admin"]))):
    return {"ok": True, "user": user}

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