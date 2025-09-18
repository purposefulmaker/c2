# C2 Perimeter Security Platform

A comprehensive C2 (Command & Control) platform for perimeter security operations, combining real-time event processing, tactical mapping, device control, and automated response systems.

## 🎯 Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend APIs  │    │  Event Services │
│  (Next.js)      │◄──►│   (FastAPI)     │◄──►│  (Bun WebSocket)│
│  Port: 3000     │    │   Port: 8000    │    │   Port: 3001    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐             │
         └─────────────►│   DragonflyDB   │◄────────────┘
                        │   Port: 6379    │
                        └─────────────────┘
                                 │
                    ┌─────────────────────────────┐
                    │      Additional Services    │
                    │  • Node-RED (Automation)    │
                    │  • ONVIF Wrapper (Cameras)  │
                    │  • Slew2 Driver (PTZ)       │
                    │  • Portainer (Management)   │
                    └─────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- Python 3.11+
- Docker & Docker Compose
- Git

### 1. Start Core Services

```bash
# Start existing working services
cd c2-frontend
npm run dev          # Frontend on http://localhost:3000

cd ../c2-backend
python -m venv venv
.\venv\Scripts\Activate.ps1  # Windows
pip install -r requirements.txt
python main.py       # Backend on http://localhost:8000
```

### 2. Start Vendor Stack (Optional)

```bash
# Start full Docker stack
docker-compose up -d

# Access services:
# - Portainer: http://localhost:9000 (admin/c2admin)
# - Node-RED: http://localhost:1880
# - DragonflyDB: http://localhost:6380
# - Bun WebSocket: http://localhost:3001
```

## 📁 Project Structure

```
c2/
├── c2-frontend/          # Next.js React frontend (working)
│   ├── src/components/   # C2 dashboard components
│   ├── src/app/         # Next.js app router
│   └── public/          # Static assets
├── c2-backend/          # FastAPI backend (working)
│   ├── api/             # REST API modules
│   ├── models.py        # Database models
│   ├── main.py          # FastAPI app
│   └── mock_devices.py  # Device simulators
├── services/            # Vendor stack implementation
│   ├── bun-websocket/   # Event processing service
│   ├── onvif-wrapper/   # Camera integration
│   └── slew2-driver/    # PTZ control
├── config/              # Configuration files
│   ├── cameras.yml      # Camera definitions
│   └── ptz-presets.yml  # PTZ preset positions
├── flows/               # Node-RED automation flows
├── kml/                 # Zone definition files
└── docker-compose.yml   # Full stack deployment
```

## 🎛️ Features

### Core C2 Platform (Working)
- ✅ **Real-time Dashboard**: Tactical overview with live updates
- ✅ **Interactive Map**: Leaflet-based tactical map with device tracking
- ✅ **Event Feed**: Live security event monitoring and alerts
- ✅ **Device Control**: Quick response controls for LRAD and cameras
- ✅ **System Status**: Real-time health monitoring
- ✅ **WebSocket Integration**: Live event streaming
- ✅ **Mock Devices**: Simulated sensors for testing

### Vendor Stack Integration (In Progress)
- 🔄 **DragonflyDB**: High-performance Redis-compatible cache/queue
- 🔄 **Bun WebSocket**: Ultra-fast event processing server
- 🔄 **Interactive Zone Editor**: KML-based security zone management
- 🔄 **ONVIF Integration**: Automatic camera discovery and control
- 🔄 **Node-RED Automation**: Visual flow-based response automation
- 🔄 **Slew2 PTZ Driver**: Professional PTZ camera control

## 🔧 Development

### Frontend Development
```bash
cd c2-frontend
npm run dev     # Development server
npm run build   # Production build
npm run lint    # Code linting
```

### Backend Development
```bash
cd c2-backend
.\venv\Scripts\Activate.ps1
python main.py  # Development server with auto-reload
```

### Testing Events
```bash
# Trigger test gunshot event
curl -X POST http://localhost:3001/api/trigger

# Trigger test thermal event  
curl -X POST http://localhost:3001/api/thermal

# View WebSocket events
# Open http://localhost:3001 for test interface
```

## 🌐 API Endpoints

### C2 Backend (Port 8000)
- `GET /health` - Health check
- `GET /events` - List events
- `POST /events` - Create event
- `GET /devices` - List devices
- `WS /ws` - WebSocket connection

### Bun WebSocket (Port 3001)
- `GET /` - Test interface
- `POST /api/trigger` - Trigger gunshot event
- `POST /api/thermal` - Trigger thermal event
- `GET /api/stats` - Server statistics
- `WS /ws` - Event WebSocket

## 🐳 Docker Deployment

```bash
# Start everything
docker-compose up -d

# View logs
docker-compose logs -f

# Scale services
docker-compose up -d --scale bun-websocket=3

# Stop everything
docker-compose down
```

## 🔌 Hardware Integration

### Camera Integration
- Edit `config/cameras.yml` to add your cameras
- Supports ONVIF-compatible cameras
- Auto-discovery available

### Sensor Integration
- Boomerang gunshot detectors via UDP (port 4001)
- Thermal cameras via webhook (port 8081)
- Adam relay modules for LRAD control

### PTZ Control
- Pelco-D protocol support
- Slew2 protocol for advanced PTZ
- Serial communication via USB

## 📊 Monitoring

### Access Points
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000/docs
- **Portainer**: http://localhost:9000
- **Node-RED**: http://localhost:1880
- **DragonflyDB Stats**: http://localhost:6380

### Health Checks
```bash
curl http://localhost:8000/health      # Backend health
curl http://localhost:3001/api/stats   # WebSocket stats
```

## 🚀 Deployment

### Railway Deployment
```bash
# Deploy with Railway CLI
railway login
railway new c2-platform
railway up
```

### Docker Production
```bash
# Production stack
docker-compose -f docker-compose.prod.yml up -d
```

## 🔒 Security Notes

- Change default passwords in production
- Use HTTPS in production environments
- Secure Redis/DragonflyDB access
- Implement proper authentication
- Review camera access credentials

## 📝 TODO

- [ ] Complete linting fixes in frontend
- [ ] Integrate DragonflyDB with existing backend
- [ ] Add authentication system
- [ ] Complete ONVIF wrapper implementation
- [ ] Add comprehensive test suite
- [ ] Production deployment guides

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

## 📄 License

This project is proprietary - for internal use only.

---

**Status**: Core platform working, vendor stack integration in progress
**Last Updated**: September 18, 2025