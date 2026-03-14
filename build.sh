#!/bin/bash
set -e

# Use pre-built frontend dist/ if available (committed to git = always present).
# This skips npm install (~240MB download) and npm run build, saving ~3 minutes.
if [ -d "/home/runner/workspace/frontend/dist" ]; then
  echo "=== Using pre-built frontend dist/ (skipping npm) ==="
else
  echo "=== Building frontend (dist/ not found, running npm) ==="
  cd /home/runner/workspace/frontend
  npm install --silent
  npm run build
  rm -rf /home/runner/workspace/frontend/node_modules
fi

echo "=== Installing backend dependencies ==="
cd /home/runner/workspace/backend

# Production dependencies only — no torch/whisper (~800MB savings).
# ElevenLabs handles all STT in production.
pip install -q --no-cache-dir -r requirements-prod.txt

# Clean pycache before bundling
find /home/runner/workspace/backend -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true

echo "=== Build complete ==="
