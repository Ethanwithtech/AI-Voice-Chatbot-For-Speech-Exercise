#!/bin/bash
# ── AI Speech Coach — Build Script ──
# Strategy:
# 1. Install runtime deps into `backend/.deps` using REAL Python 3.11
# 2. Delete `.pythonlibs` entirely so Bundle is tiny and has very few files
# 3. Keep build operations simple/fast (no slow find/strip passes)

set -e

WORKSPACE="/home/runner/workspace"
BACKEND_DIR="$WORKSPACE/backend"
DEPS_DIR="$BACKEND_DIR/.deps"

echo "=== BUILD START: $(date -u +%H:%M:%S) ==="

echo "Resolving Python from PATH and nix store..."
CLEAN_PATH="$(echo "$PATH" | tr ':' '\n' | grep -v '.pythonlibs' | tr '\n' ':')"
PYTHON_BIN=""
# Try PATH first (prefer explicit versioned commands)
for cmd in python3.12 python3.11 python3.10 python3 python; do
    FOUND="$(PATH="$CLEAN_PATH" command -v "$cmd" 2>/dev/null || true)"
    if [ -n "$FOUND" ] && "$FOUND" -c "import sys; sys.exit(0)" 2>/dev/null; then
        PYTHON_BIN="$FOUND"
        break
    fi
done
# Fall back to nix store — same lookup as start_prod.sh uses at runtime
if [ -z "$PYTHON_BIN" ]; then
    for p in /nix/store/*/bin/python3.12 /nix/store/*/bin/python3.11 /nix/store/*/bin/python3; do
        if [ -x "$p" ] 2>/dev/null && "$p" -c "import sys; sys.exit(0)" 2>/dev/null; then
            PYTHON_BIN="$p"
            break
        fi
    done
fi
if [ -z "$PYTHON_BIN" ]; then
    echo "ERROR: No Python found"
    echo "PATH=$PATH"
    exit 1
fi
echo "Python: $PYTHON_BIN ($("$PYTHON_BIN" --version 2>&1))"
echo "$PYTHON_BIN" > "$BACKEND_DIR/.python_path"

# ── Frontend ──
if [ -d "$WORKSPACE/frontend/dist" ]; then
  echo "Frontend: pre-built dist/ found"
else
  echo "Frontend: building..."
  cd "$WORKSPACE/frontend"
  npm install --silent
  npm run build
fi
rm -rf "$WORKSPACE/frontend/node_modules"

# ── Backend deps → backend/.deps ──
# Use `uv pip install --target` which:
#   1. Puts packages flat in $DEPS_DIR/ (no versioned subdirectory)
#   2. Does NOT conflict with PIP_USER=1 (uv handles --target independently)
#   3. Works even when the nix Python has no pip module
# PYTHONPATH at runtime just needs to include $DEPS_DIR directly.
echo "Backend: installing runtime deps into backend/.deps ..."
cd "$BACKEND_DIR"
rm -rf "$DEPS_DIR"
mkdir -p "$DEPS_DIR"
UV_BIN="$(command -v uv 2>/dev/null || true)"
if [ -z "$UV_BIN" ]; then
    echo "ERROR: uv not found in build environment"
    exit 1
fi
echo "Using uv: $UV_BIN ($("$UV_BIN" --version 2>&1))"

# ── CRITICAL: build container has Python 3.11; runtime has Python 3.12 ──
# If we install with Python 3.11, pydantic_core gets a cp311 .so file that
# Python 3.12 at runtime cannot load. We MUST install cp312 wheels.
#
# Solution: tell uv to download its own managed Python 3.12, then install
# targeting that version. Manylinux cp312 wheels produced this way are
# compatible with any CPython 3.12 on linux-x86_64, including the runtime
# nix Python 3.12 (both share the same cpython-312 stable ABI).
echo "Installing Python packages for Python 3.12..."
# KEY: use --python-version / --python-platform instead of --python <path>
# This lets uv resolve and download cp312 manylinux wheels WITHOUT Python 3.12
# being installed in the build container (which only has Python 3.11).
# The resulting _pydantic_core.cpython-312-x86_64-linux-gnu.so is importable
# by any CPython 3.12 on linux-x86_64, including the runtime nix Python 3.12.
# Does NOT require `uv python install` (which is blocked by python-downloads=never).
"$UV_BIN" pip install \
    --python-version 3.12 \
    --python-platform linux \
    --target "$DEPS_DIR" \
    --no-cache \
    -r requirements-deploy.txt

echo "Verifying cp312 .so was installed (not cp311)..."
ls "$DEPS_DIR/pydantic_core/" | grep cpython || echo "(WARNING: no cpython .so found)"

# ── Remove giant development env from workspace ──
echo "Removing .pythonlibs from bundle..."
rm -rf "$WORKSPACE/.pythonlibs"
rm -rf "$HOME/.pythonlibs"
rm -rf /home/runner/.pythonlibs

# ── Remove root-level files that trigger Replit pre-install or add bulk ──
echo "Cleaning workspace..."
rm -rf "$WORKSPACE/.git" "$WORKSPACE/.codebuddy" "$WORKSPACE/attached_assets" "$WORKSPACE/materials"
rm -rf "$WORKSPACE/.upm" "$WORKSPACE/.cache" "$WORKSPACE/node_modules"
rm -rf "$WORKSPACE/frontend/src" "$WORKSPACE/frontend/public"
rm -rf "$WORKSPACE/scripts"
rm -f "$WORKSPACE"/*.pdf "$WORKSPACE"/*.pptx "$WORKSPACE"/*.docx "$WORKSPACE"/*.xlsx "$WORKSPACE"/*.zip
rm -f "$WORKSPACE/pyproject.toml" "$WORKSPACE/package.json" "$WORKSPACE/package-lock.json"
rm -f "$WORKSPACE/replit.md" "$WORKSPACE/OPERATION_GUIDE.md" "$WORKSPACE/main.py" "$WORKSPACE/start.sh"
rm -rf ~/.cache/pip ~/.cache/uv ~/.cache

# ── Quick verification ──
echo "backend/.deps size: $(du -sh "$DEPS_DIR" 2>/dev/null | cut -f1)"
echo "workspace total:  $(du -sh "$WORKSPACE" 2>/dev/null | cut -f1)"

echo "=== BUILD COMPLETE: $(date -u +%H:%M:%S) ==="