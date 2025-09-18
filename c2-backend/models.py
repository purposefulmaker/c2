# backend/models.py
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, JSON, ForeignKey, Text
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
    device_id = Column(String, ForeignKey("devices.device_id"))
    event_type = Column(String)  # gunshot, thermal, intrusion, fence
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    location_lat = Column(Float)
    location_lon = Column(Float)
    confidence = Column(Float)
    event_metadata = Column(JSON)
    status = Column(String, default="active")  # active, acknowledged, resolved
    zone_id = Column(String, ForeignKey("zones.zone_id"))
    
    device = relationship("Device", back_populates="events")
    zone = relationship("Zone", back_populates="events")
    responses = relationship("Response", back_populates="event")

class Response(Base):
    __tablename__ = "responses"
    
    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"))
    response_type = Column(String)  # lrad, camera_pan, light, alarm
    parameters = Column(JSON)
    executed_at = Column(DateTime(timezone=True), server_default=func.now())
    status = Column(String, default="pending")  # pending, executed, failed
    
    event = relationship("Event", back_populates="responses")

class Zone(Base):
    __tablename__ = "zones"
    
    id = Column(Integer, primary_key=True, index=True)
    zone_id = Column(String, unique=True, index=True)
    name = Column(String)
    type = Column(String)  # red, yellow, restricted
    polygon = Column(Text)  # GeoJSON polygon
    day_spl = Column(Integer, default=95)
    night_spl = Column(Integer, default=85)
    auto_response = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    events = relationship("Event", back_populates="zone")