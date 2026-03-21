#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== AI Speech Coach Starting ==="
echo "Directory: $(pwd)"
echo "Port: 5000"

# Use full path since .pythonlibs may not be in PATH in the deployment container
PYTHON="${WORKSPACE_PYTHON:-$(which python3 2>/dev/null || which python 2>/dev/null || echo /home/runner/workspace/.pythonlibs/bin/python3)}"
echo "Using Python: $PYTHON"
exec "$PYTHON" -m uvicorn app.main:app --host 0.0.0.0 --port 5000 --log-level info
