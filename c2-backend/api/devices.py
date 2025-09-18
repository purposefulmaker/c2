# backend/api/devices.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
import json

from database import get_db
from models import Device

router = APIRouter()

@router.get("/")
async def get_devices(db: AsyncSession = Depends(get_db)):
    """Get all devices"""
    result = await db.execute(select(Device))
    devices = result.scalars().all()
    
    return [
        {
            "id": device.device_id,
            "name": device.name,
            "type": device.type,
            "status": device.status,
            "ip_address": device.ip_address,
            "location": {"lat": device.location_lat, "lng": device.location_lon} if device.location_lat else None,
            "configuration": device.configuration
        }
        for device in devices
    ]

@router.post("/")
async def create_device(device_data: dict, db: AsyncSession = Depends(get_db)):
    """Create a new device"""
    device = Device(
        device_id=device_data.get("device_id"),
        name=device_data.get("name"),
        type=device_data.get("type"),
        ip_address=device_data.get("ip_address"),
        location_lat=device_data.get("location", {}).get("lat"),
        location_lon=device_data.get("location", {}).get("lng"),
        status=device_data.get("status", "offline"),
        configuration=device_data.get("configuration", {})
    )
    
    db.add(device)
    await db.commit()
    await db.refresh(device)
    
    return {"status": "success", "device_id": device.device_id}

@router.patch("/{device_id}/status")
async def update_device_status(device_id: str, status_data: dict, db: AsyncSession = Depends(get_db)):
    """Update device status"""
    result = await db.execute(select(Device).where(Device.device_id == device_id))
    device = result.scalar_one_or_none()
    
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    device.status = status_data.get("status", device.status)
    await db.commit()
    
    return {"status": "success", "device_id": device_id}