#!/bin/bash
set -e

echo "=== Post-merge setup ==="

# Install backend Python dependencies
echo "Installing backend dependencies..."
pip install -q -r /home/runner/workspace/backend/requirements.txt

# Run DB migrations (idempotent — safe to run on every merge)
echo "Running DB migrations..."
cd /home/runner/workspace/backend
python -c "from app.database import init_db; init_db(); print('Migrations complete')"

# Build frontend
echo "Building frontend..."
cd /home/runner/workspace/frontend
npm install --no-fund --no-audit < /dev/null
npx vite build

echo "=== Post-merge setup complete ==="
