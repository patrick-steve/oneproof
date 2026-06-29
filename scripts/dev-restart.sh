#!/usr/bin/env bash
# Restart the detached dev server. By default we DON'T wipe .next —
# Turbopack's cache is generally robust and a warm cache restart binds in
# ~5s. Pass `clean` as the first arg to wipe .next first; only needed when
# HMR is genuinely stuck (rare).
set -euo pipefail
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 22 >/dev/null 2>&1 || true

CLEAN_MODE="${1:-warm}"

echo "killing existing :3000 listener (if any)…"
fuser -k 3000/tcp 2>/dev/null || true
sleep 1

if [ "$CLEAN_MODE" = "clean" ]; then
  echo "wiping .next cache (clean restart requested)…"
  rm -rf /mnt/c/Users/patri/Documents/OneProof/web/.next 2>/dev/null || true
else
  echo "preserving .next cache (warm restart, faster) — pass 'clean' to wipe"
fi

cd /mnt/c/Users/patri/Documents/OneProof/web
LOG=/tmp/oneproof-dev.log
: > "$LOG"

echo "launching fresh dev server (turbopack), detached…"
setsid nohup node_modules/.bin/next dev --turbopack --hostname 0.0.0.0 --port 3000 \
  > "$LOG" 2>&1 < /dev/null &
disown

sleep 2
PID=$(pgrep -f "next dev" | head -1 || true)
echo "spawned next dev pid=$PID, log=$LOG"
echo "warm restart: ~5s to bind. clean restart: ~15s. Refresh when ready."
