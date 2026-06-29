"use client";

// Submit tab — wire the OneProof verifier on testnet from the browser.
//
// Three stages:
//   1. Load an example proof (the K=4 aggregator's outer proof, served as
//      a static asset from /public/example/).
//   2. Simulate via Soroban RPC. Free, no signing required.
//   3. Sign + submit via Freighter wallet.
//
// stellar-sdk (~70 KB minified) is loaded lazily inside the handlers so
// it's not in the initial route bundle. freighter-api stays eager. Wallet
// state lives in the shared WalletContext (see ../WalletContext.tsx) so
// connection survives tab navigation AND auto-reconnects on return visits.

import { useState } from "react";
import { CONTRACTS, NETWORK, txUrl } from "@/lib/stellar";
import { useWallet } from "../WalletContext";

type Stage =
  | "idle" | "loading-example" | "ready"
  | "simulating" | "simulated"
  | "signing" | "submitting" | "submitted"
  | "error";

interface ProofBundle {
  proofBytes: Uint8Array;
  publicInputs: Uint8Array;
  sourceLabel: string;
}

interface SimResult {
  ok: boolean;
  minResourceFee?: string;
  returnValue?: string;
  error?: string;
}

export default function SubmitClient() {
  const wallet = useWallet();
  const [stage, setStage] = useState<Stage>("idle");
  const [bundle, setBundle] = useState<ProofBundle | null>(null);
  const [sim, setSim] = useState<SimResult | null>(null);
  const [submitTx, setSubmitTx] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadExample() {
    setStage("loading-example");
    setError(null);
    setSim(null);
    setSubmitTx(null);
    try {
      const [proofResp, pubResp] = await Promise.all([
        fetch("/example/oneproof-aggregator/proof.bin", { cache: "force-cache" }),
        fetch("/example/oneproof-aggregator/public_inputs.bin", { cache: "force-cache" }),
      ]);
      const [proofBuf, pubBuf] = await Promise.all([proofResp.arrayBuffer(), pubResp.arrayBuffer()]);
      setBundle({
        proofBytes:   new Uint8Array(proofBuf),
        publicInputs: new Uint8Array(pubBuf),
        sourceLabel: "aggregator K=4 outer proof (4 inner transfers → 1)",
      });
      setStage("ready");
    } catch (e) {
      setError(String(e));
      setStage("error");
    }
  }

  async function runSimulate() {
    if (!bundle) return;
    setStage("simulating");
    setError(null);
    setSim(null);
    try {
      const StellarSdk = await import("@stellar/stellar-sdk");
      // sim can run without a wallet — we use the wallet's address if
      // available, otherwise a syntactically-valid throwaway pubkey.
      const source = wallet.address ?? StellarSdk.Keypair.random().publicKey();
      const result = await simulateVerifyProof(StellarSdk, bundle, source);
      setSim(result);
      setStage("simulated");
    } catch (e) {
      setError(prettyError(e));
      setStage("error");
    }
  }

  async function runSubmit() {
    if (!bundle || !wallet.address) return;
    setStage("signing");
    setError(null);
    setSubmitTx(null);
    try {
      const [StellarSdk, freighter] = await Promise.all([
        import("@stellar/stellar-sdk"),
        import("@stellar/freighter-api"),
      ]);
      const hash = await submitVerifyProof(StellarSdk, freighter, bundle, wallet.address);
      setSubmitTx(hash);
      setStage("submitted");
    } catch (e) {
      setError(prettyError(e));
      setStage("error");
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-5 md:px-8 py-6 md:py-10 space-y-6">
      <Header />
      <WalletBanner />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-px bg-line">
        {/* LEFT: form + actions */}
        <div className="bg-ink p-6 font-mono space-y-6">
          <section className="space-y-3">
            <SectionLabel n="01" title="load a proof" />
            <button
              onClick={loadExample}
              disabled={stage === "loading-example"}
              className="inline-flex items-center bg-signal text-ink px-4 py-2 text-[12px] uppercase tracking-[0.08em] hover:bg-signal/90 disabled:opacity-50 transition-colors"
            >
              {stage === "loading-example" ? "loading…" : "load example proof"}
            </button>
            {bundle && (
              <div className="text-[11px] text-mute space-y-1 pt-2">
                <Kv k="source"        v={<span className="text-paper">{bundle.sourceLabel}</span>} />
                <Kv k="proof bytes"   v={<span className="text-paper">{bundle.proofBytes.length.toLocaleString()}</span>} />
                <Kv k="public inputs" v={<span className="text-paper">{bundle.publicInputs.length.toLocaleString()} bytes</span>} />
              </div>
            )}
          </section>

          <section className="space-y-3 pt-2 border-t border-line">
            <SectionLabel n="02" title="simulate (free, no wallet needed)" />
            <p className="text-[11px] text-mute leading-relaxed">
              Soroban RPC simulates the call against the live ledger. Returns the
              resource fee and the return value without signing or submitting.
            </p>
            <button
              onClick={runSimulate}
              disabled={!bundle || stage === "simulating"}
              className="inline-flex items-center border border-line text-paper px-4 py-2 text-[12px] uppercase tracking-[0.08em] hover:border-signal hover:text-signal disabled:opacity-40 disabled:hover:border-line disabled:hover:text-paper transition-colors"
            >
              {stage === "simulating" ? "simulating…" : "simulate"}
            </button>
          </section>

          <section className="space-y-3 pt-2 border-t border-line">
            <SectionLabel n="03" title="sign + submit (wallet)" />
            <button
              onClick={runSubmit}
              disabled={!bundle || !wallet.address || stage === "signing" || stage === "submitting"}
              className="inline-flex items-center bg-signal text-ink px-4 py-2 text-[12px] uppercase tracking-[0.08em] hover:bg-signal/90 disabled:opacity-40 disabled:hover:bg-signal disabled:cursor-not-allowed transition-colors"
            >
              {stage === "signing" ? "waiting for Freighter…" :
               stage === "submitting" ? "submitting…" :
               !wallet.address ? "connect wallet above to enable" :
               "submit to testnet"}
            </button>
          </section>
        </div>

        {/* RIGHT: results pane */}
        <div className="bg-ink p-6 font-mono space-y-6 max-h-[80vh] overflow-y-auto">
          <SectionLabel n="·" title="result" />

          {error && (
            <div className="border border-foil p-4 text-[12px] text-foil whitespace-pre-wrap">
              {error}
            </div>
          )}

          {!sim && !submitTx && !error && (
            <p className="text-mute text-sm">
              Load an example proof on the left, simulate to see the projected
              cost, then sign with Freighter to verify it on-chain.
            </p>
          )}

          {sim && (
            <div className="space-y-3">
              <div className="text-[11px] uppercase tracking-[0.08em] text-mute">simulation</div>
              <Kv k="status" v={sim.ok ? <span className="text-signal">would succeed</span> : <span className="text-foil">would fail</span>} />
              {sim.minResourceFee && <Kv k="min fee"  v={<span><span className="text-paper">{Number(sim.minResourceFee).toLocaleString()}</span> <span className="text-mute">stroops</span></span>} />}
              {sim.returnValue    && <Kv k="return"   v={<code className="text-paper text-[11px]">{sim.returnValue}</code>} />}
              {sim.error          && <Kv k="error"    v={<span className="text-foil text-[11px]">{sim.error}</span>} />}
            </div>
          )}

          {submitTx && (
            <div className="space-y-3 pt-3 border-t border-line">
              <div className="text-[11px] uppercase tracking-[0.08em] text-signal">submitted on-chain</div>
              <Kv k="tx hash" v={
                <a href={txUrl(submitTx)} target="_blank" rel="noopener" className="text-paper hover:text-signal break-all">{submitTx}</a>
              } />
              <a href={txUrl(submitTx)} target="_blank" rel="noopener" className="inline-flex text-[12px] text-signal hover:text-paper transition-colors">
                inspect on stellar.expert ↗
              </a>
            </div>
          )}
        </div>
      </div>

      <FooterNote />
    </div>
  );
}

function Header() {
  return (
    <div className="space-y-1">
      <div className="font-mono text-[12px] uppercase tracking-[0.08em] text-mute">submit</div>
      <h1 className="font-mono text-paper text-xl">
        verify a proof on the live <span className="text-signal">oneproof_verifier</span> contract
      </h1>
    </div>
  );
}

// Banner at the top of the page making the wallet state obvious. Sits
// between the header and the form so the visitor knows up front what's
// gated behind the wallet connection.
function WalletBanner() {
  const { address, allowed, installed, error, connect, disconnect } = useWallet();

  if (address) {
    return (
      <div className="border border-line bg-ink-2 p-4 font-mono flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-[12px]">
          <span aria-hidden className="inline-block w-2 h-2 rounded-full bg-signal" />
          <span className="text-mute uppercase tracking-[0.08em]">wallet connected</span>
          <a
            href={`${NETWORK.explorerBase}/account/${address}`}
            target="_blank"
            rel="noopener"
            className="text-paper hover:text-signal break-all"
          >
            {address.slice(0, 8)}…{address.slice(-6)}
          </a>
        </div>
        <button
          onClick={disconnect}
          className="text-[11px] uppercase tracking-[0.08em] text-mute hover:text-foil transition-colors"
        >
          disconnect
        </button>
      </div>
    );
  }

  if (!installed) {
    return (
      <div className="border border-line bg-ink-2 p-4 font-mono space-y-3">
        <div className="flex items-center gap-3 text-[12px]">
          <span aria-hidden className="inline-block w-2 h-2 rounded-full bg-mute" />
          <span className="text-mute uppercase tracking-[0.08em]">freighter not installed</span>
        </div>
        <p className="text-[11px] text-mute leading-relaxed max-w-2xl">
          You can still <span className="text-paper">load + simulate</span> a
          proof without a wallet. Submitting requires Freighter, the Stellar
          browser wallet.
        </p>
        <a
          href="https://freighter.app/"
          target="_blank"
          rel="noopener"
          className="inline-flex items-center bg-signal text-ink px-4 py-2 text-[12px] uppercase tracking-[0.08em] hover:bg-signal/90 transition-colors"
        >
          install freighter →
        </a>
      </div>
    );
  }

  // Installed but not allowed (no wallet address yet).
  return (
    <div className="border border-line bg-ink-2 p-4 font-mono space-y-3">
      <div className="flex items-center gap-3 text-[12px]">
        <span aria-hidden className="inline-block w-2 h-2 rounded-full bg-mute" />
        <span className="text-mute uppercase tracking-[0.08em]">
          {allowed ? "wallet allowed · reading address…" : "wallet ready · not connected"}
        </span>
      </div>
      <p className="text-[11px] text-mute leading-relaxed max-w-2xl">
        Make sure Freighter is set to <span className="text-paper">Test SDF Network ; September 2015</span>.
        Need testnet XLM? <a className="text-signal hover:text-paper" href="https://laboratory.stellar.org/#account-creator?network=test" target="_blank" rel="noopener">friendbot at Stellar Laboratory</a>.
      </p>
      {error && <div className="text-[11px] text-foil break-all">{error}</div>}
      <button
        onClick={connect}
        className="inline-flex items-center bg-signal text-ink px-4 py-2 text-[12px] uppercase tracking-[0.08em] hover:bg-signal/90 transition-colors"
      >
        connect freighter →
      </button>
    </div>
  );
}

function SectionLabel({ n, title }: { n: string; title: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="text-[11px] text-mute">{n}</span>
      <span className="text-[12px] uppercase tracking-[0.08em] text-paper">{title}</span>
    </div>
  );
}

function Kv({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2 items-baseline text-[12px]">
      <span className="text-mute uppercase tracking-[0.08em]">{k}</span>
      <span className="break-all">{v}</span>
    </div>
  );
}

function FooterNote() {
  return (
    <div className="text-[11px] text-mute font-mono border border-line p-3 leading-relaxed">
      The transaction fee is paid in testnet XLM from YOUR account, not ours.
      Get free testnet XLM at{" "}
      <a className="hover:text-paper text-signal" href="https://laboratory.stellar.org/#account-creator?network=test" target="_blank" rel="noopener">
        Stellar Laboratory
      </a>
      {" "}or via friendbot. Make sure Freighter is set to <span className="text-paper">Test SDF Network ; September 2015</span>.
    </div>
  );
}

// stellar-sdk errors are often wrapped in nested objects; surface the
// most useful message rather than dumping the whole thing.
function prettyError(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try { return JSON.stringify(e); } catch { return String(e); }
}

// ─── Soroban tx construction ──────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StellarSdkMod = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FreighterMod = any;

function bytesToScVal(StellarSdk: StellarSdkMod, bytes: Uint8Array) {
  return StellarSdk.xdr.ScVal.scvBytes(Buffer.from(bytes));
}

async function simulateVerifyProof(
  StellarSdk: StellarSdkMod,
  bundle: ProofBundle,
  sourcePubKey: string,
): Promise<SimResult> {
  const server = new StellarSdk.rpc.Server(NETWORK.sorobanRpc);
  let account;
  try {
    account = await server.getAccount(sourcePubKey);
  } catch {
    // Account doesn't exist on testnet (e.g. user hasn't funded their
    // wallet, or we generated a throwaway key for simulation). Use a
    // synthetic Account — only requires the strkey to be syntactically
    // valid, which Keypair.random().publicKey() guarantees.
    account = new StellarSdk.Account(sourcePubKey, "0");
  }
  const contract = new StellarSdk.Contract(CONTRACTS.oneproofVerifier);
  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK.passphrase,
  })
    .addOperation(
      contract.call(
        "verify_proof",
        bytesToScVal(StellarSdk, bundle.publicInputs),
        bytesToScVal(StellarSdk, bundle.proofBytes),
      ),
    )
    .setTimeout(60)
    .build();

  const result = await server.simulateTransaction(tx);
  if (StellarSdk.rpc.Api.isSimulationError(result)) {
    return { ok: false, error: result.error };
  }
  const ret = result.result?.retval;
  return {
    ok: true,
    minResourceFee: result.minResourceFee,
    returnValue: ret ? StellarSdk.scValToNative(ret) + "" : undefined,
  };
}

async function submitVerifyProof(
  StellarSdk: StellarSdkMod,
  freighter: FreighterMod,
  bundle: ProofBundle,
  sourcePubKey: string,
): Promise<string> {
  const server = new StellarSdk.rpc.Server(NETWORK.sorobanRpc);
  const account = await server.getAccount(sourcePubKey);
  const contract = new StellarSdk.Contract(CONTRACTS.oneproofVerifier);
  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK.passphrase,
  })
    .addOperation(
      contract.call(
        "verify_proof",
        bytesToScVal(StellarSdk, bundle.publicInputs),
        bytesToScVal(StellarSdk, bundle.proofBytes),
      ),
    )
    .setTimeout(60)
    .build();
  const prepared = await server.prepareTransaction(tx);

  const signed = await freighter.signTransaction(prepared.toXDR(), {
    networkPassphrase: NETWORK.passphrase,
    address: sourcePubKey,
  });
  if (!signed?.signedTxXdr) {
    throw new Error("Freighter returned no signed tx" + (signed?.error ? `: ${signed.error}` : ""));
  }

  const signedTx = StellarSdk.TransactionBuilder.fromXDR(signed.signedTxXdr, NETWORK.passphrase);
  const sendResult = await server.sendTransaction(signedTx);
  if (sendResult.status !== "PENDING") {
    throw new Error(`send failed: ${sendResult.status} ${sendResult.errorResult ?? ""}`);
  }
  const hash = sendResult.hash;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2_000));
    const status = await server.getTransaction(hash);
    if (status.status === "SUCCESS") return hash;
    if (status.status === "FAILED") throw new Error(`tx ${hash} failed on-chain`);
  }
  throw new Error(`tx ${hash} did not confirm within 60s; check stellar.expert manually`);
}
