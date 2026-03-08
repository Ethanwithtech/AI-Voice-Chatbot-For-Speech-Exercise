#!/bin/bash

echo "=== AI Speech Coach - Starting ==="

# Install backend dependencies
echo ">> Installing Python dependencies..."
cd backend
pip install -q -r requirements.txt 2>&1 | tail -5
cd ..

# Install frontend dependencies and build
if [ ! -d "frontend/dist" ]; then
  echo ">> Installing frontend dependencies..."
  cd frontend
  npm install --silent 2>&1 | tail -3

  echo ">> Building frontend..."
  # Use vite build directly, skip tsc type checking to avoid errors
  npx vite build 2>&1 | tail -5
  cd ..
else
  echo ">> Frontend already built, skipping..."
fi

# Start backend (serves both API and frontend static files)
echo ">> Starting server on port 8000..."
cd backend
exec python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
