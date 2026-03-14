#!/bin/bash
set -e

echo "=== Building frontend ==="
cd /home/runner/workspace/frontend
npm install --silent
npm run build

# Remove node_modules after build — only dist/ is needed at runtime
echo "=== Cleaning frontend node_modules (not needed at runtime) ==="
rm -rf /home/runner/workspace/frontend/node_modules
echo "node_modules removed — saves ~240MB from bundle"

echo "=== Installing backend dependencies ==="
cd /home/runner/workspace/backend

# Always install core dependencies (no torch/whisper — keeps container small)
pip install -q --no-cache-dir -r requirements-prod.txt

# Only install heavy ML stack (torch + whisper) when local STT is needed.
# If ELEVENLABS_API_KEY is set, ElevenLabs handles all transcription,
# so we skip torch/whisper entirely to stay within deployment size limits.
if [ -n "$ELEVENLABS_API_KEY" ] || [ "$STT_ENGINE" = "elevenlabs" ]; then
  echo "=== Skipping local Whisper install (ElevenLabs STT configured) ==="
else
  echo "=== Installing local Whisper + PyTorch (no ElevenLabs key found) ==="
  pip install -q --no-cache-dir openai-whisper torch

  echo "=== Pre-downloading Whisper model ==="
  python -c "
import whisper
import os
model_size = os.getenv('WHISPER_MODEL_SIZE', 'base')
print(f'Downloading Whisper model: {model_size}')
whisper.load_model(model_size)
print('Whisper model downloaded and cached')
" || echo "WARNING: Whisper model download failed — will retry on first use"
fi

# Clean up pycache to reduce bundle size
echo "=== Cleaning __pycache__ ==="
find /home/runner/workspace/backend -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true

echo "=== Build complete ==="
