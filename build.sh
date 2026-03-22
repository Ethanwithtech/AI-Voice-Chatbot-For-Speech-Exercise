#!/bin/bash
set -e

WORKSPACE="/home/runner/workspace"

# ── Frontend ──
# Use pre-built frontend dist/ committed to git — skips npm install entirely.
if [ -d "$WORKSPACE/frontend/dist" ]; then
  echo "=== Using pre-built frontend dist/ (skipping npm) ==="
else
  echo "=== Building frontend (dist/ not found, running npm) ==="
  cd "$WORKSPACE/frontend"
  npm install --silent
  npm run build
  # Remove node_modules immediately to keep bundle small
  rm -rf "$WORKSPACE/frontend/node_modules"
fi

echo "=== Installing backend dependencies ==="
cd "$WORKSPACE/backend"

# Install lightweight deploy dependencies only (keeps Bundle under 10-min limit).
# faster-whisper (~500MB) is NOT installed here — it will be lazily installed
# at runtime on the first audio submission (~2-3 min one-time cost).
# See backend/app/services/whisper_local_service.py for the lazy-install logic.
#
# NOTE: Do NOT pass --target here. The deployment env sets PIP_USER=1 and
# combining --user + --target is forbidden by pip/uv (exit 1).
# Unset PIP_USER so pip installs into the default site-packages.
unset PIP_USER
if [ -f requirements-deploy.txt ]; then
  pip install -q --no-cache-dir -r requirements-deploy.txt
else
  pip install -q --no-cache-dir -r requirements-prod.txt
fi

# ── Remove heavy ML packages left over from development ──
# These were pulled in by faster-whisper during dev (torch, CUDA, triton, etc.)
# but are NOT needed for the deploy bundle. faster-whisper will be lazily
# installed at runtime on the first audio submission (~2-3 min one-time cost).
# See backend/app/services/whisper_local_service.py for the lazy-install logic.
# This saves ~3.5 GB from the Bundle image.
echo "=== Removing heavy ML packages from .pythonlibs (saves ~3.5 GB) ==="
for SITE_DIR in "$WORKSPACE"/.pythonlibs/lib/python*/site-packages; do
  if [ -d "$SITE_DIR" ]; then
    echo "  Cleaning $SITE_DIR ..."
    for pkg in nvidia torch triton llvmlite scipy ctranslate2 onnxruntime \
               faster_whisper numba huggingface_hub tokenizers transformers \
               parselmouth praat; do
      rm -rf "$SITE_DIR"/${pkg}  2>/dev/null || true
      rm -rf "$SITE_DIR"/${pkg}-* 2>/dev/null || true
      rm -rf "$SITE_DIR"/${pkg}*.dist-info 2>/dev/null || true
    done
    # nvidia has many sub-packages with names like nvidia_cublas_cu12, etc.
    rm -rf "$SITE_DIR"/nvidia* 2>/dev/null || true
    rm -rf "$SITE_DIR"/torch*  2>/dev/null || true
    echo "  Done."
  fi
done
echo "=== ML cleanup complete ==="

# ── Aggressive cleanup to reduce Bundle size ──
echo "=== Cleaning up to reduce bundle size ==="

# Remove __pycache__ directories
find "$WORKSPACE" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
find "$WORKSPACE" -name "*.pyc" -delete 2>/dev/null || true

# Remove pip cache
rm -rf ~/.cache/pip 2>/dev/null || true

# Remove unnecessary test directories from installed packages
find /home/runner -type d -name "tests" -path "*/site-packages/*" -exec rm -rf {} + 2>/dev/null || true
find /home/runner -type d -name "test" -path "*/site-packages/*" -exec rm -rf {} + 2>/dev/null || true

# Note: do NOT remove .dist-info — some packages need it for entry_points and imports

# Remove frontend source files (only dist/ is needed for serving)
rm -rf "$WORKSPACE/frontend/src" 2>/dev/null || true
rm -rf "$WORKSPACE/frontend/public" 2>/dev/null || true
rm -rf "$WORKSPACE/frontend/node_modules" 2>/dev/null || true

# Remove non-essential workspace files
rm -rf "$WORKSPACE/.codebuddy" 2>/dev/null || true
rm -rf "$WORKSPACE/attached_assets" 2>/dev/null || true
rm -rf "$WORKSPACE/materials" 2>/dev/null || true
rm -rf "$WORKSPACE/.git" 2>/dev/null || true
rm -f "$WORKSPACE"/*.pdf "$WORKSPACE"/*.pptx "$WORKSPACE"/*.docx 2>/dev/null || true

# Remove Replit-specific caches (NOT .pythonlibs — that's where Python itself lives)
rm -rf "$WORKSPACE/.upm" 2>/dev/null || true
rm -rf "$WORKSPACE/.cache" 2>/dev/null || true

# ── Locate and cache Python 3.11 path for the run script ──
# MUST match the version in .replit modules (python-3.11).
# Packages were compiled for 3.11 — using 3.12 causes pydantic_core crash.
# CRITICAL: .pythonlibs/bin/python3 is a Go shim — skip it!
echo "=== Locating Python 3.11 interpreter ==="
echo "PATH=$PATH"
TARGET_VER="3.11"
PYTHON_BIN=""

# Priority 1: nix store python3.11 specifically
for p in /nix/store/*/bin/python${TARGET_VER}; do
    if [ -x "$p" ] 2>/dev/null; then
        VER="$("$p" --version 2>&1 || true)"
        if echo "$VER" | grep -q "Python ${TARGET_VER}"; then
            PYTHON_BIN="$p"
            echo "Found Python ${TARGET_VER} in nix store: $PYTHON_BIN"
            break
        fi
    fi
done

# Priority 2: PATH but exclude .pythonlibs, must be 3.11
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
    echo "Cached Python path to backend/.python_path: $PYTHON_BIN"
    echo "Python version: $($PYTHON_BIN --version 2>&1 || echo 'unknown')"
else
    echo "WARNING: Could not find Python ${TARGET_VER} during build!"
    echo "Listing nix python binaries:"
    ls -la /nix/store/*/bin/python3* 2>/dev/null | head -10 || echo "  nix: none"
fi

echo "=== Build complete ==="
