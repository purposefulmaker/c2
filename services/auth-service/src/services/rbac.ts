// services/auth-service/src/services/rbac.ts
import { User, Role, Permission, PermissionType, PERMISSIONS, ROLES } from '../types/auth.js';
import { v4 as uuidv4 } from 'uuid';

export class RBACService {
  private static instance: RBACService;
  private defaultRoles: Map<string, Permission[]> = new Map();
  private users: any; // Add users property - replace with proper type

  constructor() {
    this.initializeDefaultRoles();
    // Initialize users service - replace with proper implementation
    this.users = {
      findByExternalId: async (provider: string, externalId: string) => null,
      create: async (userData: any) => ({ id: uuidv4(), ...userData })
    };
  }

  static getInstance(): RBACService {
    if (!RBACService.instance) {
      RBACService.instance = new RBACService();
    }
    return RBACService.instance;
  }

  private initializeDefaultRoles(): void {
    // Super Admin - Full access
    this.defaultRoles.set(ROLES.SUPER_ADMIN, [
      { id: '1', resource: '*', action: '*' }
    ]);

    // System Admin - System management and configuration
    this.defaultRoles.set(ROLES.SYSTEM_ADMIN, [
      { id: '2', resource: 'system', action: 'admin' },
      { id: '3', resource: 'system', action: 'config' },
      { id: '4', resource: 'system', action: 'monitor' },
      { id: '5', resource: 'users', action: 'read' },
      { id: '6', resource: 'users', action: 'write' },
      { id: '7', resource: 'devices', action: 'read' },
      { id: '8', resource: 'devices', action: 'write' },
      { id: '9', resource: 'devices', action: 'control' },
      { id: '10', resource: 'cameras', action: 'view' },
      { id: '11', resource: 'cameras', action: 'control' },
      { id: '12', resource: 'cameras', action: 'ptz' },
      { id: '13', resource: 'zones', action: 'read' },
      { id: '14', resource: 'zones', action: 'write' },
      { id: '15', resource: 'events', action: 'read' },
      { id: '16', resource: 'events', action: 'write' },
      { id: '17', resource: 'actuators', action: 'view' },
      { id: '18', resource: 'actuators', action: 'control' },
      { id: '19', resource: 'analytics', action: 'read' },
      { id: '20', resource: 'reports', action: 'generate' }
    ]);

    // Operator - Day-to-day operations
    this.defaultRoles.set(ROLES.OPERATOR, [
      { id: '21', resource: 'devices', action: 'read' },
      { id: '22', resource: 'devices', action: 'control' },
      { id: '23', resource: 'cameras', action: 'view' },
      { id: '24', resource: 'cameras', action: 'control' },
      { id: '25', resource: 'cameras', action: 'ptz' },
      { id: '26', resource: 'zones', action: 'read' },
      { id: '27', resource: 'events', action: 'read' },
      { id: '28', resource: 'events', action: 'write' },
      { id: '29', resource: 'actuators', action: 'view' },
      { id: '30', resource: 'actuators', action: 'control' },
      { id: '31', resource: 'lrad', action: 'control' },
      { id: '32', resource: 'emergency', action: 'override' }
    ]);

    // Security Guard - Basic security operations
    this.defaultRoles.set(ROLES.SECURITY_GUARD, [
      { id: '33', resource: 'devices', action: 'read' },
      { id: '34', resource: 'cameras', action: 'view' },
      { id: '35', resource: 'cameras', action: 'ptz' },
      { id: '36', resource: 'zones', action: 'read' },
      { id: '37', resource: 'events', action: 'read' },
      { id: '38', resource: 'events', action: 'write' },
      { id: '39', resource: 'actuators', action: 'view' },
      { id: '40', resource: 'lrad', action: 'control' }
    ]);

    // Viewer - Read-only access
    this.defaultRoles.set(ROLES.VIEWER, [
      { id: '41', resource: 'devices', action: 'read' },
      { id: '42', resource: 'cameras', action: 'view' },
      { id: '43', resource: 'zones', action: 'read' },
      { id: '44', resource: 'events', action: 'read' },
      { id: '45', resource: 'actuators', action: 'view' }
    ]);
  }

  public hasPermission(user: User, resource: string, action: string): boolean {
    if (!user || !user.roles || user.roles.length === 0) {
      return false;
    }

    // Check if user has super admin role
    if (user.roles.some(role => role.name === ROLES.SUPER_ADMIN)) {
      return true;
    }

    // Check specific permissions
    for (const role of user.roles) {
      for (const permission of role.permissions) {
        // Wildcard permissions
        if (permission.resource === '*' && permission.action === '*') {
          return true;
        }
        
        // Resource wildcard
        if (permission.resource === '*' && permission.action === action) {
          return true;
        }
        
        // Action wildcard
        if (permission.resource === resource && permission.action === '*') {
          return true;
        }
        
        // Exact match
        if (permission.resource === resource && permission.action === action) {
          return true;
        }
      }
    }

    return false;
  }

  public hasAnyPermission(user: User, permissions: PermissionType[]): boolean {
    return permissions.some(permission => {
      const [resource, action] = permission.split(':');
      return this.hasPermission(user, resource, action);
    });
  }

  public hasAllPermissions(user: User, permissions: PermissionType[]): boolean {
    return permissions.every(permission => {
      const [resource, action] = permission.split(':');
      return this.hasPermission(user, resource, action);
    });
  }

  public getDefaultPermissions(roleName: string): Permission[] {
    return this.defaultRoles.get(roleName) || [];
  }

  public createUserWithDefaultRole(azureProfile: any, roleName: string): User {
    const permissions = this.getDefaultPermissions(roleName);
    
    return {
      id: uuidv4(),
      email: azureProfile.email || azureProfile.preferred_username,
      name: azureProfile.name || azureProfile.displayName,
      azure_oid: azureProfile.oid,
      created_at: new Date().toISOString(),
      last_login: new Date().toISOString(),
      is_active: true,
      roles: [{
        id: uuidv4(),
        name: roleName,
        description: `Default ${roleName} role`,
        permissions
      }]
    };
  }

  public validateRoleAssignment(userRoles: string[], targetRole: string): boolean {
    // Super admins can assign any role
    if (userRoles.includes(ROLES.SUPER_ADMIN)) {
      return true;
    }

    // System admins can assign operator, security guard, and viewer roles
    if (userRoles.includes(ROLES.SYSTEM_ADMIN)) {
      return [ROLES.OPERATOR, ROLES.SECURITY_GUARD, ROLES.VIEWER].includes(targetRole as any);
    }

    // Operators can only assign viewer roles
    if (userRoles.includes(ROLES.OPERATOR)) {
      return targetRole === ROLES.VIEWER;
    }

    return false;
  }

  private async applyExternalRoles(userId: string, roles: string[]): Promise<void> {
    // Implementation for applying external roles
    // Replace with proper role assignment logic
  }

  private async ensureDefaultRole(userId: string): Promise<void> {
    // Implementation for ensuring default role
    // Replace with proper default role assignment logic
  }

  async findOrCreateExternalUser(input: {
    externalId: string;
    provider: 'azure';
    tenantId?: string;
    name?: string | null;
    email?: string | null;
    roles?: string[];
  }) {
    // Prefer externalId (oid) as unique key
    let user = await this.users.findByExternalId(input.provider, input.externalId);
    if (!user) {
      user = await this.users.create({
        externalProvider: input.provider,
        externalId: input.externalId,
        tenantId: input.tenantId || null,
        displayName: input.name || input.email || 'Unknown',
        primaryEmail: input.email || null
      });
    }
    // Apply roles from Azure (app roles) if present
    if (input.roles && input.roles.length) {
      await this.applyExternalRoles(user.id, input.roles);
    } else {
      await this.ensureDefaultRole(user.id); // your existing default
    }
    return user;
  }
}