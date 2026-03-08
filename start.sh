#!/bin/bash
set -e

echo "=== AI Speech Coach - Starting ==="

# Install backend dependencies
echo ">> Installing Python dependencies..."
cd backend
pip install -q -r requirements.txt
cd ..

# Install frontend dependencies and build
echo ">> Installing frontend dependencies..."
cd frontend
npm install --silent
echo ">> Building frontend..."
npm run build
cd ..

# Start backend (serves both API and frontend static files)
echo ">> Starting server on port 8000..."
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
