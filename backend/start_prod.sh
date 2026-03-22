#!/bin/bash
# ── AI Speech Coach — Production Start Script ──
# Works with both Replit Autoscale and Reserved VM deployments.
#
# CRITICAL: .pythonlibs/bin/python3 is a Go-language "python-wrapper" shim,
# NOT real Python. It panics in deployment containers with
# "no such file or directory". We MUST skip it and find real Python.

set -e
cd "$(dirname "$0")" || exit 1

echo "=== AI Speech Coach Starting ==="
echo "Directory: $(pwd)"
echo "Port: 5000"
echo "PATH=$PATH"

# Unset PIP_USER to avoid conflicts if we need to pip install anything
unset PIP_USER

# ── Find REAL Python 3 (skip .pythonlibs Go wrapper!) ──
PYTHON_BIN=""

# Helper: check if a python binary is real (not the Go wrapper)
is_real_python() {
    local p="$1"
    # Skip anything in .pythonlibs/bin — that's the Go shim
    case "$p" in
        */.pythonlibs/bin/*) return 1 ;;
    esac
    [ -x "$p" ] && "$p" --version &>/dev/null
}

# Method 1: Search nix store FIRST (most reliable in Replit containers)
for p in /nix/store/*/bin/python3.11 /nix/store/*/bin/python3 /nix/store/*/bin/python3.12; do
    if [ -x "$p" ] 2>/dev/null && is_real_python "$p"; then
        PYTHON_BIN="$p"
        echo "Found real python3 in nix store: $PYTHON_BIN"
        break
    fi
done

# Method 2: Check PATH but EXCLUDE .pythonlibs entries
if [ -z "$PYTHON_BIN" ]; then
    # Temporarily remove .pythonlibs from PATH to avoid Go wrapper
    CLEAN_PATH="$(echo "$PATH" | tr ':' '\n' | grep -v '.pythonlibs' | tr '\n' ':')"
    FOUND="$(PATH="$CLEAN_PATH" command -v python3 2>/dev/null || true)"
    if [ -n "$FOUND" ] && is_real_python "$FOUND"; then
        PYTHON_BIN="$FOUND"
        echo "Found real python3 in PATH (excluding .pythonlibs): $PYTHON_BIN"
    fi
fi

# Method 3: Common system locations
if [ -z "$PYTHON_BIN" ]; then
    for p in /usr/bin/python3 /usr/local/bin/python3 /usr/bin/python3.11; do
        if is_real_python "$p"; then
            PYTHON_BIN="$p"
            echo "Found real python3 at system path: $PYTHON_BIN"
            break
        fi
    done
fi

# Method 4: Read cached path from build.sh (but verify it's not the wrapper)
if [ -z "$PYTHON_BIN" ] && [ -f "$(pwd)/.python_path" ]; then
    CACHED="$(cat "$(pwd)/.python_path")"
    if is_real_python "$CACHED"; then
        PYTHON_BIN="$CACHED"
        echo "Found real python3 from build cache: $PYTHON_BIN"
    else
        echo "Cached path $CACHED is Go wrapper or invalid, skipping"
    fi
fi

# Method 5: Last resort — try .pythonlibs wrapper anyway (may work in dev)
if [ -z "$PYTHON_BIN" ]; then
    for p in /home/runner/workspace/.pythonlibs/bin/python3 \
             /home/runner/workspace/.pythonlibs/bin/python3.11; do
        if [ -x "$p" ]; then
            echo "WARNING: Falling back to .pythonlibs wrapper: $p (may panic in deploy)"
            PYTHON_BIN="$p"
            break
        fi
    done
fi

if [ -z "$PYTHON_BIN" ]; then
    echo "FATAL: Cannot find any python3!"
    echo "PATH=$PATH"
    ls -la /nix/store/*/bin/python3* 2>/dev/null | head -10 || echo "  nix: none"
    ls -la /home/runner/workspace/.pythonlibs/bin/ 2>/dev/null || echo "  .pythonlibs/bin: none"
    exit 1
fi

echo "Using Python: $PYTHON_BIN"
echo "Python version: $($PYTHON_BIN --version 2>&1 || echo 'unknown')"

# ── Set PYTHONPATH for installed packages ──
for PY_VER in 3.11 3.12 3.10; do
    for base in "$HOME/.local/lib/python${PY_VER}/site-packages" \
                "/home/runner/workspace/.pythonlibs/lib/python${PY_VER}/site-packages"; do
        if [ -d "$base" ]; then
            export PYTHONPATH="${base}:${PYTHONPATH:-}"
        fi
    done
done

echo "PYTHONPATH=$PYTHONPATH"

# ── Start uvicorn ──
echo "Starting uvicorn..."
exec "$PYTHON_BIN" -m uvicorn app.main:app --host 0.0.0.0 --port 5000 --log-level info
