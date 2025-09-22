// services/slew2-driver/index.ts - Slew2 PTZ driver for C2 platform
import express, { Request, Response } from 'express';
import Redis from 'ioredis';
import { SerialPort } from 'serialport';
import yaml from 'js-yaml';
import fs from 'fs';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// Types
interface PTZCommand {
  id?: string;
  camera_id: string;
  action: 'preset' | 'move';
  preset?: number;
  pan?: number;
  tilt?: number;
  zoom?: number;
}

interface BoomerangAlert {
  id: string;
  timestamp: string;
  position: {
    latitude: number;
    longitude: number;
    elevation?: number;
  };
  bearing: number; // degrees
  distance: number; // meters
  confidence: number; // 0-100
  threat_type: 'gunshot' | 'explosion' | 'unknown';
  audio_signature: {
    frequency: number;
    duration: number;
    amplitude: number;
  };
}

interface ThreatResponse {
  threatId: string;
  threatPosition: {
    lat: number;
    lng: number;
  };
  assets: {
    cameras: Array<{
      id: string;
      ptz: { pan: number; tilt: number; zoom: number };
    }>;
    lrads: Array<{
      id: string;
      ptz: { pan: number; tilt: number; zoom: number };
      response: {
        type: 'voice_warning' | 'deterrent' | 'siren';
        message?: string;
        config?: any;
      };
    }>;
  };
  priority: 'low' | 'medium' | 'high' | 'critical';
  response: {
    type: 'voice_warning' | 'deterrent' | 'siren';
    message?: string;
    config?: any;
  };
}

interface PTZResult {
  status: 'success' | 'error' | 'mock_success';
  error?: string;
}

interface PTZStatus {
  camera_id: string;
  pan: number;
  tilt: number;
  zoom: number;
  status: string;
  timestamp: string;
}

interface LRADActivation {
  duration?: number;
  pattern?: string;
  spl?: number;
  zone?: string;
}

interface LRADEvent {
  type: 'LRAD_START' | 'LRAD_STOP';
  pattern: string;
  spl: number;
  duration?: number;
  zone: string;
  timestamp: string;
}

interface PTZPresets {
  ptz_presets?: {
    [cameraId: string]: Array<{
      id: number;
      name: string;
      pan: number;
      tilt: number;
      zoom: number;
    }>;
  };
}

// Connect to DragonflyDB
const redis = new Redis({
  host: process.env.REDIS_URL?.replace('redis://', '') || 'localhost',
  port: 6379,
  maxRetriesPerRequest: null,
});

// Serial connection for PTZ cameras
let ptzSerial: SerialPort | null = null;
let presets: PTZPresets = {};

// Load PTZ presets
try {
  const presetsData = fs.readFileSync('/app/presets.yml', 'utf8');
  presets = yaml.load(presetsData) as PTZPresets || {};
} catch (error) {
  console.warn('No PTZ presets file found');
  presets = {};
}

// Initialize serial connection
function initializeSerial(): void {
  const serialPort = process.env.SERIAL_PORT || '/dev/ttyUSB0';
  
  try {
    ptzSerial = new SerialPort({
      path: serialPort,
      baudRate: 9600,
      dataBits: 8,
      stopBits: 1,
      parity: 'none'
    });

    ptzSerial.on('open', () => {
      console.log(`✅ Serial port ${serialPort} opened for PTZ control`);
    });

    ptzSerial.on('error', (err: Error) => {
      console.error('Serial port error:', err.message);
      ptzSerial = null;
    });

    ptzSerial.on('data', (data: Buffer) => {
      console.log('📡 PTZ response:', data.toString('hex'));
    });

  } catch (error) {
    console.warn(`Serial port ${serialPort} not available, using mock mode`);
    ptzSerial = null;
  }
}

// Slew2 Protocol Implementation
class Slew2Protocol {
  private serial: SerialPort | null;

  constructor(serial: SerialPort | null) {
    this.serial = serial;
  }

  async gotoPreset(cameraId: string, presetNumber: number): Promise<PTZResult> {
    console.log(`🎯 Going to preset ${presetNumber} for camera ${cameraId}`);
    
    if (!this.serial) {
      console.log('📝 Mock PTZ: Goto preset', { cameraId, presetNumber });
      return { status: 'mock_success' };
    }

    // Slew2 preset command format
    const cameraAddress = parseInt(cameraId.replace('cam_', ''), 10) || 1;
    const checksumData = [0xFF, 0x01, cameraAddress, 0x07, presetNumber, 0x00, 0x00];
    const command = Buffer.from([
      0xFF, 0x01, // Header
      cameraAddress, // Camera address
      0x07, // Preset recall command
      presetNumber,
      0x00, 0x00, // Reserved
      this.calculateChecksum(checksumData)
    ]);

    return new Promise((resolve) => {
      if (!this.serial) {
        resolve({ status: 'error', error: 'Serial port not available' });
        return;
      }

      this.serial.write(command, (err?: Error | null) => {
        if (err) {
          console.error('Serial write error:', err);
          resolve({ status: 'error', error: err.message });
        } else {
          console.log('✅ PTZ preset command sent');
          resolve({ status: 'success' });
        }
      });
    });
  }

  async setPTZ(cameraId: string, { pan, tilt, zoom }: { pan?: number; tilt?: number; zoom?: number }): Promise<PTZResult> {
    console.log(`🎮 PTZ move for camera ${cameraId}:`, { pan, tilt, zoom });
    
    if (!this.serial) {
      console.log('📝 Mock PTZ: Manual control', { cameraId, pan, tilt, zoom });
      return { status: 'mock_success' };
    }

    // Convert angles to Slew2 format
    const panBytes = this.angleToBytes(pan || 0);
    const tiltBytes = this.angleToBytes(tilt || 0);
    const zoomByte = Math.round((zoom || 1) * 255);
    const cameraAddress = parseInt(cameraId.replace('cam_', ''), 10) || 1;

    const checksumData = [0xFF, 0x01, cameraAddress, 0x4B, ...panBytes, ...tiltBytes, zoomByte];
    const command = Buffer.from([
      0xFF, 0x01, // Header
      cameraAddress, // Camera address
      0x4B, // Absolute position command
      ...panBytes,  // Pan (2 bytes)
      ...tiltBytes, // Tilt (2 bytes)
      zoomByte,     // Zoom (1 byte)
      this.calculateChecksum(checksumData)
    ]);

    return new Promise((resolve) => {
      if (!this.serial) {
        resolve({ status: 'error', error: 'Serial port not available' });
        return;
      }

      this.serial.write(command, (err?: Error | null) => {
        if (err) {
          resolve({ status: 'error', error: err.message });
        } else {
          resolve({ status: 'success' });
        }
      });
    });
  }

  async getStatus(cameraId: string): Promise<PTZStatus> {
    if (!this.serial) {
      return {
        camera_id: cameraId,
        pan: 0,
        tilt: 0,
        zoom: 1,
        status: 'mock_online',
        timestamp: new Date().toISOString()
      };
    }

    // TODO: Implement real Slew2 status query and parse response when available

    // For now, return mock data
    return {
      camera_id: cameraId,
      pan: 0,
      tilt: 0,
      zoom: 1,
      status: 'online',
      timestamp: new Date().toISOString()
    };
  }

  private angleToBytes(angle: number): [number, number] {
    // Convert angle (0-360) to Slew2 format (0-65535)
    const value = Math.round((angle / 360) * 65535);
    return [(value >> 8) & 0xFF, value & 0xFF];
  }

  private calculateChecksum(bytes: number[]): number {
    // Simple XOR checksum for Slew2
    return bytes.reduce((sum, byte) => sum ^ byte, 0);
  }
}

// Initialize Slew2 protocol
initializeSerial();
const slew2 = new Slew2Protocol(ptzSerial);

// Subscribe to PTZ commands and Boomerang alerts from DragonflyDB
redis.subscribe('commands:ptz', 'alerts:boomerang', 'threats:detected');
redis.on('message', async (channel: string, message: string) => {
  if (channel === 'commands:ptz') {
    try {
      const command: PTZCommand = JSON.parse(message);
      console.log('📡 Received PTZ command:', command);
      
      let result: PTZResult;
      if (command.action === 'preset' && command.preset !== undefined) {
        result = await slew2.gotoPreset(command.camera_id, command.preset);
      } else if (command.action === 'move') {
        const ptzParams: { pan?: number; tilt?: number; zoom?: number } = {};
        if (command.pan !== undefined) ptzParams.pan = command.pan;
        if (command.tilt !== undefined) ptzParams.tilt = command.tilt;
        if (command.zoom !== undefined) ptzParams.zoom = command.zoom;
        result = await slew2.setPTZ(command.camera_id, ptzParams);
      } else {
        result = { status: 'error', error: 'Invalid command action' };
      }
      
      // Publish result back
      await redis.publish('ptz:status', JSON.stringify({
        command_id: command.id,
        camera_id: command.camera_id,
        result,
        timestamp: new Date().toISOString()
      }));
      
    } catch (error) {
      console.error('PTZ command processing error:', error);
    }
  } else if (channel === 'alerts:boomerang') {
    try {
      const alert: BoomerangAlert = JSON.parse(message);
      console.log('🎯 Received Boomerang alert:', alert);
      await processBoomerangAlert(alert);
    } catch (error) {
      console.error('Boomerang alert processing error:', error);
    }
  } else if (channel === 'threats:detected') {
    try {
      const threatData = JSON.parse(message);
      console.log('🚨 Received threat detection:', threatData);
      await processThreatDetection(threatData);
    } catch (error) {
      console.error('Threat detection processing error:', error);
    }
  }
});

// Process Boomerang acoustic alerts and coordinate response
async function processBoomerangAlert(alert: BoomerangAlert): Promise<void> {
  console.log(`🎯 Processing Boomerang alert: ${alert.threat_type} at bearing ${alert.bearing}°, distance ${alert.distance}m`);
  
  // Calculate threat priority based on distance and threat type
  const priority = calculateThreatPriority(alert);
  
  // Get available assets (cameras and LRADs) within range
  const availableAssets = await getAvailableAssets(alert.position, alert.distance);
  
  // Generate coordinated response
  const response = generateThreatResponse(alert, availableAssets, priority);
  
  // Execute coordinated response
  await executeThreatResponse(response);
  
  // Log threat event
  await redis.lpush('queue:threat_events', JSON.stringify({
    alertId: alert.id,
    threatType: alert.threat_type,
    position: alert.position,
    bearing: alert.bearing,
    distance: alert.distance,
    confidence: alert.confidence,
    priority,
    response: response.response,
    timestamp: new Date().toISOString()
  }));
}

// Calculate threat priority based on alert characteristics
function calculateThreatPriority(alert: BoomerangAlert): 'low' | 'medium' | 'high' | 'critical' {
  // Distance factor (closer = higher priority)
  let priorityScore = 0;
  if (alert.distance < 100) priorityScore += 3;
  else if (alert.distance < 500) priorityScore += 2;
  else if (alert.distance < 1000) priorityScore += 1;
  
  // Threat type factor
  if (alert.threat_type === 'gunshot') priorityScore += 3;
  else if (alert.threat_type === 'explosion') priorityScore += 4;
  else priorityScore += 1;
  
  // Confidence factor
  if (alert.confidence > 90) priorityScore += 2;
  else if (alert.confidence > 70) priorityScore += 1;
  
  // Convert score to priority
  if (priorityScore >= 7) return 'critical';
  if (priorityScore >= 5) return 'high';
  if (priorityScore >= 3) return 'medium';
  return 'low';
}

// Get available assets within range of threat
async function getAvailableAssets(threatPosition: any, maxDistance: number) {
  try {
    // Get registered cameras from Redis
    const cameraRegistry = await redis.hgetall('cameras:registry');
    const lradRegistry = await redis.hgetall('lrads:registry');
    
    const availableCameras = [];
    const availableLRADs = [];
    
    // Process cameras
    for (const [cameraId, cameraData] of Object.entries(cameraRegistry)) {
      try {
        const camera = JSON.parse(cameraData);
        // For now, assume all cameras are available
        // In production, you'd calculate distance and check capabilities
        availableCameras.push({
          id: cameraId,
          name: camera.name,
          ptz: camera.ptz,
          position: camera.position || { lat: 0, lng: 0 }
        });
      } catch (error) {
        console.error(`Error parsing camera data for ${cameraId}:`, error);
      }
    }
    
    // Process LRADs
    for (const [lradId, lradData] of Object.entries(lradRegistry)) {
      try {
        const lrad = JSON.parse(lradData);
        availableLRADs.push({
          id: lradId,
          name: lrad.name,
          model: lrad.model,
          position: lrad.position,
          capabilities: lrad.capabilities || []
        });
      } catch (error) {
        console.error(`Error parsing LRAD data for ${lradId}:`, error);
      }
    }
    
    return { cameras: availableCameras, lrads: availableLRADs };
  } catch (error) {
    console.error('Error getting available assets:', error);
    return { cameras: [], lrads: [] };
  }
}

// Generate coordinated threat response
function generateThreatResponse(
  alert: BoomerangAlert, 
  assets: any, 
  priority: 'low' | 'medium' | 'high' | 'critical'
): ThreatResponse {
  const response: ThreatResponse = {
    threatId: alert.id,
    threatPosition: {
      lat: alert.position.latitude,
      lng: alert.position.longitude
    },
    assets: {
      cameras: [],
      lrads: []
    },
    priority,
    response: {
      type: 'voice_warning',
      message: 'Attention: Security alert in progress. Please comply with instructions.'
    }
  };
  
  // Calculate PTZ positions to aim at threat
  const threatBearing = alert.bearing;
  
  // Assign cameras to track threat
  for (const camera of assets.cameras.slice(0, 2)) { // Use up to 2 cameras
    response.assets.cameras.push({
      id: camera.id,
      ptz: {
        pan: (threatBearing / 360) * 2 - 1, // Convert to ONVIF coordinates
        tilt: 0, // Assume horizontal
        zoom: priority === 'critical' ? 1.0 : 0.7
      }
    });
  }
  
  // Assign LRADs based on priority
  for (const lrad of assets.lrads.slice(0, 1)) { // Use primary LRAD
    let responseType: 'voice_warning' | 'deterrent' | 'siren' = 'voice_warning';
    let message = 'Security alert. Please remain calm and follow instructions.';
    
    if (priority === 'critical') {
      responseType = 'deterrent';
      message = 'STOP! You are in a restricted area. Cease activity immediately.';
    } else if (priority === 'high') {
      responseType = 'siren';
      message = 'Warning: Unauthorized activity detected. Clear the area immediately.';
    }
    
    response.assets.lrads.push({
      id: lrad.id,
      ptz: {
        pan: (threatBearing / 360) * 2 - 1, // Convert to ONVIF coordinates
        tilt: 0,
        zoom: 1.0
      },
      response: {
        type: responseType,
        message,
        config: {
          volume: priority === 'critical' ? 90 : 70,
          duration: priority === 'critical' ? 30 : 10
        }
      }
    });
  }
  
  response.response = response.assets.lrads[0]?.response || response.response;
  
  return response;
}

// Execute coordinated threat response
async function executeThreatResponse(response: ThreatResponse): Promise<void> {
  console.log(`🚨 Executing threat response: ${response.priority} priority for threat ${response.threatId}`);
  
  try {
    // Send S2C command to onvif-wrapper for execution
    await redis.lpush('queue:s2c_commands', JSON.stringify({
      type: 'threat_response',
      threatId: response.threatId,
      threatPosition: response.threatPosition,
      assets: response.assets,
      priority: response.priority,
      response: response.response,
      timestamp: new Date().toISOString()
    }));
    
    // Publish threat response event
    await redis.publish('events:threat_response', JSON.stringify({
      threatId: response.threatId,
      responseType: response.response.type,
      assetsActivated: {
        cameras: response.assets.cameras.length,
        lrads: response.assets.lrads.length
      },
      priority: response.priority,
      timestamp: new Date().toISOString()
    }));
    
    console.log(`✅ Threat response executed: ${response.assets.cameras.length} cameras, ${response.assets.lrads.length} LRADs activated`);
    
  } catch (error) {
    console.error('Error executing threat response:', error);
  }
}

// Process general threat detections (from other sources)
async function processThreatDetection(threatData: any): Promise<void> {
  console.log('🚨 Processing threat detection:', threatData);
  
  // Convert to Boomerang-like format for consistent processing
  const syntheticAlert: BoomerangAlert = {
    id: threatData.id || `threat_${Date.now()}`,
    timestamp: threatData.timestamp || new Date().toISOString(),
    position: threatData.position || { latitude: 0, longitude: 0 },
    bearing: threatData.bearing || 0,
    distance: threatData.distance || 1000,
    confidence: threatData.confidence || 50,
    threat_type: threatData.type || 'unknown',
    audio_signature: threatData.audio_signature || {
      frequency: 1000,
      duration: 1,
      amplitude: 50
    }
  };
  
  await processBoomerangAlert(syntheticAlert);
}

// REST API for PTZ control
app.post('/api/ptz/preset', async (req: Request, res: Response): Promise<void> => {
  const { camera_id, preset }: { camera_id?: string; preset?: number } = req.body;
  
  if (!camera_id || preset === undefined) {
    res.status(400).json({ error: 'camera_id and preset required' });
    return;
  }
  
  try {
    const result = await slew2.gotoPreset(camera_id, preset);
    
    // Log to DragonflyDB
    await redis.lpush('ptz:commands', JSON.stringify({
      camera: camera_id,
      action: 'preset',
      preset,
      result,
      timestamp: new Date().toISOString()
    }));
    
    res.json({ status: 'ok', camera: camera_id, preset, result });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.post('/api/ptz/manual', async (req: Request, res: Response): Promise<void> => {
  const { camera_id, pan, tilt, zoom }: { 
    camera_id?: string; 
    pan?: number; 
    tilt?: number; 
    zoom?: number; 
  } = req.body;
  
  if (!camera_id) {
    res.status(400).json({ error: 'camera_id required' });
    return;
  }
  
  try {
    const ptzParams: { pan?: number; tilt?: number; zoom?: number } = {};
    if (pan !== undefined) ptzParams.pan = pan;
    if (tilt !== undefined) ptzParams.tilt = tilt;
    if (zoom !== undefined) ptzParams.zoom = zoom;
    
    const result = await slew2.setPTZ(camera_id, ptzParams);
    
    res.json({ status: 'ok', camera: camera_id, pan, tilt, zoom, result });
    return;
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
    return;
  }
});

app.get('/api/ptz/status/:camera_id', async (req: Request, res: Response) => {
  try {
    const status = await slew2.getStatus(req.params.camera_id);
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// LRAD control via relay (Adam 6060 or similar)
app.post('/api/lrad/activate', async (req: Request, res: Response) => {
  const { duration = 10, pattern = 'deterrent', spl = 95, zone = 'unknown' }: LRADActivation = req.body;
  
  try {
    // Simulate LRAD activation
    await activateLRAD(duration, pattern, spl, zone);
    
    // Log to DragonflyDB
    await redis.lpush('lrad:activations', JSON.stringify({
      duration,
      pattern,
      spl,
      zone,
      timestamp: new Date().toISOString()
    }));
    
    // Publish event
    await redis.publish('lrad:activated', JSON.stringify({
      duration,
      pattern,
      spl,
      zone,
      timestamp: new Date().toISOString()
    }));
    
    res.json({ status: 'activated', duration, pattern, spl, zone });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

async function activateLRAD(duration: number, pattern: string, spl: number, zone: string): Promise<void> {
  console.log(`🔊 LRAD Activated: ${pattern} @ ${spl}dB for ${duration}s in zone ${zone}`);
  
  // Here you would send actual Modbus/relay commands to Adam 6060
  // For now, simulate with logging
  
  // Log activation start
  const startEvent: LRADEvent = {
    type: 'LRAD_START',
    pattern,
    spl,
    duration,
    zone,
    timestamp: new Date().toISOString()
  };
  
  await redis.publish('events:lrad', JSON.stringify(startEvent));
  
  // Schedule deactivation
  setTimeout(async () => {
    console.log('🔇 LRAD Deactivated');
    
    const stopEvent: LRADEvent = {
      type: 'LRAD_STOP',
      pattern,
      spl,
      zone,
      timestamp: new Date().toISOString()
    };
    
    await redis.publish('events:lrad', JSON.stringify(stopEvent));
  }, duration * 1000);
}

// Manual threat response endpoint
app.post('/api/threat/respond', async (req: Request, res: Response) => {
  const { threatPosition, priority = 'medium', responseType = 'voice_warning', message } = req.body;
  
  if (!threatPosition || !threatPosition.lat || !threatPosition.lng) {
    res.status(400).json({ error: 'threatPosition with lat/lng required' });
    return;
  }
  
  try {
    // Create synthetic threat for testing
    const syntheticThreat: BoomerangAlert = {
      id: `manual_${Date.now()}`,
      timestamp: new Date().toISOString(),
      position: {
        latitude: threatPosition.lat,
        longitude: threatPosition.lng,
        elevation: threatPosition.elevation || 0
      },
      bearing: threatPosition.bearing || 0,
      distance: threatPosition.distance || 500,
      confidence: 95,
      threat_type: 'unknown',
      audio_signature: {
        frequency: 1000,
        duration: 1,
        amplitude: 70
      }
    };
    
    // Process the threat
    await processBoomerangAlert(syntheticThreat);
    
    res.json({ 
      status: 'ok', 
      message: 'Threat response initiated',
      threatId: syntheticThreat.id
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Simulate Boomerang alert endpoint
app.post('/api/boomerang/simulate', async (req: Request, res: Response) => {
  const { 
    position = { latitude: 40.7128, longitude: -74.0060 },
    bearing = 45,
    distance = 200,
    threat_type = 'gunshot',
    confidence = 85
  } = req.body;
  
  try {
    const simulatedAlert: BoomerangAlert = {
      id: `sim_${Date.now()}`,
      timestamp: new Date().toISOString(),
      position,
      bearing,
      distance,
      confidence,
      threat_type,
      audio_signature: {
        frequency: threat_type === 'gunshot' ? 2000 : 500,
        duration: threat_type === 'gunshot' ? 0.1 : 1.0,
        amplitude: 80
      }
    };
    
    // Publish simulated Boomerang alert
    await redis.publish('alerts:boomerang', JSON.stringify(simulatedAlert));
    
    res.json({ 
      status: 'ok', 
      message: 'Boomerang alert simulated',
      alert: simulatedAlert
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get threat response status
app.get('/api/threat/status', async (_req: Request, res: Response) => {
  try {
    // Get recent threat events
    const recentEvents = await redis.lrange('queue:threat_events', 0, 9);
    const events = recentEvents.map(event => JSON.parse(event));
    
    res.json({ 
      status: 'ok',
      recent_threats: events,
      active_responses: events.filter(e => 
        new Date().getTime() - new Date(e.timestamp).getTime() < 300000 // Last 5 minutes
      ).length
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get available presets
app.get('/api/ptz/presets/:camera_id', (req: Request, res: Response) => {
  const cameraPresets = presets.ptz_presets?.[req.params.camera_id] || [];
  res.json(cameraPresets);
});

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    serial_port: ptzSerial ? 'connected' : 'disconnected',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.listen(8090, () => {
  console.log('🚀 Slew2 PTZ Driver running on port 8090');
  console.log('🔌 Serial port status:', ptzSerial ? 'connected' : 'mock mode');
  console.log('🎯 Loaded presets for cameras:', Object.keys(presets.ptz_presets || {}));
});