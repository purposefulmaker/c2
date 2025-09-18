# backend/mock_devices/mock_boomerang.py
import asyncio
import random
import json
from datetime import datetime
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
            # Wait random interval (30-120 seconds)
            await asyncio.sleep(random.randint(30, 120))
            
            # Generate gunshot event
            event = self.generate_gunshot_event()
            
            # Broadcast via WebSocket
            if self.manager:
                await self.manager.broadcast_event("gunshot_detection", event)
            
            logger.info(f"Gunshot detected: {event}")
    
    def generate_gunshot_event(self):
        """Generate realistic gunshot event data"""
        return {
            "device_id": self.device_id,
            "type": "gunshot",
            "timestamp": datetime.utcnow().isoformat(),
            "confidence": random.uniform(0.85, 0.99),
            "location": {
                "lat": 37.7749 + random.uniform(-0.01, 0.01),
                "lon": -122.4194 + random.uniform(-0.01, 0.01),
                "elevation": random.uniform(0, 50)
            },
            "audio_signature": {
                "peak_db": random.randint(110, 140),
                "duration_ms": random.randint(50, 200),
                "frequency_hz": random.randint(300, 3000)
            },
            "classification": random.choice(["rifle", "handgun", "shotgun"]),
            "direction": random.randint(0, 360),
            "distance_m": random.randint(50, 500)
        }
    
    def stop(self):
        self.running = False

# backend/mock_devices/mock_thermal.py
import cv2
import numpy as np
import asyncio
import base64
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class MockThermalCamera:
    """Uses webcam with OpenCV to simulate thermal detection"""
    
    def __init__(self, device_id="thermal_01", websocket_manager=None):
        self.device_id = device_id
        self.manager = websocket_manager
        self.cap = None
        self.running = False
        self.motion_detector = None
        
    async def start(self):
        """Start webcam capture and motion detection"""
        self.running = True
        self.cap = cv2.VideoCapture(0)  # Use default webcam
        
        # Initialize motion detector
        self.motion_detector = cv2.createBackgroundSubtractorMOG2()
        
        logger.info(f"Mock Thermal Camera {self.device_id} started")
        
        prev_frame = None
        
        while self.running:
            ret, frame = self.cap.read()
            if not ret:
                await asyncio.sleep(0.1)
                continue
            
            # Apply thermal-like effect
            thermal_frame = self.apply_thermal_effect(frame)
            
            # Detect motion
            motion_detected, motion_bbox = self.detect_motion(thermal_frame)
            
            if motion_detected:
                event = self.generate_thermal_event(motion_bbox, thermal_frame)
                
                if self.manager:
                    await self.manager.broadcast_event("thermal_detection", event)
                
                logger.info(f"Thermal motion detected: {event['confidence']:.2f}")
            
            # Stream frame if needed (base64 encoded)
            if self.manager and random.random() < 0.1:  # Send frame 10% of the time
                _, buffer = cv2.imencode('.jpg', thermal_frame)
                frame_base64 = base64.b64encode(buffer).decode('utf-8')
                
                await self.manager.broadcast_event("video_frame", {
                    "device_id": self.device_id,
                    "frame": frame_base64,
                    "timestamp": datetime.utcnow().isoformat()
                })
            
            await asyncio.sleep(0.1)  # 10 FPS
    
    def apply_thermal_effect(self, frame):
        """Convert regular image to thermal-like visualization"""
        # Convert to grayscale
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # Apply colormap to simulate thermal imaging
        thermal = cv2.applyColorMap(gray, cv2.COLORMAP_JET)
        
        return thermal
    
    def detect_motion(self, frame):
        """Detect motion using background subtraction"""
        # Apply background subtraction
        fg_mask = self.motion_detector.apply(frame)
        
        # Remove noise
        kernel = np.ones((5, 5), np.uint8)
        fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_CLOSE, kernel)
        
        # Find contours
        contours, _ = cv2.findContours(fg_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        # Filter significant contours
        for contour in contours:
            area = cv2.contourArea(contour)
            if area > 500:  # Minimum area threshold
                x, y, w, h = cv2.boundingRect(contour)
                return True, (x, y, w, h)
        
        return False, None
    
    def generate_thermal_event(self, bbox, frame):
        """Generate thermal detection event"""
        x, y, w, h = bbox
        
        return {
            "device_id": self.device_id,
            "type": "thermal_detection",
            "timestamp": datetime.utcnow().isoformat(),
            "confidence": random.uniform(0.7, 0.95),
            "bbox": {
                "x": x,
                "y": y,
                "width": w,
                "height": h
            },
            "classification": random.choice(["person", "vehicle", "animal", "unknown"]),
            "temperature": {
                "max": random.uniform(36, 40),  # Celsius
                "min": random.uniform(20, 30),
                "avg": random.uniform(25, 35)
            }
        }
    
    def stop(self):
        self.running = False
        if self.cap:
            self.cap.release()

# backend/mock_devices/mock_lrad.py
import asyncio
import random
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class MockLRAD:
    """Simulates LRAD acoustic device responses"""
    
    def __init__(self, device_id="lrad_01", websocket_manager=None):
        self.device_id = device_id
        self.manager = websocket_manager
        self.active = False
        self.current_spl = 0
        
    async def activate(self, duration=10, pattern="deterrent", spl=95):
        """Activate LRAD with specified parameters"""
        if self.active:
            return {"error": "LRAD already active"}
        
        self.active = True
        self.current_spl = spl
        
        logger.info(f"LRAD {self.device_id} activated: {pattern} @ {spl}dB for {duration}s")
        
        # Broadcast activation
        if self.manager:
            await self.manager.broadcast_event("lrad_activation", {
                "device_id": self.device_id,
                "status": "active",
                "pattern": pattern,
                "spl": spl,
                "duration": duration,
                "timestamp": datetime.utcnow().isoformat()
            })
        
        # Simulate activation duration
        await asyncio.sleep(duration)
        
        # Deactivate
        self.active = False
        self.current_spl = 0
        
        if self.manager:
            await self.manager.broadcast_event("lrad_deactivation", {
                "device_id": self.device_id,
                "status": "inactive",
                "timestamp": datetime.utcnow().isoformat()
            })
        
        logger.info(f"LRAD {self.device_id} deactivated")
        
        return {"status": "completed", "duration": duration}
    
    async def play_message(self, message: str, language="en"):
        """Play pre-recorded message"""
        if self.active:
            return {"error": "LRAD already active"}
        
        self.active = True
        duration = len(message) * 0.1  # Estimate duration based on message length
        
        logger.info(f"LRAD {self.device_id} playing message: '{message[:50]}...'")
        
        if self.manager:
            await self.manager.broadcast_event("lrad_message", {
                "device_id": self.device_id,
                "message": message,
                "language": language,
                "timestamp": datetime.utcnow().isoformat()
            })
        
        await asyncio.sleep(duration)
        self.active = False
        
        return {"status": "message_played", "duration": duration}

# backend/mock_devices/__init__.py
from .mock_boomerang import MockBoomerang
from .mock_thermal import MockThermalCamera
from .mock_lrad import MockLRAD
from .mock_adam import MockAdamRelay
import asyncio
import logging

logger = logging.getLogger(__name__)

async def start_mock_devices(websocket_manager):
    """Initialize and start all mock devices"""
    logger.info("Starting mock devices...")
    
    # Initialize devices
    boomerang = MockBoomerang(websocket_manager=websocket_manager)
    thermal = MockThermalCamera(websocket_manager=websocket_manager)
    lrad = MockLRAD(websocket_manager=websocket_manager)
    adam = MockAdamRelay(websocket_manager=websocket_manager)
    
    # Start device simulations
    tasks = [
        asyncio.create_task(boomerang.start()),
        asyncio.create_task(thermal.start()),
    ]
    
    # Store devices for command handling
    websocket_manager.devices = {
        "boomerang_01": boomerang,
        "thermal_01": thermal,
        "lrad_01": lrad,
        "adam_01": adam
    }
    
    logger.info("All mock devices started")
    
    # Keep running
    await asyncio.gather(*tasks)

# backend/mock_devices/mock_adam.py
class MockAdamRelay:
    """Simulates Adam 6060 relay module"""
    
    def __init__(self, device_id="adam_01", websocket_manager=None):
        self.device_id = device_id
        self.manager = websocket_manager
        self.relays = {i: False for i in range(6)}  # 6 relay channels
        
    async def set_relay(self, channel: int, state: bool):
        """Set relay channel state"""
        if channel not in self.relays:
            return {"error": f"Invalid channel {channel}"}
        
        self.relays[channel] = state
        
        if self.manager:
            await self.manager.broadcast_event("relay_state", {
                "device_id": self.device_id,
                "channel": channel,
                "state": state,
                "timestamp": datetime.utcnow().isoformat()
            })
        
        logger.info(f"Relay {self.device_id} channel {channel} set to {state}")
        return {"status": "ok", "channel": channel, "state": state}