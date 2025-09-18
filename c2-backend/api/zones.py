# backend/api/zones.py
from fastapi import APIRouter
import json

router = APIRouter()

@router.get("/")
async def get_zones():
    """Get all zones"""
    # Mock zones data
    return [
        {
            "id": "red-zone-1",
            "name": "Red Zone - Critical",
            "type": "red",
            "coordinates": [
                [37.7740, -122.4180],
                [37.7760, -122.4180],
                [37.7760, -122.4160],
                [37.7740, -122.4160]
            ],
            "day_spl": 95,
            "night_spl": 85,
            "auto_response": True
        },
        {
            "id": "yellow-zone-1",
            "name": "Yellow Zone - Warning",
            "type": "yellow",
            "coordinates": [
                [37.7720, -122.4200],
                [37.7780, -122.4200],
                [37.7780, -122.4140],
                [37.7720, -122.4140]
            ],
            "day_spl": 90,
            "night_spl": 80,
            "auto_response": False
        }
    ]

@router.post("/")
async def create_zone(zone_data: dict):
    """Create a new zone"""
    return {"status": "success", "zone_id": zone_data.get("id")}