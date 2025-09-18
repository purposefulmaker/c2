# Deploy C2 Platform to Fly.io

## Project Structure for Fly

```
c2-platform-fly/
├── apps/
│   ├── bun-websocket/      # Bun WebSocket server
│   ├── api/                # Main API backend
│   ├── onvif-wrapper/      # ONVIF camera service
│   └── web/                # Frontend from v0
├── fly.toml                # Main orchestration
├── docker-compose.local.yml # Local testing
└── deploy.sh               # Deployment script
```

## Step 1: Install Fly CLI

```bash
# macOS
brew install flyctl

# Linux
curl -L https://fly.io/install.sh | sh

# Windows
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"

# Login
fly auth login
```

## Step 2: Create Fly Apps

```bash
# Create all apps (run once)
fly apps create c2-platform-api
fly apps create c2-platform-ws
fly apps create c2-platform-onvif
fly apps create c2-platform-web

# Create databases
fly postgres create --name c2-platform-db --region sjc
fly redis create --name c2-platform-redis --region sjc
```

## Step 3: Bun WebSocket Service

```toml
# apps/bun-websocket/fly.toml
app = "c2-platform-ws"
primary_region = "sjc"
kill_signal = "SIGINT"
kill_timeout = 5

[build]
  dockerfile = "Dockerfile"

[env]
  PORT = "8080"
  NODE_ENV = "production"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 1

[[services]]
  protocol = "tcp"
  internal_port = 8080
  
  [[services.ports]]
    port = 80
    handlers = ["http"]
    
  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]

[[services]]
  protocol = "udp"
  internal_port = 4001
  
  [[services.ports]]
    port = 4001
```

```dockerfile
# apps/bun-websocket/Dockerfile
FROM oven/bun:1-alpine

WORKDIR /app

COPY package.json bun.lockb ./
RUN bun install --production

COPY . .

EXPOSE 8080 4001

CMD ["bun", "run", "src/index.ts"]
```

```typescript
// apps/bun-websocket/src/index.ts
import { serve } from "bun";

const REDIS_URL = process.env.REDIS_URL || "redis://default:password@c2-platform-redis.internal:6379";
const PORT = process.env.PORT || 8080;

const server = serve({
  port: PORT,
  
  fetch(req, server) {
    const url = new URL(req.url);
    
    // Health check for Fly
    if (url.pathname === "/health") {
      return new Response("OK");
    }
    
    // WebSocket upgrade
    if (req.headers.get("upgrade") === "websocket") {
      const success = server.upgrade(req);
      if (!success) {
        return new Response("WebSocket upgrade failed", { status: 400 });
      }
      return;
    }

    // Test trigger endpoint
    if (url.pathname === "/api/trigger" && req.method === "POST") {
      // Broadcast test event
      const event = {
        type: "gunshot",
        confidence: 0.95,
        location: { lat: 37.7749, lon: -122.4194 },
        timestamp: new Date().toISOString()
      };
      
      // Broadcast to all WebSocket clients
      server.publish("events", JSON.stringify(event));
      
      return Response.json({ status: "triggered", event });
    }

    return new Response("C2 WebSocket Server on Fly.io");
  },

  websocket: {
    open(ws) {
      ws.subscribe("events");
      console.log("Client connected");
      ws.send(JSON.stringify({ type: "connected", timestamp: new Date() }));
    },
    
    message(ws, message) {
      // Handle incoming messages
      const data = JSON.parse(message.toString());
      console.log("Received:", data);
      
      // Broadcast to all subscribers
      server.publish("events", message);
    },
    
    close(ws) {
      ws.unsubscribe("events");
      console.log("Client disconnected");
    }
  }
});

console.log(`Bun WebSocket server running on port ${server.port}`);

// UDP listener for Boomerang (if needed)
const udpSocket = Bun.udpSocket({
  port: 4001,
  handler: {
    data(socket, buf, port, addr) {
      console.log(`UDP data from ${addr}:${port}`);
      // Process Boomerang data
      server.publish("events", JSON.stringify({
        type: "boomerang",
        source: "udp",
        data: buf.toString(),
        from: addr
      }));
    }
  }
});
```

## Step 4: Main API Service

```toml
# apps/api/fly.toml
app = "c2-platform-api"
primary_region = "sjc"

[build]
  dockerfile = "Dockerfile"

[env]
  PORT = "8080"
  NODE_ENV = "production"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 1

[[services]]
  protocol = "tcp"
  internal_port = 8080
  
  [[services.ports]]
    port = 80
    handlers = ["http"]
    
  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]

[mounts]
  source = "c2_data"
  destination = "/data"
```

```dockerfile
# apps/api/Dockerfile
FROM node:20-alpine

WORKDIR /app

# Install Python and build dependencies for node-gyp
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --production

COPY . .

EXPOSE 8080

CMD ["node", "src/index.js"]
```

```javascript
// apps/api/src/index.js
import express from 'express';
import { createClient } from 'redis';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// Connect to Fly Redis
const redis = createClient({
  url: process.env.REDIS_URL || 'redis://default:password@c2-platform-redis.internal:6379'
});

await redis.connect();

// Connect to Fly Postgres
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date() });
});

// Get zones
app.get('/api/zones', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM zones');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create zone
app.post('/api/zones', async (req, res) => {
  const { name, type, polygon, day_spl, night_spl } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO zones (name, type, polygon, day_spl, night_spl) 
       VALUES ($1, $2, ST_GeomFromGeoJSON($3), $4, $5) 
       RETURNING *`,
      [name, type, JSON.stringify(polygon), day_spl, night_spl]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get events
app.get('/api/events', async (req, res) => {
  try {
    const events = await redis.lRange('events:recent', 0, 99);
    res.json(events.map(e => JSON.parse(e)));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get cameras (mock for now)
app.get('/api/cameras', async (req, res) => {
  res.json([
    { id: 'cam_001', name: 'North Gate', status: 'online', ptz: true },
    { id: 'cam_002', name: 'South Fence', status: 'online', ptz: false },
    { id: 'cam_003', name: 'East Tower', status: 'online', ptz: true },
    { id: 'cam_004', name: 'West Entrance', status: 'offline', ptz: false }
  ]);
});

// LRAD control
app.post('/api/lrad/activate', async (req, res) => {
  const { duration, pattern, spl } = req.body;
  
  // Log activation
  await redis.lPush('lrad:activations', JSON.stringify({
    duration,
    pattern,
    spl,
    timestamp: new Date()
  }));
  
  res.json({ status: 'activated', duration, pattern, spl });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});
```

## Step 5: Frontend Deployment

```toml
# apps/web/fly.toml
app = "c2-platform-web"
primary_region = "sjc"

[build]
  dockerfile = "Dockerfile"

[env]
  PORT = "8080"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 1

[[services]]
  protocol = "tcp"
  internal_port = 8080
  
  [[services.ports]]
    port = 80
    handlers = ["http"]
    
  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]
```

```dockerfile
# apps/web/Dockerfile
FROM node:20-alpine as builder

WORKDIR /app

# Copy your v0 generated code
COPY package*.json ./
RUN npm ci

COPY . .

# Build with production API URLs
ENV NEXT_PUBLIC_API_URL=https://c2-platform-api.fly.dev
ENV NEXT_PUBLIC_WS_URL=wss://c2-platform-ws.fly.dev

RUN npm run build

# Production image
FROM node:20-alpine
WORKDIR /app

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 8080
ENV PORT=8080

CMD ["npm", "start"]
```

## Step 6: Deploy Script

```bash
#!/bin/bash
# deploy.sh - Deploy everything to Fly

echo "🚀 Deploying C2 Platform to Fly.io..."

# Set secrets
fly secrets set DATABASE_URL="$(fly postgres attach c2-platform-db --app c2-platform-api)" --app c2-platform-api
fly secrets set REDIS_URL="redis://default:$(fly redis status c2-platform-redis --json | jq -r .password)@c2-platform-redis.internal:6379" --app c2-platform-api

# Deploy services
echo "📡 Deploying WebSocket service..."
cd apps/bun-websocket
fly deploy

echo "🔧 Deploying API service..."
cd ../api
fly deploy

echo "🌐 Deploying Web frontend..."
cd ../web
fly deploy

echo "✅ Deployment complete!"
echo ""
echo "Your C2 Platform is live at:"
echo "  Web:       https://c2-platform-web.fly.dev"
echo "  API:       https://c2-platform-api.fly.dev"
echo "  WebSocket: wss://c2-platform-ws.fly.dev"
echo ""
echo "Test with:"
echo "  curl -X POST https://c2-platform-ws.fly.dev/api/trigger"
```

## Step 7: Initialize Database

```sql
-- Connect to Fly Postgres and run:
fly postgres connect -a c2-platform-db

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE zones (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    type VARCHAR(50),
    polygon GEOMETRY(Polygon, 4326),
    day_spl INTEGER DEFAULT 95,
    night_spl INTEGER DEFAULT 85,
    auto_response BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    event_id UUID DEFAULT gen_random_uuid(),
    type VARCHAR(50),
    confidence FLOAT,
    location GEOMETRY(Point, 4326),
    data JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Insert test zone
INSERT INTO zones (name, type, polygon, day_spl, night_spl) VALUES 
('Red Zone', 'red', ST_GeomFromText('POLYGON((-122.42 37.77, -122.41 37.77, -122.41 37.78, -122.42 37.78, -122.42 37.77))', 4326), 95, 85);
```

## Step 8: Complete Deployment

```bash
# Make deploy script executable
chmod +x deploy.sh

# Run deployment
./deploy.sh

# Check status
fly status --app c2-platform-api
fly status --app c2-platform-ws
fly status --app c2-platform-web

# View logs
fly logs --app c2-platform-api
fly logs --app c2-platform-ws

# Scale if needed
fly scale count 2 --app c2-platform-api
```

## Environment Variables to Set

```bash
# Set all secrets at once
fly secrets set \
  JWT_SECRET="your-secret-key-here" \
  NODE_ENV="production" \
  --app c2-platform-api

fly secrets set \
  NEXT_PUBLIC_API_URL="https://c2-platform-api.fly.dev" \
  NEXT_PUBLIC_WS_URL="wss://c2-platform-ws.fly.dev" \
  --app c2-platform-web
```

## Your Live URLs

After deployment, your system will be available at:

- **Web Dashboard**: https://c2-platform-web.fly.dev
- **API**: https://c2-platform-api.fly.dev
- **WebSocket**: wss://c2-platform-ws.fly.dev
- **Health Check**: https://c2-platform-api.fly.dev/health

## Cost on Fly.io

For this setup:
- **Free tier**: 3 shared-cpu-1x VMs (enough to start)
- **Postgres**: Free 256MB development database
- **Redis**: Free 100MB Redis instance
- **Total**: $0/month to start, ~$25/month for production

## Monitoring

```bash
# View metrics
fly dashboard --app c2-platform-api

# SSH into container
fly ssh console --app c2-platform-api

# Check Redis
fly redis connect --app c2-platform-redis
```
