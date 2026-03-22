#!/bin/bash
# ── AI Speech Coach — Production Start Script ──
# Works with both Replit Autoscale and Reserved VM deployments.
#
# The deployment container may NOT have python3 in PATH by default.
# We search multiple known locations to find a working Python interpreter.

set -e
cd "$(dirname "$0")" || exit 1

echo "=== AI Speech Coach Starting ==="
echo "Directory: $(pwd)"
echo "Port: 5000"

# Unset PIP_USER to avoid conflicts if we need to pip install anything
unset PIP_USER

# ── Find a working Python 3 interpreter ──
# Priority: 0) cached path from build, 1) PATH, 2) nix store, 3) .pythonlibs, 4) system
PYTHON_BIN=""

# Method 0: Read cached path from build.sh (most reliable)
# Note: we already cd'd to script dir on line 9, so just use pwd
SCRIPT_DIR="$(pwd)"
if [ -f "$SCRIPT_DIR/.python_path" ]; then
    CACHED="$(cat "$SCRIPT_DIR/.python_path")"
    if [ -x "$CACHED" ]; then
        PYTHON_BIN="$CACHED"
        echo "Found python3 from build cache: $PYTHON_BIN"
    fi
fi

# Method 1: Check PATH (works if nix python is available)
if [ -z "$PYTHON_BIN" ] && command -v python3 &>/dev/null; then
    PYTHON_BIN="$(command -v python3)"
    echo "Found python3 in PATH: $PYTHON_BIN"
fi

# Method 2: Search nix store (Replit Autoscale containers)
if [ -z "$PYTHON_BIN" ]; then
    for p in /nix/store/*/bin/python3 /nix/store/*/bin/python3.11 /nix/store/*/bin/python3.12; do
        if [ -x "$p" ] 2>/dev/null; then
            PYTHON_BIN="$p"
            echo "Found python3 in nix store: $PYTHON_BIN"
            break
        fi
    done
fi

# Method 3: .pythonlibs wrapper (may be Go shim but sometimes works)
if [ -z "$PYTHON_BIN" ]; then
    for p in /home/runner/workspace/.pythonlibs/bin/python3 \
             /home/runner/workspace/.pythonlibs/bin/python3.11; do
        if [ -x "$p" ]; then
            PYTHON_BIN="$p"
            echo "Found python3 in .pythonlibs: $PYTHON_BIN"
            break
        fi
    done
fi

# Method 4: Common system locations
if [ -z "$PYTHON_BIN" ]; then
    for p in /usr/bin/python3 /usr/local/bin/python3; do
        if [ -x "$p" ]; then
            PYTHON_BIN="$p"
            echo "Found python3 at system path: $PYTHON_BIN"
            break
        fi
    done
fi

if [ -z "$PYTHON_BIN" ]; then
    echo "ERROR: Cannot find python3 anywhere!"
    echo "PATH=$PATH"
    echo "Listing /nix/store/*/bin/python*:"
    ls -la /nix/store/*/bin/python* 2>/dev/null || echo "  (none found)"
    echo "Listing .pythonlibs/bin/:"
    ls -la /home/runner/workspace/.pythonlibs/bin/ 2>/dev/null || echo "  (none found)"
    exit 1
fi

echo "Using Python: $PYTHON_BIN"
echo "Python version: $($PYTHON_BIN --version 2>&1 || echo 'unknown')"

# ── Set PYTHONPATH for installed packages ──
for PY_VER in 3.11 3.12 3.10; do
    for base in "$HOME/.local/lib/python${PY_VER}/site-packages" \
                "/home/runner/workspace/.pythonlibs/lib/python${PY_VER}/site-packages"; do
        if [ -d "$base" ]; then
            export PYTHONPATH="${base}:${PYTHONPATH:-}"
        fi
    done
done

echo "PYTHONPATH=$PYTHONPATH"

# ── Start uvicorn ──
echo "Starting uvicorn..."
exec "$PYTHON_BIN" -m uvicorn app.main:app --host 0.0.0.0 --port 5000 --log-level info
