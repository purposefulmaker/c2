// services/auth-service/src/types/auth.ts
import { Request } from 'express';

export interface User {
  id: string;
  email: string;
  name: string;
  roles: Role[];
  azure_oid: string;
  created_at: string;
  last_login: string;
  is_active: boolean;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
}

export interface Permission {
  id: string;
  resource: string;
  action: string;
  conditions?: Record<string, any>;
}

export interface AuthToken {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: 'Bearer';
  user: User;
}

export interface AzureProfile {
  oid: string;
  name: string;
  email: string;
  preferred_username: string;
  given_name?: string;
  family_name?: string;
  roles?: string[];
}

export interface SessionData {
  user_id: string;
  azure_oid: string;
  roles: string[];
  issued_at: number;
  expires_at: number;
}

export interface AuthRequest extends Request {
  user?: User;
  session_data?: SessionData;
}

// RBAC Permissions
export const PERMISSIONS = {
  // System Administration
  SYSTEM_ADMIN: 'system:admin',
  SYSTEM_CONFIG: 'system:config',
  SYSTEM_MONITOR: 'system:monitor',
  
  // User Management
  USER_READ: 'users:read',
  USER_WRITE: 'users:write',
  USER_DELETE: 'users:delete',
  
  // Device Management
  DEVICE_READ: 'devices:read',
  DEVICE_WRITE: 'devices:write',
  DEVICE_CONTROL: 'devices:control',
  
  // Camera Operations
  CAMERA_VIEW: 'cameras:view',
  CAMERA_CONTROL: 'cameras:control',
  CAMERA_PTZ: 'cameras:ptz',
  
  // Zone Management
  ZONE_READ: 'zones:read',
  ZONE_WRITE: 'zones:write',
  ZONE_DELETE: 'zones:delete',
  
  // Event Management
  EVENT_READ: 'events:read',
  EVENT_WRITE: 'events:write',
  EVENT_DELETE: 'events:delete',
  
  // Actuator Control
  ACTUATOR_VIEW: 'actuators:view',
  ACTUATOR_CONTROL: 'actuators:control',
  LRAD_CONTROL: 'lrad:control',
  
  // Analytics & Reporting
  ANALYTICS_READ: 'analytics:read',
  REPORTS_GENERATE: 'reports:generate',
  
  // Emergency Operations
  EMERGENCY_OVERRIDE: 'emergency:override',
  EMERGENCY_LOCKDOWN: 'emergency:lockdown'
} as const;

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  SYSTEM_ADMIN: 'system_admin',
  OPERATOR: 'operator',
  SECURITY_GUARD: 'security_guard',
  VIEWER: 'viewer'
} as const;

export type PermissionType = typeof PERMISSIONS[keyof typeof PERMISSIONS];
export type RoleType = typeof ROLES[keyof typeof ROLES];