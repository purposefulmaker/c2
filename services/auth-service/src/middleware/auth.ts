// services/auth-service/src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import Redis from 'ioredis';
import { User, AuthRequest, SessionData, PermissionType } from '../types/auth.js';
import { RBACService } from '../services/rbac.js';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: 1 // Use different DB for auth
});

const rbac = RBACService.getInstance();

export class AuthMiddleware {
  static async authenticateToken(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

      if (!token) {
        res.status(401).json({ error: 'Access token required' });
        return;
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as any;
      
      // Check if token is blacklisted
      const isBlacklisted = await redis.get(`blacklist:${token}`);
      if (isBlacklisted) {
        res.status(401).json({ error: 'Token has been revoked' });
        return;
      }

      // Get session data from Redis
      const sessionData = await redis.get(`session:${decoded.session_id}`);
      if (!sessionData) {
        res.status(401).json({ error: 'Session expired' });
        return;
      }

      const session: SessionData = JSON.parse(sessionData);
      
      // Check session expiry
      if (Date.now() > session.expires_at) {
        await redis.del(`session:${decoded.session_id}`);
        res.status(401).json({ error: 'Session expired' });
        return;
      }

      // Get user data
      const userData = await redis.get(`user:${session.user_id}`);
      if (!userData) {
        res.status(401).json({ error: 'User not found' });
        return;
      }

      const user: User = JSON.parse(userData);
      
      // Check if user is active
      if (!user.is_active) {
        res.status(401).json({ error: 'User account is disabled' });
        return;
      }

      // Attach user and session to request
      req.user = user;
      req.session_data = session;

      next();
    } catch (error) {
      console.error('Authentication error:', error);
      res.status(401).json({ error: 'Invalid token' });
    }
  }

  static requirePermission(resource: string, action: string) {
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      if (!rbac.hasPermission(req.user, resource, action)) {
        res.status(403).json({ 
          error: 'Insufficient permissions',
          required: `${resource}:${action}`
        });
        return;
      }

      next();
    };
  }

  static requireAnyPermission(permissions: PermissionType[]) {
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      if (!rbac.hasAnyPermission(req.user, permissions)) {
        res.status(403).json({ 
          error: 'Insufficient permissions',
          required_any: permissions
        });
        return;
      }

      next();
    };
  }

  static requireAllPermissions(permissions: PermissionType[]) {
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      if (!rbac.hasAllPermissions(req.user, permissions)) {
        res.status(403).json({ 
          error: 'Insufficient permissions',
          required_all: permissions
        });
        return;
      }

      next();
    };
  }

  static requireRole(roleName: string) {
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const hasRole = req.user.roles.some(role => role.name === roleName);
      if (!hasRole) {
        res.status(403).json({ 
          error: 'Insufficient permissions',
          required_role: roleName
        });
        return;
      }

      next();
    };
  }

  static async refreshSession(sessionId: string): Promise<boolean> {
    try {
      const sessionData = await redis.get(`session:${sessionId}`);
      if (!sessionData) {
        return false;
      }

      const session: SessionData = JSON.parse(sessionData);
      
      // Extend session by 24 hours
      session.expires_at = Date.now() + (24 * 60 * 60 * 1000);
      
      await redis.setex(`session:${sessionId}`, 24 * 60 * 60, JSON.stringify(session));
      
      return true;
    } catch (error) {
      console.error('Session refresh error:', error);
      return false;
    }
  }

  static async blacklistToken(token: string): Promise<void> {
    try {
      // Extract expiry from token
      const decoded = jwt.decode(token) as any;
      const ttl = decoded.exp ? Math.max(0, decoded.exp - Math.floor(Date.now() / 1000)) : 3600;
      
      await redis.setex(`blacklist:${token}`, ttl, '1');
    } catch (error) {
      console.error('Token blacklist error:', error);
    }
  }

  static async revokeAllUserSessions(userId: string): Promise<void> {
    try {
      const pattern = `session:*`;
      const keys = await redis.keys(pattern);
      
      for (const key of keys) {
        const sessionData = await redis.get(key);
        if (sessionData) {
          const session: SessionData = JSON.parse(sessionData);
          if (session.user_id === userId) {
            await redis.del(key);
          }
        }
      }
    } catch (error) {
      console.error('Session revocation error:', error);
    }
  }
}