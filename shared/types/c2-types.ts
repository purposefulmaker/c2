// shared/types/c2-types.ts - Shared TypeScript types for C2 platform services

// Core coordinate system
export interface Coordinates {
  lat: number;
  lng: number;
}

// Camera and PTZ types
export interface PTZCommand {
  id?: string;
  camera_id: string;
  action: 'move' | 'stop' | 'preset';
  pan?: number;
  tilt?: number;
  zoom?: number;
  preset?: number;
}

export interface PTZResult {
  status: 'success' | 'error' | 'mock_success';
  error?: string;
}

export interface PTZStatus {
  camera_id: string;
  pan: number;
  tilt: number;
  zoom: number;
  status: string;
  timestamp: string;
}

export interface CameraConfig {
  id: string;
  name: string;
  ip: string;
  username: string;
  password: string;
  ptz?: boolean;
  analytics?: boolean;
}

export interface CameraStreams {
  rtsp?: string;
  snapshot?: string;
  hls?: string;
}

export interface CameraInfo {
  id: string;
  name: string;
  ip: string;
  status: 'online' | 'offline' | 'maintenance';
  ptz: boolean;
  streams: CameraStreams;
  capabilities?: any;
}

// Event types
export interface BaseEvent {
  id: string;
  timestamp: string;
  type: string;
  source: string;
}

export interface CameraEvent extends BaseEvent {
  camera_id: string;
  type: 'motion' | 'line_crossing' | 'intrusion' | 'camera_analytics';
  data: any;
  confidence?: number;
}

export interface TacticalEvent extends BaseEvent {
  type: 'gunshot' | 'intrusion' | 'crowd' | 'vehicle' | 'manual';
  location: Coordinates;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  zone_id?: string;
  auto_response_triggered: boolean;
  status: 'active' | 'acknowledged' | 'resolved';
  metadata: EventMetadata;
}

export interface EventMetadata {
  audio_signature?: AudioSignature;
  video_available?: boolean;
  responder_assigned?: string;
  estimated_crowd_size?: number;
  movement_direction?: number;
  [key: string]: any;
}

export interface AudioSignature {
  frequency_profile: number[];
  duration: number;
  peak_amplitude: number;
  classification_confidence: number;
}

// LRAD types
export interface LRADActivation {
  duration?: number;
  pattern?: string;
  spl?: number;
  zone?: string;
  device_id?: string;
}

export interface LRADEvent extends BaseEvent {
  type: 'LRAD_START' | 'LRAD_STOP';
  pattern: string;
  spl: number;
  duration?: number;
  zone: string;
  device_id: string;
}

// Zone types
export interface Zone {
  id: string;
  name: string;
  type: 'red' | 'yellow' | 'green' | 'restricted' | 'custom';
  coordinates: Coordinates[];
  properties: ZoneProperties;
  visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface ZoneProperties {
  day_spl: number;
  night_spl: number;
  auto_response: boolean;
  color: string;
  opacity: number;
  priority: number;
  enforcement_level: 'warning' | 'moderate' | 'strict' | 'critical';
  policy_id?: string;
}

// Device types
export interface LRADDevice {
  id: string;
  name: string;
  location: Coordinates;
  status: 'online' | 'offline' | 'maintenance';
  coverage_ranges: CoverageRange[];
  max_spl: number;
  current_direction: number;
  capabilities: DeviceCapabilities;
}

export interface CoverageRange {
  spl: number;
  radius: number;
  frequency_range?: [number, number];
}

export interface DeviceCapabilities {
  ptz_control: boolean;
  audio_output: boolean;
  video_recording: boolean;
  thermal_imaging: boolean;
  night_vision: boolean;
}

// WebSocket message types
export interface WSMessage {
  type: string;
  payload?: any;
  timestamp: string;
  client_id?: string;
}

export interface WSPTZMessage extends WSMessage {
  type: 'ptz';
  camera_id: string;
  action: string;
  pan?: number;
  tilt?: number;
  zoom?: number;
}

export interface WSEventMessage extends WSMessage {
  type: 'event';
  event: TacticalEvent | CameraEvent | LRADEvent;
}

// API Response types
export interface APIResponse<T = any> {
  status: 'ok' | 'error';
  data?: T;
  error?: string;
  timestamp: string;
}

export interface HealthCheck {
  status: 'healthy' | 'unhealthy';
  uptime: number;
  timestamp: string;
  version?: string;
  [key: string]: any;
}

// Redis/DragonflyDB event types
export interface RedisEvent {
  channel: string;
  message: string;
  timestamp: string;
}

export interface QueuedCommand {
  id: string;
  type: string;
  payload: any;
  timestamp: string;
  priority?: number;
  retry_count?: number;
}

// Service registration types
export interface ServiceRegistration {
  service_name: string;
  service_type: 'camera' | 'ptz' | 'lrad' | 'analytics' | 'websocket';
  host: string;
  port: number;
  endpoints: string[];
  capabilities: string[];
  timestamp: string;
  health_check_url?: string;
}

// Boomerang detection types
export interface BoomerangAlarm {
  type: 'BOOMERANG_ALARM';
  timestamp: string;
  location: Coordinates;
  confidence: number;
  device_id: string;
  metadata: {
    sound_level?: number;
    frequency_analysis?: string;
    raw_packet?: string;
    [key: string]: any;
  };
}

// Thermal detection types
export interface ThermalAlarm {
  type: 'THERMAL_ALARM';
  timestamp: string;
  location: Coordinates;
  confidence: number;
  device_id: string;
  metadata: {
    temperature?: number;
    target_size?: string;
    [key: string]: any;
  };
}