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

# Pre-download and cache the Whisper model so the app can serve STT
# requests immediately without a cold-start download.
echo "=== Pre-warming Whisper model ==="
export WHISPER_MODEL_SIZE="${WHISPER_MODEL_SIZE:-base}"
export WHISPER_CACHE_DIR="${WHISPER_CACHE_DIR:-/home/runner/workspace/backend/.model_cache}"
python -c "
from faster_whisper import WhisperModel
import os
model_size = os.environ.get('WHISPER_MODEL_SIZE', 'base')
cache_dir = os.environ.get('WHISPER_CACHE_DIR', '/home/runner/workspace/backend/.model_cache')
os.makedirs(cache_dir, exist_ok=True)
print(f'Downloading/caching faster-whisper model: {model_size} -> {cache_dir}')
WhisperModel(model_size, device='cpu', compute_type='int8', download_root=cache_dir)
print(f'Whisper model \"{model_size}\" cached successfully in {cache_dir}')
" && echo "=== Whisper model pre-warm complete ===" \
  || echo "=== WARNING: Whisper model pre-warm failed; model will download on first request ==="

echo "=== Build complete ==="
