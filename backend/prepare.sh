#!/usr/bin/env bash
# Stage the deploy: copy ../circuits and the companion proofs into
# backend/ so the Dockerfile's COPY directives can find them. Run from
# inside backend/ before every `fly deploy`.
#
# We DON'T commit circuits/ and companions/ inside backend/ — they're
# derived from the canonical locations elsewhere in the repo. Staging
# them at deploy time keeps a single source of truth.
set -euo pipefail
cd "$(dirname "$0")"

echo "▸ staging circuits from ../circuits/ …"
rm -rf circuits
mkdir -p circuits
# We only need inner_transfer/ and aggregator/ — the other circuits aren't
# touched by the prover backend. Skipping them keeps the image smaller.
for c in inner_transfer aggregator; do
  if [ ! -d "../circuits/$c" ]; then
    echo "  ✗ ../circuits/$c not found — did you run build.sh first?"
    exit 1
  fi
  cp -r "../circuits/$c" "circuits/"
done

echo "▸ staging companion inner proofs from ../web/public/example/inner-companions/ …"
rm -rf companions
if [ -d "../web/public/example/inner-companions" ]; then
  cp -r "../web/public/example/inner-companions" companions
else
  echo "  ⚠ no inner-companions found yet — Mode 1 (solo-with-companions)"
  echo "    won't work until you generate them. Run:"
  echo "      backend/generate-companions.sh"
  mkdir -p companions
fi

echo "✓ staged. now: fly deploy"
