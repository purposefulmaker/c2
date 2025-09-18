# backend/api/actuators.py
from fastapi import APIRouter
import asyncio

router = APIRouter()

@router.post("/lrad/activate")
async def activate_lrad(lrad_data: dict):
    """Activate LRAD system"""
    duration = lrad_data.get("duration", 10)
    pattern = lrad_data.get("pattern", "deterrent")
    spl = lrad_data.get("spl", 95)
    
    # Mock LRAD activation
    return {
        "status": "activated",
        "duration": duration,
        "pattern": pattern,
        "spl": spl,
        "device_id": "lrad_01"
    }