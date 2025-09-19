# C2 Command & Control Platform

## Overview

The C2 (Command & Control) Platform is a comprehensive tactical surveillance and response system designed for security operations, perimeter defense, and threat detection. The platform integrates multiple sensor types, automated response systems, and real-time visualization for situational awareness.

## Architecture Overview

### Current Technology Stack

```
Frontend (Next.js 15 + TypeScript)
├── React 19 with Turbopack
├── TailwindCSS + Radix UI
├── Leaflet mapping
├── Real-time WebSocket connection
└── Zustand state management

Python Backend (FastAPI)
├── Async SQLite database
├── WebSocket connection manager
├── Redis/DragonflyDB integration
├── RESTful API endpoints
└── Mock device simulation

Vendor Services (TypeScript/Node.js)
├── Bun WebSocket Server (Event Processing)
├── ONVIF Camera Wrapper
├── Slew2 PTZ Driver
└── Serial Device Communication

Infrastructure
├── DragonflyDB (Redis-compatible, 25x faster)
├── Node-RED (Flow automation)
├── Portainer (Container management)
└── Docker Compose orchestration
```

## System Components

### 1. Core Services

#### Python Backend (`c2-backend/`)
- **Technology**: FastAPI + AsyncIO + SQLite
- **Purpose**: Main API server, database management, WebSocket coordination
- **Features**:
  - Device management and configuration
  - Event processing and storage
  - Zone management and geofencing
  - Camera and actuator control APIs
  - Real-time WebSocket broadcasting

#### Next.js Frontend (`c2-frontend/`)
- **Technology**: Next.js 15 + React 19 + TypeScript
- **Purpose**: Operator interface and command console
- **Features**:
  - Interactive tactical map (Leaflet)
  - Real-time event visualization
  - PTZ camera control interface
  - Device status monitoring
  - Zone editor and management

### 2. Vendor Integration Services

#### Bun WebSocket Server (`services/bun-websocket/`)
- **Technology**: Bun runtime + TypeScript
- **Purpose**: High-performance event processing and distribution
- **Features**:
  - Boomerang acoustic gunshot detection
  - UDP packet processing (port 4001)
  - Thermal camera webhook integration
  - Real-time event broadcasting
  - Redis pub/sub integration

#### ONVIF Camera Wrapper (`services/onvif-wrapper/`)
- **Technology**: Node.js + TypeScript + ONVIF SDK
- **Purpose**: IP camera integration and PTZ control
- **Features**:
  - Automatic camera discovery
  - RTSP stream management
  - PTZ (Pan-Tilt-Zoom) control
  - Event analytics processing
  - Snapshot capture

#### Slew2 PTZ Driver (`services/slew2-driver/`)
- **Technology**: Node.js + TypeScript + SerialPort
- **Purpose**: Serial-based PTZ camera control
- **Features**:
  - Slew2 protocol implementation
  - Serial communication management
  - PTZ command translation
  - LRAD (acoustic deterrent) control
  - Hardware status monitoring

### 3. Infrastructure Components

#### DragonflyDB
- **Purpose**: High-performance Redis-compatible data store
- **Features**: 25x faster than Redis, event queuing, pub/sub messaging
- **Usage**: Event processing, caching, inter-service communication

#### Node-RED
- **Purpose**: Flow-based automation and integration
- **Features**: Visual programming, webhook processing, alert workflows

#### Portainer
- **Purpose**: Container management and monitoring
- **Features**: Docker UI, service monitoring, log management

## Data Flow Architecture

```
Sensors → Vendor Services → DragonflyDB → Python Backend → Frontend
                              ↓
                           Node-RED (Automation)
```

1. **Sensor Data Ingestion**:
   - Boomerang devices send UDP packets to Bun WebSocket server
   - Thermal cameras send webhooks to REST endpoints
   - ONVIF cameras stream events via analytics

2. **Event Processing**:
   - Vendor services normalize and validate sensor data
   - Events published to DragonflyDB channels
   - Python backend subscribes and processes events

3. **Real-time Distribution**:
   - WebSocket connections broadcast to frontend
   - Node-RED triggers automated responses
   - Database stores events for analysis

## Device Types Supported

### Sensors
- **Boomerang Acoustic Gunshot Detection**: UDP-based gunshot detection
- **Thermal Cameras**: HTTP webhook-based human detection
- **ONVIF IP Cameras**: Standards-based video analytics
- **PIR Motion Sensors**: Serial/GPIO-based motion detection

### Actuators
- **PTZ Cameras**: ONVIF and Slew2 protocol support
- **LRAD Acoustic Deterrents**: Serial-controlled sound projection
- **Lighting Systems**: Automated illumination control
- **Barrier Controls**: Gate and access control integration

## Deployment Options

### Development Environment
```bash
# Start all services
docker-compose up -d

# Or selective startup
./start-vendor-stack.sh  # Vendor services only
```

### Production Deployment
- **Railway**: Automated deployment via `railway.yml`
- **Render**: Container-based deployment
- **Fly.io**: Edge deployment with global distribution
- **Self-hosted**: Docker Compose on premises

## Configuration

### Camera Configuration (`config/cameras.yml`)
```yaml
cameras:
  - id: "cam001"
    name: "Perimeter North"
    ip: "192.168.1.100"
    username: "admin"
    password: "password"
    ptz: true
    analytics: true
```

### PTZ Presets (`config/ptz-presets.yml`)
```yaml
presets:
  - id: 1
    name: "Gate View"
    pan: 180
    tilt: 15
    zoom: 1.5
```

## API Endpoints

### Python Backend (Port 8000)
- `GET /api/events` - Recent events
- `GET /api/devices` - Device status
- `POST /api/zones` - Zone management
- `WebSocket /ws` - Real-time events

### Vendor Services
- **Bun WebSocket**: `ws://localhost:3001/ws` - Event stream
- **ONVIF Wrapper**: `http://localhost:8082/api` - Camera control
- **Slew2 Driver**: `http://localhost:8084/api` - PTZ/LRAD control

## Security Features

### Current Security
- CORS protection on all services
- Input validation and sanitization
- WebSocket connection management
- Network isolation via Docker networks

### Planned Security Enhancements
- **Azure OIDC/OAuth2 Integration**: Enterprise authentication
- **Role-Based Access Control (RBAC)**: Granular permissions
- **JWT Token Management**: Secure API access
- **Audit Logging**: Complete action tracking

## Monitoring and Observability

### Available Interfaces
- **Portainer**: `http://localhost:9000` - Container management
- **DragonflyDB Monitor**: `http://localhost:6380` - Database metrics
- **Node-RED**: `http://localhost:1880` - Flow automation
- **Bun WebSocket Test**: `http://localhost:3001` - Event testing

### Metrics Collected
- Event processing rates
- WebSocket connection counts
- Service health status
- Database performance metrics

## Development

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for TypeScript services)
- Python 3.11+ (for backend)
- Bun runtime (for WebSocket service)

### Local Development Setup
```bash
# Clone repository
git clone <repository-url>
cd c2

# Start infrastructure
docker-compose up dragonfly nodered portainer -d

# Start Python backend
cd c2-backend
python -m venv venv
source venv/bin/activate  # or .\venv\Scripts\activate on Windows
pip install -r requirements.txt
python main.py

# Start frontend
cd c2-frontend
npm install
npm run dev

# Start vendor services
cd services/bun-websocket && bun run index.ts
cd services/onvif-wrapper && npm run dev
cd services/slew2-driver && npm run dev
```

### Technology Choices

#### Why Bun for WebSocket Service?
- **Performance**: 3x faster than Node.js for WebSocket handling
- **Memory Efficiency**: Lower memory footprint for high-concurrency scenarios
- **TypeScript Native**: No compilation step needed

#### Why DragonflyDB over Redis?
- **Performance**: 25x faster than Redis for pub/sub workloads
- **Memory Efficiency**: Better memory utilization for large datasets
- **Drop-in Replacement**: Full Redis compatibility

#### Why FastAPI for Backend?
- **Async Performance**: Excellent for real-time applications
- **Type Safety**: Automatic API documentation and validation
- **WebSocket Support**: Native async WebSocket handling

## Contributing

### Code Standards
- **TypeScript**: Strict typing enabled across all services
- **Python**: Type hints and async/await patterns
- **Testing**: Unit tests for critical business logic
- **Documentation**: Comprehensive API documentation

### Service Development Guidelines
1. All vendor services must implement health check endpoints
2. Error handling should include proper logging and metrics
3. Configuration via environment variables
4. Docker containerization for all services

## License

[Specify your license here]

## Support

For technical support and deployment assistance, contact the development team.