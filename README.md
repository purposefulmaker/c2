# C2 Platform - Complete Deployment Ready!

## 🎯 What's Built

### Frontend (Next.js)
- **C2 Dashboard**: Real-time tactical command interface
- **Tactical Map**: Interactive Leaflet map with zones and device tracking
- **Event Feed**: Live security event monitoring
- **Device Control**: Quick response LRAD and camera controls
- **System Status**: Real-time system health monitoring
- **Zone Editor**: Interactive security zone management

### Backend (FastAPI)
- **REST API**: Complete CRUD operations for all entities
- **WebSocket**: Real-time event streaming
- **Mock Devices**: Simulated security devices and sensors
- **Database**: SQLite with async operations
- **Health Monitoring**: System status and device monitoring

## 🚀 Local Development

### Frontend (Port 3003)
```bash
cd c2-frontend
npm run dev
```

### Backend (Port 8000)
```bash
cd c2-backend
.\venv\Scripts\Activate.ps1  # Windows
python main.py
```

## ☁️ Railway Deployment

### Option 1: Quick Deploy
```bash
# Run the deployment script
bash deploy-railway.sh
```

### Option 2: Manual Deploy
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and create project
railway login
railway new c2-platform

# Deploy backend
cd c2-backend
railway up --service c2-backend

# Deploy frontend  
cd ../c2-frontend
railway up --service c2-frontend
```

## 🔧 Configuration

### Environment Variables

**Backend**:
- `DATABASE_URL`: SQLite database path
- `CORS_ORIGINS`: Frontend domain for CORS
- `PORT`: Server port (8000)

**Frontend**:
- `NEXT_PUBLIC_API_URL`: Backend API endpoint
- `NEXT_PUBLIC_WS_URL`: WebSocket endpoint

### Custom Domains
```bash
railway domain add your-domain.com --service c2-frontend
railway domain add api.your-domain.com --service c2-backend
```

## 📊 Features

- ✅ Real-time tactical map with device tracking
- ✅ Live event feed and notifications
- ✅ Quick response controls (LRAD, cameras)
- ✅ Interactive zone editor
- ✅ System health monitoring
- ✅ WebSocket real-time updates
- ✅ Mock device simulation
- ✅ Responsive dark UI design
- ✅ Railway deployment ready

## 🎮 Usage

1. **Monitor**: Watch real-time events on the tactical map
2. **Respond**: Use quick response controls for LRAD and cameras
3. **Manage**: Edit security zones with the zone editor
4. **Track**: Monitor device status and system health
5. **Analyze**: Review event history and patterns

Perfect for perimeter security, facility monitoring, and tactical operations!