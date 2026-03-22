#!/bin/bash
# ── AI Speech Coach — Build Script ──
# Goal: minimize workspace size + finish fast so Bundle has enough time.
# Total time budget: ~8 min (Build + Bundle must complete together).

set +e

WORKSPACE="/home/runner/workspace"
PYLIB="$WORKSPACE/.pythonlibs"
SITE="$PYLIB/lib/python3.11/site-packages"

echo "=== BUILD START: $(date -u +%H:%M:%S) ==="

# ── Skip frontend build if dist/ exists ──
if [ -d "$WORKSPACE/frontend/dist" ]; then
    echo "Frontend: using pre-built dist/"
else
    echo "Frontend: building..."
    cd "$WORKSPACE/frontend" && npm install --silent && npm run build
    rm -rf "$WORKSPACE/frontend/node_modules"
fi

# ── Backend: install only what we need ──
echo "Backend: installing deploy deps..."
cd "$WORKSPACE/backend"
unset PIP_USER
pip install -q --no-cache-dir -r requirements-deploy.txt 2>&1 | tail -1

# ── NUKE heavy ML packages ──
echo "Cleaning ML packages from $SITE ..."
if [ -d "$SITE" ]; then
    # Remove everything ML-related in one pass
    cd "$SITE"
    rm -rf nvidia* torch* triton* llvmlite* scipy* ctranslate2* \
           onnxruntime* faster_whisper* numba* huggingface_hub* \
           tokenizers* transformers* parselmouth* praat* \
           torchaudio* torchvision* sympy* networkx* \
           _torch* caffe2* 2>/dev/null
    cd "$WORKSPACE"
fi

# ── Aggressively shrink .pythonlibs ──
echo "Shrinking .pythonlibs..."

# Remove Python stdlib modules we don't need
STDLIB="$PYLIB/lib/python3.11"
if [ -d "$STDLIB" ]; then
    rm -rf "$STDLIB/test" "$STDLIB/tests" 2>/dev/null           # Python test suite (~25MB)
    rm -rf "$STDLIB/tkinter" "$STDLIB/turtle*" 2>/dev/null      # GUI (~5MB)
    rm -rf "$STDLIB/idlelib" "$STDLIB/idle*" 2>/dev/null        # IDLE (~10MB)
    rm -rf "$STDLIB/ensurepip" 2>/dev/null                      # pip bootstrapper (~3MB)
    rm -rf "$STDLIB/lib2to3" 2>/dev/null                        # Python 2->3 tool
    rm -rf "$STDLIB/turtledemo" 2>/dev/null
    rm -rf "$STDLIB/pydoc_data" 2>/dev/null
    rm -rf "$STDLIB/distutils" 2>/dev/null
    rm -rf "$STDLIB/unittest/test" 2>/dev/null
fi

# Remove .pyc and __pycache__ everywhere
find "$PYLIB" -name "*.pyc" -delete 2>/dev/null
find "$PYLIB" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null

# Remove test/doc dirs from all packages
find "$PYLIB" -type d \( -name "tests" -o -name "test" -o -name "docs" -o -name "doc" -o -name "examples" \) -exec rm -rf {} + 2>/dev/null

# Strip .so debug symbols (saves 10-30% on binary size)
find "$PYLIB" -name "*.so" -exec strip --strip-debug {} \; 2>/dev/null

# Remove Go python-wrapper and other unneeded bins
# Only keep real python3.11 symlinks/binaries
rm -f "$PYLIB/bin/python-wrapper" 2>/dev/null
rm -f "$PYLIB/bin/python" "$PYLIB/bin/python3" 2>/dev/null  # Go shims

# Remove .pth files that might cause import issues
# (Keep only what's strictly needed)

# Remove pip/setuptools/wheel from site-packages (not needed at runtime)
if [ -d "$SITE" ]; then
    rm -rf "$SITE/pip" "$SITE/pip-"*.dist-info 2>/dev/null
    rm -rf "$SITE/setuptools" "$SITE/setuptools-"*.dist-info 2>/dev/null
    rm -rf "$SITE/wheel" "$SITE/wheel-"*.dist-info 2>/dev/null
    rm -rf "$SITE/pkg_resources" 2>/dev/null
    rm -rf "$SITE/_distutils_hack" 2>/dev/null
fi

# ── Nuke everything non-essential from workspace ──
echo "Cleaning workspace..."
rm -rf "$WORKSPACE/frontend/src" "$WORKSPACE/frontend/public" "$WORKSPACE/frontend/node_modules" 2>/dev/null
rm -rf "$WORKSPACE/.codebuddy" "$WORKSPACE/attached_assets" "$WORKSPACE/materials" 2>/dev/null
rm -rf "$WORKSPACE/.git" "$WORKSPACE/.upm" "$WORKSPACE/.cache" 2>/dev/null
rm -f "$WORKSPACE"/*.pdf "$WORKSPACE"/*.pptx "$WORKSPACE"/*.docx 2>/dev/null
# Root node_modules from Replit auto npm-install (connectors-sdk etc)
rm -rf "$WORKSPACE/node_modules" 2>/dev/null
rm -f "$WORKSPACE/package-lock.json" 2>/dev/null
# pyproject.toml triggers uv sync — remove it
rm -f "$WORKSPACE/pyproject.toml" 2>/dev/null
# Other non-essential root files
rm -f "$WORKSPACE/replit.md" "$WORKSPACE/OPERATION_GUIDE.md" 2>/dev/null
rm -f "$WORKSPACE/main.py" "$WORKSPACE/start.sh" 2>/dev/null
rm -rf "$WORKSPACE/scripts" 2>/dev/null

# Clean ALL caches
rm -rf ~/.cache 2>/dev/null

# Python caches in workspace
find "$WORKSPACE" -name "*.pyc" -delete 2>/dev/null
find "$WORKSPACE" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null

# ── Size check ──
echo "Sizes after cleanup:"
echo "  .pythonlibs: $(du -sh "$PYLIB" 2>/dev/null | cut -f1)"
echo "  workspace:   $(du -sh "$WORKSPACE" --exclude=.pythonlibs 2>/dev/null | cut -f1)"
echo "  TOTAL:       $(du -sh "$WORKSPACE" 2>/dev/null | cut -f1)"

# ── Cache Python 3.11 path ──
PYTHON_BIN=""
for p in /nix/store/*/bin/python3.11; do
    if [ -x "$p" ] 2>/dev/null && "$p" --version 2>&1 | grep -q "3.11"; then
        PYTHON_BIN="$p"
        break
    fi
done
if [ -z "$PYTHON_BIN" ]; then
    CLEAN_PATH="$(echo "$PATH" | tr ':' '\n' | grep -v '.pythonlibs' | tr '\n' ':')"
    PYTHON_BIN="$(PATH="$CLEAN_PATH" command -v python3.11 2>/dev/null || PATH="$CLEAN_PATH" command -v python3 2>/dev/null || true)"
fi
if [ -n "$PYTHON_BIN" ]; then
    echo "$PYTHON_BIN" > "$WORKSPACE/backend/.python_path"
    echo "Python: $PYTHON_BIN ($($PYTHON_BIN --version 2>&1))"
fi

echo "=== BUILD COMPLETE: $(date -u +%H:%M:%S) ==="
