#!/bin/bash
# ── AI Speech Coach — Production Start Script ──
# Uses whatever Python 3 was available during the build step.
# Does NOT require a specific version — build.sh caches the actual path.

set -e
cd "$(dirname "$0")" || exit 1

echo "=== AI Speech Coach Starting ==="
echo "Directory: $(pwd)"
echo "Port: 5000"

PYTHON_BIN=""

# Method 1: Use path cached by build.sh (most reliable — exact interpreter used to install deps)
if [ -f "$(pwd)/.python_path" ]; then
    CACHED="$(cat "$(pwd)/.python_path")"
    if [ -x "$CACHED" ] && "$CACHED" --version &>/dev/null; then
        PYTHON_BIN="$CACHED"
        echo "Using cached Python from build: $PYTHON_BIN"
    else
        echo "Cached path $CACHED not usable, searching..."
    fi
fi

# Method 2: PATH with .pythonlibs/bin stripped (avoids Go wrapper that panics)
if [ -z "$PYTHON_BIN" ]; then
    CLEAN_PATH="$(echo "$PATH" | tr ':' '\n' | grep -v '\.pythonlibs/bin' | tr '\n' ':' | sed 's/:$//')"
    for cmd in python3.12 python3.11 python3.10 python3 python; do
        FOUND="$(PATH="$CLEAN_PATH" command -v "$cmd" 2>/dev/null || true)"
        if [ -n "$FOUND" ] && "$FOUND" --version &>/dev/null; then
            PYTHON_BIN="$FOUND"
            echo "Found Python in PATH: $PYTHON_BIN"
            break
        fi
    done
fi

# Method 3: nix store scan
if [ -z "$PYTHON_BIN" ]; then
    for p in /nix/store/*/bin/python3.12 /nix/store/*/bin/python3.11 /nix/store/*/bin/python3.10 /nix/store/*/bin/python3; do
        if [ -x "$p" ] 2>/dev/null && "$p" --version &>/dev/null; then
            PYTHON_BIN="$p"
            echo "Found Python in nix store: $PYTHON_BIN"
            break
        fi
    done
fi

# Method 4: system paths
if [ -z "$PYTHON_BIN" ]; then
    for p in /usr/bin/python3 /usr/local/bin/python3 /usr/bin/python; do
        if [ -x "$p" ] && "$p" --version &>/dev/null; then
            PYTHON_BIN="$p"
            echo "Found Python at system path: $PYTHON_BIN"
            break
        fi
    done
fi

if [ -z "$PYTHON_BIN" ]; then
    echo "FATAL: No working Python interpreter found!"
    echo "PATH=$PATH"
    echo "Contents of /nix/store/*/bin/python*:"
    ls /nix/store/*/bin/python* 2>/dev/null | head -10 || echo "  (none)"
    exit 1
fi

echo "Python: $PYTHON_BIN ($($PYTHON_BIN --version 2>&1))"

# ── PYTHONPATH: cover both --target layout and PYTHONUSERBASE layout ──
DEPS_BASE="$(pwd)/.deps"
for sp in "$DEPS_BASE" \
          "$DEPS_BASE/lib/python3.12/site-packages" \
          "$DEPS_BASE/lib/python3.11/site-packages" \
          "$DEPS_BASE/lib/python3.10/site-packages"; do
    if [ -d "$sp" ]; then
        export PYTHONPATH="${sp}:${PYTHONPATH:-}"
    fi
done
echo "PYTHONPATH=$PYTHONPATH"

echo "Starting uvicorn..."
exec "$PYTHON_BIN" -m uvicorn app.main:app --host 0.0.0.0 --port 5000 --log-level info
