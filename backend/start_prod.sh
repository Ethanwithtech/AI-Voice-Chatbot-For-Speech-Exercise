#!/bin/bash
# ── AI Speech Coach — Production Start Script ──
# Works with Replit Autoscale deployment.
#
# CRITICAL CONSTRAINTS:
# 1. .pythonlibs/bin/python3 is a Go "python-wrapper" shim → panics in deploy
# 2. Must use Python 3.11 specifically (packages compiled for 3.11 in build)
# 3. Using Python 3.12 causes "No module named 'pydantic_core._pydantic_core'"

set -e
cd "$(dirname "$0")" || exit 1

echo "=== AI Speech Coach Starting ==="
echo "Directory: $(pwd)"
echo "Port: 5000"
echo "PATH=$PATH"

unset PIP_USER

# ── Target Python version (must match .replit modules and build step) ──
TARGET_VER="3.11"

# ── Find Python 3.11 specifically ──
PYTHON_BIN=""

# Method 0: Read cached path from build.sh
if [ -f "$(pwd)/.python_path" ]; then
    CACHED="$(cat "$(pwd)/.python_path")"
    if [ -x "$CACHED" ] 2>/dev/null; then
        # Verify it's real Python and correct version
        VER="$("$CACHED" --version 2>&1 || true)"
        if echo "$VER" | grep -q "Python ${TARGET_VER}"; then
            PYTHON_BIN="$CACHED"
            echo "Found Python ${TARGET_VER} from build cache: $PYTHON_BIN"
        else
            echo "Cached $CACHED is $VER (need ${TARGET_VER}), skipping"
        fi
    fi
fi

# Method 1: Search nix store for python3.11 specifically
if [ -z "$PYTHON_BIN" ]; then
    for p in /nix/store/*/bin/python${TARGET_VER}; do
        if [ -x "$p" ] 2>/dev/null; then
            # Skip .pythonlibs wrapper
            case "$p" in */.pythonlibs/*) continue ;; esac
            VER="$("$p" --version 2>&1 || true)"
            if echo "$VER" | grep -q "Python ${TARGET_VER}"; then
                PYTHON_BIN="$p"
                echo "Found Python ${TARGET_VER} in nix store: $PYTHON_BIN"
                break
            fi
        fi
    done
fi

# Method 2: Check PATH for python3.11 (exclude .pythonlibs)
if [ -z "$PYTHON_BIN" ]; then
    CLEAN_PATH="$(echo "$PATH" | tr ':' '\n' | grep -v '.pythonlibs' | tr '\n' ':')"
    # Try python3.11 first, then python3
    for cmd in python${TARGET_VER} python3; do
        FOUND="$(PATH="$CLEAN_PATH" command -v "$cmd" 2>/dev/null || true)"
        if [ -n "$FOUND" ]; then
            VER="$("$FOUND" --version 2>&1 || true)"
            if echo "$VER" | grep -q "Python ${TARGET_VER}"; then
                PYTHON_BIN="$FOUND"
                echo "Found Python ${TARGET_VER} in PATH: $PYTHON_BIN"
                break
            else
                echo "PATH has $FOUND but it's $VER (need ${TARGET_VER})"
            fi
        fi
    done
fi

# Method 3: System locations
if [ -z "$PYTHON_BIN" ]; then
    for p in /usr/bin/python${TARGET_VER} /usr/local/bin/python${TARGET_VER}; do
        if [ -x "$p" ] 2>/dev/null; then
            VER="$("$p" --version 2>&1 || true)"
            if echo "$VER" | grep -q "Python ${TARGET_VER}"; then
                PYTHON_BIN="$p"
                echo "Found Python ${TARGET_VER} at system path: $PYTHON_BIN"
                break
            fi
        fi
    done
fi

# Method 4: If 3.11 not found, try ANY real python3 as last resort
if [ -z "$PYTHON_BIN" ]; then
    echo "WARNING: Python ${TARGET_VER} not found, trying any python3..."
    for p in /nix/store/*/bin/python3; do
        if [ -x "$p" ] 2>/dev/null; then
            case "$p" in */.pythonlibs/*) continue ;; esac
            if "$p" --version &>/dev/null; then
                PYTHON_BIN="$p"
                echo "WARNING: Using fallback $PYTHON_BIN ($("$p" --version 2>&1))"
                break
            fi
        fi
    done
fi

if [ -z "$PYTHON_BIN" ]; then
    echo "FATAL: Cannot find any python3!"
    echo "PATH=$PATH"
    ls -la /nix/store/*/bin/python3* 2>/dev/null | head -10 || echo "  nix: none"
    exit 1
fi

echo "Using Python: $PYTHON_BIN"
echo "Python version: $($PYTHON_BIN --version 2>&1)"

# ── Set PYTHONPATH only for the matching Python version ──
ACTUAL_VER="$($PYTHON_BIN -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || echo "$TARGET_VER")"
echo "Setting PYTHONPATH for Python $ACTUAL_VER"

for base in "$HOME/.local/lib/python${ACTUAL_VER}/site-packages" \
            "/home/runner/workspace/.pythonlibs/lib/python${ACTUAL_VER}/site-packages"; do
    if [ -d "$base" ]; then
        export PYTHONPATH="${base}:${PYTHONPATH:-}"
        echo "  Added: $base"
    fi
done

echo "PYTHONPATH=$PYTHONPATH"

# ── Start uvicorn ──
echo "Starting uvicorn..."
exec "$PYTHON_BIN" -m uvicorn app.main:app --host 0.0.0.0 --port 5000 --log-level info
