#!/bin/bash
# ── AI Speech Coach — Production Start Script ──
# Designed for Replit VM/Autoscale deployment.

cd "$(dirname "$0")" || exit 1

echo "=== AI Speech Coach Starting ==="
echo "Directory: $(pwd)"
echo "Port: 5000"

# ── Find the REAL Python interpreter ──
# IMPORTANT: /home/runner/workspace/.pythonlibs/bin/python3 is a Replit
# python-wrapper (Go binary), NOT the real Python. It can panic with
# "no such file or directory" if the environment isn't set up correctly.
# We need to find the actual Python from nix or system paths.

# Strategy: look for the real python3 binary, skipping .pythonlibs wrappers
PYTHON=""

# 1. Check if there's a nix-provided python3 in PATH (preferred)
for p in $(echo "$PATH" | tr ':' '\n'); do
    case "$p" in
        */workspace/.pythonlibs/*) continue ;;  # skip wrapper
    esac
    if [ -x "$p/python3" ]; then
        # Verify it's a real python, not another wrapper
        if "$p/python3" --version >/dev/null 2>&1; then
            PYTHON="$p/python3"
            break
        fi
    fi
done

# 2. Try common nix store paths
if [ -z "$PYTHON" ]; then
    for candidate in /nix/store/*/bin/python3; do
        if [ -x "$candidate" ] && "$candidate" --version >/dev/null 2>&1; then
            PYTHON="$candidate"
            break
        fi
    done
fi

# 3. System fallbacks
if [ -z "$PYTHON" ]; then
    for candidate in /usr/bin/python3 /usr/local/bin/python3; do
        if [ -x "$candidate" ] && "$candidate" --version >/dev/null 2>&1; then
            PYTHON="$candidate"
            break
        fi
    done
fi

# 4. Last resort: try the .pythonlibs wrapper anyway
if [ -z "$PYTHON" ] && [ -x /home/runner/workspace/.pythonlibs/bin/python3 ]; then
    PYTHON="/home/runner/workspace/.pythonlibs/bin/python3"
fi

if [ -z "$PYTHON" ]; then
    echo "FATAL: Cannot find any working Python interpreter!"
    echo "PATH=$PATH"
    echo "Listing nix python:"
    ls -la /nix/store/*/bin/python3 2>/dev/null | head -5
    echo "Listing .pythonlibs:"
    ls -la /home/runner/workspace/.pythonlibs/bin/ 2>/dev/null
    exit 1
fi

echo "Using Python: $PYTHON"
echo "Python version: $("$PYTHON" --version 2>&1)"

# Ensure pip packages are findable — cover both common install locations
# (user install: ~/.local/lib/pythonX.Y/site-packages, and .pythonlibs fallback)
PY_VER=$("$PYTHON" -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>/dev/null || echo "3.11")
export PYTHONPATH="${HOME}/.local/lib/python${PY_VER}/site-packages:/home/runner/workspace/.pythonlibs/lib/python${PY_VER}/site-packages:${PYTHONPATH:-}"

# Verify uvicorn is importable
if ! "$PYTHON" -c "import uvicorn" 2>/dev/null; then
    echo "WARNING: uvicorn not found in PYTHONPATH, attempting install..."
    unset PIP_USER
    "$PYTHON" -m pip install -q --no-cache-dir -r requirements-deploy.txt 2>&1 || true
fi

echo "Starting uvicorn on port 5000..."
"$PYTHON" -m uvicorn app.main:app --host 0.0.0.0 --port 5000 --log-level info
