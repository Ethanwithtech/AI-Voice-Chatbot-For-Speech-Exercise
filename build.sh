#!/bin/bash
# ── AI Speech Coach — Build Script ──
# Runs during Replit deployment before the Bundle step.
# Goal: get workspace under ~500 MB so Bundle completes within timeout.

# Don't use set -e — cleanup commands may fail and that's OK
set +e

WORKSPACE="/home/runner/workspace"

echo "============================================"
echo "=== BUILD START — $(date -u +%H:%M:%S) ==="
echo "============================================"

# ── Step 0: Diagnostics — understand what's eating space ──
echo ""
echo "=== DIAGNOSTICS: disk usage before cleanup ==="
echo "Total workspace:"
du -sh "$WORKSPACE" 2>/dev/null || echo "  (cannot check)"
echo ""
echo "Top-level directories:"
du -sh "$WORKSPACE"/* 2>/dev/null | sort -rh | head -15
echo ""
echo "Looking for .pythonlibs in various locations:"
for loc in "$WORKSPACE/.pythonlibs" "$HOME/.pythonlibs" "/home/runner/.pythonlibs"; do
    if [ -d "$loc" ]; then
        echo "  FOUND: $loc ($(du -sh "$loc" 2>/dev/null | cut -f1))"
        echo "  Top subdirs:"
        du -sh "$loc"/lib/python*/site-packages/* 2>/dev/null | sort -rh | head -10
    else
        echo "  NOT FOUND: $loc"
    fi
done
echo ""
echo "Looking for site-packages in all known locations:"
find /home/runner -type d -name "site-packages" 2>/dev/null | while read sp; do
    echo "  $sp ($(du -sh "$sp" 2>/dev/null | cut -f1))"
done
echo ""

# ── Step 1: Frontend ──
if [ -d "$WORKSPACE/frontend/dist" ]; then
    echo "=== Using pre-built frontend dist/ (skipping npm) ==="
else
    echo "=== Building frontend ==="
    cd "$WORKSPACE/frontend" && npm install --silent && npm run build
    rm -rf "$WORKSPACE/frontend/node_modules"
fi

# ── Step 2: Backend dependencies (lightweight only) ──
echo "=== Installing backend dependencies ==="
cd "$WORKSPACE/backend"
unset PIP_USER
if [ -f requirements-deploy.txt ]; then
    pip install -q --no-cache-dir -r requirements-deploy.txt 2>&1 || echo "pip install failed, continuing..."
else
    pip install -q --no-cache-dir -r requirements-prod.txt 2>&1 || echo "pip install failed, continuing..."
fi

# ── Step 3: NUKE all heavy ML packages from ALL site-packages locations ──
# These were installed during development by faster-whisper and its deps.
# faster-whisper will be lazily installed at runtime on first audio submission.
echo ""
echo "=== NUKING heavy ML packages from ALL site-packages ==="

# Packages to remove (each can be 50MB-2GB)
ML_PACKAGES="nvidia torch triton llvmlite scipy ctranslate2 onnxruntime
faster_whisper numba huggingface_hub tokenizers transformers
parselmouth praat torchaudio torchvision sympy networkx
filelock mpmath jinja2 certifi charset_normalizer markupsafe"

# Find ALL site-packages directories under /home/runner
find /home/runner -type d -name "site-packages" 2>/dev/null | while read SITE_DIR; do
    echo "  Scanning: $SITE_DIR"
    for pkg in $ML_PACKAGES; do
        # Remove package directory
        rm -rf "$SITE_DIR"/${pkg} 2>/dev/null
        rm -rf "$SITE_DIR"/${pkg}-* 2>/dev/null
        # Remove .dist-info
        rm -rf "$SITE_DIR"/${pkg}*.dist-info 2>/dev/null
    done
    # nvidia has sub-packages like nvidia_cublas_cu12, nvidia_cudnn_cu12, etc.
    rm -rf "$SITE_DIR"/nvidia* 2>/dev/null
    # torch has sub-packages
    rm -rf "$SITE_DIR"/torch* 2>/dev/null
    echo "    Done cleaning $SITE_DIR"
done

# Also check if there's a .local site-packages
if [ -d "$HOME/.local/lib" ]; then
    find "$HOME/.local/lib" -type d -name "site-packages" 2>/dev/null | while read SITE_DIR; do
        echo "  Also cleaning: $SITE_DIR"
        for pkg in $ML_PACKAGES; do
            rm -rf "$SITE_DIR"/${pkg} 2>/dev/null
            rm -rf "$SITE_DIR"/${pkg}-* 2>/dev/null
            rm -rf "$SITE_DIR"/${pkg}*.dist-info 2>/dev/null
        done
        rm -rf "$SITE_DIR"/nvidia* 2>/dev/null
        rm -rf "$SITE_DIR"/torch* 2>/dev/null
    done
fi

echo "=== ML cleanup complete ==="

# ── Step 4: General cleanup ──
echo "=== General cleanup ==="

# Python cache
find "$WORKSPACE" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null
find "$WORKSPACE" -name "*.pyc" -delete 2>/dev/null
find /home/runner -type d -name "__pycache__" -path "*/site-packages/*" -exec rm -rf {} + 2>/dev/null

# pip/uv cache
rm -rf ~/.cache/pip ~/.cache/uv 2>/dev/null

# Test directories in packages
find /home/runner -type d -name "tests" -path "*/site-packages/*" -exec rm -rf {} + 2>/dev/null
find /home/runner -type d -name "test" -path "*/site-packages/*" -exec rm -rf {} + 2>/dev/null

# Frontend source (only dist/ needed)
rm -rf "$WORKSPACE/frontend/src" "$WORKSPACE/frontend/public" "$WORKSPACE/frontend/node_modules" 2>/dev/null

# Non-essential workspace files
rm -rf "$WORKSPACE/.codebuddy" "$WORKSPACE/attached_assets" "$WORKSPACE/materials" 2>/dev/null
rm -rf "$WORKSPACE/.git" 2>/dev/null
rm -f "$WORKSPACE"/*.pdf "$WORKSPACE"/*.pptx "$WORKSPACE"/*.docx 2>/dev/null

# Replit caches
rm -rf "$WORKSPACE/.upm" "$WORKSPACE/.cache" 2>/dev/null

# ── Step 5: Post-cleanup diagnostics ──
echo ""
echo "=== DIAGNOSTICS: disk usage AFTER cleanup ==="
echo "Total workspace:"
du -sh "$WORKSPACE" 2>/dev/null || echo "  (cannot check)"
echo ""
echo "Top-level directories:"
du -sh "$WORKSPACE"/* 2>/dev/null | sort -rh | head -10
echo ""
echo ".pythonlibs after cleanup:"
for loc in "$WORKSPACE/.pythonlibs" "$HOME/.pythonlibs" "/home/runner/.pythonlibs"; do
    if [ -d "$loc" ]; then
        echo "  $loc: $(du -sh "$loc" 2>/dev/null | cut -f1)"
        echo "  Largest remaining packages:"
        du -sh "$loc"/lib/python*/site-packages/* 2>/dev/null | sort -rh | head -5
    fi
done
echo ""
echo "All site-packages sizes:"
find /home/runner -type d -name "site-packages" 2>/dev/null | while read sp; do
    echo "  $sp: $(du -sh "$sp" 2>/dev/null | cut -f1)"
done

# ── Step 6: Cache Python 3.11 path ──
echo ""
echo "=== Locating Python 3.11 ==="
TARGET_VER="3.11"
PYTHON_BIN=""

for p in /nix/store/*/bin/python${TARGET_VER}; do
    if [ -x "$p" ] 2>/dev/null; then
        VER="$("$p" --version 2>&1 || true)"
        if echo "$VER" | grep -q "Python ${TARGET_VER}"; then
            PYTHON_BIN="$p"
            echo "Found Python ${TARGET_VER}: $PYTHON_BIN"
            break
        fi
    fi
done

if [ -z "$PYTHON_BIN" ]; then
    CLEAN_PATH="$(echo "$PATH" | tr ':' '\n' | grep -v '.pythonlibs' | tr '\n' ':')"
    for cmd in python${TARGET_VER} python3; do
        FOUND="$(PATH="$CLEAN_PATH" command -v "$cmd" 2>/dev/null || true)"
        if [ -n "$FOUND" ]; then
            VER="$("$FOUND" --version 2>&1 || true)"
            if echo "$VER" | grep -q "Python ${TARGET_VER}"; then
                PYTHON_BIN="$FOUND"
                echo "Found Python ${TARGET_VER} in PATH: $PYTHON_BIN"
                break
            fi
        fi
    done
fi

if [ -n "$PYTHON_BIN" ]; then
    echo "$PYTHON_BIN" > "$WORKSPACE/backend/.python_path"
    echo "Cached: $PYTHON_BIN ($($PYTHON_BIN --version 2>&1))"
else
    echo "WARNING: Python ${TARGET_VER} not found during build"
    ls -la /nix/store/*/bin/python3* 2>/dev/null | head -5
fi

echo ""
echo "============================================"
echo "=== BUILD COMPLETE — $(date -u +%H:%M:%S) ==="
echo "============================================"
