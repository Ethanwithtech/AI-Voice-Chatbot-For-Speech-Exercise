#!/bin/bash
# ── AI Speech Coach — Production Start Script ──
# Works with both Replit Autoscale and Reserved VM deployments.
#
# Keep this script SIMPLE — complex Python discovery logic has caused
# more problems than it solved. Trust the Replit environment's PATH.

set -e
cd "$(dirname "$0")" || exit 1

echo "=== AI Speech Coach Starting ==="
echo "Directory: $(pwd)"
echo "Port: 5000"

# Unset PIP_USER to avoid conflicts if we need to pip install anything
unset PIP_USER

# ── Detect Python version for PYTHONPATH ──
# Cover both user-install (~/.local) and Replit .pythonlibs locations
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
# Use python3 from PATH directly. In Autoscale containers, the Replit
# python-wrapper in .pythonlibs/bin handles this. In VM mode, the nix
# python3 is in PATH. Don't override — let the environment work.
echo "Starting uvicorn..."
exec python3 -m uvicorn app.main:app --host 0.0.0.0 --port 5000 --log-level info
