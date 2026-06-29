#!/usr/bin/env bash
# Preview mode — production build + next start. ~45s one-time build cost,
# then every page loads in ~300ms and restarts are instant. NO HMR; code
# changes require another build. Best for "I just want to see what's there."
#
# For active editing where you want hot-reload, use dev_detached.sh instead.
set -euo pipefail
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 22 >/dev/null 2>&1 || true

fuser -k 3000/tcp 2>/dev/null || true

cd /mnt/c/Users/patri/Documents/OneProof/web

# Re-use the .next/standalone build if it's already there AND newer than
# the source. Otherwise rebuild.
NEEDS_BUILD=1
if [ -d .next ]; then
  NEWEST_SRC=$(find app components lib remotion package.json next.config.js tailwind.config.ts -newer .next/BUILD_ID 2>/dev/null | head -1 || true)
  if [ -z "$NEWEST_SRC" ] && [ -f .next/BUILD_ID ]; then
    NEEDS_BUILD=0
    echo "build is up to date (source unchanged since last build)"
  fi
fi

if [ "$NEEDS_BUILD" = 1 ]; then
  echo "building (one-time ~45s)…"
  node_modules/.bin/next build > /tmp/oneproof-build.log 2>&1
  echo "build complete."
fi

LOG=/tmp/oneproof-preview.log
: > "$LOG"

echo "launching next start, detached…"
setsid nohup node_modules/.bin/next start --hostname 0.0.0.0 --port 3000 \
  > "$LOG" 2>&1 < /dev/null &
disown

sleep 1
PID=$(pgrep -f "next start" | head -1 || true)
echo "next start pid=$PID — page loads in ~300ms now. NO HMR; rerun this script after code changes."
