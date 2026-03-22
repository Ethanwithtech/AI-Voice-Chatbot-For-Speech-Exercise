#!/bin/bash
# ── AI Speech Coach — Build Script ──
# Goal: get workspace under ~300 MB so Bundle completes within timeout.

set +e  # Don't abort on errors — cleanup should always try

WORKSPACE="/home/runner/workspace"
echo "=== BUILD START: $(date -u +%H:%M:%S) ==="

# ── Step 1: Frontend ──
if [ -d "$WORKSPACE/frontend/dist" ]; then
    echo "Using pre-built frontend dist/"
else
    echo "Building frontend..."
    cd "$WORKSPACE/frontend" && npm install --silent && npm run build
    rm -rf "$WORKSPACE/frontend/node_modules"
fi

# ── Step 2: Backend dependencies (lightweight only) ──
echo "Installing backend dependencies..."
cd "$WORKSPACE/backend"
unset PIP_USER
if [ -f requirements-deploy.txt ]; then
    pip install -q --no-cache-dir -r requirements-deploy.txt
else
    pip install -q --no-cache-dir -r requirements-prod.txt
fi

# ── Step 3: Find ALL site-packages and NUKEml packages ──
echo "Nuking ML packages..."

PYLIB="$WORKSPACE/.pythonlibs"

# ML packages that are safe to remove (not needed at runtime)
ML_PKGS="nvidia torch triton llvmlite scipy ctranslate2 onnxruntime
faster_whisper numba huggingface_hub tokenizers transformers
parselmouth praat torchaudio torchvision sympy networkx
filelock mpmath jinja2 certifi charset_normalizer markupsafe
urllib3 idna requests aiohttp yarl frozenlist aiosignal
packaging protobuf google protobuf"

for SP in "$PYLIB/lib/python3.11/site-packages" \
          "$HOME/.local/lib/python3.11/site-packages"; do
    if [ -d "$SP" ]; then
        echo "  Cleaning $SP..."
        for pkg in $ML_PKGS; do
            rm -rf "$SP/$pkg" "$SP/${pkg}-"* "$SP/${pkg}"*.dist-info 2>/dev/null
        done
        # Wildcard removes for nvidia/torch sub-packages
        rm -rf "$SP/nvidia"* "$SP/torch"* "$SP/_torch"* 2>/dev/null
        echo "  Done ($SP)"
    fi
done

echo "ML cleanup done"

# ── Step 4: General cleanup ──
echo "General cleanup..."

# Python cache
find "$WORKSPACE" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null
find "$WORKSPACE" -name "*.pyc" -delete 2>/dev/null
find /home/runner -type d -name "__pycache__" -path "*/site-packages/*" -exec rm -rf {} + 2>/dev/null

# pip cache
rm -rf ~/.cache/pip ~/.cache/uv 2>/dev/null

# Test dirs in packages
find /home/runner -type d \( -name "tests" -o -name "test" \) -path "*/site-packages/*" -exec rm -rf {} + 2>/dev/null

# Frontend source
rm -rf "$WORKSPACE/frontend/src" "$WORKSPACE/frontend/public" 2>/dev/null

# Non-essential workspace
rm -rf "$WORKSPACE/.codebuddy" "$WORKSPACE/attached_assets" "$WORKSPACE/materials" 2>/dev/null
rm -rf "$WORKSPACE/.git" 2>/dev/null
rm -f "$WORKSPACE"/*.pdf "$WORKSPACE"/*.pptx "$WORKSPACE"/*.docx 2>/dev/null

# Replit caches
rm -rf "$WORKSPACE/.upm" "$WORKSPACE/.cache" 2>/dev/null

# ── Step 5: Quick size check ──
echo "Quick size check:"
echo "  .pythonlibs: $(du -sh "$PYLIB" 2>/dev/null | cut -f1 || echo 'n/a')"
echo "  workspace:   $(du -sh "$WORKSPACE" 2>/dev/null | cut -f1 || echo 'n/a')"

# ── Step 6: Cache Python 3.11 path ──
echo "Locating Python 3.11..."
TARGET_VER="3.11"
PYTHON_BIN=""

for p in /nix/store/*/bin/python${TARGET_VER}; do
    if [ -x "$p" ] 2>/dev/null; then
        if "$p" --version 2>&1 | grep -q "Python ${TARGET_VER}"; then
            PYTHON_BIN="$p"
            break
        fi
    fi
done

if [ -z "$PYTHON_BIN" ]; then
    CLEAN_PATH="$(echo "$PATH" | tr ':' '\n' | grep -v '.pythonlibs' | tr '\n' ':')"
    for cmd in python${TARGET_VER} python3; do
        FOUND="$(PATH="$CLEAN_PATH" command -v "$cmd" 2>/dev/null || true)"
        if [ -n "$FOUND" ] && "$FOUND" --version 2>&1 | grep -q "Python ${TARGET_VER}"; then
            PYTHON_BIN="$FOUND"
            break
        fi
    done
fi

if [ -n "$PYTHON_BIN" ]; then
    echo "$PYTHON_BIN" > "$WORKSPACE/backend/.python_path"
    echo "Cached Python: $PYTHON_BIN ($("$PYTHON_BIN" --version 2>&1))"
else
    echo "WARNING: Python ${TARGET_VER} not found"
fi

echo "=== BUILD COMPLETE: $(date -u +%H:%M:%S) ==="
