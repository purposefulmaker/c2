@echo off
REM start-vendor-stack.bat - Windows version

echo 🚀 Starting C2 Vendor Stack Integration
echo =====================================

echo.
echo 🐳 Starting vendor services with Docker Compose...
docker-compose up -d

echo.
echo ⏳ Waiting for services to start...
timeout /t 10 /nobreak > nul

echo.
echo 🔍 Checking service health...

REM Check services
curl -f http://localhost:6380/metrics > nul 2>&1
if %errorlevel% == 0 (
    echo ✅ DragonflyDB: Healthy
) else (
    echo ❌ DragonflyDB: Not responding
)

curl -f http://localhost:3001/api/stats > nul 2>&1
if %errorlevel% == 0 (
    echo ✅ Bun WebSocket: Healthy
) else (
    echo ❌ Bun WebSocket: Not responding
)

curl -f http://localhost:8082/health > nul 2>&1
if %errorlevel% == 0 (
    echo ✅ ONVIF Wrapper: Healthy
) else (
    echo ❌ ONVIF Wrapper: Not responding
)

curl -f http://localhost:8090/health > nul 2>&1
if %errorlevel% == 0 (
    echo ✅ Slew2 Driver: Healthy
) else (
    echo ❌ Slew2 Driver: Not responding
)

curl -f http://localhost:9000 > nul 2>&1
if %errorlevel% == 0 (
    echo ✅ Portainer: Healthy
) else (
    echo ❌ Portainer: Not responding
)

curl -f http://localhost:1880 > nul 2>&1
if %errorlevel% == 0 (
    echo ✅ Node-RED: Healthy
) else (
    echo ❌ Node-RED: Not responding
)

echo.
echo 🎯 Testing vendor integration...
echo 🔫 Testing gunshot event trigger...
curl -X POST http://localhost:3001/api/trigger

echo.
echo ✅ Vendor Stack Started!
echo ======================
echo.
echo 🌐 Access Points:
echo   Portainer:     http://localhost:9000 (admin/c2admin^)
echo   Node-RED:      http://localhost:1880
echo   DragonflyDB:   http://localhost:6380 (metrics^)
echo   Bun WebSocket: http://localhost:3001
echo   ONVIF Wrapper: http://localhost:8082
echo   Slew2 Driver:  http://localhost:8090
echo.
echo 🔧 Testing Commands:
echo   curl -X POST http://localhost:3001/api/trigger     # Trigger gunshot
echo   curl http://localhost:8082/api/cameras             # List cameras
echo   curl http://localhost:8090/health                  # PTZ driver status
echo   curl http://localhost:8000/api/vendor/status       # Full status
echo.
echo 🚀 Now start your C2 backend and frontend to see the integration!

pause