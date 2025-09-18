# Railway C2 Platform Deployment Guide

## Quick Deploy to Railway

### 1. Prerequisites
- Railway account (railway.app)
- GitHub repository with your code
- Railway CLI installed

### 2. Deploy Backend Service

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Create new project
railway new

# Deploy backend
cd c2-backend
railway up --service backend

# Add environment variables
railway variables set DATABASE_URL=sqlite:///./c2.db
railway variables set CORS_ORIGINS=https://your-frontend-domain.railway.app
```

### 3. Deploy Frontend Service

```bash
# Deploy frontend
cd ../c2-frontend
railway up --service frontend

# Add environment variables
railway variables set NEXT_PUBLIC_API_URL=https://your-backend-domain.railway.app
```

### 4. Configure Custom Domain (Optional)

```bash
# Add custom domain to services
railway domain add your-c2-platform.com --service frontend
railway domain add api.your-c2-platform.com --service backend
```

### 5. Environment Variables

**Backend (.env)**:
```
DATABASE_URL=sqlite:///./c2.db
CORS_ORIGINS=https://your-frontend-domain.railway.app
PORT=8000
```

**Frontend (.env.local)**:
```
NEXT_PUBLIC_API_URL=https://your-backend-domain.railway.app
NEXT_PUBLIC_WS_URL=wss://your-backend-domain.railway.app
```

### 6. Post-Deployment

1. Test API health: `https://your-backend-domain.railway.app/health`
2. Access frontend: `https://your-frontend-domain.railway.app`
3. Monitor logs: `railway logs --service backend`

### 7. Scaling & Monitoring

```bash
# Scale services
railway scale --replicas 2 --service backend

# View metrics
railway metrics --service backend

# View logs
railway logs --follow --service backend
```

## Architecture

- **Backend**: FastAPI + SQLite + WebSockets (Auto-scaling)
- **Frontend**: Next.js + Static Deployment
- **Database**: SQLite (persistent volume)
- **Real-time**: WebSocket connections

## Costs

- **Hobby Plan**: $5/month per service
- **Pro Plan**: $20/month + usage
- **Team Plan**: $99/month + usage

Railway provides automatic SSL, custom domains, and environment management.