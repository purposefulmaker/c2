// services/bun-websocket/index.ts - Vendor implementation
import { serve, ServerWebSocket } from "bun";
import Redis from "ioredis";

// Connect to DragonflyDB (Redis compatible)
const redis = new Redis({
  host: process.env.DRAGONFLY_URL?.replace('redis://', '') || "dragonfly",
  port: 6379,
  maxRetriesPerRequest: null,
});

// Subscribe to events
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

// Subscribe to Boomerang alarm events
subscriber.subscribe("boomerang:alarms", "events:gunshot", "events:thermal");
subscriber.on("message", (channel, message) => {
  console.log(`📡 Received event on ${channel}:`, message);
  
  // Broadcast to all connected clients
  for (const [id, ws] of clients) {
    try {
      ws.send(message);
    } catch (error) {
      console.error(`Failed to send to client ${id}:`, error);
      clients.delete(id);
    }
  }
});

// Bun server with WebSocket support
const server = serve({
  port: 3000,
  
  fetch(req, server) {
    const url = new URL(req.url);
    
    // WebSocket upgrade for events
    if (url.pathname === "/ws" || url.pathname === "/ws/events") {
      const upgraded = server.upgrade(req);
      if (!upgraded) {
        return new Response("Upgrade failed", { status: 500 });
      }
      return;
    }

    // REST endpoints for testing
    if (url.pathname === "/api/trigger" && req.method === "POST") {
      // Simulate gunshot event
      const event = {
        type: "BOOMERANG_ALARM",
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        location: {
          lat: 37.7749 + (Math.random() - 0.5) * 0.01,
          lon: -122.4194 + (Math.random() - 0.5) * 0.01,
        },
        confidence: 0.85 + Math.random() * 0.15,
        device_id: "boomerang_01",
        metadata: {
          sound_level: 95 + Math.random() * 25,
          frequency_analysis: "gunshot_pattern_detected"
        }
      };

      // Push to DragonflyDB
      publisher.lpush("queue:gunshot", JSON.stringify(event));
      publisher.publish("boomerang:alarms", JSON.stringify(event));
      
      return Response.json({ status: "triggered", event });
    }

    if (url.pathname === "/api/thermal" && req.method === "POST") {
      // Simulate thermal event
      const event = {
        type: "THERMAL_ALARM",
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        location: {
          lat: 37.7749 + (Math.random() - 0.5) * 0.01,
          lon: -122.4194 + (Math.random() - 0.5) * 0.01,
        },
        confidence: 0.75 + Math.random() * 0.25,
        device_id: "thermal_01",
        metadata: {
          temperature: 98.6 + Math.random() * 10,
          target_size: "human"
        }
      };

      publisher.lpush("queue:thermal", JSON.stringify(event));
      publisher.publish("events:thermal", JSON.stringify(event));
      
      return Response.json({ status: "triggered", event });
    }

    if (url.pathname === "/api/stats") {
      return Response.json({
        connected_clients: clients.size,
        server_uptime: process.uptime(),
        memory_usage: process.memoryUsage(),
        timestamp: new Date().toISOString()
      });
    }

    return new Response(`
<!DOCTYPE html>
<html>
<head>
    <title>C2 Bun WebSocket Server</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #0a0a0a; color: #00ffff; }
        .status { background: #1a1a2e; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        button { background: #00ffff; color: #0a0a0a; border: none; padding: 10px 20px; margin: 5px; border-radius: 4px; cursor: pointer; }
        button:hover { background: #00cccc; }
        .log { background: #111; padding: 15px; border-radius: 4px; font-family: monospace; font-size: 12px; height: 300px; overflow-y: auto; }
    </style>
</head>
<body>
    <h1>🚀 C2 Bun WebSocket Server</h1>
    <div class="status">
        <p><strong>Status:</strong> Running</p>
        <p><strong>Clients:</strong> <span id="clientCount">${clients.size}</span></p>
        <p><strong>WebSocket:</strong> ws://localhost:3000/ws</p>
    </div>
    <div>
        <button onclick="triggerGunshot()">🔫 Trigger Gunshot</button>
        <button onclick="triggerThermal()">🌡️ Trigger Thermal</button>
        <button onclick="connectWS()">🔌 Connect WebSocket</button>
    </div>
    <div id="log" class="log">WebSocket events will appear here...</div>
    
    <script>
        let ws;
        const log = document.getElementById('log');
        
        function addLog(message) {
            log.innerHTML += new Date().toLocaleTimeString() + ': ' + message + '\\n';
            log.scrollTop = log.scrollHeight;
        }
        
        function connectWS() {
            ws = new WebSocket('ws://localhost:3000/ws');
            ws.onopen = () => addLog('✅ WebSocket connected');
            ws.onmessage = (event) => addLog('📡 ' + event.data);
            ws.onclose = () => addLog('❌ WebSocket disconnected');
            ws.onerror = (error) => addLog('🚨 WebSocket error: ' + error);
        }
        
        async function triggerGunshot() {
            const response = await fetch('/api/trigger', { method: 'POST' });
            const data = await response.json();
            addLog('🔫 Gunshot triggered: ' + JSON.stringify(data));
        }
        
        async function triggerThermal() {
            const response = await fetch('/api/thermal', { method: 'POST' });
            const data = await response.json();
            addLog('🌡️ Thermal triggered: ' + JSON.stringify(data));
        }
        
        // Auto-connect on load
        connectWS();
    </script>
</body>
</html>
    `, {
      headers: { "Content-Type": "text/html" },
    });
  },

  websocket: {
    open(ws) {
      const id = crypto.randomUUID();
      clients.set(id, ws);
      ws.data = { id };
      
      console.log(`✅ Client connected: ${id} (${clients.size} total)`);
      
      // Send welcome message
      ws.send(JSON.stringify({
        type: "CONNECTION_ESTABLISHED",
        client_id: id,
        timestamp: new Date().toISOString(),
        connected_clients: clients.size
      }));
    },

    message(ws, message) {
      try {
        const data = JSON.parse(message.toString());
        console.log(`📨 Message from ${ws.data.id}:`, data);
        
        // Handle client commands
        if (data.type === "PING") {
          ws.send(JSON.stringify({ type: "PONG", timestamp: new Date().toISOString() }));
        }
      } catch (error) {
        console.error("Failed to parse message:", error);
      }
    },

    close(ws) {
      const id = ws.data?.id;
      if (id) {
        clients.delete(id);
        console.log(`❌ Client disconnected: ${id} (${clients.size} remaining)`);
      }
    },
  },
});

// UDP Listener for legacy Boomerang devices
const udpSocket = Bun.udpSocket({
  port: 4001,
  handler: {
    data(socket, buf, port, addr) {
      console.log(`📡 UDP packet from ${addr}:${port}`);
      
      // Parse Boomerang UDP protocol
      const event = parseBoomerangUDP(buf);
      if (event) {
        handleBoomerangAlarm(event);
      }
    },
  },
});

function parseBoomerangUDP(buffer: Buffer) {
  try {
    // Basic Boomerang UDP packet structure
    if (buffer.length < 20) return null;
    
    return {
      type: "BOOMERANG_ALARM",
      timestamp: new Date().toISOString(),
      location: {
        lat: buffer.readFloatBE(8),
        lon: buffer.readFloatBE(12),
      },
      confidence: buffer.readFloatBE(16),
      device_id: "boomerang_udp",
      metadata: {
        raw_packet: buffer.toString('hex')
      }
    };
  } catch (error) {
    console.error("Failed to parse UDP packet:", error);
    return null;
  }
}

async function handleBoomerangAlarm(data: any) {
  console.log("🚨 Processing Boomerang alarm:", data);
  
  // Validate alarm
  if (data.confidence < 0.7) {
    console.log("⚠️ Low confidence alarm ignored");
    return;
  }

  // Push to processing queue
  await redis.lpush("queue:gunshot", JSON.stringify(data));
  
  // Publish for real-time subscribers
  await redis.publish("boomerang:alarms", JSON.stringify(data));
  
  // Trigger Node-RED flow
  await redis.publish("nodered:trigger", JSON.stringify({
    flow: "gunshot_response",
    payload: data
  }));
}

console.log(`🚀 Bun WebSocket Server running on port ${server.port}`);
console.log(`📡 UDP listener on port 4001`);
console.log(`🌐 Test interface: http://localhost:${server.port}`);
console.log(`🔌 WebSocket: ws://localhost:${server.port}/ws`);