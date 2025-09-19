// services/onvif-wrapper/index.ts - ONVIF camera integration
import express, { Request, Response } from 'express';
import WebSocket from 'ws';
import { Discovery, Cam } from 'onvif';
import Redis from 'ioredis';
import yaml from 'js-yaml';
import fs from 'fs';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// Types
interface CameraConfig {
  id: string;
  name: string;
  ip: string;
  username: string;
  password: string;
  ptz?: boolean;
  analytics?: boolean;
}

interface CameraInfo {
  id: string;
  name: string;
  ip: string;
  onvif: any; // ONVIF Cam instance
  config: CameraConfig;
  capabilities: any;
  streams: {
    rtsp?: string;
    snapshot?: string;
  };
}


interface PTZCommand {
  id?: string;
  camera_id: string;
  action: 'move' | 'stop' | 'preset';
  pan?: number;
  tilt?: number;
  zoom?: number;
  preset?: number;
}

interface AnalyticsEvent {
  camera_id: string;
  timestamp: string;
  type: 'motion' | 'line_crossing' | 'intrusion' | 'camera_analytics';
  data: any;
}

interface DiscoveredCamera {
  hostname: string;
  port: number;
  urn: string;
}

interface CameraRegistration {
  name: string;
  streams: {
    rtsp?: string;
    snapshot?: string;
  };
  ptz: boolean;
  timestamp: string;
  source: string;
}

interface Config {
  cameras: CameraConfig[];
}

// Connect to DragonflyDB
const redis = new Redis({
  host: process.env.DRAGONFLY_URL?.replace('redis://', '') || 'localhost',
  port: 6379,
  maxRetriesPerRequest: null,
});

// WebSocket server for real-time PTZ control
const wss = new WebSocket.Server({ port: 8083 });

// Camera registry
const cameras = new Map<string, CameraInfo>();
let config: Config = { cameras: [] };

// Load camera configuration
try {
  const configData = fs.readFileSync('/app/config/cameras.yml', 'utf8');
  config = yaml.load(configData) as Config || { cameras: [] };
} catch (error) {
  console.warn('No camera config found, using discovery mode');
  config = { cameras: [] };
}

// Initialize ONVIF cameras
async function initializeCameras(): Promise<void> {
  console.log('🎥 Initializing ONVIF cameras...');
  
  for (const camConfig of config.cameras) {
    try {
      console.log(`Connecting to camera: ${camConfig.name} (${camConfig.ip})`);
      
      const cam = new Cam({
        hostname: camConfig.ip,
        username: camConfig.username,
        password: camConfig.password,
        port: 80,
        timeout: 5000
      }, (err) => {
        if (err) {
          console.error(`Failed to connect to ${camConfig.name}:`, err.message);
          return;
        }
        
        console.log(`✅ Connected to ${camConfig.name}`);
        
        // Store camera info
        cameras.set(camConfig.id, {
          id: camConfig.id,
          name: camConfig.name,
          ip: camConfig.ip,
          onvif: cam,
          config: camConfig,
          capabilities: {},
          streams: {}
        });
        
        // Get camera capabilities
        cam.getCapabilities((err, caps) => {
          if (err) {
            console.warn(`getCapabilities error for ${camConfig.name}:`, err);
            return;
          }
          if (caps) {
            const camera = cameras.get(camConfig.id);
            if (camera) {
              camera.capabilities = caps;
              console.log(`📋 Got capabilities for ${camConfig.name}`);
            }
          }
        });
        
        // Get stream URIs
        cam.getStreamUri({
          stream: 'RTP-Unicast',
          protocol: 'RTSP'
        }, (err, stream) => {
          if (err || !stream) {
            console.warn(`getStreamUri error for ${camConfig.name}:`, err);
            return;
          }
          if (stream) {
            const camera = cameras.get(camConfig.id);
            if (camera) {
              camera.streams = {
                rtsp: stream.uri,
                snapshot: `http://${camConfig.ip}/ISAPI/Streaming/channels/1/picture`
              };
              
              // Register with our C2 backend
              registerWithC2Backend(camConfig.id, {
                name: camConfig.name,
                streams: camera.streams,
                ptz: camConfig.ptz || false
              });
            }
          }
        });
        
        // Subscribe to analytics if available
        if (camConfig.analytics !== false) {
          subscribeToAnalytics(cam, camConfig);
        }
      });
      
    } catch (error) {
      console.error(`Error initializing camera ${camConfig.name}:`, error);
    }
  }
}

// Register camera with our existing C2 backend
async function registerWithC2Backend(cameraId: string, cameraInfo: Omit<CameraRegistration, 'timestamp' | 'source'>): Promise<void> {
  try {
    const registration: CameraRegistration = {
      ...cameraInfo,
      timestamp: new Date().toISOString(),
      source: 'onvif-wrapper'
    };

    // Store in DragonflyDB for our backend to discover
    await redis.hset('cameras:registry', cameraId, JSON.stringify(registration));
    
    // Publish camera registration event
    await redis.publish('cameras:registered', JSON.stringify({
      camera_id: cameraId,
      ...cameraInfo
    }));
    
    console.log(`📡 Registered ${cameraId} with C2 backend`);
  } catch (error) {
    console.error('Failed to register camera with C2 backend:', error);
  }
}

// Subscribe to ONVIF analytics events
function subscribeToAnalytics(camera: any, config: CameraConfig): void {
  camera.createPullPointSubscription((err: any, subscription: any) => {
    if (err) {
      console.warn(`Analytics not available for ${config.name}`);
      return;
    }
    
    console.log(`📊 Subscribed to analytics for ${config.name}`);
    
    function pullEvents(): void {
      subscription.pullMessages({}, (err: any, data: any) => {
        if (err) {
          console.warn(`pullMessages error for ${config.name}:`, err);
          setTimeout(pullEvents, 2000);
          return;
        }
        if (data && data.notificationMessage) {
          data.notificationMessage.forEach((msg: any) => {
            processAnalyticsEvent(config.id, msg);
          });
        }
        
        // Continue polling
        setTimeout(pullEvents, 1000);
      });
    }
    
    pullEvents();
  });
}

// Process analytics events and forward to our C2 system
async function processAnalyticsEvent(cameraId: string, message: any): Promise<void> {
  const event: AnalyticsEvent = {
    camera_id: cameraId,
    timestamp: new Date().toISOString(),
    type: 'camera_analytics',
    data: message
  };

  // Parse event type from ONVIF message
  if (message.topic && message.topic._) {
    if (message.topic._.match(/MotionDetection/)) {
      event.type = 'motion';
    } else if (message.topic._.match(/LineDetector/)) {
      event.type = 'line_crossing';
    } else if (message.topic._.match(/FieldDetector/)) {
      event.type = 'intrusion';
    }
  }

  // Forward to our C2 backend via DragonflyDB
  await redis.lpush('queue:camera_events', JSON.stringify(event));
  await redis.publish('events:camera', JSON.stringify(event));

  console.log(`📡 Camera event: ${event.type} from ${cameraId}`);
}

// REST API Endpoints

// Get all cameras
app.get('/api/cameras', async (_req: Request, res: Response): Promise<void> => {
  const cameraList = Array.from(cameras.values()).map(cam => ({
    id: cam.id,
    name: cam.name,
    ip: cam.ip,
    status: 'online',
    ptz: cam.config.ptz || false,
    streams: cam.streams,
    capabilities: cam.capabilities
  }));

  res.json(cameraList);
});

// Get camera by ID
app.get('/api/cameras/:id', async (req: Request, res: Response): Promise<void> => {
  const camera = cameras.get(req.params.id);
  if (!camera) {
    res.status(404).json({ error: 'Camera not found' });
    return;
  }

  res.json({
    id: camera.id,
    name: camera.name,
    ip: camera.ip,
    status: 'online',
    ptz: camera.config.ptz || false,
    streams: camera.streams,
    capabilities: camera.capabilities
  });
});

// PTZ Control
app.post('/api/cameras/:id/ptz', async (req: Request, res: Response): Promise<void> => {
  const camera = cameras.get(req.params.id);
  if (!camera || !camera.onvif) {
    res.status(404).json({ error: 'Camera not found' });
    return;
  }

  const { pan, tilt, zoom, action, preset }: PTZCommand = req.body;

  try {
    if (action === 'preset' && preset) {
      // Go to preset
      camera.onvif.gotoPreset({ preset: preset }, (err: any) => {
        if (err) throw err;
      });
      
  res.json({ status: 'ok', action: 'preset', preset });
      
    } else if (action === 'move') {
      // Continuous move
      camera.onvif.continuousMove({
        x: pan || 0,
        y: tilt || 0,
        zoom: zoom || 0
      }, (err: any) => {
        if (err) throw err;
      });
      
  res.json({ status: 'ok', action: 'move', pan, tilt, zoom });
      
    } else if (action === 'stop') {
      // Stop movement
      camera.onvif.stop({}, (err: any) => {
        if (err) console.error('PTZ stop error:', err);
      });
      
  res.json({ status: 'ok', action: 'stop' });
      
    } else {
      res.status(400).json({ error: 'Invalid PTZ action' });
      return;
    }

    // Log PTZ command to DragonflyDB
    await redis.lpush('queue:ptz_commands', JSON.stringify({
      camera_id: req.params.id,
      action,
      parameters: { pan, tilt, zoom, preset },
      timestamp: new Date().toISOString()
    }));

  } catch (error) {
    console.error('PTZ error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get snapshot
app.get('/api/cameras/:id/snapshot', async (req: Request, res: Response): Promise<void> => {
  const camera = cameras.get(req.params.id);
  if (!camera) {
    res.status(404).json({ error: 'Camera not found' });
    return;
  }

  if (camera.onvif && camera.onvif.getSnapshotUri) {
    camera.onvif.getSnapshotUri((err: any, uri: any) => {
      if (err || !uri) {
        res.status(500).json({ error: 'Snapshot not available' });
        return;
      }
      res.redirect(uri.uri);
    });
  } else {
    // Fallback to HTTP snapshot
    const snapshotUrl = camera.streams?.snapshot || `http://${camera.ip}/ISAPI/Streaming/channels/1/picture`;
    res.redirect(snapshotUrl);
  }
});

// Discover cameras on network
app.post('/api/discover', async (_req: Request, res: Response): Promise<void> => {
  console.log('🔍 Starting camera discovery...');
  
  Discovery.probe((err, cams) => {
    if (err) {
      console.error('Discovery error:', err);
      res.status(500).json({ error: 'Discovery failed' });
      return;
    }

    const discovered: DiscoveredCamera[] = cams.map(cam => ({
      hostname: cam.hostname,
      port: cam.port,
      urn: cam.urn
    }));

    console.log(`Found ${discovered.length} cameras`);
    res.json(discovered);
  });
});

// Health check
app.get('/health', (_req: Request, res: Response): void => {
  res.json({
    status: 'healthy',
    cameras: cameras.size,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// WebSocket for real-time PTZ control
interface WSMessage {
  type: string;
  camera_id?: string;
  action?: string;
  pan?: number;
  tilt?: number;
  zoom?: number;
}

wss.on('connection', (ws: WebSocket) => {
  console.log('🔌 PTZ WebSocket client connected');

  ws.on('message', async (message: WebSocket.Data) => {
    try {
      const command: WSMessage = JSON.parse(message.toString());
      console.log('🎮 PTZ WebSocket command:', command);
      
      if (command.type === 'ptz' && command.camera_id) {
        const camera = cameras.get(command.camera_id);
        if (camera && camera.onvif) {
          // Execute PTZ command
          if (command.action === 'move') {
            camera.onvif.continuousMove({
              x: command.pan || 0,
              y: command.tilt || 0,
              zoom: command.zoom || 0
            });
          } else if (command.action === 'stop') {
            camera.onvif.stop({});
          }
          
          // Broadcast to all connected clients
          wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'ptz_executed',
                camera_id: command.camera_id,
                command
              }));
            }
          });
        }
      }
    } catch (error) {
      console.error('WebSocket command error:', error);
    }
  });

  ws.on('close', () => {
    console.log('❌ PTZ WebSocket client disconnected');
  });
});

// Start the service
async function start(): Promise<void> {
  // Initialize cameras
  await initializeCameras();
  
  // Start HTTP server
  app.listen(8082, () => {
    console.log('🚀 ONVIF Wrapper Service running on port 8082');
    console.log('🔌 PTZ WebSocket server on port 8083');
    console.log('🎥 Cameras initialized:', cameras.size);
  });
  
  // Auto-discovery every 30 seconds if enabled
  if (process.env.DISCOVERY_ENABLED === 'true') {
    setInterval(() => {
      console.log('🔍 Running auto-discovery...');
      Discovery.probe((err, cams) => {
        if (!err && cams.length > 0) {
          console.log(`Found ${cams.length} cameras during auto-discovery`);
        }
      });
    }, 30000);
  }
}

start().catch(console.error);