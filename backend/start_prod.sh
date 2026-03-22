#!/bin/bash
# ── AI Speech Coach — Production Start Script ──
# Uses real Python 3.11 from nix store and dependencies vendored in backend/.deps.

set -e
cd "$(dirname "$0")" || exit 1

echo "=== AI Speech Coach Starting ==="
echo "Directory: $(pwd)"
echo "Port: 5000"

unset PIP_USER
TARGET_VER="3.11"
PYTHON_BIN=""

# Prefer cached Python path from build
if [ -f "$(pwd)/.python_path" ]; then
  CACHED="$(cat "$(pwd)/.python_path")"
  if [ -x "$CACHED" ] && "$CACHED" --version 2>&1 | grep -q "Python ${TARGET_VER}"; then
    PYTHON_BIN="$CACHED"
  fi
fi

# Fallback: PATH without .pythonlibs wrappers
if [ -z "$PYTHON_BIN" ]; then
  CLEAN_PATH="$(echo "$PATH" | tr ':' '\n' | grep -v '.pythonlibs' | tr '\n' ':')"
  PYTHON_BIN="$(PATH="$CLEAN_PATH" command -v python${TARGET_VER} 2>/dev/null || PATH="$CLEAN_PATH" command -v python3 2>/dev/null || PATH="$CLEAN_PATH" command -v python 2>/dev/null || true)"
fi

# Last resort: search nix store
if [ -z "$PYTHON_BIN" ]; then
  for p in /nix/store/*/bin/python${TARGET_VER}; do
    if [ -x "$p" ] && "$p" --version 2>&1 | grep -q "Python ${TARGET_VER}"; then
      PYTHON_BIN="$p"
      break
    fi
  done
fi

if [ -z "$PYTHON_BIN" ]; then
  echo "FATAL: Python ${TARGET_VER} not found"
  exit 1
fi

echo "Using Python: $PYTHON_BIN"
echo "Python version: $($PYTHON_BIN --version 2>&1)"

# Vendored runtime dependencies installed by build.sh
export PYTHONPATH="$(pwd)/.deps:${PYTHONPATH:-}"
echo "PYTHONPATH=$PYTHONPATH"

echo "Starting uvicorn..."
exec "$PYTHON_BIN" -m uvicorn app.main:app --host 0.0.0.0 --port 5000 --log-level info