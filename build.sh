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

echo "Resolving Python from PATH (trying 3.12, 3.11, 3.10, python3, python)..."
CLEAN_PATH="$(echo "$PATH" | tr ':' '\n' | grep -v '.pythonlibs' | tr '\n' ':')"
PYTHON_BIN="$(PATH="$CLEAN_PATH" command -v python3.12 2>/dev/null || PATH="$CLEAN_PATH" command -v python3.11 2>/dev/null || PATH="$CLEAN_PATH" command -v python3.10 2>/dev/null || PATH="$CLEAN_PATH" command -v python3 2>/dev/null || PATH="$CLEAN_PATH" command -v python 2>/dev/null || true)"
if [ -z "$PYTHON_BIN" ]; then
  echo "ERROR: No Python found in PATH"
  echo "PATH=$PATH"
  exit 1
fi
echo "Python: $PYTHON_BIN"
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
if [ -n "$UV_BIN" ]; then
    echo "Installing with uv: $UV_BIN"
    "$UV_BIN" pip install \
        --python "$PYTHON_BIN" \
        --target "$DEPS_DIR" \
        --no-cache \
        -r requirements-deploy.txt
else
    echo "uv not found, falling back to pip with PYTHONUSERBASE..."
    export PYTHONUSERBASE="$DEPS_DIR"
    export PIP_USER=1
    "$PYTHON_BIN" -m pip install \
        --disable-pip-version-check \
        --no-cache-dir \
        -r requirements-deploy.txt
fi

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