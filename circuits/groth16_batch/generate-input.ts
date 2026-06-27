// Generates a single deterministic, satisfying input for circuit.circom.
// Used as a sanity check during build.sh: prove + verify off-chain.
//
// Demo construction:
//   secret = 7, amount = 1_000, blinding = 42
//   leafIndex = 0 (all pathIndices = 0)
//   Sibling subtree is "empty" — each sibling at depth d is the conventional
//   "empty subtree root" at that depth, defined recursively:
//       Z[0] = 0
//       Z[d] = Poseidon(Z[d-1], Z[d-1])
//   This is the standard empty-tree convention used by zkSNARK privacy pools.
//   The Merkle root R is computed bottom-up from the single leaf c.
import { buildPoseidon } from "circomlibjs";
import { writeFileSync } from "node:fs";

const D = 16;

(async () => {
  const poseidon = await buildPoseidon();
  const F = poseidon.F;

  const toDec = (x: any) => F.toObject(x).toString();

  const secret = 7n;
  const amount = 1000n;
  const blinding = 42n;

  const c = poseidon([secret, amount, blinding]);
  const cDec = toDec(c);

  // Empty-tree sibling values at each depth (Z[d]) — same convention zkSNARK
  // privacy pools use for "this leaf has no actual sibling"
  const Z: bigint[] = [0n];
  for (let d = 1; d <= D; d++) {
    const prev = F.e(Z[d - 1]);
    Z.push(BigInt(toDec(poseidon([prev, prev]))));
  }

  // Climb the tree from the leaf, sibling at each level is Z[i]
  const pathElements: string[] = [];
  const pathIndices: number[] = [];
  let cur = c;
  for (let i = 0; i < D; i++) {
    const sibling = F.e(Z[i]);
    pathElements.push(Z[i].toString());
    pathIndices.push(0);
    cur = poseidon([cur, sibling]); // pathIndices[i]=0 → cur is left
  }
  const root = toDec(cur);

  const leafIndex = 0n; // pathIndices all 0
  const nullifier = toDec(poseidon([secret, leafIndex]));

  const input = {
    root,
    nullifier,
    secret: secret.toString(),
    amount: amount.toString(),
    blinding: blinding.toString(),
    pathElements,
    pathIndices,
  };

  writeFileSync("input.json", JSON.stringify(input, null, 2));
  console.log("wrote input.json");
  console.log("  commitment c =", cDec);
  console.log("  root         =", root);
  console.log("  nullifier    =", nullifier);
})();
