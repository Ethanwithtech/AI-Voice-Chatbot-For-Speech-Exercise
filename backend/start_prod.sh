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

# ── Check deps and reinstall if missing or ABI-mismatched ──
# pydantic_core has a compiled C extension — if it was installed for a
# different Python version (e.g. cp311 built, cp312 running) it will fail.
# We check both uvicorn AND pydantic_core, and do a clean reinstall if either fails.
NEED_INSTALL=0
if ! "$PYTHON_BIN" -c "import uvicorn" 2>/dev/null; then
    echo "uvicorn not importable — need install"
    NEED_INSTALL=1
fi
if ! "$PYTHON_BIN" -c "import pydantic_core" 2>/dev/null; then
    echo "pydantic_core not importable (likely ABI mismatch: built for wrong Python version) — need reinstall"
    NEED_INSTALL=1
fi

if [ "$NEED_INSTALL" = "1" ]; then
    echo "Installing/reinstalling deps for $PYTHON_BIN ($("$PYTHON_BIN" --version 2>&1))..."
    # Wipe any stale packages from a different Python version
    rm -rf "$DEPS_DIR"
    mkdir -p "$DEPS_DIR"
    export PYTHONPATH="$DEPS_DIR:${PYTHONPATH:-}"

    UV_BIN="$(command -v uv 2>/dev/null || true)"
    if [ -n "$UV_BIN" ]; then
        echo "Using uv: $UV_BIN"
        # --python tells uv which ABI to target for wheel selection
        "$UV_BIN" pip install \
            --python "$PYTHON_BIN" \
            --target "$DEPS_DIR" \
            --no-cache \
            -r requirements-deploy.txt
    else
        echo "uv not found, trying ensurepip then pip..."
        "$PYTHON_BIN" -m ensurepip --upgrade 2>/dev/null || true
        "$PYTHON_BIN" -m pip install --no-cache-dir --target "$DEPS_DIR" \
            -r requirements-deploy.txt
    fi

    # Verify both critical imports work now
    for mod in uvicorn pydantic_core fastapi; do
        if ! "$PYTHON_BIN" -c "import $mod" 2>/dev/null; then
            echo "ERROR: $mod still not importable after install!"
            echo "DEPS_DIR top-level:"
            ls "$DEPS_DIR" 2>/dev/null | head -30
            exit 1
        fi
    done
    echo "Install complete — all deps verified."
fi

echo "Starting uvicorn..."
exec "$PYTHON_BIN" -m uvicorn app.main:app --host 0.0.0.0 --port 5000 --log-level info
