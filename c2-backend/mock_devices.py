# backend/mock_devices.py
import asyncio
import random
import json
from datetime import datetime, timedelta
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)

class MockBoomerang:
    """Simulates gunshot detection events"""
    
    def __init__(self, device_id="boomerang_01", websocket_manager=None):
        self.device_id = device_id
        self.manager = websocket_manager
        self.running = False
        
    async def start(self):
        """Start generating random gunshot events"""
        self.running = True
        logger.info(f"Mock Boomerang {self.device_id} started")
        
        while self.running:
            await asyncio.sleep(random.randint(30, 120))  # Random interval
            
            if self.manager:
                event = self.generate_gunshot_event()
                await self.manager.broadcast(event, "events")
    
    def generate_gunshot_event(self):
        """Generate realistic gunshot event data"""
        return {
            "type": "event",
            "data": {
                "id": random.randint(1000, 9999),
                "type": "gunshot",
                "timestamp": datetime.utcnow().isoformat(),
                "confidence": random.uniform(0.85, 0.99),
                "location": {
                    "lat": 37.7749 + random.uniform(-0.01, 0.01),
                    "lng": -122.4194 + random.uniform(-0.01, 0.01)
                },
                "device_id": self.device_id,
                "status": "active",
                "metadata": {
                    "peak_db": random.randint(110, 140),
                    "duration_ms": random.randint(50, 200),
                    "classification": random.choice(["rifle", "handgun", "shotgun"]),
                    "direction": random.randint(0, 360),
                    "distance_m": random.randint(50, 500)
                }
            }
        }
    
    def stop(self):
        self.running = False

class MockThermalCamera:
    """Simulates thermal detection events"""
    
    def __init__(self, device_id="thermal_01", websocket_manager=None):
        self.device_id = device_id
        self.manager = websocket_manager
        self.running = False
        
    async def start(self):
        """Start thermal event simulation"""
        self.running = True
        logger.info(f"Mock Thermal Camera {self.device_id} started")
        
        while self.running:
            await asyncio.sleep(random.randint(45, 180))  # Random interval
            
            if self.manager:
                event = self.generate_thermal_event()
                await self.manager.broadcast(event, "events")
    
    def generate_thermal_event(self):
        """Generate thermal detection event"""
        return {
            "type": "event",
            "data": {
                "id": random.randint(2000, 2999),
                "type": "thermal",
                "timestamp": datetime.utcnow().isoformat(),
                "confidence": random.uniform(0.70, 0.95),
                "location": {
                    "lat": 37.7759 + random.uniform(-0.005, 0.005),
                    "lng": -122.4184 + random.uniform(-0.005, 0.005)
                },
                "device_id": self.device_id,
                "status": "active",
                "metadata": {
                    "temperature": random.uniform(98.0, 102.0),
                    "size": random.choice(["small", "medium", "large"]),
                    "movement": random.choice(["stationary", "slow", "fast"])
                }
            }
        }
    
    def stop(self):
        self.running = False

class MockSystemStatus:
    """Simulates system status updates"""
    
    def __init__(self, websocket_manager=None):
        self.manager = websocket_manager
        self.running = False
        
    async def start(self):
        """Start system status broadcasts"""
        self.running = True
        logger.info("Mock System Status started")
        
        while self.running:
            await asyncio.sleep(10)  # Every 10 seconds
            
            if self.manager:
                status = self.generate_status_update()
                await self.manager.broadcast(status, "system")
    
    def generate_status_update(self):
        """Generate system status data"""
        return {
            "type": "system_status",
            "data": {
                "timestamp": datetime.utcnow().isoformat(),
                "cpu_usage": random.randint(20, 80),
                "memory_usage": random.randint(40, 90),
                "disk_usage": random.randint(20, 60),
                "connected_clients": random.randint(1, 5),
                "queue_sizes": {
                    "gunshot": random.randint(0, 20),
                    "thermal": random.randint(0, 15),
                    "ptz": random.randint(0, 5)
                }
            }
        }
    
    def stop(self):
        self.running = False

async def start_mock_devices(websocket_manager):
    """Initialize and start all mock devices"""
    logger.info("Starting mock devices...")
    
    # Initialize devices
    boomerang = MockBoomerang(websocket_manager=websocket_manager)
    thermal = MockThermalCamera(websocket_manager=websocket_manager)
    system_status = MockSystemStatus(websocket_manager=websocket_manager)
    
    # Start device simulations
    tasks = [
        asyncio.create_task(boomerang.start()),
        asyncio.create_task(thermal.start()),
        asyncio.create_task(system_status.start()),
    ]
    
    # Store devices for command handling
    websocket_manager.devices = {
        "boomerang_01": boomerang,
        "thermal_01": thermal,
        "system": system_status
    }
    
    logger.info("All mock devices started")
    
    # Keep running
    try:
        await asyncio.gather(*tasks)
    except Exception as e:
        logger.error(f"Error in mock devices: {e}")
        # Stop all devices
        boomerang.stop()
        thermal.stop()
        system_status.stop()