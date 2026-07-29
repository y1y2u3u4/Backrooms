#!/bin/sh
# Boots a vite dev server, screenshots every UI harness state, shuts down.
#   sh tools/qa/shots.ui.run.sh docs/captures/ui/r2 1280 720
OUT=${1:-docs/captures/ui/latest}
W=${2:-1280}
H=${3:-720}
PORT=${4:-5304}

npx vite --port "$PORT" --host 127.0.0.1 >/tmp/annex-ui-vite.log 2>&1 &
VITE=$!
trap 'kill $VITE 2>/dev/null' EXIT INT TERM

i=0
while [ $i -lt 60 ]; do
  if curl -sf -o /dev/null "http://127.0.0.1:$PORT/src/ui/harness.html"; then break; fi
  i=$((i+1)); sleep 0.5
done

node tools/qa/shots.ui.capture.mjs --port "$PORT" --out "$OUT" --width "$W" --height "$H"
