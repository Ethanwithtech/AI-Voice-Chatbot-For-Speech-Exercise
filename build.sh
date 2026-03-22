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

find_python311() {
  if [ -f "$BACKEND_DIR/.python_path" ]; then
    CACHED="$(cat "$BACKEND_DIR/.python_path")"
    if [ -x "$CACHED" ] && "$CACHED" --version 2>&1 | grep -q "Python 3.11"; then
      echo "$CACHED"
      return 0
    fi
  fi

  for p in /nix/store/*/bin/python3.11; do
    if [ -x "$p" ] && "$p" --version 2>&1 | grep -q "Python 3.11"; then
      echo "$p"
      return 0
    fi
  done

  CLEAN_PATH="$(echo "$PATH" | tr ':' '\n' | grep -v '.pythonlibs' | tr '\n' ':')"
  FOUND="$(PATH="$CLEAN_PATH" command -v python3.11 2>/dev/null || true)"
  if [ -n "$FOUND" ] && "$FOUND" --version 2>&1 | grep -q "Python 3.11"; then
    echo "$FOUND"
    return 0
  fi

  return 1
}

PYTHON_BIN="$(find_python311)"
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
echo "Backend: installing runtime deps into backend/.deps ..."
cd "$BACKEND_DIR"
unset PIP_USER
rm -rf "$DEPS_DIR"
mkdir -p "$DEPS_DIR"
"$PYTHON_BIN" -m pip install \
  --disable-pip-version-check \
  --no-cache-dir \
  --target "$DEPS_DIR" \
  -r requirements-deploy.txt

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