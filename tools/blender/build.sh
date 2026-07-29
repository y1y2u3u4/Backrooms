#!/usr/bin/env bash
# Rebuild every THE ANNEX Blender asset headlessly.
#
# Usage:
#   tools/blender/build.sh                # build every asset
#   tools/blender/build.sh mk_fuse_core    # build (rerun) just one script
#
# Requires: blender on PATH, and Xvfb (via xvfb-run) because Blender's
# Workbench/EEVEE render engines need a GL context even in "headless" mode.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BLENDER_BIN="${BLENDER_BIN:-blender}"

run() {
  echo "=== $1 ==="
  xvfb-run -a "$BLENDER_BIN" -b --python "$SCRIPT_DIR/$1.py"
}

if [ "$#" -eq 0 ]; then
  xvfb-run -a "$BLENDER_BIN" -b --python "$SCRIPT_DIR/build_all.py"
else
  for script in "$@"; do
    run "$script"
  done
fi
