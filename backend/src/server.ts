// OneProof prover backend — Express on port 8080.
//
// Endpoints:
//   GET  /healthz                  → liveness check for Fly
//   POST /api/prove-inner          → user inputs → inner UltraHonk proof (5–15s)
//   POST /api/aggregate            → 4 inner proofs → outer proof (20–60s)
//   POST /api/pool/join (SSE)      → Mode 2: join a shared waiting pool
//
// CORS is wide open in dev; in production it's locked to the configured
// FRONTEND_ORIGIN env var (Vercel deployment URL).

import express from "express";
import cors from "cors";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { proveInner, proveAggregate, type InnerProofResult, type OuterProofResult } from "./prover.js";

const PORT = Number(process.env.PORT ?? 8080);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? "*";
const COMPANIONS_DIR = process.env.COMPANIONS_DIR ?? "/app/companions";
const PREBAKED_DIR   = process.env.PREBAKED_DIR   ?? "/app/prebaked";
const POOL_TARGET = 4;
const POOL_TIMEOUT_MS = 15_000;

const app = express();
app.use(cors({ origin: FRONTEND_ORIGIN }));
app.use(express.json({ limit: "2mb" }));

// ─── Liveness ──────────────────────────────────────────────────────────
app.get("/healthz", (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

// ─── /api/prove-inner ──────────────────────────────────────────────────
app.post("/api/prove-inner", async (req, res) => {
  const { amount, nickname } = req.body ?? {};
  if (typeof amount !== "string" || !amount.match(/^\d+$/)) {
    return res.status(400).json({ error: "amount must be a decimal string" });
  }
  if (typeof nickname !== "string" || nickname.length > 64) {
    return res.status(400).json({ error: "nickname must be a string ≤ 64 chars" });
  }
  const t0 = Date.now();
  try {
    const r = await proveInner({ amount, nickname });
    res.json({
      id:                  r.id,
      proofBytesB64:       Buffer.from(r.proofBytes).toString("base64"),
      publicInputsBytesB64: Buffer.from(r.publicInputsBytes).toString("base64"),
      proofFields:         r.proofFields,
      publicInputsFields:  r.publicInputsFields,
      provingMs:           Date.now() - t0,
    });
  } catch (e) {
    console.error("[prove-inner] failed:", e);
    res.status(500).json({ error: errMsg(e), provingMs: Date.now() - t0 });
  }
});

// ─── /api/aggregate ────────────────────────────────────────────────────
// Body: { mode: "solo" | "pool", userProof: InnerProof, others?: InnerProof[3] }
// In "solo" mode the backend loads 3 companion proofs from disk.
// In "pool" mode the caller supplies the 3 other inner proofs (collected
// by the pool layer). Always returns the outer proof bytes.
// Outer-proof cache. Key = SHA-256 over the SORTED inner proof bytes
// (sort makes it order-independent: {a,b,c,d} and {b,d,a,c} share a key).
// 10-entry cap. Solo mode (which uses the pinned demo proof) gets near-
// 100% hit rate after the first run. Pool mode skips the cache.
const aggregateCache = new Map<string, OuterProofResult>();
const AGG_CACHE_MAX = 10;
const HEX = "hex" as const;

function aggregateCacheKey(inners: InnerProofResult[]): string {
  const sorted = inners
    .map((i) => createHash("sha256").update(i.proofBytes).digest(HEX))
    .sort()
    .join(":");
  return createHash("sha256").update(sorted).digest(HEX);
}

app.post("/api/aggregate", async (req, res) => {
  const t0 = Date.now();
  try {
    const { mode, userProof, others } = req.body ?? {};
    const inners = await assembleFour(mode, userProof, others);

    // Cache lookup (solo mode only; pool combinations are unique per user).
    if (mode === "solo") {
      const key = aggregateCacheKey(inners);
      const hit = aggregateCache.get(key);
      if (hit) {
        return res.json({
          proofBytesB64:        Buffer.from(hit.proofBytes).toString("base64"),
          publicInputsBytesB64: Buffer.from(hit.publicInputsBytes).toString("base64"),
          aggregatingMs:        Date.now() - t0,
          cached:               true,
        });
      }
    }

    const outer = await proveAggregate(inners);

    if (mode === "solo") {
      const key = aggregateCacheKey(inners);
      // LRU-ish: drop oldest if at cap.
      if (aggregateCache.size >= AGG_CACHE_MAX) {
        const firstKey = aggregateCache.keys().next().value;
        if (firstKey) aggregateCache.delete(firstKey);
      }
      aggregateCache.set(key, outer);
    }

    res.json({
      proofBytesB64:        Buffer.from(outer.proofBytes).toString("base64"),
      publicInputsBytesB64: Buffer.from(outer.publicInputsBytes).toString("base64"),
      aggregatingMs:        Date.now() - t0,
      cached:               false,
    });
  } catch (e) {
    console.error("[aggregate] failed:", e);
    res.status(500).json({ error: errMsg(e), aggregatingMs: Date.now() - t0 });
  }
});

// ─── /api/pool/join (SSE) ─────────────────────────────────────────────
// Mode 2: client POSTs their inner proof with an Accept: text/event-stream
// header. We hold their request open and stream JSON-encoded events:
//   { type: "queued",       size, target }
//   { type: "pool-grew",    size, target }
//   { type: "aggregating" }
//   { type: "fallback",     reason: "timeout" }
//   { type: "done",         proofBytesB64, publicInputsBytesB64, aggregatingMs }
//   { type: "error",        error }
//
// Stream closes after "done" or "error".
//
// State: simple in-memory pool. Single-instance Node app is fine for
// hackathon scale; if we ever scale horizontally, swap for Redis + pubsub.

interface PoolEntry {
  id:        string;
  inner:     InnerProofResult;
  res:       express.Response;
  joinedAt:  number;
  timeoutId: NodeJS.Timeout | null;
}

const pool: PoolEntry[] = [];

app.post("/api/pool/join", (req, res) => {
  const inner = parseInnerFromBody(req.body);
  if (!inner) {
    return res.status(400).json({ error: "body must include a valid inner proof bundle" });
  }

  res.setHeader("Content-Type",  "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection",    "keep-alive");
  res.flushHeaders?.();

  const entry: PoolEntry = {
    id: randomUUID(),
    inner,
    res,
    joinedAt: Date.now(),
    timeoutId: null,
  };

  // Drop entry if the client disconnects before pool fills.
  req.on("close", () => {
    const idx = pool.indexOf(entry);
    if (idx >= 0) pool.splice(idx, 1);
    if (entry.timeoutId) clearTimeout(entry.timeoutId);
  });

  pool.push(entry);
  sendEvent(entry, { type: "queued", size: pool.length, target: POOL_TARGET });
  // Notify all OTHER entries that the pool grew.
  for (const e of pool) {
    if (e !== entry) sendEvent(e, { type: "pool-grew", size: pool.length, target: POOL_TARGET });
  }

  // Pool full → trigger aggregation for the first 4.
  if (pool.length >= POOL_TARGET) {
    void flushPool();
    return;
  }

  // Otherwise: schedule a timeout fallback for THIS entry. If still
  // unflushed after POOL_TIMEOUT_MS, peel them out + pad with companions.
  entry.timeoutId = setTimeout(() => {
    void runFallback(entry);
  }, POOL_TIMEOUT_MS);
});

async function flushPool() {
  const batch = pool.splice(0, POOL_TARGET);
  for (const e of batch) {
    if (e.timeoutId) clearTimeout(e.timeoutId);
    sendEvent(e, { type: "aggregating" });
  }
  try {
    const t0 = Date.now();
    const outer = await proveAggregate(batch.map((e) => e.inner));
    const aggregatingMs = Date.now() - t0;
    for (const e of batch) {
      sendEvent(e, {
        type: "done",
        proofBytesB64:        Buffer.from(outer.proofBytes).toString("base64"),
        publicInputsBytesB64: Buffer.from(outer.publicInputsBytes).toString("base64"),
        aggregatingMs,
      });
      e.res.end();
    }
  } catch (e) {
    console.error("[pool] aggregate failed:", e);
    for (const ent of batch) {
      sendEvent(ent, { type: "error", error: errMsg(e) });
      ent.res.end();
    }
  }
}

async function runFallback(entry: PoolEntry) {
  const idx = pool.indexOf(entry);
  if (idx < 0) return; // already flushed
  pool.splice(idx, 1);
  sendEvent(entry, { type: "fallback", reason: "timeout" });
  try {
    const inners = await assembleFour("solo", innerToWire(entry.inner), undefined);
    const t0 = Date.now();
    const outer = await proveAggregate(inners);
    sendEvent(entry, {
      type: "done",
      proofBytesB64:        Buffer.from(outer.proofBytes).toString("base64"),
      publicInputsBytesB64: Buffer.from(outer.publicInputsBytes).toString("base64"),
      aggregatingMs:        Date.now() - t0,
    });
  } catch (e) {
    console.error("[pool] fallback failed:", e);
    sendEvent(entry, { type: "error", error: errMsg(e) });
  } finally {
    entry.res.end();
  }
}

function sendEvent(entry: PoolEntry, payload: unknown) {
  entry.res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

// ─── Helpers ──────────────────────────────────────────────────────────

async function assembleFour(
  mode: unknown,
  userProof: unknown,
  others: unknown,
): Promise<InnerProofResult[]> {
  const user = parseInnerFromBody(userProof);
  if (!user) throw new Error("userProof missing or invalid");

  if (mode === "pool") {
    if (!Array.isArray(others) || others.length !== 3) {
      throw new Error("pool mode requires exactly 3 other inner proofs");
    }
    const parsed = others.map((o) => parseInnerFromBody(o));
    for (const [i, p] of parsed.entries()) {
      if (!p) throw new Error(`others[${i}] is invalid`);
    }
    return [user, ...(parsed as InnerProofResult[])];
  }

  // solo mode: load 3 companions from disk
  const companions = await loadCompanions(3);
  return [user, ...companions];
}

async function loadCompanions(n: number): Promise<InnerProofResult[]> {
  let files: string[];
  try { files = await readdir(COMPANIONS_DIR); }
  catch { throw new Error(`companion dir not found: ${COMPANIONS_DIR}`); }
  const jsonFiles = files.filter((f) => f.endsWith(".json")).sort();
  if (jsonFiles.length < n) {
    throw new Error(`need ${n} companion proofs in ${COMPANIONS_DIR}, found ${jsonFiles.length}`);
  }
  const out: InnerProofResult[] = [];
  for (let i = 0; i < n; i++) {
    const filename = jsonFiles[i];
    if (!filename) continue;
    const raw = await readFile(join(COMPANIONS_DIR, filename), "utf8");
    out.push(parseCompanion(JSON.parse(raw)));
  }
  return out;
}

interface WireInnerProof {
  id?: string;
  proofBytesB64?: string;
  publicInputsBytesB64?: string;
  proofFields?: string[];
  publicInputsFields?: string[];
}

function parseInnerFromBody(body: unknown): InnerProofResult | null {
  if (!body || typeof body !== "object") return null;
  const b = body as WireInnerProof;
  if (!Array.isArray(b.proofFields) || !Array.isArray(b.publicInputsFields)) return null;
  if (!b.proofBytesB64 || !b.publicInputsBytesB64) return null;
  try {
    return {
      id:                 b.id ?? "anon",
      proofBytes:         new Uint8Array(Buffer.from(b.proofBytesB64, "base64")),
      publicInputsBytes:  new Uint8Array(Buffer.from(b.publicInputsBytesB64, "base64")),
      proofFields:        b.proofFields,
      publicInputsFields: b.publicInputsFields,
    };
  } catch { return null; }
}

function parseCompanion(raw: unknown): InnerProofResult {
  const parsed = parseInnerFromBody(raw);
  if (!parsed) throw new Error("companion proof file has wrong shape");
  return parsed;
}

function innerToWire(p: InnerProofResult): WireInnerProof {
  return {
    id: p.id,
    proofBytesB64:        Buffer.from(p.proofBytes).toString("base64"),
    publicInputsBytesB64: Buffer.from(p.publicInputsBytes).toString("base64"),
    proofFields:          p.proofFields,
    publicInputsFields:   p.publicInputsFields,
  };
}

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

// Pre-populate the in-memory cache from the pre-baked outer proof
// shipped in the Docker image at /app/prebaked/. The "solo" path's
// cache key is deterministic (4 byte-identical inner proofs, since
// user inputs are pinned to demo values in this iteration of the
// prover). So we can compute the exact key offline and load the
// canonical outer proof under it. First user click hits the cache.
async function prewarmSoloCache(): Promise<void> {
  try {
    const proofFile = join(PREBAKED_DIR, "outer-proof.bin");
    const piFile    = join(PREBAKED_DIR, "outer-public-inputs.bin");
    const [outerProofBytes, outerPiBytes] = await Promise.all([
      readFile(proofFile),
      readFile(piFile),
    ]);

    // Reproduce the cache key as if we'd just aggregated 4 copies of a
    // companion (= the canonical solo case where user proof is byte-
    // identical to the companion files). assembleFour("solo", x, _)
    // returns [user, comp1, comp2, comp3] — all identical bytes.
    const companions = await loadCompanions(3);
    const userLike   = companions[0]; // any one of them — same bytes
    if (!userLike) {
      console.warn("[prewarm] no companions, skipping cache prewarm");
      return;
    }
    const inners = [userLike, ...companions];
    const key = aggregateCacheKey(inners);

    aggregateCache.set(key, {
      proofBytes:        new Uint8Array(outerProofBytes),
      publicInputsBytes: new Uint8Array(outerPiBytes),
    });
    console.log(
      `[prewarm] solo cache populated · key=${key.slice(0, 16)}… · ` +
      `${outerProofBytes.length} byte outer proof`,
    );
  } catch (e) {
    // Non-fatal: if prebaked files missing, first solo call just pays
    // the full proving cost and then populates the cache normally.
    console.warn(`[prewarm] skipped:`, e instanceof Error ? e.message : e);
  }
}

// ─── Boot ─────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`[oneproof-backend] listening on :${PORT}`);
  console.log(`[oneproof-backend] CIRCUITS_DIR=${process.env.CIRCUITS_DIR ?? "/app/circuits"}`);
  console.log(`[oneproof-backend] COMPANIONS_DIR=${COMPANIONS_DIR}`);
  console.log(`[oneproof-backend] PREBAKED_DIR=${PREBAKED_DIR}`);
  console.log(`[oneproof-backend] FRONTEND_ORIGIN=${FRONTEND_ORIGIN}`);
  await prewarmSoloCache();
});
