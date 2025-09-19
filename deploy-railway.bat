@echo off
REM Deploy C2 Complete Vendor Stack to Railway
echo 🚀 Deploying C2 Complete Vendor Stack to Railway...

REM Check if Railway CLI is installed
where railway >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Railway CLI not found. Installing...
    npm install -g @railway/cli
)

REM Login to Railway (if not already logged in)
echo 🔐 Checking Railway authentication...
railway whoami || railway login

REM Create new project or use existing
echo 📦 Setting up Railway project...
railway project new c2-vendor-stack || echo Using existing project...

REM Link to the project
railway link

REM Deploy services in dependency order
echo 🔄 Deploying services...

echo 1/6 🗃️ Deploying DragonflyDB...
railway up --service dragonfly

echo 2/6 ⚡ Deploying Bun WebSocket...
railway up --service bun-websocket

echo 3/6 📹 Deploying ONVIF Wrapper...
railway up --service onvif-wrapper

echo 4/6 🎯 Deploying Slew2 Driver...
railway up --service slew2-driver

echo 5/6 🔧 Deploying C2 Backend...
railway up --service c2-backend

echo 6/6 🌐 Deploying C2 Frontend...
railway up --service c2-frontend

REM Show deployment status
echo 📊 Deployment Status:
railway status

REM Get service URLs
echo 🔗 Service URLs:
railway domain

echo ✅ Deployment complete!
echo.
echo 🎯 Next steps:
echo   1. Visit your frontend URL to access the C2 platform
echo   2. Check service health at /health endpoints
echo   3. Monitor logs with: railway logs [service-name]
echo   4. Configure camera settings in the interface
echo.
echo 📚 Documentation: See RAILWAY_DEPLOYMENT.md for details

pause