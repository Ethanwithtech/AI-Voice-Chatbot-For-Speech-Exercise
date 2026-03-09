#!/bin/bash
set -e
cd /home/runner/workspace/frontend
npm install --silent
npm run build
cd /home/runner/workspace/backend
pip install -q -r requirements.txt
echo "Build complete"
