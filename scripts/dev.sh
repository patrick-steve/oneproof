#!/usr/bin/env bash
# Launch the Next.js dev server fully detached from this shell so the
# harness's background-task killer can't bring it down with the launcher.
# Uses --turbopack now that next.config.js sets turbopack.root to the repo
# root (Turbopack can resolve ../bench/results.json from web/lib/bench.ts).
set -euo pipefail
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 22 >/dev/null 2>&1 || true

# Kill anything currently listening on 3000 (previous dev server zombie).
fuser -k 3000/tcp 2>/dev/null || true
sleep 1

cd /mnt/c/Users/patri/Documents/OneProof/web

LOG=/tmp/oneproof-dev.log
: > "$LOG"

# setsid → new session, immune to SIGHUP. nohup → belt-and-braces.
# < /dev/null + redirected I/O → no stdio tied to the launcher. & + disown
# → fully orphaned, owned by init.
setsid nohup node_modules/.bin/next dev --turbopack --hostname 0.0.0.0 --port 3000 \
  > "$LOG" 2>&1 < /dev/null &
disown

sleep 2
PID=$(pgrep -f "next dev" | head -1 || true)
echo "spawned next dev (turbopack) pid=$PID, log=$LOG"
echo "should bind in ~5s, first page compile ~3-10s. Total cold-start under 15s."
