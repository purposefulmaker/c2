#!/bin/bash
# start-vendor-stack.sh - Start the complete vendor stack

echo "🚀 Starting C2 Vendor Stack Integration"
echo "====================================="

# Function to check if port is available
check_port() {
    if nc -z localhost $1 2>/dev/null; then
        echo "⚠️  Port $1 is already in use"
        return 1
    fi
    return 0
}

# Check required ports
echo "📋 Checking ports..."
PORTS=(6379 8082 8083 8090 3001 1880 9000)
for port in "${PORTS[@]}"; do
    if ! check_port $port; then
        echo "❌ Port $port is occupied. Please check running services."
    fi
done

echo ""
echo "🐳 Starting vendor services with Docker Compose..."

# Start the vendor stack
docker-compose up -d

echo ""
echo "⏳ Waiting for services to start..."
sleep 10

echo ""
echo "🔍 Checking service health..."

# Check DragonflyDB
if curl -f http://localhost:6380/metrics > /dev/null 2>&1; then
    echo "✅ DragonflyDB: Healthy"
else
    echo "❌ DragonflyDB: Not responding"
fi

# Check Bun WebSocket
if curl -f http://localhost:3001/api/stats > /dev/null 2>&1; then
    echo "✅ Bun WebSocket: Healthy"
else
    echo "❌ Bun WebSocket: Not responding"
fi

# Check ONVIF Wrapper
if curl -f http://localhost:8082/health > /dev/null 2>&1; then
    echo "✅ ONVIF Wrapper: Healthy"
else
    echo "❌ ONVIF Wrapper: Not responding"
fi

# Check Slew2 Driver
if curl -f http://localhost:8090/health > /dev/null 2>&1; then
    echo "✅ Slew2 Driver: Healthy"
else
    echo "❌ Slew2 Driver: Not responding"
fi

# Check Portainer
if curl -f http://localhost:9000 > /dev/null 2>&1; then
    echo "✅ Portainer: Healthy"
else
    echo "❌ Portainer: Not responding"
fi

# Check Node-RED
if curl -f http://localhost:1880 > /dev/null 2>&1; then
    echo "✅ Node-RED: Healthy"
else
    echo "❌ Node-RED: Not responding"
fi

echo ""
echo "🎯 Testing vendor integration..."

# Test Bun WebSocket trigger
echo "🔫 Testing gunshot event trigger..."
curl -X POST http://localhost:3001/api/trigger 2>/dev/null | jq .status

echo ""
echo "✅ Vendor Stack Started!"
echo "======================"
echo ""
echo "🌐 Access Points:"
echo "  Portainer:     http://localhost:9000 (admin/c2admin)"
echo "  Node-RED:      http://localhost:1880"
echo "  DragonflyDB:   http://localhost:6380 (metrics)"
echo "  Bun WebSocket: http://localhost:3001"
echo "  ONVIF Wrapper: http://localhost:8082"
echo "  Slew2 Driver:  http://localhost:8090"
echo ""
echo "🔧 Testing Commands:"
echo "  curl -X POST http://localhost:3001/api/trigger     # Trigger gunshot"
echo "  curl http://localhost:8082/api/cameras             # List cameras"
echo "  curl http://localhost:8090/health                  # PTZ driver status"
echo "  curl http://localhost:8000/api/vendor/status       # Full status"
echo ""
echo "🚀 Now start your C2 backend and frontend to see the integration!"