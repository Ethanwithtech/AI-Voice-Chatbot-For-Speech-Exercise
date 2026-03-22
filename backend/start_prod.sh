#!/bin/bash
# ── AI Speech Coach — Production Start Script ──
# Strategy: find whatever Python 3 the container has, install deps with
# THAT interpreter if needed, then launch uvicorn.
# This avoids build-vs-run Python version mismatches entirely.

set -e
cd "$(dirname "$0")" || exit 1

echo "=== AI Speech Coach Starting ==="
echo "Directory: $(pwd)"
echo "Port: 5000"

PYTHON_BIN=""

# ── Find real Python 3 (skip .pythonlibs Go wrapper and nix wrappers) ──
# The autoscale container has Python 3.12 in the nix store.
CLEAN_PATH="$(echo "$PATH" | tr ':' '\n' | grep -v '\.pythonlibs/bin' | tr '\n' ':' | sed 's/:$//')"

for cmd in python3.12 python3.11 python3.10 python3 python; do
    FOUND="$(PATH="$CLEAN_PATH" command -v "$cmd" 2>/dev/null || true)"
    if [ -n "$FOUND" ] && "$FOUND" -c "import sys; sys.exit(0)" 2>/dev/null; then
        PYTHON_BIN="$FOUND"
        echo "Found Python in PATH: $PYTHON_BIN"
        break
    fi
done

# Nix store fallback
if [ -z "$PYTHON_BIN" ]; then
    for p in /nix/store/*/bin/python3.12 \
              /nix/store/*/bin/python3.11 \
              /nix/store/*/bin/python3; do
        if [ -x "$p" ] 2>/dev/null && "$p" -c "import sys; sys.exit(0)" 2>/dev/null; then
            PYTHON_BIN="$p"
            echo "Found Python in nix store: $PYTHON_BIN"
            break
        fi
    done
fi

if [ -z "$PYTHON_BIN" ]; then
    echo "FATAL: No working Python interpreter found!"
    echo "PATH=$PATH"
    exit 1
fi

PY_VER="$("$PYTHON_BIN" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"
echo "Python: $PYTHON_BIN (${PY_VER})"

# ── Deps directory: install here using PYTHONUSERBASE to avoid --user/--target conflict ──
DEPS_DIR="$(pwd)/.deps"
SITE_PACKAGES="$DEPS_DIR/lib/python${PY_VER}/site-packages"
mkdir -p "$SITE_PACKAGES"
export PYTHONPATH="$SITE_PACKAGES:${PYTHONPATH:-}"
echo "PYTHONPATH=$PYTHONPATH"

# ── Install packages if uvicorn is missing (runtime install matches exact Python version) ──
if ! "$PYTHON_BIN" -c "import uvicorn" 2>/dev/null; then
    echo "uvicorn not found — installing runtime deps for Python ${PY_VER}..."
    # PYTHONUSERBASE redirects --user installs to $DEPS_DIR (avoids --user/--target conflict)
    export PYTHONUSERBASE="$DEPS_DIR"
    export PIP_USER=1
    "$PYTHON_BIN" -m pip install \
        --disable-pip-version-check \
        --no-cache-dir \
        -r requirements-deploy.txt
    echo "Install complete."
    # Verify
    if ! "$PYTHON_BIN" -c "import uvicorn" 2>/dev/null; then
        echo "ERROR: uvicorn still not importable after install!"
        echo "SITE_PACKAGES contents:"
        ls "$SITE_PACKAGES" 2>/dev/null | head -20
        exit 1
    fi
fi

echo "Starting uvicorn..."
exec "$PYTHON_BIN" -m uvicorn app.main:app --host 0.0.0.0 --port 5000 --log-level info
