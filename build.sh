#!/bin/bash
# ── AI Speech Coach — Build Script ──
# Goal: minimal operations to get bundle under the ~8 min time limit.
#
# CRITICAL: Keep operations FAST. NFS I/O is slow — avoid per-file ops
# on thousands of .so files (no strip, no find -exec).

set +e

WORKSPACE="/home/runner/workspace"
PYLIB="$WORKSPACE/.pythonlibs"
SITE="$PYLIB/lib/python3.11/site-packages"

echo "=== BUILD START: $(date -u +%H:%M:%S) ==="

# ── Frontend ──
if [ -d "$WORKSPACE/frontend/dist" ]; then
    echo "Frontend: pre-built dist/ found"
else
    echo "Frontend: building..."
    cd "$WORKSPACE/frontend" && npm install --silent && npm run build
    rm -rf "$WORKSPACE/frontend/node_modules"
fi

# ── Backend deps ──
echo "Backend: installing..."
cd "$WORKSPACE/backend"
unset PIP_USER
pip install -q --no-cache-dir -r requirements-deploy.txt 2>&1 | tail -1

# ── Nuke ML packages (single rm -rf is fast) ──
echo "Nuking ML packages..."
if [ -d "$SITE" ]; then
    # One fast glob-based rm — avoid per-file operations
    rm -rf "$SITE"/{nvidia,torch,triton,llvmlite,scipy,ctranslate2,onnxruntime,\
faster_whisper,numba,huggingface_hub,tokenizers,transformers,\
parselmouth,praat,torchaudio,torchvision,sympy,networkx,\
torch*,nvidia*,caffe2,_torch*}
fi

# ── Shrink stdlib (one rm per dir is fast) ──
echo "Shrinking stdlib..."
STDLIB="$PYLIB/lib/python3.11"
for d in test tests tkinter turtledemo idlelib ensurepip lib2to3 distutils pydoc_data; do
    rm -rf "$STDLIB/$d" 2>/dev/null
done

# ── Remove pip/setuptools/wheel (not needed at runtime) ──
rm -rf "$SITE/pip-"*.dist-info "$SITE/pip" 2>/dev/null
rm -rf "$SITE/setuptools-"*.dist-info "$SITE/setuptools" 2>/dev/null
rm -rf "$SITE/wheel-"*.dist-info "$SITE/wheel" 2>/dev/null
rm -rf "$SITE/pkg_resources" "$SITE/_distutils_hack" 2>/dev/null

# ── Fast workspace cleanup ──
echo "Workspace cleanup..."
rm -rf "$WORKSPACE/frontend/src" "$WORKSPACE/frontend/public" 2>/dev/null
rm -rf "$WORKSPACE/.codebuddy" "$WORKSPACE/attached_assets" "$WORKSPACE/materials" 2>/dev/null
rm -rf "$WORKSPACE/.git" "$WORKSPACE/.upm" "$WORKSPACE/.cache" 2>/dev/null
rm -f "$WORKSPACE"/*.{pdf,pptx,docx,xlsx,zip,tar.gz} 2>/dev/null
rm -rf "$WORKSPACE/node_modules" "$WORKSPACE/scripts" 2>/dev/null
rm -f "$WORKSPACE/pyproject.toml" "$WORKSPACE/replit.md" "$WORKSPACE/OPERATION_GUIDE.md" 2>/dev/null
rm -f "$WORKSPACE/main.py" "$WORKSPACE/start.sh" 2>/dev/null
rm -f "$WORKSPACE/package-lock.json" 2>/dev/null

# Fast cache clean (avoid slow find -exec)
rm -rf ~/.cache/pip ~/.cache/uv ~/.cache 2>/dev/null

# ── Python path cache ──
echo "Caching Python path..."
PYBIN=""
for p in /nix/store/*/bin/python3.11; do
    [ -x "$p" ] && "$p" --version 2>&1 | grep -q "3.11" && PYBIN="$p" && break
done
if [ -z "$PYBIN" ]; then
    CLEAN_PATH="$(echo "$PATH" | tr ':' '\n' | grep -v '.pythonlibs' | tr '\n' ':')"
    PYBIN="$(PATH="$CLEAN_PATH" command -v python3.11 2>/dev/null || true)"
fi
if [ -n "$PYBIN" ]; then
    echo "$PYBIN" > "$WORKSPACE/backend/.python_path"
    echo "Python: $PYBIN"
fi

echo "=== BUILD DONE: $(date -u +%H:%M:%S) ==="
