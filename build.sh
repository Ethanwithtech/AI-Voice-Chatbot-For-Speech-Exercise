#!/bin/bash
set -e

echo "=== Building frontend ==="
cd /home/runner/workspace/frontend
npm install --silent
npm run build

# Remove node_modules after build — only dist/ is needed at runtime
echo "=== Cleaning frontend node_modules ==="
rm -rf /home/runner/workspace/frontend/node_modules

echo "=== Installing backend dependencies ==="
cd /home/runner/workspace/backend

# Install production dependencies only — excludes torch/whisper (~800MB savings).
# Local Whisper is only used in dev. Production always uses ElevenLabs STT.
pip install -q --no-cache-dir -r requirements-prod.txt

# Clean up pycache before bundling
find /home/runner/workspace/backend -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true

echo "=== Build complete ==="
