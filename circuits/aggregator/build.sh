#!/usr/bin/env bash
# Tier 2.2 - aggregator (K=4) sanity build. Re-uses the inner_transfer
# artifacts produced by circuits/inner_transfer/build.sh: same single proof
# fed in K times so the aggregator math (K verify_ultrahonk_proof calls)
# can be exercised without needing K distinct provings yet.
#
# Distinct-proof bench comes in Tier 2.5; for Tier 2.2 GREEN we just need
# the K-to-1 aggregator circuit to compile, witness-solve, prove, and verify.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
export PATH="$HOME/.nargo/bin:$HOME/.bb:$PATH"

INNER_DIR="$SCRIPT_DIR/../inner_transfer"
INNER_TARGET="$INNER_DIR/target"

echo "=== nargo $(nargo --version | head -1) / bb $(bb --version) ==="

# Ensure inner artifacts exist
for f in proof_fields.json vk_fields.json public_inputs_fields.json; do
  [ -f "$INNER_TARGET/$f" ] || {
    echo "ERROR: missing $INNER_TARGET/$f - run circuits/inner_transfer/build.sh first"
    exit 1
  }
done
echo "    inner artifacts present"
echo "    inner proof  fields: $(jq 'length' "$INNER_TARGET/proof_fields.json")"
echo "    inner vk     fields: $(jq 'length' "$INNER_TARGET/vk_fields.json")"
echo "    inner public fields: $(jq 'length' "$INNER_TARGET/public_inputs_fields.json")"

# ────────────────────────────────────────────────────────────────────────────
echo
echo "=== [1/3] build aggregator Prover.toml ==="
K=4
# helper: jq an array of strings into a TOML array-of-quoted-strings
to_toml_array() {
  jq -r '"[" + (map("\"" + . + "\"") | join(", ")) + "]"' "$1"
}
VK_TOML="$(to_toml_array "$INNER_TARGET/vk_fields.json")"
PROOF_TOML="$(to_toml_array "$INNER_TARGET/proof_fields.json")"
# Read the two inner public inputs (root, nullifier)
PUB_ROOT="$(jq -r '.[0]' "$INNER_TARGET/public_inputs_fields.json")"
PUB_NF="$(jq -r '.[1]' "$INNER_TARGET/public_inputs_fields.json")"

# Aggregator Prover.toml: proofs is K copies of the same proof; public_inputs
# is the flat list of K (root, nullifier) pairs (all the same here).
{
  echo "verification_key = $VK_TOML"
  echo "key_hash = \"0x00\""
  # proofs: array of K proof-arrays
  printf 'proofs = [\n'
  for i in $(seq 1 $K); do
    if [ "$i" -lt "$K" ]; then printf '  %s,\n' "$PROOF_TOML"
    else                       printf '  %s\n'  "$PROOF_TOML"
    fi
  done
  printf ']\n'
  # public_inputs: flat [r,n, r,n, r,n, r,n]
  printf 'public_inputs = ['
  for i in $(seq 1 $K); do
    if [ "$i" -lt "$K" ]; then printf '"%s","%s",' "$PUB_ROOT" "$PUB_NF"
    else                       printf '"%s","%s"'  "$PUB_ROOT" "$PUB_NF"
    fi
  done
  printf ']\n'
} > Prover.toml
echo "    wrote Prover.toml"

# ────────────────────────────────────────────────────────────────────────────
echo
echo "=== [2/3] nargo compile + execute aggregator ==="
rm -rf target
nargo compile
nargo execute aggregator

# ────────────────────────────────────────────────────────────────────────────
echo
echo "=== [3/3] bb prove + write_vk + verify the outer proof ==="
bb prove \
  --scheme ultra_honk \
  --oracle_hash keccak \
  --bytecode_path target/aggregator.json \
  --witness_path target/aggregator.gz \
  --output_path target \
  --output_format bytes_and_fields
bb write_vk \
  --scheme ultra_honk \
  --oracle_hash keccak \
  --verifier_type standalone \
  --bytecode_path target/aggregator.json \
  --output_path target \
  --output_format bytes_and_fields
bb verify \
  --scheme ultra_honk \
  --oracle_hash keccak \
  --vk_path target/vk \
  --proof_path target/proof \
  --public_inputs_path target/public_inputs

echo
echo "=== TIER 2.2 GREEN: aggregator (K=4) outer proof verifies off-chain ==="
echo "    outer proof  fields: $(jq 'length' target/proof_fields.json)"
echo "    outer vk     fields: $(jq 'length' target/vk_fields.json)"
echo "    outer public fields: $(jq 'length' target/public_inputs_fields.json) (expect 8)"
