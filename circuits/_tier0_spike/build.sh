#!/usr/bin/env bash
# Tier 0 spike 2.1 — Noir recursion verifies off-chain (bb CLI path).
#
# Background: @aztec/bb.js@0.87.0 does not include recursive-prover entrypoints
# in its WASM module; the recursion API landed in JS only later. bb CLI 0.87.0
# DOES support recursion via --honk_recursion + --init_kzg_accumulator. This
# script uses the CLI path end-to-end. No node_modules needed.
#
# Flow:
#   1. nargo execute inner   → witness + ACIR
#   2. bb prove/write_vk inner with --honk_recursion 1 --init_kzg_accumulator
#      --oracle_hash poseidon2 (Poseidon2 is "for proofs verified inside a circuit",
#      per `bb prove --help`).
#   3. jq the inner's vk_fields.json + proof_fields.json + public_inputs_fields.json
#      into the aggregator's Prover.toml.
#   4. nargo execute aggregator → outer witness.
#   5. bb prove/verify the outer with --oracle_hash keccak (outer is final, not
#      recursively verified again — matches what rs-soroban-ultrahonk expects).
#
# Green iff `bb verify` on the outer returns "Verification successful".
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

export PATH="$HOME/.nargo/bin:$HOME/.bb:$PATH"

INNER_DIR="$SCRIPT_DIR/inner"
AGG_DIR="$SCRIPT_DIR/aggregator"

echo "=== nargo $(nargo --version | head -1) / bb $(bb --version) ==="

# ────────────────────────────────────────────────────────────────────────────
echo
echo "=== [1/5] inner: compile + execute ==="
( cd "$INNER_DIR" && rm -rf target && nargo compile && nargo execute inner )
test -f "$INNER_DIR/target/inner.json"
test -f "$INNER_DIR/target/inner.gz"

# ────────────────────────────────────────────────────────────────────────────
echo
echo "=== [2/5] inner: bb prove + write_vk (recursive-friendly) ==="
INNER_OUT="$INNER_DIR/target"
bb prove \
  --scheme ultra_honk \
  --oracle_hash poseidon2 \
  --honk_recursion 1 \
  --init_kzg_accumulator \
  --bytecode_path "$INNER_DIR/target/inner.json" \
  --witness_path "$INNER_DIR/target/inner.gz" \
  --output_path "$INNER_OUT" \
  --output_format bytes_and_fields
bb write_vk \
  --scheme ultra_honk \
  --oracle_hash poseidon2 \
  --honk_recursion 1 \
  --init_kzg_accumulator \
  --verifier_type standalone \
  --bytecode_path "$INNER_DIR/target/inner.json" \
  --output_path "$INNER_OUT" \
  --output_format bytes_and_fields

echo "    inner artifacts:"
ls -la "$INNER_OUT"
echo "    inner proof fields:        $(jq 'length' "$INNER_OUT/proof_fields.json")"
echo "    inner vk fields:           $(jq 'length' "$INNER_OUT/vk_fields.json")"
echo "    inner public_inputs fields: $(jq 'length' "$INNER_OUT/public_inputs_fields.json")"

# ────────────────────────────────────────────────────────────────────────────
echo
echo "=== [3/5] populate aggregator/Prover.toml from inner artifacts ==="
to_toml_array() {  # jq: ["a","b"] → ["a", "b"]   (TOML-compatible)
  jq -r '"[" + (map("\"" + . + "\"") | join(", ")) + "]"' "$1"
}
{
  echo "verification_key = $(to_toml_array "$INNER_OUT/vk_fields.json")"
  echo "proof = $(to_toml_array "$INNER_OUT/proof_fields.json")"
  echo "public_inputs = $(to_toml_array "$INNER_OUT/public_inputs_fields.json")"
  echo 'key_hash = "0x00"'
} > "$AGG_DIR/Prover.toml"
echo "    wrote $AGG_DIR/Prover.toml"

# ────────────────────────────────────────────────────────────────────────────
echo
echo "=== [4/5] aggregator: compile + execute + bb prove ==="
( cd "$AGG_DIR" && rm -rf target && nargo compile && nargo execute aggregator )
AGG_OUT="$AGG_DIR/target"
bb prove \
  --scheme ultra_honk \
  --oracle_hash keccak \
  --bytecode_path "$AGG_DIR/target/aggregator.json" \
  --witness_path "$AGG_DIR/target/aggregator.gz" \
  --output_path "$AGG_OUT" \
  --output_format bytes_and_fields
bb write_vk \
  --scheme ultra_honk \
  --oracle_hash keccak \
  --verifier_type standalone \
  --bytecode_path "$AGG_DIR/target/aggregator.json" \
  --output_path "$AGG_OUT" \
  --output_format bytes_and_fields

# ────────────────────────────────────────────────────────────────────────────
echo
echo "=== [5/5] verify outer proof ==="
bb verify \
  --scheme ultra_honk \
  --oracle_hash keccak \
  --vk_path "$AGG_OUT/vk" \
  --proof_path "$AGG_OUT/proof" \
  --public_inputs_path "$AGG_OUT/public_inputs"

echo
echo "=== SPIKE 2.1 GREEN: recursive proof verified off-chain ==="
