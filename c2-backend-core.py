# backend/main.py
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio
import logging
from typing import List
import json

from database import engine, Base, get_db
from config import settings
from websocket import ConnectionManager
from api import events, devices, zones, actuators, cameras
from mock_devices import start_mock_devices

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

manager = ConnectionManager()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting C2 System...")
    Base.metadata.create_all(bind=engine)
    
    # Start mock devices if enabled
    if settings.ENABLE_MOCK_DEVICES:
        asyncio.create_task(start_mock_devices(manager))
    
    yield
    
    # Shutdown
    logger.info("Shutting down C2 System...")

app = FastAPI(
    title="C2 Perimeter Security API",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
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
    return {"message": "C2 Perimeter Security System", "status": "operational"}

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket, client_id)
    try:
        while True:
            data = await websocket.receive_text()
            # Handle incoming WebSocket messages
            message = json.loads(data)
            
            if message["type"] == "ping":
                await websocket.send_json({"type": "pong"})
            elif message["type"] == "subscribe":
                # Handle subscription to specific event types
                pass
            
    except WebSocketDisconnect:
        manager.disconnect(client_id)

# backend/config.py
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://user:pass@localhost/c2db"
    REDIS_URL: str = "redis://localhost:6379"
    JWT_SECRET: str = "your-secret-key"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Axis Camera
    AXIS_PORTAL_URL: Optional[str] = None
    AXIS_USERNAME: Optional[str] = None
    AXIS_PASSWORD: Optional[str] = None
    
    # Mock Devices
    ENABLE_MOCK_DEVICES: bool = True
    MOCK_GUNSHOT_INTERVAL: int = 60
    MOCK_THERMAL_CONFIDENCE: float = 0.85
    
    # Map
    MAPBOX_TOKEN: Optional[str] = None
    
    class Config:
        env_file = ".env"

settings = Settings()

# backend/database.py
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from config import settings

engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# backend/models.py
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, JSON, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class Device(Base):
    __tablename__ = "devices"
    
    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String, unique=True, index=True)
    name = Column(String)
    type = Column(String)  # thermal, boomerang, lrad, adam, camera
    ip_address = Column(String)
    location_lat = Column(Float)
    location_lon = Column(Float)
    status = Column(String, default="online")
    configuration = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    events = relationship("Event", back_populates="device")

class Event(Base):
    __tablename__ = "events"
    
    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String, unique=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id"))
    type = Column(String)  # gunshot, thermal_detection, fence_cut, etc
    confidence = Column(Float)
    location_lat = Column(Float)
    location_lon = Column(Float)
    metadata = Column(JSON)
    response_taken = Column(String)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    
    device = relationship("Device", back_populates="events")
    responses = relationship("Response", back_populates="event")

class Response(Base):
    __tablename__ = "responses"
    
    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"))
    action = Column(String)  # deterrent, spotlight, alert, etc
    target_device = Column(String)
    parameters = Column(JSON)
    success = Column(Boolean, default=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    
    event = relationship("Event", back_populates="responses")

class Zone(Base):
    __tablename__ = "zones"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True)
    type = Column(String)  # red, yellow, restricted
    polygon = Column(JSON)  # GeoJSON polygon
    day_spl_limit = Column(Integer, default=90)
    night_spl_limit = Column(Integer, default=80)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

# backend/websocket.py
from typing import List, Dict
from fastapi import WebSocket
import json
import logging

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        
    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        logger.info(f"Client {client_id} connected")
        
    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
            logger.info(f"Client {client_id} disconnected")
    
    async def send_personal_message(self, message: str, client_id: str):
        if client_id in self.active_connections:
            await self.active_connections[client_id].send_text(message)
    
    async def broadcast(self, message: dict):
        """Broadcast message to all connected clients"""
        disconnected_clients = []
        for client_id, connection in self.active_connections.items():
            try:
                await connection.send_json(message)
            except:
                disconnected_clients.append(client_id)
        
        # Clean up disconnected clients
        for client_id in disconnected_clients:
            self.disconnect(client_id)
    
    async def broadcast_event(self, event_type: str, data: dict):
        """Broadcast typed event to all clients"""
        message = {
            "type": event_type,
            "data": data,
            "timestamp": data.get("timestamp", "")
        }
        await self.broadcast(message)

# backend/api/events.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
import uuid

from database import get_db
from models import Event, Device, Response
from schemas import EventCreate, EventResponse, ResponseAction

router = APIRouter()

@router.get("/", response_model=List[EventResponse])
async def get_events(
    skip: int = 0,
    limit: int = 100,
    event_type: Optional[str] = None,
    last_hours: Optional[int] = 24,
    db: Session = Depends(get_db)
):
    query = db.query(Event)
    
    if event_type:
        query = query.filter(Event.type == event_type)
    
    if last_hours:
        since = datetime.utcnow() - timedelta(hours=last_hours)
        query = query.filter(Event.timestamp >= since)
    
    events = query.order_by(Event.timestamp.desc()).offset(skip).limit(limit).all()
    return events

@router.post("/", response_model=EventResponse)
async def create_event(
    event: EventCreate,
    db: Session = Depends(get_db)
):
    # Create new event
    db_event = Event(
        event_id=str(uuid.uuid4()),
        **event.dict()
    )
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    
    # Trigger automated response if needed
    if event.type == "gunshot" and event.confidence > 0.8:
        # Auto-trigger LRAD
        response = Response(
            event_id=db_event.id,
            action="deterrent",
            target_device="lrad_01",
            parameters={"duration": 10, "pattern": "alert"}
        )
        db.add(response)
        db.commit()
    
    return db_event

@router.post("/{event_id}/respond")
async def respond_to_event(
    event_id: str,
    action: ResponseAction,
    db: Session = Depends(get_db)
):
    event = db.query(Event).filter(Event.event_id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    response = Response(
        event_id=event.id,
        action=action.action,
        target_device=action.target_device,
        parameters=action.parameters
    )
    db.add(response)
    db.commit()
    
    return {"message": "Response triggered", "response_id": response.id}

# backend/api/devices.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import uuid

from database import get_db
from models import Device
from schemas import DeviceCreate, DeviceResponse, DeviceUpdate

router = APIRouter()

@router.get("/", response_model=List[DeviceResponse])
async def get_devices(
    device_type: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Device)
    
    if device_type:
        query = query.filter(Device.type == device_type)
    if status:
        query = query.filter(Device.status == status)
    
    return query.all()

@router.post("/", response_model=DeviceResponse)
async def create_device(
    device: DeviceCreate,
    db: Session = Depends(get_db)
):
    db_device = Device(
        device_id=str(uuid.uuid4()),
        **device.dict()
    )
    db.add(db_device)
    db.commit()
    db.refresh(db_device)
    return db_device

@router.patch("/{device_id}")
async def update_device(
    device_id: str,
    update: DeviceUpdate,
    db: Session = Depends(get_db)
):
    device = db.query(Device).filter(Device.device_id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    for field, value in update.dict(exclude_unset=True).items():
        setattr(device, field, value)
    
    db.commit()
    return device

@router.post("/{device_id}/command")
async def send_device_command(
    device_id: str,
    command: dict,
    db: Session = Depends(get_db)
):
    device = db.query(Device).filter(Device.device_id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    # Route to appropriate device handler
    if device.type == "lrad":
        # Trigger LRAD
        return {"status": "LRAD activated", "duration": command.get("duration", 10)}
    elif device.type == "camera":
        # PTZ control
        return {"status": "Camera moved", "position": command.get("position")}
    
    return {"status": "Command sent", "device": device_id}