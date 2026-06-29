// Generate 3 companion inner-proof JSON files from the canonical demo
// proof at circuits/inner_transfer/target/. Run from the repo root:
//
//     node backend/generate-companions.mjs
//
// Output: web/public/example/inner-companions/companion-{1,2,3}.json
//
// Honest framing: the 3 companions are byte-identical copies of the
// committed demo proof. The aggregator circuit doesn't care that the 4
// inner proofs are distinct — it just verifies 4 ultrahonk proofs hold.
// A cryptographically-different companion set would require re-proving
// the inner_transfer circuit with different (secret, amount, blinding)
// inputs, which means computing fresh (root, nullifier) values for each.
// That requires either pedersen_hash in JS or a helper Noir circuit;
// out of scope for the unblocking commit. Banner copy on /console
// explains this transparently.

import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");

const INNER_TARGET = join(repoRoot, "circuits", "inner_transfer", "target");
const OUT_DIR      = join(repoRoot, "web", "public", "example", "inner-companions");

const [proofBytes, publicInputsBytes, proofFieldsRaw, piFieldsRaw] = await Promise.all([
  readFile(join(INNER_TARGET, "proof")),
  readFile(join(INNER_TARGET, "public_inputs")),
  readFile(join(INNER_TARGET, "proof_fields.json"), "utf8"),
  readFile(join(INNER_TARGET, "public_inputs_fields.json"), "utf8"),
]);

const proofFields = JSON.parse(proofFieldsRaw);
const publicInputsFields = JSON.parse(piFieldsRaw);

await mkdir(OUT_DIR, { recursive: true });

const baseId = createHash("sha256").update(proofBytes).digest("hex").slice(0, 16);

for (let i = 1; i <= 3; i++) {
  const wire = {
    id: `companion-${i}-${baseId}`,
    proofBytesB64:        Buffer.from(proofBytes).toString("base64"),
    publicInputsBytesB64: Buffer.from(publicInputsBytes).toString("base64"),
    proofFields,
    publicInputsFields,
  };
  const out = join(OUT_DIR, `companion-${i}.json`);
  await writeFile(out, JSON.stringify(wire, null, 0));
  console.log(`✓ wrote ${out} (${proofBytes.length} bytes proof, ${publicInputsBytes.length} bytes pi)`);
}

console.log(`\ndone. ${3} companion files at:\n  ${OUT_DIR}`);
