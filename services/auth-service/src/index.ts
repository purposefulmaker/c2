// services/auth-service/src/index.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import passport from 'passport';
import { Strategy as OIDCStrategy } from 'passport-azure-ad';
import rateLimit from 'express-rate-limit';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

import { buildPassportConfig, getAzureConfig, setAzureConfig } from './config/azure.js';
import { AuthMiddleware } from './middleware/auth.js';
import { RBACService } from './services/rbac.js';
import { User, AzureProfile, AuthToken, SessionData, ROLES } from './types/auth.js';

const app = express();
const port = process.env.PORT || 8085;

// Redis for session storage
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: 1 // Use different DB for auth
});

const rbac = RBACService.getInstance();
let currentStrategy: any = null;

async function initPassportStrategy() {
  const cfg = await getAzureConfig(redis);
  if (currentStrategy) {
    // remove existing strategy if present
    // @ts-ignore
    delete (passport as any)._strategies['azuread-openidconnect'];
  }
  currentStrategy = new OIDCStrategy(buildPassportConfig(cfg), async (req: any, profile: AzureProfile, done: any) => {
    try {
      const email = (profile as any).email || (profile as any).preferred_username || (profile as any)._json?.email || (profile as any)._json?.upn;
      console.log('Azure authentication successful for:', email);
      
      // Pull groups/roles from Azure claims if present
      const azureGroups: string[] = ((profile as any)._json?.groups) || [];
      const azureRoles: string[] = ((profile as any)._json?.roles) || [];

      // Check if user exists
      let userData = await redis.get(`user:azure:${profile.oid}`);
      let user: User;
      
      if (userData) {
        user = JSON.parse(userData);
        // Update last login
        user.last_login = new Date().toISOString();
      } else {
        // Create new user with default role
        user = rbac.createUserWithDefaultRole(profile, ROLES.VIEWER);
        // Elevate to SUPER_ADMIN if matches bootstrap emails
        const adminList = (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
        if (adminList.length && email && adminList.includes(String(email).toLowerCase())) {
          user.roles = [{
            id: uuidv4(),
            name: ROLES.SUPER_ADMIN,
            description: 'Bootstrap Super Admin',
            permissions: rbac.getDefaultPermissions(ROLES.SUPER_ADMIN)
          }];
        }
        console.log('Created new user:', email);
      }
      
      // Apply role mappings from Azure groups/roles if configured
      try {
        const raw = await redis.get('config:azure:role_mappings');
        if (raw) {
          const mappings: Array<{ azureGroupId?: string; azureRole?: string; roleName: string }> = JSON.parse(raw);
          const matchedRoleNames = new Set<string>();
          for (const m of mappings) {
            if ((m.azureGroupId && azureGroups.includes(m.azureGroupId)) || (m.azureRole && azureRoles.includes(m.azureRole))) {
              matchedRoleNames.add(m.roleName);
            }
          }
          if (matchedRoleNames.size > 0) {
            user.roles = Array.from(matchedRoleNames).map((name) => ({
              id: uuidv4(),
              name,
              description: `${name} via Azure mapping`,
              permissions: rbac.getDefaultPermissions(name)
            }));
          }
        }
      } catch (e) {
        console.warn('Role mapping parse failed:', e);
      }

      // Store/update user in Redis
      await redis.set(`user:${user.id}`, JSON.stringify(user));
      await redis.set(`user:azure:${profile.oid}`, JSON.stringify(user));
      
      return done(null, user);
    } catch (error) {
      console.error('Authentication error:', error);
      return done(error);
    }
  });
  passport.use(currentStrategy);
}

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  message: { error: 'Too many authentication attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/auth', authLimiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'default-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// Initialize strategy on boot (no top-level await in CJS)
initPassportStrategy().catch((e) => console.error('Failed to init Azure strategy:', e));

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const userData = await redis.get(`user:${id}`);
    if (userData) {
      done(null, JSON.parse(userData));
    } else {
      done(new Error('User not found'));
    }
  } catch (error) {
    done(error);
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'c2-auth-service'
  });
});

// Authentication routes
app.get('/auth/azure', passport.authenticate('azuread-openidconnect'));

app.post('/auth/azure/callback', 
  passport.authenticate('azuread-openidconnect', { failureRedirect: '/auth/error' }),
  async (req, res) => {
    try {
      const user = req.user as User;
      
      // Create session
      const sessionId = uuidv4();
      const sessionData: SessionData = {
        user_id: user.id,
        azure_oid: user.azure_oid,
        roles: user.roles.map(r => r.name),
        issued_at: Date.now(),
        expires_at: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
      };
      
      await redis.setex(`session:${sessionId}`, 24 * 60 * 60, JSON.stringify(sessionData));
      
      // Generate JWT token
      const token = jwt.sign(
        { 
          session_id: sessionId,
          user_id: user.id,
          roles: user.roles.map(r => r.name)
        },
        process.env.JWT_SECRET || 'default-secret',
        { expiresIn: '24h' }
      );
      
      const authResponse: AuthToken = {
        access_token: token,
        refresh_token: sessionId,
        expires_in: 24 * 60 * 60,
        token_type: 'Bearer',
        user: {
          ...user,
          // Don't send sensitive data to frontend
          azure_oid: undefined as any
        }
      };
      
      // Redirect to frontend with token
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
      
    } catch (error) {
      console.error('Callback error:', error);
      res.status(500).json({ error: 'Authentication failed' });
    }
  }
);

// Token refresh
app.post('/auth/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;
    
    if (!refresh_token) {
      return res.status(400).json({ error: 'Refresh token required' });
    }
    
    const sessionData = await redis.get(`session:${refresh_token}`);
    if (!sessionData) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    
    const session: SessionData = JSON.parse(sessionData);
    
    // Check if session is expired
    if (Date.now() > session.expires_at) {
      await redis.del(`session:${refresh_token}`);
      return res.status(401).json({ error: 'Session expired' });
    }
    
    // Get fresh user data
    const userData = await redis.get(`user:${session.user_id}`);
    if (!userData) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    const user: User = JSON.parse(userData);
    
    if (!user.is_active) {
      return res.status(401).json({ error: 'User account is disabled' });
    }
    
    // Extend session
    session.expires_at = Date.now() + (24 * 60 * 60 * 1000);
    await redis.setex(`session:${refresh_token}`, 24 * 60 * 60, JSON.stringify(session));
    
    // Generate new access token
    const token = jwt.sign(
      { 
        session_id: refresh_token,
        user_id: user.id,
        roles: user.roles.map(r => r.name)
      },
      process.env.JWT_SECRET || 'default-secret',
      { expiresIn: '24h' }
    );
    
    const authResponse: AuthToken = {
      access_token: token,
      refresh_token: refresh_token,
      expires_in: 24 * 60 * 60,
      token_type: 'Bearer',
      user: {
        ...user,
        azure_oid: undefined as any
      }
    };
    
    res.json(authResponse);
    
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// Logout
app.post('/auth/logout', (AuthMiddleware.authenticateToken as any), async (req: any, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.slice(7);
    
    if (token) {
      await AuthMiddleware.blacklistToken(token);
    }
    // Remove the session by session_id inside the token
    if (req.session_data) {
      const decoded = jwt.decode(token) as any;
      if (decoded?.session_id) {
        await redis.del(`session:${decoded.session_id}`);
      }
    }
    
    res.json({ message: 'Logout successful' });
    
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// User profile
app.get('/auth/profile', (AuthMiddleware.authenticateToken as any), (req: express.Request, res: express.Response) => {
  const user = req.user as User;
  res.json({
    user: {
      ...user,
      azure_oid: undefined
    }
  });
});

// Error handler
app.get('/auth/error', (req, res) => {
  res.status(401).json({ error: 'Authentication failed' });
});

// Setup status endpoint
app.get('/setup/status', async (req, res) => {
  const cfg = await getAzureConfig(redis);
  const setupComplete = !!(await redis.get('setup:complete'));
  res.json({
    setupComplete,
    hasClientId: !!cfg.clientId,
    hasTenantId: !!cfg.tenantId,
    redirectUri: cfg.redirectUri
  });
});

// One-time secure setup endpoint to configure Azure OIDC before SSO is usable
app.post('/setup/azure', async (req, res) => {
  try {
    const provided = req.headers['x-setup-token'] || req.query.token || req.body?.token;
    const setupToken = process.env.SETUP_TOKEN;
    if (!setupToken || !provided || String(provided) !== setupToken) {
      return res.status(401).json({ error: 'Unauthorized setup' });
    }
    const setupComplete = await redis.get('setup:complete');
    if (setupComplete && process.env.ALLOW_SETUP_RECONFIG !== 'true') {
      return res.status(409).json({ error: 'Setup already completed' });
    }

    const { clientId, clientSecret, tenantId, redirectUri, scopes, roleMappings, adminEmails } = req.body || {};
    if (!clientId || !tenantId) {
      return res.status(400).json({ error: 'clientId and tenantId are required' });
    }

    // Save Azure config
    const updated = await setAzureConfig(redis, { clientId, clientSecret, tenantId, redirectUri, scopes });
    // Save role mappings if provided
    if (Array.isArray(roleMappings)) {
      await redis.set('config:azure:role_mappings', JSON.stringify(roleMappings));
    }
    // Save admin emails if provided
    if (typeof adminEmails === 'string') {
      // store in Redis for visibility; env ADMIN_EMAILS also works
      await redis.set('config:admin_emails', adminEmails);
    }

    await initPassportStrategy();
    await redis.set('setup:complete', '1');
    res.json({ message: 'Azure SSO configured', config: {
      clientId: updated.clientId,
      tenantId: updated.tenantId,
      redirectUri: updated.redirectUri,
      scopes: updated.scopes
    }});
  } catch (e) {
    console.error('Setup error:', e);
    res.status(500).json({ error: 'Failed to perform setup' });
  }
});

// Admin endpoints to manage role mappings for Azure groups/roles
app.get('/admin/sso/role-mappings',
  (AuthMiddleware.authenticateToken as any),
  (AuthMiddleware.requirePermission('system', 'config') as any),
  async (req, res) => {
    const raw = await redis.get('config:azure:role_mappings');
    res.json({ mappings: raw ? JSON.parse(raw) : [] });
  }
);

app.put('/admin/sso/role-mappings',
  (AuthMiddleware.authenticateToken as any),
  (AuthMiddleware.requirePermission('system', 'config') as any),
  async (req, res) => {
    try {
      const body = req.body;
      if (!Array.isArray(body)) {
        return res.status(400).json({ error: 'Expected an array of mappings' });
      }
      // Basic validation
      for (const m of body) {
        if (!m || !m.roleName) {
          return res.status(400).json({ error: 'Each mapping must include roleName' });
        }
      }
      await redis.set('config:azure:role_mappings', JSON.stringify(body));
      res.json({ message: 'Role mappings updated' });
    } catch (e) {
      console.error('Role mapping update error:', e);
      res.status(500).json({ error: 'Failed to update role mappings' });
    }
  }
);
// Admin endpoints to view/update Azure OIDC config
app.get('/admin/sso/config',
  (AuthMiddleware.authenticateToken as any),
  (AuthMiddleware.requirePermission('system', 'config') as any),
  async (req, res) => {
    const cfg = await getAzureConfig(redis);
    // Do not expose clientSecret
    res.json({
      clientId: cfg.clientId,
      tenantId: cfg.tenantId,
      redirectUri: cfg.redirectUri,
      scopes: cfg.scopes,
      authority: cfg.authority
    });
  }
);

app.put('/admin/sso/config',
  (AuthMiddleware.authenticateToken as any),
  (AuthMiddleware.requirePermission('system', 'config') as any),
  async (req, res) => {
    try {
      const { clientId, clientSecret, tenantId, redirectUri, scopes } = req.body || {};
      const updated = await setAzureConfig(redis, {
        clientId, clientSecret, tenantId, redirectUri, scopes
      });
      // Reinitialize strategy with new config
      await initPassportStrategy();
      res.json({ message: 'SSO configuration updated', config: {
        clientId: updated.clientId,
        tenantId: updated.tenantId,
        redirectUri: updated.redirectUri,
        scopes: updated.scopes,
        authority: updated.authority
      }});
    } catch (e) {
      console.error('SSO config update error:', e);
      res.status(500).json({ error: 'Failed to update SSO configuration' });
    }
  }
);

// Admin routes - User management
app.get('/admin/users', 
  (AuthMiddleware.authenticateToken as any),
  (AuthMiddleware.requirePermission('users', 'read') as any),
  async (req: any, res) => {
    try {
      const pattern = 'user:*';
      const keys = await redis.keys(pattern);
      const users = [];
      
      for (const key of keys) {
        if (!key.includes('azure:')) {
          const userData = await redis.get(key);
          if (userData) {
            const user = JSON.parse(userData);
            users.push({
              ...user,
              azure_oid: undefined // Don't expose Azure OID
            });
          }
        }
      }
      
      res.json({ users });
    } catch (error) {
      console.error('Users fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  }
);

app.put('/admin/users/:userId/role',
  (AuthMiddleware.authenticateToken as any),
  (AuthMiddleware.requirePermission('users', 'write') as any),
  async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { role } = req.body;
      
      // Validate role assignment permissions
      const currentUserRoles = req.user.roles.map((r: any) => r.name);
      if (!rbac.validateRoleAssignment(currentUserRoles, role)) {
        return res.status(403).json({ error: 'Insufficient permissions to assign this role' });
      }
      
      const userData = await redis.get(`user:${userId}`);
      if (!userData) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const user: User = JSON.parse(userData);
      
      // Update user role
      user.roles = [{
        id: uuidv4(),
        name: role,
        description: `${role} role`,
        permissions: rbac.getDefaultPermissions(role)
      }];
      
      await redis.set(`user:${userId}`, JSON.stringify(user));
      await redis.set(`user:azure:${user.azure_oid}`, JSON.stringify(user));
      
      // Revoke all existing sessions to force re-authentication
      await AuthMiddleware.revokeAllUserSessions(userId);
      
      res.json({ message: 'User role updated successfully' });
      
    } catch (error) {
      console.error('Role update error:', error);
      res.status(500).json({ error: 'Failed to update user role' });
    }
  }
);

app.put('/admin/users/:userId/status',
  (AuthMiddleware.authenticateToken as any),
  (AuthMiddleware.requirePermission('users', 'write') as any),
  async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { is_active } = req.body;
      
      const userData = await redis.get(`user:${userId}`);
      if (!userData) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const user: User = JSON.parse(userData);
      user.is_active = is_active;
      
      await redis.set(`user:${userId}`, JSON.stringify(user));
      await redis.set(`user:azure:${user.azure_oid}`, JSON.stringify(user));
      
      // If deactivating user, revoke all sessions
      if (!is_active) {
        await AuthMiddleware.revokeAllUserSessions(userId);
      }
      
      res.json({ message: 'User status updated successfully' });
      
    } catch (error) {
      console.error('Status update error:', error);
      res.status(500).json({ error: 'Failed to update user status' });
    }
  }
);

app.listen(port, () => {
  console.log(`🔐 C2 Auth Service running on port ${port}`);
  console.log(`🌐 Health check: http://localhost:${port}/health`);
  console.log(`🚀 Azure login: http://localhost:${port}/auth/azure`);
});