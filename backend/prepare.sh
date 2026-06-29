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
# Three circuits the prover backend uses:
#   - derive_inputs   — helper to compute root/nullifier/path from user inputs
#   - inner_transfer  — the per-transfer proof
#   - aggregator      — K=4 recursive aggregator over inner proofs
for c in derive_inputs inner_transfer aggregator; do
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

echo "▸ staging pre-baked aggregator outer proof from ../web/public/example/oneproof-aggregator/ …"
rm -rf prebaked
if [ -f "../web/public/example/oneproof-aggregator/proof.bin" ] \
   && [ -f "../web/public/example/oneproof-aggregator/public_inputs.bin" ]; then
  mkdir -p prebaked
  cp "../web/public/example/oneproof-aggregator/proof.bin"         prebaked/outer-proof.bin
  cp "../web/public/example/oneproof-aggregator/public_inputs.bin" prebaked/outer-public-inputs.bin
  echo "  ✓ prebaked $(stat -c%s prebaked/outer-proof.bin) byte outer proof"
else
  echo "  ⚠ no prebaked aggregator outer proof — first solo aggregate"
  echo "    will pay full proving cost (60-180s on shared-cpu)."
  mkdir -p prebaked
fi

echo "✓ staged. now: fly deploy"
