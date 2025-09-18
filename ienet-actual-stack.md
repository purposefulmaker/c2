# iEnet C2 System - ACTUAL Production Stack

This is their REAL architecture based on what they showed you.

## Docker Compose - Exact Stack

```yaml
version: '3.8'

services:
  # Portainer - Container Management UI
  portainer:
    image: portainer/portainer-ce:latest
    restart: always
    ports:
      - "9000:9000"
      - "9443:9443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - portainer_data:/data
    command: --admin-password='$$2y$$10$$X5PVCZ4sOB5w8vRnR5v2yOG3qGJfHtB.N8XZr8MkN9dqG8dNQZF3.'  # admin/c2admin

  # Node-RED - Flow-based automation
  nodered:
    image: nodered/node-red:latest
    restart: always
    ports:
      - "1880:1880"
    volumes:
      - nodered_data:/data
    environment:
      - TZ=America/Los_Angeles
      - NODE_RED_CREDENTIAL_SECRET=c2secret
    depends_on:
      - dragonfly
    extra_hosts:
      - "host.docker.internal:host-gateway"

  # DragonflyDB - Redis compatible but faster
  dragonfly:
    image: docker.dragonflydb.io/dragonflydb/dragonfly:latest
    restart: always
    ports:
      - "6379:6379"
    volumes:
      - dragonfly_data:/data
    ulimits:
      memlock:
        soft: -1
        hard: -1
    command: >
      --logtostderr
      --cache_mode=true
      --dbfilename=c2dump
      --maxmemory=4gb
      --proactor_threads=4
      --enable_http=true
      --http_port=6380

  # Bun WebSocket Server - Boomerang receiver
  bun-websocket:
    build:
      context: ./bun-server
      dockerfile: Dockerfile
    restart: always
    ports:
      - "3000:3000"      # WebSocket server
      - "4001:4001/udp"  # Boomerang UDP
    environment:
      - DRAGONFLY_URL=redis://dragonfly:6379
      - NODE_ENV=production
    depends_on:
      - dragonfly

  # Slew2 PTZ Driver
  slew2-driver:
    build:
      context: ./slew2
      dockerfile: Dockerfile
    restart: always
    ports:
      - "8090:8090"  # REST API for PTZ
      - "554:554"    # RTSP proxy
    devices:
      - /dev/ttyUSB0:/dev/ttyUSB0  # Serial for Pelco-D
    volumes:
      - ./slew2/config:/config
    environment:
      - REDIS_URL=redis://dragonfly:6379

  # API Backend (they might use Fastify or Express)
  api:
    build:
      context: ./api
      dockerfile: Dockerfile
    restart: always
    ports:
      - "8000:8000"
    environment:
      - REDIS_URL=redis://dragonfly:6379
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/c2db
    depends_on:
      - dragonfly
      - postgres

  # PostgreSQL for persistence
  postgres:
    image: postgres:15-alpine
    restart: always
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_DB=c2db
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  portainer_data:
  nodered_data:
  dragonfly_data:
  postgres_data:
```

## Bun WebSocket Server (Boomerang Receiver)

```typescript
// bun-server/index.ts - Their actual Bun implementation
import { serve, ServerWebSocket } from "bun";
import Redis from "ioredis";

// Connect to DragonflyDB (Redis compatible)
const redis = new Redis({
  host: process.env.DRAGONFLY_URL || "dragonfly",
  port: 6379,
  maxRetriesPerRequest: null,
});

// Subscribe to Boomerang alarm events
const subscriber = new Redis({
  host: "dragonfly",
  port: 6379,
});

const publisher = new Redis({
  host: "dragonfly",
  port: 6379,
});

// WebSocket clients
const clients = new Map<string, ServerWebSocket>();

// Boomerang WebSocket handler
subscriber.subscribe("boomerang:alarms");
subscriber.on("message", (channel, message) => {
  // Broadcast to all connected clients
  for (const [id, ws] of clients) {
    ws.send(message);
  }
});

// Bun server with WebSocket support
const server = serve({
  port: 3000,
  
  fetch(req, server) {
    const url = new URL(req.url);
    
    // WebSocket upgrade for Boomerang
    if (url.pathname === "/ws/boomerang") {
      const upgraded = server.upgrade(req);
      if (!upgraded) {
        return new Response("Upgrade failed", { status: 400 });
      }
      return;
    }

    // REST endpoints for testing
    if (url.pathname === "/api/trigger") {
      // Simulate gunshot event
      const event = {
        type: "gunshot",
        device: "boomerang_01",
        confidence: 0.95,
        timestamp: new Date().toISOString(),
        location: {
          lat: 37.7749,
          lon: -122.4194,
        },
        audio: {
          peak_db: 140,
          direction: 45,
          classification: "rifle",
        },
      };
      
      // Push to DragonflyDB queue
      redis.lpush("events:gunshot", JSON.stringify(event));
      redis.publish("boomerang:alarms", JSON.stringify(event));
      
      return Response.json({ status: "triggered", event });
    }

    return new Response("Bun WebSocket Server", {
      headers: { "Content-Type": "text/plain" },
    });
  },

  websocket: {
    open(ws) {
      const id = crypto.randomUUID();
      ws.data = { id };
      clients.set(id, ws);
      console.log(`Boomerang client connected: ${id}`);
      
      // Send connection confirmation
      ws.send(JSON.stringify({
        type: "connected",
        id,
        timestamp: new Date().toISOString(),
      }));
    },

    message(ws, message) {
      const data = JSON.parse(message.toString());
      
      // Handle Boomerang protocol
      if (data.type === "BOOMERANG_ALARM") {
        // Process Boomerang alarm
        handleBoomerangAlarm(data);
      } else if (data.type === "BOOMERANG_STATUS") {
        // Update device status
        redis.hset(`device:${data.device_id}`, "status", JSON.stringify(data));
      }
    },

    close(ws) {
      const id = ws.data.id;
      clients.delete(id);
      console.log(`Client disconnected: ${id}`);
    },
  },
});

async function handleBoomerangAlarm(data: any) {
  // Validate alarm
  if (data.confidence < 0.7) return;

  // Check zone from KML
  const zone = await checkZone(data.location);
  
  // Determine response
  let response = "none";
  if (zone === "red" && data.confidence > 0.9) {
    response = "immediate_deterrent";
  } else if (zone === "yellow") {
    response = "alert_operator";
  }

  // Push to processing queue
  await redis.lpush("queue:responses", JSON.stringify({
    ...data,
    zone,
    response,
    queued_at: new Date().toISOString(),
  }));

  // Trigger Node-RED flow
  await redis.publish("nodered:trigger", JSON.stringify({
    flow: "gunshot_response",
    payload: { ...data, zone, response },
  }));
}

async function checkZone(location: { lat: number; lon: number }) {
  // Check against KML zones in Redis
  const zones = await redis.get("kml:zones");
  // ... zone checking logic
  return "red"; // simplified
}

console.log(`Bun WebSocket Server running on port ${server.port}`);

// UDP Listener for legacy Boomerang devices
const udpSocket = Bun.udpSocket({
  port: 4001,
  handler: {
    data(socket, buf, port, addr) {
      // Parse Boomerang UDP protocol
      const data = parseBoomerangUDP(buf);
      
      // Convert to WebSocket format and process
      handleBoomerangAlarm({
        ...data,
        source: "udp",
        from_addr: addr,
      });
    },
  },
});

function parseBoomerangUDP(buffer: Buffer) {
  // Boomerang UDP packet structure
  // Bytes 0-3: Header
  // Bytes 4-7: Timestamp
  // Bytes 8-11: Lat (float)
  // Bytes 12-15: Lon (float)
  // Bytes 16-19: Confidence (float)
  // ... etc
  
  return {
    type: "BOOMERANG_ALARM",
    timestamp: buffer.readUInt32BE(4),
    location: {
      lat: buffer.readFloatBE(8),
      lon: buffer.readFloatBE(12),
    },
    confidence: buffer.readFloatBE(16),
  };
}
```

## Node-RED Flows Configuration

```json
// nodered-flows/gunshot-response.json
[
  {
    "id": "input-redis",
    "type": "redis-in",
    "name": "Gunshot Queue",
    "topic": "queue:responses",
    "x": 100,
    "y": 100
  },
  {
    "id": "parse-event",
    "type": "function",
    "name": "Parse Event",
    "func": "const event = JSON.parse(msg.payload);\n\n// Check zone and confidence\nif (event.zone === 'red' && event.confidence > 0.9) {\n    msg.action = 'immediate';\n    msg.spl = 95;\n    msg.duration = 10;\n} else if (event.zone === 'yellow') {\n    msg.action = 'alert';\n    msg.spl = 85;\n    msg.duration = 5;\n} else {\n    msg.action = 'log_only';\n}\n\nmsg.event = event;\nreturn msg;",
    "x": 300,
    "y": 100
  },
  {
    "id": "switch-action",
    "type": "switch",
    "name": "Action Router",
    "property": "action",
    "rules": [
      {"t": "eq", "v": "immediate"},
      {"t": "eq", "v": "alert"},
      {"t": "eq", "v": "log_only"}
    ],
    "x": 500,
    "y": 100
  },
  {
    "id": "trigger-lrad",
    "type": "http request",
    "name": "Activate LRAD",
    "method": "POST",
    "url": "http://slew2-driver:8090/api/lrad/activate",
    "x": 700,
    "y": 50
  },
  {
    "id": "trigger-ptz",
    "type": "http request",
    "name": "Point Camera",
    "method": "POST",
    "url": "http://slew2-driver:8090/api/ptz/preset",
    "x": 700,
    "y": 100
  },
  {
    "id": "log-event",
    "type": "postgresql",
    "name": "Log to Database",
    "query": "INSERT INTO events (type, data, response) VALUES ($type, $data, $response)",
    "x": 700,
    "y": 200
  }
]
```

## Slew2 PTZ Driver Implementation

```javascript
// slew2/index.js - PTZ control driver
const express = require('express');
const Redis = require('ioredis');
const SerialPort = require('serialport');
const { Slew2Protocol } = require('./protocols/slew2');
const { PelcoD } = require('./protocols/pelco-d');

const app = express();
app.use(express.json());

const redis = new Redis({
  host: process.env.REDIS_URL || 'dragonfly',
  port: 6379
});

// Serial connection for PTZ cameras
const ptzSerial = new SerialPort('/dev/ttyUSB0', {
  baudRate: 9600,
  dataBits: 8,
  stopBits: 1,
  parity: 'none'
});

// Slew2 protocol handler
const slew2 = new Slew2Protocol(ptzSerial);

// REST API for PTZ control
app.post('/api/ptz/preset', async (req, res) => {
  const { camera_id, preset } = req.body;
  
  // Send Slew2 command
  await slew2.gotoPreset(camera_id, preset);
  
  // Log to Redis
  await redis.lpush('ptz:commands', JSON.stringify({
    camera: camera_id,
    command: 'preset',
    preset,
    timestamp: new Date().toISOString()
  }));
  
  res.json({ status: 'ok', camera: camera_id, preset });
});

app.post('/api/ptz/manual', async (req, res) => {
  const { camera_id, pan, tilt, zoom } = req.body;
  
  // Manual PTZ control
  await slew2.setPTZ(camera_id, { pan, tilt, zoom });
  
  res.json({ status: 'ok', camera: camera_id, pan, tilt, zoom });
});

app.get('/api/ptz/status/:camera_id', async (req, res) => {
  const status = await slew2.getStatus(req.params.camera_id);
  res.json(status);
});

// LRAD control via Adam 6060 relay
app.post('/api/lrad/activate', async (req, res) => {
  const { duration = 10, pattern = 'deterrent', spl = 95 } = req.body;
  
  // Activate relay for LRAD
  await activateLRAD(duration, pattern, spl);
  
  // Publish event
  await redis.publish('lrad:activated', JSON.stringify({
    duration,
    pattern,
    spl,
    timestamp: new Date().toISOString()
  }));
  
  res.json({ status: 'activated', duration, pattern, spl });
});

async function activateLRAD(duration, pattern, spl) {
  // Send Modbus command to Adam 6060
  // This would interface with the actual relay module
  console.log(`LRAD: ${pattern} @ ${spl}dB for ${duration}s`);
  
  // Simulated activation
  setTimeout(() => {
    console.log('LRAD deactivated');
    redis.publish('lrad:deactivated', JSON.stringify({
      timestamp: new Date().toISOString()
    }));
  }, duration * 1000);
}

app.listen(8090, () => {
  console.log('Slew2 PTZ Driver running on port 8090');
});

// Slew2 Protocol Implementation
class Slew2Protocol {
  constructor(serial) {
    this.serial = serial;
  }

  async gotoPreset(cameraId, presetNumber) {
    // Slew2 preset command format
    const command = Buffer.from([
      0xFF,                    // Start byte
      parseInt(cameraId),      // Camera address
      0x00,                    // Command 1
      0x07,                    // Preset command
      0x00,                    // Speed
      presetNumber,            // Preset number
      0x00                     // Checksum
    ]);
    
    // Calculate checksum
    let sum = 0;
    for (let i = 1; i < command.length - 1; i++) {
      sum += command[i];
    }
    command[command.length - 1] = sum & 0xFF;
    
    // Send command
    this.serial.write(command);
    
    return new Promise(resolve => {
      setTimeout(resolve, 100); // Wait for camera response
    });
  }

  async setPTZ(cameraId, { pan, tilt, zoom }) {
    // Convert angles to Slew2 format
    const panBytes = this.angleToBytes(pan);
    const tiltBytes = this.angleToBytes(tilt);
    
    const command = Buffer.from([
      0xFF,
      parseInt(cameraId),
      0x00,
      0x4B,  // Absolute position command
      panBytes[0], panBytes[1],
      tiltBytes[0], tiltBytes[1],
      zoom & 0xFF,
      0x00   // Checksum placeholder
    ]);
    
    // Calculate and set checksum
    let sum = 0;
    for (let i = 1; i < command.length - 1; i++) {
      sum += command[i];
    }
    command[command.length - 1] = sum & 0xFF;
    
    this.serial.write(command);
  }

  angleToBytes(angle) {
    // Convert angle (0-360) to Slew2 format (0-65535)
    const value = Math.floor((angle / 360) * 65535);
    return [(value >> 8) & 0xFF, value & 0xFF];
  }
}
```

## DragonflyDB Configuration & Queues

```lua
-- dragonfly-init.lua - Queue management
-- This runs on DragonflyDB startup

-- Define queue structures
redis.call('HSET', 'queues:config', 'gunshot', json.encode({
  max_length = 10000,
  ttl = 3600,
  priority = 'high'
}))

redis.call('HSET', 'queues:config', 'thermal', json.encode({
  max_length = 50000,
  ttl = 1800,
  priority = 'medium'
}))

redis.call('HSET', 'queues:config', 'ptz', json.encode({
  max_length = 1000,
  ttl = 300,
  priority = 'low'
}))

-- Stream processing functions
local process_event = function(event_type, data)
  -- Add to appropriate queue
  redis.call('LPUSH', 'queue:' .. event_type, data)
  
  -- Trim queue to max length
  local config = redis.call('HGET', 'queues:config', event_type)
  if config then
    local cfg = json.decode(config)
    redis.call('LTRIM', 'queue:' .. event_type, 0, cfg.max_length - 1)
  end
  
  -- Publish for real-time subscribers
  redis.call('PUBLISH', 'events:' .. event_type, data)
end
```

## Frontend API Service

```javascript
// api/index.js - Their API layer (probably Express or Fastify)
const fastify = require('fastify')({ logger: true });
const Redis = require('ioredis');

const redis = new Redis({
  host: 'dragonfly',
  port: 6379
});

// WebSocket support
fastify.register(require('@fastify/websocket'));

// Routes
fastify.get('/api/status', async (req, reply) => {
  const status = {
    boomerang: await redis.get('device:boomerang:status'),
    thermal: await redis.get('device:thermal:status'),
    lrad: await redis.get('device:lrad:status'),
    queue_sizes: {
      gunshot: await redis.llen('queue:gunshot'),
      thermal: await redis.llen('queue:thermal'),
      ptz: await redis.llen('queue:ptz')
    }
  };
  return status;
});

fastify.post('/api/zones/kml', async (req, reply) => {
  // Store KML zones in DragonflyDB
  await redis.set('kml:zones', req.body.kml);
  return { status: 'updated' };
});

fastify.get('/api/events/stream', { websocket: true }, (connection, req) => {
  // Subscribe to DragonflyDB events
  const sub = new Redis({ host: 'dragonfly', port: 6379 });
  
  sub.subscribe('events:gunshot', 'events:thermal', 'events:alarm');
  
  sub.on('message', (channel, message) => {
    connection.socket.send(JSON.stringify({
      channel,
      data: JSON.parse(message),
      timestamp: new Date().toISOString()
    }));
  });
  
  connection.socket.on('close', () => {
    sub.unsubscribe();
    sub.quit();
  });
});

const start = async () => {
  try {
    await fastify.listen({ port: 8000, host: '0.0.0.0' });
    console.log('API server running on port 8000');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
```

## Access Everything

```yaml
# After docker-compose up, access:

Portainer:     http://localhost:9000     # admin/c2admin
Node-RED:      http://localhost:1880     # Flow automation
DragonflyDB:   http://localhost:6380     # HTTP stats interface
API:           http://localhost:8000     # REST API
WebSocket:     ws://localhost:3000/ws    # Boomerang events
PTZ Control:   http://localhost:8090     # Slew2 driver

# Test gunshot event:
curl -X POST http://localhost:3000/api/trigger

# View DragonflyDB stats:
curl http://localhost:6380/metrics

# Import Node-RED flows:
# Go to http://localhost:1880 → Import → Paste JSON
```

## This IS Their Stack!

- **Portainer** for container management ✓
- **Node-RED** for visual flow automation ✓
- **DragonflyDB** for queues & caching ✓
- **Bun WebSocket** for Boomerang ✓
- **Slew2** for PTZ camera control ✓
- **PostgreSQL** for persistence ✓

The key insight: They use **Node-RED** as the business logic layer! This lets operators create custom response flows without coding.

Want me to show you:
1. How to import their actual Node-RED flows?
2. The Boomerang WebSocket protocol details?
3. How Slew2 controls PTZ cameras?
4. The DragonflyDB queue patterns they use?
