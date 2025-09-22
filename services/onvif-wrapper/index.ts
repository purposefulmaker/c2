// services/onvif-wrapper/index.ts - ONVIF camera integration with LRAD support
import express, { Request, Response } from 'express';
import WebSocket from 'ws';
import { Discovery, Cam } from 'onvif';
import Redis from 'ioredis';
import yaml from 'js-yaml';
import fs from 'fs';
import cors from 'cors';
import { LRADONVIFProfile, createLRADONVIFProfile, type LRADConfiguration } from './src/lrad-onvif-profile';

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

interface LRADConfig {
  id: string;
  name: string;
  endpoint: string; // WebSocket endpoint for LRAD device
  model: string;
  position: {
    latitude: number;
    longitude: number;
    elevation?: number;
  };
  enabled: boolean;
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

interface LRADInfo {
  id: string;
  name: string;
  endpoint: string;
  profile: LRADONVIFProfile;
  config: LRADConfig;
  status: 'online' | 'offline' | 'error';
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
  lrads: LRADConfig[];
}

// Connect to DragonflyDB
const redis = new Redis({
  host: process.env.DRAGONFLY_URL?.replace('redis://', '') || 'localhost',
  port: 6379,
  maxRetriesPerRequest: null,
});

// WebSocket server for real-time PTZ control
const wss = new WebSocket.Server({ port: 8083 });

// Camera and LRAD registries
const cameras = new Map<string, CameraInfo>();
const lrads = new Map<string, LRADInfo>();
let config: Config = { cameras: [], lrads: [] };

// Load camera and LRAD configuration
try {
  const configData = fs.readFileSync('/app/config/cameras.yml', 'utf8');
  config = yaml.load(configData) as Config || { cameras: [], lrads: [] };
  
  // Ensure lrads array exists
  if (!config.lrads) {
    config.lrads = [];
  }
} catch (error) {
  console.warn('No camera config found, using discovery mode');
  config = { cameras: [], lrads: [] };
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

// Initialize LRAD devices
async function initializeLRADs(): Promise<void> {
  console.log('📢 Initializing LRAD devices...');
  
  for (const lradConfig of config.lrads) {
    try {
      console.log(`Connecting to LRAD: ${lradConfig.name} (${lradConfig.endpoint})`);
      
      const profile = createLRADONVIFProfile(lradConfig.id, lradConfig.endpoint);
      
      // Initialize the ONVIF profile
      await profile.initialize();
      
      // Store LRAD info
      lrads.set(lradConfig.id, {
        id: lradConfig.id,
        name: lradConfig.name,
        endpoint: lradConfig.endpoint,
        profile: profile,
        config: lradConfig,
        status: 'online'
      });
      
      // Register with C2 backend as a special "camera" with audio capabilities
      await registerLRADWithC2Backend(lradConfig.id, {
        name: lradConfig.name,
        model: lradConfig.model,
        position: lradConfig.position,
        capabilities: ['ptz', 'audio_output', 'deterrent']
      });
      
      console.log(`✅ Connected to LRAD: ${lradConfig.name}`);
      
    } catch (error) {
      console.error(`Error initializing LRAD ${lradConfig.name}:`, error);
      
      // Mark as offline but keep in registry for retry
      lrads.set(lradConfig.id, {
        id: lradConfig.id,
        name: lradConfig.name,
        endpoint: lradConfig.endpoint,
        profile: createLRADONVIFProfile(lradConfig.id, lradConfig.endpoint),
        config: lradConfig,
        status: 'error'
      });
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

// Register LRAD with C2 backend
async function registerLRADWithC2Backend(lradId: string, lradInfo: any): Promise<void> {
  try {
    const registration = {
      ...lradInfo,
      timestamp: new Date().toISOString(),
      source: 'onvif-wrapper',
      deviceType: 'lrad'
    };

    // Store in DragonflyDB for our backend to discover
    await redis.hset('lrads:registry', lradId, JSON.stringify(registration));
    
    // Publish LRAD registration event
    await redis.publish('lrads:registered', JSON.stringify({
      lrad_id: lradId,
      ...lradInfo
    }));
    
    console.log(`📡 Registered LRAD ${lradId} with C2 backend`);
  } catch (error) {
    console.error('Failed to register LRAD with C2 backend:', error);
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

// Process S2C (Slew2Cue) queue for coordinated PTZ/LRAD commands
async function processS2CQueue(): Promise<void> {
  try {
    // Listen for S2C commands from slew2-driver
    const command = await redis.brpop('queue:s2c_commands', 1);
    
    if (command) {
      const s2cCommand = JSON.parse(command[1]);
      console.log('📡 Processing S2C command:', s2cCommand);
      
      switch (s2cCommand.type) {
        case 'threat_response':
          await handleThreatResponse(s2cCommand);
          break;
          
        case 'lrad_activation':
          await handleLRADActivation(s2cCommand);
          break;
          
        case 'coordinated_ptz':
          await handleCoordinatedPTZ(s2cCommand);
          break;
          
        default:
          console.warn('Unknown S2C command type:', s2cCommand.type);
      }
    }
  } catch (error) {
    console.error('S2C queue processing error:', error);
  }
  
  // Continue processing
  setImmediate(processS2CQueue);
}

// Handle threat response coordination
async function handleThreatResponse(command: any): Promise<void> {
  const { threatPosition, assets, response } = command;
  
  console.log(`🚨 Threat response: ${response.type} at ${threatPosition.lat}, ${threatPosition.lng}`);
  
  // Execute camera PTZ commands
  if (assets.cameras && assets.cameras.length > 0) {
    for (const cameraAsset of assets.cameras) {
      const camera = cameras.get(cameraAsset.id);
      if (camera && camera.onvif) {
        try {
          // Slew camera to threat position
          await camera.onvif.absoluteMove({
            x: cameraAsset.ptz.pan,
            y: cameraAsset.ptz.tilt,
            zoom: cameraAsset.ptz.zoom
          });
          
          console.log(`📹 Slewed camera ${cameraAsset.id} to threat`);
        } catch (error) {
          console.error(`Failed to slew camera ${cameraAsset.id}:`, error);
        }
      }
    }
  }
  
  // Execute LRAD commands
  if (assets.lrads && assets.lrads.length > 0) {
    for (const lradAsset of assets.lrads) {
      const lrad = lrads.get(lradAsset.id);
      if (lrad && lrad.status === 'online') {
        try {
          // Position LRAD
          await lrad.profile.absoluteMove(
            lradAsset.ptz.pan,
            lradAsset.ptz.tilt,
            lradAsset.ptz.zoom
          );
          
          // Activate appropriate response
          switch (response.type) {
            case 'voice_warning':
              await lrad.profile.announceVoice(response.message);
              break;
              
            case 'deterrent':
              await lrad.profile.activateDeterrent(response.config);
              break;
              
            case 'siren':
              await lrad.profile.activateSiren(response.config);
              break;
          }
          
          console.log(`📢 Activated LRAD ${lradAsset.id} - ${response.type}`);
        } catch (error) {
          console.error(`Failed to activate LRAD ${lradAsset.id}:`, error);
        }
      }
    }
  }
}

// Handle LRAD activation commands
async function handleLRADActivation(command: any): Promise<void> {
  const { lradId, action, config } = command;
  const lrad = lrads.get(lradId);
  
  if (!lrad || lrad.status !== 'online') {
    console.error(`LRAD ${lradId} not available for activation`);
    return;
  }
  
  try {
    switch (action) {
      case 'voice':
        await lrad.profile.announceVoice(config.message, config);
        break;
        
      case 'deterrent':
        await lrad.profile.activateDeterrent(config);
        break;
        
      case 'siren':
        await lrad.profile.activateSiren(config);
        break;
        
      case 'standby':
        await lrad.profile.enterStandby();
        break;
        
      default:
        console.warn(`Unknown LRAD action: ${action}`);
    }
    
    console.log(`📢 LRAD ${lradId} executed: ${action}`);
  } catch (error) {
    console.error(`LRAD activation error for ${lradId}:`, error);
  }
}

// Handle coordinated PTZ commands
async function handleCoordinatedPTZ(command: any): Promise<void> {
  const { devices } = command;
  
  for (const device of devices) {
    if (device.type === 'camera') {
      const camera = cameras.get(device.id);
      if (camera && camera.onvif) {
        try {
          await camera.onvif.absoluteMove({
            x: device.ptz.pan,
            y: device.ptz.tilt,
            zoom: device.ptz.zoom
          });
          console.log(`📹 Coordinated PTZ: ${device.id}`);
        } catch (error) {
          console.error(`Coordinated PTZ error for ${device.id}:`, error);
        }
      }
    } else if (device.type === 'lrad') {
      const lrad = lrads.get(device.id);
      if (lrad && lrad.status === 'online') {
        try {
          await lrad.profile.absoluteMove(
            device.ptz.pan,
            device.ptz.tilt,
            device.ptz.zoom
          );
          console.log(`📢 Coordinated PTZ: ${device.id}`);
        } catch (error) {
          console.error(`Coordinated PTZ error for ${device.id}:`, error);
        }
      }
    }
  }
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

// Get all LRADs
app.get('/api/lrads', async (_req: Request, res: Response): Promise<void> => {
  const lradList = Array.from(lrads.values()).map(lrad => ({
    id: lrad.id,
    name: lrad.name,
    status: lrad.status,
    model: lrad.config.model,
    position: lrad.config.position,
    onvifStatus: lrad.profile.getStatus()
  }));

  res.json(lradList);
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

// Get LRAD by ID
app.get('/api/lrads/:id', async (req: Request, res: Response): Promise<void> => {
  const lrad = lrads.get(req.params.id);
  if (!lrad) {
    res.status(404).json({ error: 'LRAD not found' });
    return;
  }

  res.json({
    id: lrad.id,
    name: lrad.name,
    status: lrad.status,
    model: lrad.config.model,
    position: lrad.config.position,
    onvifStatus: lrad.profile.getStatus()
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

// LRAD PTZ Control
app.post('/api/lrads/:id/ptz', async (req: Request, res: Response): Promise<void> => {
  const lrad = lrads.get(req.params.id);
  if (!lrad || lrad.status !== 'online') {
    res.status(404).json({ error: 'LRAD not found or offline' });
    return;
  }

  const { pan, tilt, zoom, action, preset }: PTZCommand = req.body;

  try {
    if (action === 'preset' && preset) {
      // Go to preset
      await lrad.profile.gotoPreset(preset.toString());
      res.json({ status: 'ok', action: 'preset', preset });
      
    } else if (action === 'move') {
      // Absolute move (ONVIF coordinates)
      await lrad.profile.absoluteMove(pan || 0, tilt || 0, zoom || 1);
      res.json({ status: 'ok', action: 'move', pan, tilt, zoom });
      
    } else if (action === 'stop') {
      // Stop movement
      await lrad.profile.stop();
      res.json({ status: 'ok', action: 'stop' });
      
    } else {
      res.status(400).json({ error: 'Invalid LRAD PTZ action' });
      return;
    }

    // Log PTZ command to DragonflyDB
    await redis.lpush('queue:lrad_ptz_commands', JSON.stringify({
      lrad_id: req.params.id,
      action,
      parameters: { pan, tilt, zoom, preset },
      timestamp: new Date().toISOString()
    }));

  } catch (error) {
    console.error('LRAD PTZ error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// LRAD Activation Control
app.post('/api/lrads/:id/activate', async (req: Request, res: Response): Promise<void> => {
  const lrad = lrads.get(req.params.id);
  if (!lrad || lrad.status !== 'online') {
    res.status(404).json({ error: 'LRAD not found or offline' });
    return;
  }

  const { action, config: actionConfig } = req.body;

  try {
    let result;
    
    switch (action) {
      case 'voice':
        if (!actionConfig?.message) {
          res.status(400).json({ error: 'Voice message required' });
          return;
        }
        await lrad.profile.announceVoice(actionConfig.message, actionConfig);
        result = { action: 'voice', message: actionConfig.message };
        break;
        
      case 'deterrent':
        await lrad.profile.activateDeterrent(actionConfig);
        result = { action: 'deterrent', config: actionConfig };
        break;
        
      case 'siren':
        await lrad.profile.activateSiren(actionConfig);
        result = { action: 'siren', config: actionConfig };
        break;
        
      case 'standby':
        await lrad.profile.enterStandby();
        result = { action: 'standby' };
        break;
        
      default:
        res.status(400).json({ error: 'Invalid LRAD action' });
        return;
    }

    // Log activation command
    await redis.lpush('queue:lrad_activations', JSON.stringify({
      lrad_id: req.params.id,
      action,
      config: actionConfig,
      timestamp: new Date().toISOString()
    }));

    res.json({ status: 'ok', ...result });

  } catch (error) {
    console.error('LRAD activation error:', error);
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
  const lradStatus = Array.from(lrads.values()).reduce((acc, lrad) => {
    acc[lrad.status] = (acc[lrad.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  res.json({
    status: 'healthy',
    cameras: cameras.size,
    lrads: lrads.size,
    lradStatus,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// WebSocket for real-time PTZ control
interface WSMessage {
  type: string;
  camera_id?: string;
  lrad_id?: string;
  action?: string;
  pan?: number;
  tilt?: number;
  zoom?: number;
  config?: any;
  message?: string;
}

wss.on('connection', (ws: WebSocket) => {
  console.log('🔌 PTZ WebSocket client connected');

  ws.on('message', async (message: WebSocket.Data) => {
    try {
      const command: WSMessage = JSON.parse(message.toString());
      console.log('🎮 WebSocket command:', command);
      
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
      } else if (command.type === 'lrad_ptz' && command.lrad_id) {
        const lrad = lrads.get(command.lrad_id);
        if (lrad && lrad.status === 'online') {
          // Execute LRAD PTZ command
          if (command.action === 'move') {
            await lrad.profile.absoluteMove(
              command.pan || 0,
              command.tilt || 0, 
              command.zoom || 1
            );
          } else if (command.action === 'stop') {
            await lrad.profile.stop();
          }
          
          // Broadcast to all connected clients
          wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'lrad_ptz_executed',
                lrad_id: command.lrad_id,
                command
              }));
            }
          });
        }
      } else if (command.type === 'lrad_activate' && command.lrad_id) {
        const lrad = lrads.get(command.lrad_id);
        if (lrad && lrad.status === 'online') {
          // Execute LRAD activation
          switch (command.action) {
            case 'voice':
              if (command.message) {
                await lrad.profile.announceVoice(command.message, command.config);
              }
              break;
            case 'deterrent':
              await lrad.profile.activateDeterrent(command.config);
              break;
            case 'siren':
              await lrad.profile.activateSiren(command.config);
              break;
            case 'standby':
              await lrad.profile.enterStandby();
              break;
          }
          
          // Broadcast to all connected clients
          wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'lrad_activated',
                lrad_id: command.lrad_id,
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
  
  // Initialize LRADs
  await initializeLRADs();
  
  // Start S2C queue processing
  processS2CQueue();
  
  // Start HTTP server
  app.listen(8082, () => {
    console.log('🚀 ONVIF Wrapper Service running on port 8082');
    console.log('🔌 PTZ WebSocket server on port 8083');
    console.log('🎥 Cameras initialized:', cameras.size);
    console.log('📢 LRADs initialized:', lrads.size);
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