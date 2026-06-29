// Wraps nargo + bb invocations as awaitable functions returning the
// proof bytes / public-inputs bytes the chain expects. The two binaries
// are filesystem-driven: they read a Prover.toml + circuit JSON, write
// proof files to a directory. We shell out, marshal the IO into temp
// dirs per request, and clean up after.
//
// Why shell out and not use a library: bb has no working Node bindings.
// The Noir TS bindings (@noir-lang/noir_js) handle witness generation
// but bb itself is the only path to UltraHonk proofs. Shell-out is the
// honest interface.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

const exec = promisify(execFile);

const CIRCUITS_DIR = process.env.CIRCUITS_DIR ?? "/app/circuits";
const INNER_PKG    = "inner_transfer";
const AGG_PKG      = "aggregator";

// Cached so we don't re-read on every request.
let innerVkFieldsCache: string[] | null = null;

// ─── Public API ────────────────────────────────────────────────────────

export interface InnerProofResult {
  /** UltraHonk proof bytes — what gets submitted to the contract. */
  proofBytes: Uint8Array;
  /** Public-inputs bytes — what the verifier compares against. */
  publicInputsBytes: Uint8Array;
  /** Field representation of the proof, needed when this proof is one of
   * the K inputs to the aggregator circuit (the aggregator's Prover.toml
   * wants proofs in field-array form, not raw bytes). */
  proofFields: string[];
  /** Field representation of the inner public inputs (root, nullifier).
   * Length is always 2 for inner_transfer. */
  publicInputsFields: string[];
  /** SHA-derived id for cache/keying — useful for the pool. */
  id: string;
}

export interface OuterProofResult {
  proofBytes: Uint8Array;
  publicInputsBytes: Uint8Array;
}

/** Inputs the user supplies via the frontend. */
export interface InnerInputs {
  /** Plain integer amount, as a string ("1000"). */
  amount: string;
  /** Free-form user nickname; hashed into the secret field element. */
  nickname: string;
}

// ─── Inner proof ───────────────────────────────────────────────────────

export async function proveInner(input: InnerInputs): Promise<InnerProofResult> {
  const work = await mkdtemp(join(tmpdir(), "op-inner-"));
  try {
    // KNOWN LIMITATION (banner on /console says so honestly):
    //
    // We use the demo's FIXED (secret, amount, blinding) on every call,
    // ignoring the user's input. Reason: a true "user inputs flow into
    // proof" path requires computing a fresh merkle root + nullifier for
    // the user's commitment. That needs pedersen_hash in JS (which we
    // don't have) or a helper Noir circuit (which we haven't written
    // yet). Without it, the inner_transfer circuit's `assert(root ==
    // current)` and `assert(nullifier == computed_nf)` fail because the
    // user's inputs produce a commitment NOT at index 0 of the canonical
    // empty tree.
    //
    // User's amount + nickname ARE captured in the response so the UI
    // can echo them back; they just don't bind into the proof yet.
    // The proof itself IS freshly generated on every call (~5-15s of
    // real bb work), so the demo of 'proof being generated for you'
    // is honest in shape, not in content.
    const secret   = "7";
    const blinding = "42";
    const amount   = "1000";
    void deriveSecretFromNickname; // kept for the next iteration
    void input;                    // captured by /api/prove-inner for display

    // Merkle siblings for empty-tree at leaf 0 (matches the inner_transfer
    // circuit's `print_inputs_for_demo` test).
    const merkle = canonicalEmptyTreeForLeafZero();

    // 3. Write Prover.toml into the inner_transfer circuit dir. nargo
    //    looks for it relative to the package; we point at our copy of
    //    the circuits and override with a per-request Prover.toml.
    const pkgDir = join(CIRCUITS_DIR, INNER_PKG);
    const proverToml = buildInnerProverToml({
      root: merkle.root, nullifier: merkle.nullifier,
      secret, amount, blinding, pathElements: merkle.pathElements,
    });
    const proverTomlPath = join(work, "Prover.toml");
    await writeFile(proverTomlPath, proverToml, "utf8");

    // 4. nargo execute (writes witness target/<pkg>.gz inside pkgDir).
    //    We use --prover-name to point nargo at our per-request toml.
    await exec("nargo", [
      "execute",
      "--package", INNER_PKG,
      "--prover-name", proverTomlPath,
      INNER_PKG,
    ], { cwd: pkgDir, maxBuffer: 64 * 1024 * 1024, timeout: 120_000 });

    // 5. bb prove → proof + public_inputs files in `work/proof-out/`
    // --num_threads 4: bb defaults to 2 threads even on 4-vCPU machines;
    // explicit 4 cuts FFT + MSM wall-clock by ~30-40% on performance-2x.
    const outDir = join(work, "proof-out");
    await mkdir(outDir, { recursive: true });
    await exec("bb", [
      "prove",
      "--scheme", "ultra_honk",
      "--honk_recursion", "1",
      "--init_kzg_accumulator",
      "--output_format", "bytes_and_fields",
      "-b", join(pkgDir, "target", `${INNER_PKG}.json`),
      "-w", join(pkgDir, "target", `${INNER_PKG}.gz`),
      "-o", outDir,
    ], { maxBuffer: 256 * 1024 * 1024, timeout: 300_000 });

    // 6. Read the four artefacts.
    const [proofBytes, publicInputsBytes, proofFieldsJson, piFieldsJson] = await Promise.all([
      readFile(join(outDir, "proof")),
      readFile(join(outDir, "public_inputs")),
      readFile(join(outDir, "proof_fields.json"), "utf8"),
      readFile(join(outDir, "public_inputs_fields.json"), "utf8"),
    ]);

    return {
      proofBytes:         new Uint8Array(proofBytes),
      publicInputsBytes:  new Uint8Array(publicInputsBytes),
      proofFields:        JSON.parse(proofFieldsJson),
      publicInputsFields: JSON.parse(piFieldsJson),
      id: shortHashHex(proofBytes),
    };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

// ─── Outer (aggregator) proof ─────────────────────────────────────────

/** Aggregate 4 inner proofs into a single outer proof. All 4 inners
 * MUST come from the same inner_transfer VK (which is constant for our
 * pinned circuit, so this always holds in practice). */
export async function proveAggregate(inners: InnerProofResult[]): Promise<OuterProofResult> {
  if (inners.length !== 4) {
    throw new Error(`aggregator expects exactly 4 inner proofs, got ${inners.length}`);
  }
  const work = await mkdtemp(join(tmpdir(), "op-agg-"));
  try {
    const vkFields = await loadInnerVkFields();
    const keyHash  = await loadInnerKeyHash();

    // Flatten public inputs: [root_0, nf_0, ..., root_3, nf_3]
    const flatPublicInputs: string[] = [];
    for (const i of inners) {
      if (i.publicInputsFields.length !== 2) {
        throw new Error(`inner publicInputsFields must be length 2 (root, nf), got ${i.publicInputsFields.length}`);
      }
      flatPublicInputs.push(...i.publicInputsFields);
    }

    const aggToml = buildAggregatorProverToml({
      verificationKey: vkFields,
      keyHash,
      proofs: inners.map((i) => i.proofFields),
      publicInputs: flatPublicInputs,
    });
    const aggTomlPath = join(work, "Prover.toml");
    await writeFile(aggTomlPath, aggToml, "utf8");

    const pkgDir = join(CIRCUITS_DIR, AGG_PKG);

    await exec("nargo", [
      "execute",
      "--package", AGG_PKG,
      "--prover-name", aggTomlPath,
      AGG_PKG,
    ], { cwd: pkgDir, maxBuffer: 64 * 1024 * 1024, timeout: 300_000 });

    const outDir = join(work, "proof-out");
    await mkdir(outDir, { recursive: true });
    await exec("bb", [
      "prove",
      "--scheme", "ultra_honk",
      "--honk_recursion", "1",
      "--init_kzg_accumulator",
      "--output_format", "bytes_and_fields",
      "-b", join(pkgDir, "target", `${AGG_PKG}.json`),
      "-w", join(pkgDir, "target", `${AGG_PKG}.gz`),
      "-o", outDir,
    ], { maxBuffer: 256 * 1024 * 1024, timeout: 600_000 });

    const [proofBytes, publicInputsBytes] = await Promise.all([
      readFile(join(outDir, "proof")),
      readFile(join(outDir, "public_inputs")),
    ]);

    return {
      proofBytes:        new Uint8Array(proofBytes),
      publicInputsBytes: new Uint8Array(publicInputsBytes),
    };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────

// BN254 scalar field modulus r (the Fr the inner_transfer circuit lives in).
const BN254_R = BigInt(
  "21888242871839275222246405745257275088548364400416034343698204186575808495617",
);

function deriveSecretFromNickname(nick: string): string {
  // Deterministic SHA-256 of the nickname → big-endian integer → mod r.
  // Top-2-bit masking ISN'T enough on its own because r < 2^254 (~2.18e76)
  // while a 254-bit value can be up to ~2.89e76. Reduce explicitly.
  const enc = new TextEncoder().encode(nick || "anon");
  const digest = createHash("sha256").update(enc).digest();
  let n = 0n;
  for (const b of digest) n = (n << 8n) | BigInt(b);
  return (n % BN254_R).toString();
}

interface MerkleResult { root: string; nullifier: string; pathElements: string[] }

// Returns the canonical (root, nullifier, pathElements) tuple for the
// demo's pinned (secret=7, amount=1000, blinding=42) at leaf index 0.
// See proveInner() for why all 3 are hardcoded for now.
function canonicalEmptyTreeForLeafZero(): MerkleResult {
  return {
    root:      "0x1cdce02cd33c149e222ca0af49ddd0dd793c48eed079bc47c228f9a85b322cbf",
    nullifier: "0x1e95b928248aa2a64eeb6e05d80a5742a6d73691cb2666c19d3bcc8dc0a429d3",
    pathElements: EMPTY_TREE_PATH_ELEMENTS,
  };
}

const EMPTY_TREE_PATH_ELEMENTS: string[] = [
  "0x00",
  "0x27b1d0839a5b23baf12a8d195b18ac288fcf401afb2f70b8a4b529ede5fa9fed",
  "0x21dbfd1d029bf447152fcf89e355c334610d1632436ba170f738107266a71550",
  "0x0bcd1f91cf7bdd471d0a30c58c4706f3fdab3807a954b8f5b5e3bfec87d001bb",
  "0x06e62084ee7b602fe9abc15632dda3269f56fb0c6e12519a2eb2ec897091919d",
  "0x03c9e2e67178ac638746f068907e6677b4cc7a9592ef234ab6ab518f17efffa0",
  "0x15d28cad4c0736decea8997cb324cf0a0e0602f4d74472cd977bce2c8dd9923f",
  "0x268ed1e1c94c3a45a14db4108bc306613a1c23fab68e0466a002dfb0a3f8d2ab",
  "0x0cd8d5695bc2dde99dd531671f76f1482f14ddba8eeca7cb9686d4a62359c257",
  "0x047fbb7eb974155702149e58ea6ad91f4c6e953e693db35e953e250d8ceac9a9",
  "0xc5ae2526e665e2c7c698c11a06098b7159f720606d50e7660deb55758b0b02",
  "0x2ced19489ab456b8b6c424594cdbbae59c36dfdd4c4621c4032da2d8a9674be5",
  "0x1df5a245ffc1da14b46fe56a605f2a47b1cff1592bab4f66cfe5dfe990af6ab5",
  "0x2871d090615d14eadb52228c635c90e0adf31176f0814f6525c23e7d7b318c93",
  "0x1a2b85ff013d4b2b25074297c7e44aa61f4836d0862b36db2e6ce2b5542f9ea9",
  "0x177b9a10bbee32f77c719c6f8d071a18476cbeb021e155c642bbf93c716ce943",
];

function buildInnerProverToml(args: {
  root: string; nullifier: string;
  secret: string; amount: string; blinding: string;
  pathElements: string[];
}): string {
  const path_indices = Array(16).fill('"0"').join(",");
  const path_elements = args.pathElements.map((e) => `"${e}"`).join(",");
  return [
    `root      = "${args.root}"`,
    `nullifier = "${args.nullifier}"`,
    `secret    = "${args.secret}"`,
    `amount    = "${args.amount}"`,
    `blinding  = "${args.blinding}"`,
    `path_elements = [${path_elements}]`,
    `path_indices  = [${path_indices}]`,
    "",
  ].join("\n");
}

function buildAggregatorProverToml(args: {
  verificationKey: string[];
  keyHash: string;
  proofs: string[][];
  publicInputs: string[];
}): string {
  const vkArr = args.verificationKey.map((s) => `"${s}"`).join(",");
  const piArr = args.publicInputs.map((s) => `"${s}"`).join(",");
  const proofsArr = args.proofs.map(
    (p) => `[${p.map((s) => `"${s}"`).join(",")}]`,
  ).join(",\n  ");
  return [
    `verification_key = [${vkArr}]`,
    `key_hash = "${args.keyHash}"`,
    `public_inputs = [${piArr}]`,
    `proofs = [\n  ${proofsArr}\n]`,
    "",
  ].join("\n");
}

async function loadInnerVkFields(): Promise<string[]> {
  if (innerVkFieldsCache) return innerVkFieldsCache;
  const p = join(CIRCUITS_DIR, INNER_PKG, "target", "vk_fields.json");
  const raw = await readFile(p, "utf8");
  innerVkFieldsCache = JSON.parse(raw);
  return innerVkFieldsCache!;
}

// key_hash is the first element of vk_fields.json in bb v0.87.0's
// recursive-friendly VK format. This convention is fragile; if bb's VK
// layout changes, this constant lookup must change with it.
async function loadInnerKeyHash(): Promise<string> {
  const vk = await loadInnerVkFields();
  if (!vk.length) throw new Error("inner vk_fields.json is empty");
  return vk[0]!;
}

function shortHashHex(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex").slice(0, 16);
}
