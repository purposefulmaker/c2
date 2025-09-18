#!/bin/bash
# Railway deployment script

# Backend service
echo "Deploying C2 Backend..."
cd c2-backend
uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}