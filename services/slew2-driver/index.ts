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

// Subscribe to PTZ commands from DragonflyDB
redis.subscribe('commands:ptz');
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
  }
});

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