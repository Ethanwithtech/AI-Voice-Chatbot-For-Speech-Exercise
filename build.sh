#!/bin/bash
set -e

echo "=== Building frontend ==="
cd /home/runner/workspace/frontend
npm install --silent
npm run build

echo "=== Installing backend dependencies ==="
cd /home/runner/workspace/backend
pip install -q -r requirements.txt

echo "=== Pre-downloading Whisper model ==="
python -c "
import whisper
import os
model_size = os.getenv('WHISPER_MODEL_SIZE', 'base')
print(f'Downloading Whisper model: {model_size}')
whisper.load_model(model_size)
print('Whisper model downloaded and cached')
"

echo "=== Build complete ==="
