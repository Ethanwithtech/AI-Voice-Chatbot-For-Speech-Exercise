#!/bin/bash
# ── AI Speech Coach — Production Start Script ──
# Runtime container facts (autoscale):
#   - Python 3.12 is in the nix store (bare, no pip module)
#   - uv and pip are NOT available at runtime
#   - ALL packages must be pre-installed by build.sh into backend/.deps/
#   - PYTHONPATH must point to backend/.deps/ (flat --target layout)

set -e
cd "$(dirname "$0")" || exit 1

echo "=== AI Speech Coach Starting ==="
echo "Directory: $(pwd)"
echo "Port: 5000"

# ── Find Python 3.12 ──
# Skip .pythonlibs/bin — that Go wrapper panics in autoscale containers.
CLEAN_PATH="$(echo "$PATH" | tr ':' '\n' | grep -v '\.pythonlibs/bin' | tr '\n' ':' | sed 's/:$//')"
PYTHON_BIN=""
for cmd in python3.12 python3.11 python3.10 python3 python; do
    FOUND="$(PATH="$CLEAN_PATH" command -v "$cmd" 2>/dev/null || true)"
    if [ -n "$FOUND" ] && "$FOUND" -c "import sys; sys.exit(0)" 2>/dev/null; then
        PYTHON_BIN="$FOUND"
        echo "Found Python in PATH: $PYTHON_BIN ($("$PYTHON_BIN" --version 2>&1))"
        break
    fi
done
# Nix store fallback (runtime container has nix Python 3.12 here)
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

# ── Set PYTHONPATH to the pre-installed deps (flat --target layout) ──
DEPS_DIR="$(pwd)/.deps"
export PYTHONPATH="$DEPS_DIR:${PYTHONPATH:-}"
echo "PYTHONPATH=$PYTHONPATH"

# ── Sanity check: verify critical packages are importable ──
# All packages must have been installed by build.sh (uv pip install --python 3.12 --target .deps/).
# If they are missing, the build step failed — we cannot install here (no uv/pip at runtime).
MISSING=""
for mod in uvicorn fastapi pydantic_core; do
    if ! "$PYTHON_BIN" -c "import $mod" 2>/dev/null; then
        MISSING="$MISSING $mod"
    fi
done
if [ -n "$MISSING" ]; then
    echo "ERROR: Missing packages:$MISSING"
    echo "These must be pre-installed by build.sh (uv pip install --python 3.12 --target .deps/)."
    echo "Hint: check that the build step completed successfully and installed cp312 wheels."
    echo ""
    echo "DEPS_DIR contents (first 30):"
    ls "$DEPS_DIR" 2>/dev/null | head -30 || echo "(empty or missing)"
    # Check for ABI mismatch — cp311 .so present when 3.12 runtime
    echo ""
    echo "pydantic_core .so files:"
    ls "$DEPS_DIR/pydantic_core/"*.so 2>/dev/null || ls "$DEPS_DIR/pydantic_core/" 2>/dev/null || echo "(pydantic_core not installed)"
    exit 1
fi

echo "All deps verified (uvicorn, fastapi, pydantic_core)"
echo "Starting uvicorn..."
exec "$PYTHON_BIN" -m uvicorn app.main:app --host 0.0.0.0 --port 5000 --log-level info
