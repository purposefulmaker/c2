// services/auth-service/src/index.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import passport from 'passport';
import * as AzureAD from 'passport-azure-ad';
const OIDCStrategy: any = (AzureAD as any).OIDCStrategy;
import rateLimit from 'express-rate-limit';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

import { buildPassportConfig, getAzureConfig, setAzureConfig } from './config/azure.js';
import { AuthMiddleware } from './middleware/auth.js';
import { RBACService } from './services/rbac.js';
import { User, AzureProfile, AuthToken, SessionData, ROLES } from './types/auth.js';
import type { Request } from 'express';

const app = express();
const port = process.env.PORT || 8085;
// When running behind a proxy/tunnel (e.g., loca.lt, nginx), trust proxy so rate limit and IPs work.
app.set('trust proxy', true);

// Disable ETag to reduce 304/If-None-Match behavior on simple health checks and auth endpoints
app.set('etag', false);

// Redis for session storage
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: 1 // Use different DB for auth
});

const rbac = RBACService.getInstance();
let currentStrategy: any = null;

function normalizeAzureClaims(claims: any) {
  const roles: string[] = Array.isArray(claims?.roles) ? claims.roles : [];
  const email =
    claims?.preferred_username ||
    claims?.email ||
    claims?.upn ||
    claims?.unique_name ||
    null;

  return {
    sub: claims?.oid,            // stable user id
    tenantId: claims?.tid,
    name: claims?.name || [claims?.given_name, claims?.family_name].filter(Boolean).join(' ') || email,
    email,
    roles
  };
}

async function initPassportStrategy() {
  const cfg = await getAzureConfig(redis);
  if (currentStrategy) {
    // remove existing strategy if present
    // @ts-ignore
    delete (passport as any)._strategies['azuread-openidconnect'];
  }
  // Note: OIDCStrategy verify callback signature when passReqToCallback=true is
  // (req, iss, sub, profile, accessToken, refreshToken, params, done)
  currentStrategy = new OIDCStrategy(buildPassportConfig(cfg), async (
    req: any,
    iss: string,
    sub: string,
    profile: AzureProfile,
    accessToken: string,
    refreshToken: string,
    params: any,
    done: any
  ) => {
    try {
      const claims = (profile as any)?._json || {};
      const userInfo = normalizeAzureClaims(claims);
      // Create or fetch local user by external id (oid) and persist in Redis
  let user: User | null = null;
      const existing = userInfo.sub ? await redis.get(`user:azure:${userInfo.sub}`) : null;
      if (existing) {
        const parsed: User = JSON.parse(existing);
        parsed.last_login = new Date().toISOString();
        if (userInfo.email) parsed.email = userInfo.email;
        if (userInfo.name) parsed.name = userInfo.name;
        user = parsed;
      } else {
        // Pick default role based on admin emails if configured
        const adminSrc = (process.env.ADMIN_EMAILS || (await redis.get('config:admin_emails')) || '').toString();
        const adminEmails = adminSrc.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
        const isAdmin = userInfo.email ? adminEmails.includes(userInfo.email.toLowerCase()) : false;
        const roleName = isAdmin ? ROLES.SUPER_ADMIN : ROLES.VIEWER;
        const permissions = rbac.getDefaultPermissions(roleName);
        user = {
          id: uuidv4(),
          email: userInfo.email || 'unknown@local',
          name: userInfo.name || 'Unknown',
          roles: [{ id: uuidv4(), name: roleName, description: `${roleName} role`, permissions }],
          azure_oid: userInfo.sub || '',
          created_at: new Date().toISOString(),
          last_login: new Date().toISOString(),
          is_active: true,
        } as User;
      }

      // Persist user
      if (user) {
        await redis.set(`user:${user.id}`, JSON.stringify(user));
        if (user.azure_oid) await redis.set(`user:azure:${user.azure_oid}`, JSON.stringify(user));
      }
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
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
    },
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  crossOriginEmbedderPolicy: false,
}));

const allowedOrigins = new Set<string>([
  'http://localhost:3000',
  'http://localhost:3006',
  process.env.FRONTEND_URL || 'http://localhost:3006',
]);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    // Allow exact matches in the allowlist
    if (allowedOrigins.has(origin)) return cb(null, true);
    // Allow any loca.lt subdomain (used by localtunnel)
    try {
      const u = new URL(origin);
      if (u.protocol === 'https:' && u.hostname.endsWith('.loca.lt')) {
        return cb(null, true);
      }
    } catch {}
    return cb(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting - MUCH more permissive for development
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per window (was 10)
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
  skip: (req) => {
    // Skip rate limiting in development for local IPs
    if (process.env.NODE_ENV === 'development') {
      const ip = req.ip || req.connection.remoteAddress || '';
      if (ip.includes('127.0.0.1') || ip.includes('::1') || ip.includes('localhost')) {
        return true;
      }
    }
    return false;
  }
});

// Apply to auth routes only (was applying to all routes)
app.use('/auth', limiter);
app.use('/setup', limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'default-session-secret',
  resave: false,
  saveUninitialized: true, // CHANGE: Need to save the session before redirect
  proxy: true,
  cookie: {
    secure: process.env.AUTH_PUBLIC_URL?.startsWith('https'), // Only secure for HTTPS
    sameSite: process.env.AUTH_PUBLIC_URL?.startsWith('https') ? 'none' : 'lax', // CHANGE: 'none' for cross-site
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    domain: undefined // Let Express figure it out
  },
  name: 'c2auth.sid' // Custom session name to avoid conflicts
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

// Friendly landing page for root requests (useful when hitting the tunnel root)
app.get('/', (req, res) => {
  res.type('html').send(
    `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>C2 Auth Service</title>
        <style>
          body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, 'Helvetica Neue', Arial, 'Noto Sans', 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'; padding: 2rem; line-height: 1.5; }
          code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; }
          a { color: #2563eb; text-decoration: none; }
          a:hover { text-decoration: underline; }
          .links { margin-top: 1rem; }
        </style>
      </head>
      <body>
        <h1>🔐 C2 Auth Service</h1>
        <p>Service is running. Useful links:</p>
        <div class="links">
          <div>• <a href="/health">Health check</a></div>
          <div>• <a href="/auth/azure">Sign in with Azure</a></div>
          <div>• <a href="/auth/azure/force">Force sign-in (prompt=login)</a></div>
          <div>• <a href="/auth/clear">Clear local session</a></div>
        </div>
      </body>
    </html>`
  );
});

// Avoid noisy 404s for favicon
app.get('/favicon.ico', (_req, res) => res.status(204).end());

// Health check
app.get('/health', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'c2-auth-service'
  });
});

// Authentication routes
app.get('/auth/azure', passport.authenticate('azuread-openidconnect'));

// Force Azure to show the login prompt and bypass any cached session at Microsoft
app.get('/auth/azure/force', (req, res, next) => {
  // Inject extra query to force login. passport-azure-ad forwards 'prompt' to Azure.
  (req as any).query = { ...(req as any).query, prompt: 'login' };
  return (passport.authenticate('azuread-openidconnect') as any)(req, res, next);
});

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
      // Include refresh token so the frontend can refresh sessions gracefully
      res.redirect(`${frontendUrl}/auth/callback?token=${token}&refresh=${sessionId}`);
      
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
    if (token) await AuthMiddleware.blacklistToken(token);
    const decoded = token ? (jwt.decode(token) as any) : null;
    if (decoded?.session_id) await redis.del(`session:${decoded.session_id}`);
    if (req.session) req.session.destroy(() => {});
    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Browser-friendly logout with optional global Microsoft sign-out
// GET /auth/logout?global=true&redirect=http://localhost:3006
app.get('/auth/logout', async (req: any, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (token) await AuthMiddleware.blacklistToken(token);
    const decoded = token ? (jwt.decode(token) as any) : null;
    if (decoded?.session_id) await redis.del(`session:${decoded.session_id}`);
    if (req.session) req.session.destroy(() => {});

    const frontendUrl = (req.query.redirect as string) || process.env.FRONTEND_URL || 'http://localhost:3006';
    const cfg = await getAzureConfig(redis);
    const doGlobal = String(req.query.global || '').toLowerCase() === 'true';
    if (doGlobal) {
      const postLogout = encodeURIComponent(frontendUrl);
      return res.redirect(`${cfg.authority}/oauth2/v2.0/logout?post_logout_redirect_uri=${postLogout}`);
    }
    return res.redirect(frontendUrl);
  } catch (e) {
    console.error('Browser logout error:', e);
    res.status(500).type('html').send('<p>Logout failed</p>');
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

// Error handler with HTML fallback
app.get('/auth/error', (req, res) => {
  const acceptsHtml = (req.headers.accept || '').includes('text/html');
  if (acceptsHtml) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3006';
    const localLoginLink = process.env.ENABLE_LOCAL_LOGIN === 'true' ? '<div>• <a href="/auth/local">Use local dev login</a></div>' : '';
    return res.status(401).type('html').send(`<!doctype html>
      <html><head><meta charset="utf-8"/><title>Auth Error</title>
      <style>body{font-family:system-ui;padding:2rem}</style></head>
      <body>
        <h1>Authentication failed</h1>
        <p>Try again or force a fresh sign-in.</p>
        <div>• <a href="/auth/azure">Sign in</a></div>
        <div>• <a href="/auth/azure/force">Force sign-in</a></div>
        <div>• <a href="/auth/logout?global=true&redirect=${encodeURIComponent(frontendUrl)}">Global sign-out</a></div>
        ${localLoginLink}
        <div style="margin-top:1rem">• <a href="/">Back</a></div>
      </body></html>`);
  }
  res.status(401).json({ error: 'Authentication failed' });
});

// Clear local server-side session (useful in dev when flows feel sticky)
app.get('/auth/clear', (req: any, res) => {
  try {
    if (req.session) {
      req.session.destroy(() => {
        res.type('html').send('<p>Local session cleared. <a href="/">Back</a></p>');
      });
      return;
    }
    res.type('html').send('<p>No session to clear. <a href="/">Back</a></p>');
  } catch (e) {
    res.status(500).type('html').send('<p>Failed to clear session. <a href="/">Back</a></p>');
  }
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

// Dev-only Local Login (enabled via ENABLE_LOCAL_LOGIN=true)
app.get('/auth/local', (req, res) => {
  if (process.env.ENABLE_LOCAL_LOGIN !== 'true') return res.status(404).send('Not found');
  res.type('html').send(`<!doctype html>
  <html><head><meta charset="utf-8"/><title>Local Login</title>
  <style>body{font-family:system-ui;padding:2rem}label{display:block;margin:.5rem 0}</style></head>
  <body>
    <h1>Local Dev Login</h1>
    <form method="post" action="/auth/local">
      <label>Name <input name="name" required/></label>
      <label>Email <input name="email" type="email" required/></label>
      <label>Role
        <select name="role">
          <option value="viewer">viewer</option>
          <option value="operator">operator</option>
          <option value="system_admin">system_admin</option>
          <option value="super_admin">super_admin</option>
        </select>
      </label>
      <button type="submit">Sign In</button>
    </form>
  </body></html>`);
});

app.post('/auth/local', async (req: any, res) => {
  if (process.env.ENABLE_LOCAL_LOGIN !== 'true') return res.status(404).json({ error: 'Not found' });
  try {
    const name = (req.body?.name || '').toString();
    const email = (req.body?.email || '').toString();
    const roleName = (req.body?.role || 'viewer').toString();
    if (!name || !email) return res.status(400).json({ error: 'Name and email required' });

    const permissions = rbac.getDefaultPermissions(roleName);
    const user: User = {
      id: uuidv4(),
      email,
      name,
      roles: [{ id: uuidv4(), name: roleName, description: `${roleName} role`, permissions }],
      azure_oid: '',
      created_at: new Date().toISOString(),
      last_login: new Date().toISOString(),
      is_active: true,
    };
    await redis.set(`user:${user.id}`, JSON.stringify(user));

    const sessionId = uuidv4();
    const sessionData: SessionData = {
      user_id: user.id,
      azure_oid: '',
      roles: user.roles.map(r => r.name),
      issued_at: Date.now(),
      expires_at: Date.now() + (24 * 60 * 60 * 1000),
    };
    await redis.setex(`session:${sessionId}`, 24 * 60 * 60, JSON.stringify(sessionData));
    const token = jwt.sign({ session_id: sessionId, user_id: user.id, roles: sessionData.roles }, process.env.JWT_SECRET || 'default-secret', { expiresIn: '24h' });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3006';
    return res.redirect(`${frontendUrl}/auth/callback?token=${token}&refresh=${sessionId}`);
  } catch (e) {
    console.error('Local login error:', e);
    return res.status(500).json({ error: 'Local login failed' });
  }
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