# backend/api/cameras.py
from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def get_cameras():
    """Get all cameras"""
    return [
        {
            "id": "cam_001",
            "name": "North Gate",
            "ip_address": "192.168.1.100",
            "rtsp_url": "rtsp://admin:pass@192.168.1.100:554/stream",
            "ptz_enabled": True,
            "location": {"lat": 37.7755, "lng": -122.4175},
            "status": "online"
        },
        {
            "id": "cam_002",
            "name": "South Fence",
            "ip_address": "192.168.1.101",
            "rtsp_url": "rtsp://admin:pass@192.168.1.101:554/stream",
            "ptz_enabled": False,
            "location": {"lat": 37.7745, "lng": -122.4185},
            "status": "online"
        }
    ]

@router.post("/{camera_id}/ptz")
async def control_ptz(camera_id: str, ptz_data: dict):
    """Control PTZ camera"""
    return {
        "status": "success",
        "camera_id": camera_id,
        "action": ptz_data.get("action"),
        "parameters": ptz_data.get("parameters", {})
    }