// LRAD ONVIF Profile Implementation
// Bridges LRAD API calls to ONVIF PTZ-like commands for VMS compatibility

import WebSocket from 'ws';

export interface LRADCapabilities {
  model: string;
  maxSPL: number;
  beamWidth: number;
  verticalBeam: number;
  maxRange: number;
  frequencyRange: [number, number];
  hasOpticalDazzler: boolean;
  supportedCommands: string[];
}

export interface LRADPosition {
  azimuth: number;   // degrees 0-360
  elevation: number; // degrees -90 to +90
  zoom: number;      // 1.0 = wide beam, higher = focused
}

export interface LRADConfiguration {
  volume: number;        // 0-100%
  frequency: number;     // Hz within device range
  duration: number;      // seconds (0 = continuous)
  mode: 'voice' | 'siren' | 'deterrent' | 'standby';
  dazzlerEnabled: boolean;
}

// ONVIF-compatible PTZ node mapping for LRAD devices
export class LRADONVIFProfile {
  private deviceId: string;
  private capabilities: LRADCapabilities;
  private currentPosition: LRADPosition;
  private currentConfig: LRADConfiguration;
  private websocket?: WebSocket | undefined;
  private lradEndpoint: string;

  constructor(deviceId: string, lradEndpoint: string) {
    this.deviceId = deviceId;
    this.lradEndpoint = lradEndpoint;
    this.currentPosition = { azimuth: 0, elevation: 0, zoom: 1.0 };
    this.currentConfig = {
      volume: 50,
      frequency: 1000,
      duration: 0,
      mode: 'standby',
      dazzlerEnabled: false
    };
    
    // Default capabilities - will be updated on connection
    this.capabilities = {
      model: 'Unknown',
      maxSPL: 120,
      beamWidth: 30,
      verticalBeam: 30,
      maxRange: 1000,
      frequencyRange: [200, 8000],
      hasOpticalDazzler: false,
      supportedCommands: ['move', 'stop', 'preset', 'status']
    };
  }

  // Initialize connection to LRAD device
  async initialize(): Promise<void> {
    try {
      // Connect to LRAD WebSocket API
      this.websocket = new WebSocket(this.lradEndpoint);
      
      this.websocket.on('open', () => {
        console.log(`[LRAD-ONVIF] Connected to LRAD device: ${this.deviceId}`);
        this.requestCapabilities();
      });

      this.websocket.on('message', (data) => {
        this.handleLRADMessage(JSON.parse(data.toString()));
      });

      this.websocket.on('error', (error) => {
        console.error(`[LRAD-ONVIF] WebSocket error for ${this.deviceId}:`, error);
      });

      this.websocket.on('close', () => {
        console.log(`[LRAD-ONVIF] Disconnected from LRAD device: ${this.deviceId}`);
        // Attempt reconnection after 5 seconds
        setTimeout(() => this.initialize(), 5000);
      });

    } catch (error) {
      console.error(`[LRAD-ONVIF] Failed to initialize LRAD device ${this.deviceId}:`, error);
      throw error;
    }
  }

  // ONVIF PTZ Command: Absolute Move
  async absoluteMove(pan: number, tilt: number, zoom: number): Promise<void> {
    // Convert ONVIF coordinates to LRAD position
    // ONVIF: pan/tilt range typically -1.0 to 1.0
    // LRAD: azimuth 0-360°, elevation -90° to +90°
    
    const azimuth = ((pan + 1) / 2) * 360; // Convert -1:1 to 0:360
    const elevation = tilt * 90; // Convert -1:1 to -90:90
    
    const position: LRADPosition = {
      azimuth: Math.max(0, Math.min(360, azimuth)),
      elevation: Math.max(-90, Math.min(90, elevation)),
      zoom: Math.max(1.0, Math.min(10.0, zoom))
    };

    await this.moveToPosition(position);
  }

  // ONVIF PTZ Command: Relative Move
  async relativeMove(deltaX: number, deltaY: number, deltaZoom: number): Promise<void> {
    const newPosition: LRADPosition = {
      azimuth: (this.currentPosition.azimuth + deltaX * 10) % 360,
      elevation: Math.max(-90, Math.min(90, this.currentPosition.elevation + deltaY * 10)),
      zoom: Math.max(1.0, Math.min(10.0, this.currentPosition.zoom + deltaZoom))
    };

    await this.moveToPosition(newPosition);
  }

  // ONVIF PTZ Command: Continuous Move
  async continuousMove(velocityX: number, velocityY: number, velocityZoom: number): Promise<void> {
    // Start continuous movement in specified direction
    const command = {
      type: 'continuous_move',
      deviceId: this.deviceId,
      velocity: {
        pan: velocityX,
        tilt: velocityY,
        zoom: velocityZoom
      }
    };

    this.sendToLRAD(command);
  }

  // ONVIF PTZ Command: Stop
  async stop(stopPan: boolean = true, stopTilt: boolean = true, stopZoom: boolean = true): Promise<void> {
    const command = {
      type: 'stop',
      deviceId: this.deviceId,
      stopPan,
      stopTilt,
      stopZoom
    };

    this.sendToLRAD(command);
  }

  // ONVIF PTZ Command: Go to Preset
  async gotoPreset(presetToken: string): Promise<void> {
    const command = {
      type: 'goto_preset',
      deviceId: this.deviceId,
      presetToken
    };

    this.sendToLRAD(command);
  }

  // ONVIF PTZ Command: Set Preset
  async setPreset(presetToken: string, presetName: string): Promise<void> {
    const command = {
      type: 'set_preset',
      deviceId: this.deviceId,
      presetToken,
      presetName,
      position: this.currentPosition,
      configuration: this.currentConfig
    };

    this.sendToLRAD(command);
  }

  // LRAD-specific: Activate deterrent mode
  async activateDeterrent(config: Partial<LRADConfiguration> = {}): Promise<void> {
    const deterrentConfig: LRADConfiguration = {
      ...this.currentConfig,
      ...config,
      mode: 'deterrent'
    };

    const command = {
      type: 'activate_deterrent',
      deviceId: this.deviceId,
      configuration: deterrentConfig
    };

    this.sendToLRAD(command);
    this.currentConfig = deterrentConfig;
  }

  // LRAD-specific: Voice announcement
  async announceVoice(message: string, config: Partial<LRADConfiguration> = {}): Promise<void> {
    const voiceConfig: LRADConfiguration = {
      ...this.currentConfig,
      ...config,
      mode: 'voice'
    };

    const command = {
      type: 'voice_announcement',
      deviceId: this.deviceId,
      message,
      configuration: voiceConfig
    };

    this.sendToLRAD(command);
  }

  // LRAD-specific: Siren activation
  async activateSiren(config: Partial<LRADConfiguration> = {}): Promise<void> {
    const sirenConfig: LRADConfiguration = {
      ...this.currentConfig,
      ...config,
      mode: 'siren'
    };

    const command = {
      type: 'activate_siren',
      deviceId: this.deviceId,
      configuration: sirenConfig
    };

    this.sendToLRAD(command);
    this.currentConfig = sirenConfig;
  }

  // LRAD-specific: Standby mode
  async enterStandby(): Promise<void> {
    const command = {
      type: 'enter_standby',
      deviceId: this.deviceId
    };

    this.sendToLRAD(command);
    this.currentConfig.mode = 'standby';
  }

  // Get current ONVIF-compatible status
  getStatus() {
    return {
      deviceId: this.deviceId,
      capabilities: this.capabilities,
      position: {
        // Convert LRAD coordinates back to ONVIF format
        pan: (this.currentPosition.azimuth / 360) * 2 - 1, // 0:360 to -1:1
        tilt: this.currentPosition.elevation / 90, // -90:90 to -1:1
        zoom: this.currentPosition.zoom
      },
      configuration: this.currentConfig,
      isOnline: this.websocket?.readyState === WebSocket.OPEN
    };
  }

  // Private methods
  private async moveToPosition(position: LRADPosition): Promise<void> {
    const command = {
      type: 'move_absolute',
      deviceId: this.deviceId,
      position
    };

    this.sendToLRAD(command);
    this.currentPosition = position;
  }

  private sendToLRAD(command: any): void {
    if (this.websocket?.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify(command));
    } else {
      console.error(`[LRAD-ONVIF] Cannot send command - WebSocket not connected for ${this.deviceId}`);
    }
  }

  private requestCapabilities(): void {
    const command = {
      type: 'get_capabilities',
      deviceId: this.deviceId
    };

    this.sendToLRAD(command);
  }

  private handleLRADMessage(message: any): void {
    switch (message.type) {
      case 'capabilities_response':
        this.capabilities = message.capabilities;
        console.log(`[LRAD-ONVIF] Updated capabilities for ${this.deviceId}:`, this.capabilities);
        break;

      case 'position_update':
        this.currentPosition = message.position;
        break;

      case 'configuration_update':
        this.currentConfig = message.configuration;
        break;

      case 'status_update':
        // Handle general status updates
        break;

      case 'error':
        console.error(`[LRAD-ONVIF] LRAD error for ${this.deviceId}:`, message.error);
        break;

      default:
        console.log(`[LRAD-ONVIF] Unhandled message type: ${message.type}`);
    }
  }

  // Cleanup
  async disconnect(): Promise<void> {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = undefined;
    }
  }
}

// Factory function for creating LRAD ONVIF profiles
export function createLRADONVIFProfile(deviceId: string, lradEndpoint: string): LRADONVIFProfile {
  return new LRADONVIFProfile(deviceId, lradEndpoint);
}

// ONVIF Profile T/G/S compatibility layer
export const ONVIFCompatibilityLayer = {
  // Profile T: Streaming
  getStreamUri: (deviceId: string) => {
    // LRAD doesn't have video streams, but we can provide audio stream
    return `ws://lrad-audio-stream/${deviceId}`;
  },

  // Profile G: Recording and Search
  getRecordings: (deviceId: string) => {
    // Return LRAD usage logs
    return [];
  },

  // Profile S: Access Control
  getAccessRules: (deviceId: string) => {
    // Return LRAD authorization policies
    return [];
  }
};