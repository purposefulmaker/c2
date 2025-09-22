# backend/config.py
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Default to Postgres in Docker; override with .env for local non-Docker
    DATABASE_URL: str = "postgresql+asyncpg://c2:devpassword@postgres:5432/c2_local"
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