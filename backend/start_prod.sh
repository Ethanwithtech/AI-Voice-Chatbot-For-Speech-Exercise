#!/bin/bash
# ── AI Speech Coach — Production Start Script ──
# Designed for Replit VM deployment.
# Finds Python in known locations and starts uvicorn.

cd "$(dirname "$0")" || exit 1

echo "=== AI Speech Coach Starting ==="
echo "Directory: $(pwd)"
echo "Port: 5000"

# Find Python — check multiple known locations in Replit
PYTHON=""
for candidate in \
    /home/runner/workspace/.pythonlibs/bin/python3 \
    /nix/store/*/bin/python3 \
    /usr/bin/python3 \
    /usr/local/bin/python3; do
    if [ -x "$candidate" ]; then
        PYTHON="$candidate"
        break
    fi
done

# Fallback to PATH lookup
if [ -z "$PYTHON" ]; then
    PYTHON="$(which python3 2>/dev/null || which python 2>/dev/null)"
fi

if [ -z "$PYTHON" ] || [ ! -x "$PYTHON" ]; then
    echo "ERROR: Cannot find Python interpreter!"
    echo "Searched: .pythonlibs, nix store, /usr/bin, /usr/local/bin, PATH"
    ls -la /home/runner/workspace/.pythonlibs/bin/ 2>/dev/null || echo ".pythonlibs/bin not found"
    exit 1
fi

echo "Using Python: $PYTHON"
echo "Python version: $($PYTHON --version 2>&1)"

# Verify uvicorn is importable
if ! $PYTHON -c "import uvicorn" 2>/dev/null; then
    echo "ERROR: uvicorn not found — installing dependencies..."
    $PYTHON -m pip install -q --no-cache-dir -r requirements-deploy.txt 2>/dev/null \
        || $PYTHON -m pip install -q --no-cache-dir -r requirements-prod.txt
fi

echo "Starting uvicorn..."
$PYTHON -m uvicorn app.main:app --host 0.0.0.0 --port 5000 --log-level info
