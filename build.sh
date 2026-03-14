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

# faster-whisper uses CTranslate2 (not PyTorch) — much smaller (~50MB vs 739MB).
# No conditional needed: this works for both dev and production.
pip install -q --no-cache-dir -r requirements-prod.txt

echo "=== Pre-downloading Whisper model ==="
python -c "
from faster_whisper import WhisperModel
import os
model_size = os.getenv('WHISPER_MODEL_SIZE', 'base')
print(f'Downloading faster-whisper model: {model_size}')
WhisperModel(model_size, device='cpu', compute_type='int8')
print('faster-whisper model downloaded and cached')
" || echo "WARNING: model download failed — will retry on first use"

# Clean pycache before bundling
find /home/runner/workspace/backend -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true

echo "=== Build complete ==="
