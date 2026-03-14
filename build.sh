#!/bin/bash
set -e

# Use pre-built frontend dist/ committed to git — skips npm install entirely.
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

# No --no-cache-dir so Replit can cache wheels between deployments.
# scipy removed (unused). faster-whisper replaces torch+openai-whisper.
pip install -q -r requirements-prod.txt

# Clean pycache before bundling
find /home/runner/workspace/backend -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true

# NOTE: Whisper model is NOT pre-downloaded here. It downloads lazily on first
# use at runtime into WHISPER_CACHE_DIR (/tmp/whisper_cache by default).
# Pre-downloading added ~150 MB to the bundle and caused deployment timeouts.

echo "=== Build complete ==="
