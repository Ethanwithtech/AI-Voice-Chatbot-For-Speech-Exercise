#!/bin/bash
# ── AI Speech Coach — Production Start Script ──
# The autoscale container has Python 3.12 (nix, no pip) and uv.
# Use uv to install deps with --target, which puts packages flat in .deps/
# so PYTHONPATH just needs to point at .deps/ — no version subdirectory.

set -e
cd "$(dirname "$0")" || exit 1

echo "=== AI Speech Coach Starting ==="
echo "Directory: $(pwd)"
echo "Port: 5000"

# ── Find Python 3 (skip .pythonlibs Go wrapper) ──
CLEAN_PATH="$(echo "$PATH" | tr ':' '\n' | grep -v '\.pythonlibs/bin' | tr '\n' ':' | sed 's/:$//')"
PYTHON_BIN=""
for cmd in python3.12 python3.11 python3.10 python3 python; do
    FOUND="$(PATH="$CLEAN_PATH" command -v "$cmd" 2>/dev/null || true)"
    if [ -n "$FOUND" ] && "$FOUND" -c "import sys; sys.exit(0)" 2>/dev/null; then
        PYTHON_BIN="$FOUND"
        echo "Found Python: $PYTHON_BIN ($("$PYTHON_BIN" --version 2>&1))"
        break
    fi
done
# Nix store fallback
if [ -z "$PYTHON_BIN" ]; then
    for p in /nix/store/*/bin/python3.12 /nix/store/*/bin/python3.11 /nix/store/*/bin/python3; do
        if [ -x "$p" ] 2>/dev/null && "$p" -c "import sys; sys.exit(0)" 2>/dev/null; then
            PYTHON_BIN="$p"
            echo "Found Python in nix store: $PYTHON_BIN ($("$PYTHON_BIN" --version 2>&1))"
            break
        fi
    done
fi
if [ -z "$PYTHON_BIN" ]; then
    echo "FATAL: No working Python interpreter found!"
    exit 1
fi

# ── deps dir: uv --target puts packages flat here, so PYTHONPATH = .deps/ ──
DEPS_DIR="$(pwd)/.deps"
mkdir -p "$DEPS_DIR"
export PYTHONPATH="$DEPS_DIR:${PYTHONPATH:-}"
echo "PYTHONPATH=$PYTHONPATH"

# ── Install if uvicorn is missing ──
if ! "$PYTHON_BIN" -c "import uvicorn" 2>/dev/null; then
    echo "uvicorn not found — installing via uv..."

    # Find uv (Replit's package manager — has pip module, unlike nix python3.12)
    UV_BIN="$(command -v uv 2>/dev/null || true)"
    if [ -n "$UV_BIN" ]; then
        echo "Using uv: $UV_BIN"
        # uv pip install --target avoids the --user/--target pip conflict entirely
        "$UV_BIN" pip install \
            --python "$PYTHON_BIN" \
            --target "$DEPS_DIR" \
            --no-cache \
            -r requirements-deploy.txt
    else
        # Fallback: bootstrap pip via ensurepip then install
        echo "uv not found, trying ensurepip bootstrap..."
        "$PYTHON_BIN" -m ensurepip --upgrade 2>/dev/null || true
        "$PYTHON_BIN" -m pip install \
            --no-cache-dir \
            --target "$DEPS_DIR" \
            -r requirements-deploy.txt
    fi

    if ! "$PYTHON_BIN" -c "import uvicorn" 2>/dev/null; then
        echo "ERROR: uvicorn still not importable after install!"
        echo "DEPS_DIR contents (first 20):"
        ls "$DEPS_DIR" 2>/dev/null | head -20
        exit 1
    fi
    echo "Install complete."
fi

echo "Starting uvicorn..."
exec "$PYTHON_BIN" -m uvicorn app.main:app --host 0.0.0.0 --port 5000 --log-level info
