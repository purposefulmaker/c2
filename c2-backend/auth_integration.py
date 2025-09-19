# c2-backend/auth_integration.py
import httpx
import logging
from typing import Optional, Dict, List
from fastapi import HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import Depends, Request

logger = logging.getLogger(__name__)

class AuthService:
    def __init__(self, auth_service_url: str = "http://localhost:8085"):
        self.auth_service_url = auth_service_url
        self.client = httpx.AsyncClient(timeout=30.0)
    
    async def verify_token(self, token: str) -> Optional[Dict]:
        """Verify JWT token with auth service"""
        try:
            response = await self.client.get(
                f"{self.auth_service_url}/auth/profile",
                headers={"Authorization": f"Bearer {token}"}
            )
            
            if response.status_code == 200:
                return response.json()
            
            logger.warning(f"Token verification failed: {response.status_code}")
            return None
            
        except Exception as e:
            logger.error(f"Auth service error: {e}")
            return None
    
    async def check_permission(self, token: str, resource: str, action: str) -> bool:
        """Check if user has specific permission"""
        user_data = await self.verify_token(token)
        if not user_data:
            return False
        
        # For now, we'll implement basic role-based checks
        # This can be enhanced to call auth service for detailed permission checks
        user = user_data.get("user", {})
        roles = [role.get("name") for role in user.get("roles", [])]
        
        # Super admin can do everything
        if "super_admin" in roles:
            return True
        
        # Basic permission mapping
        permission_map = {
            ("devices", "read"): ["system_admin", "operator", "security_guard", "viewer"],
            ("devices", "write"): ["system_admin", "operator"],
            ("devices", "control"): ["system_admin", "operator"],
            ("cameras", "view"): ["system_admin", "operator", "security_guard", "viewer"],
            ("cameras", "control"): ["system_admin", "operator", "security_guard"],
            ("cameras", "ptz"): ["system_admin", "operator", "security_guard"],
            ("events", "read"): ["system_admin", "operator", "security_guard", "viewer"],
            ("events", "write"): ["system_admin", "operator", "security_guard"],
            ("zones", "read"): ["system_admin", "operator", "security_guard", "viewer"],
            ("zones", "write"): ["system_admin", "operator"],
            ("actuators", "view"): ["system_admin", "operator", "security_guard", "viewer"],
            ("actuators", "control"): ["system_admin", "operator", "security_guard"],
            ("lrad", "control"): ["system_admin", "operator", "security_guard"],
            ("emergency", "override"): ["system_admin", "operator"],
        }
        
        allowed_roles = permission_map.get((resource, action), [])
        return any(role in allowed_roles for role in roles)

# Global auth service instance
auth_service = AuthService()

# Security scheme
security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Dependency to get current authenticated user"""
    try:
        user_data = await auth_service.verify_token(credentials.credentials)
        if not user_data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        return user_data.get("user")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Authentication error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed",
            headers={"WWW-Authenticate": "Bearer"},
        )

def require_permission(resource: str, action: str):
    """Dependency to require specific permission"""
    async def permission_checker(
        credentials: HTTPAuthorizationCredentials = Depends(security),
        user = Depends(get_current_user)
    ):
        has_permission = await auth_service.check_permission(
            credentials.credentials, resource, action
        )
        
        if not has_permission:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required: {resource}:{action}"
            )
        
        return user
    
    return permission_checker

def require_any_role(roles: List[str]):
    """Dependency to require any of the specified roles"""
    async def role_checker(user = Depends(get_current_user)):
        user_roles = [role.get("name") for role in user.get("roles", [])]
        
        if not any(role in user_roles for role in roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required roles: {', '.join(roles)}"
            )
        
        return user
    
    return role_checker

# Optional dependency - returns None if not authenticated
async def get_optional_user(request: Request) -> Optional[Dict]:
    """Get user if authenticated, None otherwise"""
    try:
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return None
        
        token = auth_header[7:]
        user_data = await auth_service.verify_token(token)
        return user_data.get("user") if user_data else None
        
    except Exception:
        return None