// Typed client for the OneProof prover backend. Calls are POST JSON;
// the pool endpoint uses SSE so it gets a separate streaming helper.
//
// Set NEXT_PUBLIC_BACKEND_URL in .env.local for local dev:
//   NEXT_PUBLIC_BACKEND_URL=http://localhost:8080
// In Vercel prod: https://oneproof-backend.fly.dev (or whatever Fly assigns).

const BASE = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";

export interface InnerProofWire {
  id: string;
  proofBytesB64: string;
  publicInputsBytesB64: string;
  proofFields: string[];
  publicInputsFields: string[];
}

export interface ProveInnerResponse extends InnerProofWire {
  provingMs: number;
}

export interface ProveAggregateResponse {
  proofBytesB64: string;
  publicInputsBytesB64: string;
  aggregatingMs: number;
}

export class BackendError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function assertBaseConfigured() {
  if (!BASE) {
    throw new BackendError(
      "Backend URL not configured. Set NEXT_PUBLIC_BACKEND_URL in web/.env.local.",
      0,
    );
  }
}

export async function backendHealthz(): Promise<boolean> {
  if (!BASE) return false;
  try {
    const r = await fetch(`${BASE}/healthz`, { method: "GET" });
    return r.ok;
  } catch { return false; }
}

/** Same probe as backendHealthz, but returns timing — used by /console
 * to detect a cold-start (>2s typically means Fly's machine was sleeping
 * and just woke up). */
export async function backendHealthzTimed(): Promise<{ ok: boolean; ms: number }> {
  if (!BASE) return { ok: false, ms: 0 };
  const t0 = performance.now();
  try {
    const r = await fetch(`${BASE}/healthz`, { method: "GET" });
    return { ok: r.ok, ms: Math.round(performance.now() - t0) };
  } catch {
    return { ok: false, ms: Math.round(performance.now() - t0) };
  }
}

export async function proveInner(amount: string, nickname: string): Promise<ProveInnerResponse> {
  assertBaseConfigured();
  const r = await fetch(`${BASE}/api/prove-inner`, {
    method:  "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ amount, nickname }),
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new BackendError(`prove-inner failed (${r.status}): ${txt}`, r.status);
  }
  return r.json() as Promise<ProveInnerResponse>;
}

export async function aggregateSolo(userProof: InnerProofWire): Promise<ProveAggregateResponse> {
  assertBaseConfigured();
  const r = await fetch(`${BASE}/api/aggregate`, {
    method:  "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode: "solo", userProof }),
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new BackendError(`aggregate (solo) failed (${r.status}): ${txt}`, r.status);
  }
  return r.json() as Promise<ProveAggregateResponse>;
}

// ─── Pool (SSE) ────────────────────────────────────────────────────────

export type PoolEvent =
  | { type: "queued";       size: number; target: number }
  | { type: "pool-grew";    size: number; target: number }
  | { type: "aggregating" }
  | { type: "fallback";     reason: string }
  | { type: "done";         proofBytesB64: string; publicInputsBytesB64: string; aggregatingMs: number }
  | { type: "error";        error: string };

/** POST + SSE: subscribe to the shared pool. Resolves with the final
 * aggregated outer proof or rejects on error. Calls `onEvent` for every
 * intermediate event so the UI can render progress. */
export async function joinPool(
  userProof: InnerProofWire,
  onEvent: (e: PoolEvent) => void,
  signal?: AbortSignal,
): Promise<{ proofBytesB64: string; publicInputsBytesB64: string; aggregatingMs: number }> {
  assertBaseConfigured();
  const resp = await fetch(`${BASE}/api/pool/join`, {
    method:  "POST",
    headers: { "content-type": "application/json", accept: "text/event-stream" },
    body: JSON.stringify(userProof),
    signal,
  });
  if (!resp.ok || !resp.body) {
    const txt = await resp.text().catch(() => "");
    throw new BackendError(`pool/join failed (${resp.status}): ${txt}`, resp.status);
  }
  const reader = resp.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value ?? "";
    // SSE frames are separated by blank lines; each frame may have a
    // "data: " prefix line. Parse all complete frames out of `buffer`.
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) >= 0) {
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const dataLine = frame.split("\n").find((l) => l.startsWith("data:"));
      if (!dataLine) continue;
      try {
        const evt = JSON.parse(dataLine.slice(5).trim()) as PoolEvent;
        onEvent(evt);
        if (evt.type === "done") {
          return {
            proofBytesB64:        evt.proofBytesB64,
            publicInputsBytesB64: evt.publicInputsBytesB64,
            aggregatingMs:        evt.aggregatingMs,
          };
        }
        if (evt.type === "error") {
          throw new BackendError(evt.error, 500);
        }
      } catch (e) {
        if (e instanceof BackendError) throw e;
        // ignore malformed frames; keep reading
      }
    }
  }
  throw new BackendError("pool stream ended without a done event", 0);
}
