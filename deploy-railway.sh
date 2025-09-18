#!/bin/bash
# Complete C2 Platform Railway Deployment Script

echo "🚀 C2 Platform Railway Deployment"
echo "=================================="

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Installing..."
    npm install -g @railway/cli
fi

# Login to Railway
echo "🔐 Logging into Railway..."
railway login

# Create new project
echo "📁 Creating Railway project..."
railway new c2-platform

# Deploy backend service
echo "🔧 Deploying backend service..."
cd c2-backend
railway up --service c2-backend

# Set backend environment variables
echo "⚙️ Setting backend environment variables..."
railway variables set DATABASE_URL="sqlite:///./c2.db" --service c2-backend
railway variables set CORS_ORIGINS="*" --service c2-backend
railway variables set PORT="8000" --service c2-backend

# Get backend URL
BACKEND_URL=$(railway domain --service c2-backend)
echo "📡 Backend deployed to: $BACKEND_URL"

# Deploy frontend service
echo "🎨 Deploying frontend service..."
cd ../c2-frontend
railway up --service c2-frontend

# Set frontend environment variables
echo "⚙️ Setting frontend environment variables..."
railway variables set NEXT_PUBLIC_API_URL="https://$BACKEND_URL" --service c2-frontend
railway variables set NEXT_PUBLIC_WS_URL="wss://$BACKEND_URL" --service c2-frontend

# Get frontend URL
FRONTEND_URL=$(railway domain --service c2-frontend)
echo "🌐 Frontend deployed to: $FRONTEND_URL"

# Update backend CORS with actual frontend URL
railway variables set CORS_ORIGINS="https://$FRONTEND_URL" --service c2-backend

echo ""
echo "✅ Deployment Complete!"
echo "========================"
echo "🌐 Frontend: https://$FRONTEND_URL"
echo "📡 Backend:  https://$BACKEND_URL"
echo "📊 Dashboard: https://railway.app/dashboard"
echo ""
echo "🔧 Next Steps:"
echo "1. Test your deployment"
echo "2. Set up custom domains (optional)"
echo "3. Configure monitoring"
echo "4. Set up CI/CD (optional)"