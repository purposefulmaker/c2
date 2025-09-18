# backend/api/events.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from datetime import datetime, timedelta
import json

from database import get_db
from models import Event, Device, Response
# from schemas import EventCreate, EventResponse, ResponseAction

router = APIRouter()

@router.get("/")
async def get_events(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    event_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    hours: Optional[int] = Query(24, ge=1, le=168),
    db: AsyncSession = Depends(get_db)
):
    """Get events with filtering options"""
    query = select(Event)
    
    # Filter by time (last N hours)
    since = datetime.utcnow() - timedelta(hours=hours)
    query = query.where(Event.timestamp >= since)
    
    # Filter by event type
    if event_type:
        query = query.where(Event.event_type == event_type)
    
    # Filter by status
    if status:
        query = query.where(Event.status == status)
    
    # Apply pagination
    query = query.offset(skip).limit(limit).order_by(Event.timestamp.desc())
    
    result = await db.execute(query)
    events = result.scalars().all()
    
    # Convert to dict format expected by frontend
    return [
        {
            "id": event.id,
            "type": event.event_type,
            "timestamp": event.timestamp.isoformat(),
            "location": {"lat": event.location_lat, "lng": event.location_lon},
            "confidence": event.confidence,
            "status": event.status,
            "device_id": event.device_id,
            "zone_id": event.zone_id,
            "metadata": event.metadata
        }
        for event in events
    ]

@router.post("/")
async def create_event(
    event_data: dict,
    db: AsyncSession = Depends(get_db)
):
    """Create a new event"""
    event = Event(
        device_id=event_data.get("device_id"),
        event_type=event_data.get("type"),
        location_lat=event_data.get("location", {}).get("lat"),
        location_lon=event_data.get("location", {}).get("lng"),
        confidence=event_data.get("confidence", 0.0),
        metadata=event_data.get("metadata", {}),
        status="active"
    )
    
    db.add(event)
    await db.commit()
    await db.refresh(event)
    
    return {
        "id": event.id,
        "type": event.event_type,
        "timestamp": event.timestamp.isoformat(),
        "location": {"lat": event.location_lat, "lng": event.location_lon},
        "confidence": event.confidence,
        "status": event.status,
        "device_id": event.device_id,
        "metadata": event.metadata
    }

@router.post("/{event_id}/respond")
async def respond_to_event(
    event_id: int,
    response_data: dict,
    db: AsyncSession = Depends(get_db)
):
    """Create a response to an event"""
    # Check if event exists
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Create response
    response = Response(
        event_id=event_id,
        response_type=response_data.get("type", "manual"),
        parameters=response_data.get("parameters", {}),
        status="executed"
    )
    
    db.add(response)
    
    # Update event status
    event.status = "acknowledged"
    
    await db.commit()
    
    return {"status": "success", "response_id": response.id}

@router.patch("/{event_id}/status")
async def update_event_status(
    event_id: int,
    status_data: dict,
    db: AsyncSession = Depends(get_db)
):
    """Update event status"""
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    event.status = status_data.get("status", event.status)
    await db.commit()
    
    return {"status": "success", "event_id": event_id}