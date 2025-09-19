# C2 Platform - Complete Vendor Stack Deployment Guide

## Quick Deploy to Railway

1. **Install Railway CLI**:
   ```bash
   npm install -g @railway/cli
   ```

2. **Login and Deploy**:
   ```bash
   railway login
   railway up
   ```

## Deploy Sequence

Railway will automatically deploy services in dependency order:

1. **DragonflyDB** → Core Redis-compatible cache/queue
2. **Bun WebSocket** → Gunshot detection event processing  
3. **ONVIF Wrapper** → Camera discovery and PTZ control
4. **Slew2 Driver** → PTZ camera control and LRAD activation
5. **C2 Backend** → FastAPI with vendor integration
6. **C2 Frontend** → React interface with enhanced zone editor

## Service Endpoints

After deployment, Railway provides URLs for each service:

- **Frontend**: `https://c2-frontend-[id].railway.app`
- **API**: `https://c2-api-[id].railway.app` 
- **Bun WebSocket**: `wss://c2-bun-ws-[id].railway.app/ws`
- **ONVIF**: `https://c2-onvif-[id].railway.app`
- **Slew2**: `https://c2-slew2-[id].railway.app`
- **DragonflyDB**: Internal service communication only

## Environment Variables

Railway automatically injects service-to-service URLs. Manual config:

```bash
# Optional: Custom domain mapping
railway domain add your-domain.com c2-frontend

# Optional: Database URL override
railway variables set DATABASE_URL="postgresql://..."

# Optional: Enable debug logging
railway variables set DEBUG="true"
```

## Monitoring

### Health Checks
All services include health endpoints:
- `/health` - Service status
- `/metrics` - Performance data (DragonflyDB)
- `/api/stats` - WebSocket connection stats

### Service Dependencies
```
DragonflyDB
├── Bun WebSocket (gunshot events)
├── ONVIF Wrapper (camera control)
├── Slew2 Driver (PTZ/LRAD)
└── C2 Backend (main API)
    └── C2 Frontend (user interface)
```

## Production Configuration

### Resource Allocation
- **DragonflyDB**: 1GB RAM, 0.5 CPU
- **Services**: Auto-scaling based on traffic
- **Storage**: Persistent volumes for DragonflyDB

### Security
- Private networking between services
- CORS configured for frontend domain
- Environment-based secrets

## Local Development vs Production

| Component | Local | Production |
|-----------|-------|------------|
| DragonflyDB | localhost:6379 | Railway private domain |
| Frontend | localhost:3000 | Railway static URL |
| Backend | localhost:8000 | Railway service URL |
| WebSocket | localhost:3001 | Railway WebSocket URL |

## Troubleshooting

### Common Issues
1. **Service startup order**: Railway handles dependencies automatically
2. **Network connectivity**: Check `${{service.RAILWAY_PRIVATE_DOMAIN}}` variables
3. **Health checks failing**: Verify service ports and paths

### Logs
```bash
# View service logs
railway logs c2-backend
railway logs c2-bun-ws
railway logs dragonfly

# Follow live logs
railway logs --follow c2-backend
```

### Scaling
```bash
# Scale specific service
railway scale c2-backend --replicas 2

# Resource limits
railway scale c2-backend --memory 2GB --cpu 1.0
```

## Complete Stack Features

### Vendor Implementation
✅ **DragonflyDB**: 25x faster Redis-compatible cache  
✅ **Bun WebSocket**: High-performance event processing  
✅ **ONVIF**: Camera discovery and PTZ control  
✅ **Slew2**: PTZ driver with LRAD activation  

### C2 Platform Integration
✅ **Enhanced Zone Editor**: KML overlay support  
✅ **Real-time Events**: WebSocket integration  
✅ **Camera Control**: PTZ and LRAD activation  
✅ **Event Processing**: Gunshot detection pipeline  

### Production Ready
✅ **Docker Orchestration**: Complete containerization  
✅ **Health Monitoring**: Service health checks  
✅ **Auto-scaling**: Railway platform scaling  
✅ **Private Networking**: Secure service communication  

## Next Steps

1. **Deploy**: `railway up`
2. **Monitor**: Check service health endpoints
3. **Configure**: Set up camera configurations
4. **Test**: Verify event processing pipeline