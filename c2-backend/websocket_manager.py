# backend/websocket_manager.py
from typing import List, Dict, Set
from fastapi import WebSocket
import json
import logging

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.subscriptions: Dict[str, Set[str]] = {}  # client_id -> set of topics
        self.devices: Dict[str, any] = {}  # For storing mock devices

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        self.subscriptions[client_id] = set()
        logger.info(f"Client {client_id} connected")

    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
        if client_id in self.subscriptions:
            del self.subscriptions[client_id]
        logger.info(f"Client {client_id} disconnected")

    async def send_personal_message(self, message: dict, client_id: str):
        if client_id in self.active_connections:
            websocket = self.active_connections[client_id]
            try:
                await websocket.send_text(json.dumps(message))
            except Exception as e:
                logger.error(f"Error sending message to {client_id}: {e}")
                self.disconnect(client_id)

    async def broadcast(self, message: dict, topic: str = None):
        """Broadcast message to all connected clients or those subscribed to a topic"""
        disconnected_clients = []
        
        for client_id, websocket in self.active_connections.items():
            # If topic is specified, only send to subscribed clients
            if topic and topic not in self.subscriptions.get(client_id, set()):
                continue
                
            try:
                await websocket.send_text(json.dumps(message))
            except Exception as e:
                logger.error(f"Error broadcasting to {client_id}: {e}")
                disconnected_clients.append(client_id)
        
        # Clean up disconnected clients
        for client_id in disconnected_clients:
            self.disconnect(client_id)

    async def add_subscription(self, client_id: str, topic: str):
        """Add a topic subscription for a client"""
        if client_id in self.subscriptions:
            self.subscriptions[client_id].add(topic)
            logger.info(f"Client {client_id} subscribed to {topic}")

    async def remove_subscription(self, client_id: str, topic: str):
        """Remove a topic subscription for a client"""
        if client_id in self.subscriptions:
            self.subscriptions[client_id].discard(topic)
            logger.info(f"Client {client_id} unsubscribed from {topic}")

    def get_connected_count(self) -> int:
        """Get the number of connected clients"""
        return len(self.active_connections)