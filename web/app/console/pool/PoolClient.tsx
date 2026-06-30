"use client";

// /console/pool — the privacy pool demo. Two flows:
//   1. Deposit: user sends testnet XLM into the pool + registers a
//      commitment derived from their (nickname, amount) inputs. Real
//      value moves; their identity is on-chain (they signed) but the
//      commitment's preimage stays private.
//   2. Batch withdraw: one tx invokes pool.batch_withdraw with the
//      canonical aggregated proof, four nullifiers, four recipients,
//      four amounts. The contract verifies the proof via cross-contract
//      call, records the nullifiers, dispatches four token transfers.
//      ONE Stellar tx, FOUR settlements.
//
// HONEST CAVEAT (banner in copy): the demo's aggregated proof attests
// the inner proofs are valid but doesn't constrain the (recipient,
// amount) tuples. A production version would bind those into the
// circuit's public inputs so the contract can verify they match what
// was committed. For the demo, we accept that limitation explicitly.

import { useEffect, useState } from "react";
import { CONTRACTS, NETWORK, txUrl, contractUrl } from "@/lib/stellar";
import { useWallet } from "../WalletContext";

type Stage =
  | "idle"
  | "deposit-signing" | "deposit-submitting" | "deposit-done"
  | "withdraw-loading" | "withdraw-signing" | "withdraw-submitting" | "withdraw-done"
  | "error";

interface PoolStats {
  total: bigint;
  commitmentCount: number;
}

export default function PoolClient() {
  const wallet = useWallet();

  const [depositAmount, setDepositAmount]   = useState("1");
  const [depositNick,   setDepositNick]     = useState("alice");
  const [withdrawAmount, setWithdrawAmount] = useState("0.5");
  const [stage, setStage]                   = useState<Stage>("idle");
  const [stats, setStats]                   = useState<PoolStats | null>(null);
  const [statsErr, setStatsErr]             = useState<string | null>(null);
  const [lastTx, setLastTx]                 = useState<string | null>(null);
  const [error, setError]                   = useState<string | null>(null);

  // Pool stats poll
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const r = await fetchPoolStats();
        if (!alive) return;
        setStats(r);
        setStatsErr(null);
      } catch (e) {
        if (alive) setStatsErr(e instanceof Error ? e.message : String(e));
      }
    }
    load();
    const id = setInterval(load, 15_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  async function runDeposit() {
    if (!wallet.address) return;
    setError(null);
    setStage("deposit-signing");
    try {
      const [StellarSdk, freighter] = await Promise.all([
        import("@stellar/stellar-sdk"),
        import("@stellar/freighter-api"),
      ]);
      const commitment = await deriveCommitmentBytes(depositNick, depositAmount);
      const stroops = Math.round(parseFloat(depositAmount) * 10_000_000); // 1 XLM = 10^7 stroops
      const hash = await submitDeposit(StellarSdk, freighter, wallet.address, stroops, commitment);
      setLastTx(hash);
      setStage("deposit-done");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStage("error");
    }
  }

  async function runWithdraw() {
    if (!wallet.address) return;
    setError(null);
    setStage("withdraw-loading");
    try {
      const [StellarSdk, freighter, proofResp, piResp] = await Promise.all([
        import("@stellar/stellar-sdk"),
        import("@stellar/freighter-api"),
        fetch("/example/oneproof-aggregator/proof.bin"),
        fetch("/example/oneproof-aggregator/public_inputs.bin"),
      ]);
      const proofBytes        = new Uint8Array(await proofResp.arrayBuffer());
      const publicInputsBytes = new Uint8Array(await piResp.arrayBuffer());
      const stroops = Math.round(parseFloat(withdrawAmount) * 10_000_000);
      setStage("withdraw-signing");
      const hash = await submitBatchWithdraw(
        StellarSdk, freighter, wallet.address,
        proofBytes, publicInputsBytes, stroops,
      );
      setLastTx(hash);
      setStage("withdraw-done");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStage("error");
    }
  }

  const busy = stage.includes("signing") || stage.includes("submitting") || stage.includes("loading");

  return (
    <div className="max-w-6xl mx-auto px-5 md:px-8 py-6 md:py-10 space-y-6">
      <Header />
      <HonestyBanner />
      <WalletBanner />

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-px bg-line">
        {/* LEFT — deposit/withdraw forms */}
        <div className="bg-ink p-6 md:p-7 font-mono space-y-8">
          <section className="space-y-3">
            <SectionLabel n="01" title="deposit testnet XLM into the pool" />
            <p className="text-[11px] text-mute leading-relaxed">
              Pay XLM, register a commitment. Your account signs the deposit (visible on-chain);
              the commitment&apos;s preimage stays private. Pool funds accumulate; later, any
              withdrawer with a valid aggregated proof can draw against them.
            </p>
            <div className="grid grid-cols-[1fr_1.4fr] gap-3">
              <LabeledInput label="amount (XLM)" value={depositAmount} setValue={setDepositAmount} disabled={busy} type="number" />
              <LabeledInput label="nickname"     value={depositNick}   setValue={setDepositNick}   disabled={busy} />
            </div>
            <ActionButton onClick={runDeposit} disabled={busy || !wallet.address}>
              {stage === "deposit-signing"    ? "waiting for Freighter…" :
               stage === "deposit-submitting" ? "submitting…" :
               !wallet.address                ? "connect wallet to deposit" :
                                                "deposit →"}
            </ActionButton>
          </section>

          <section className="pt-6 border-t border-line space-y-3">
            <SectionLabel n="02" title="batch-withdraw via aggregated proof" />
            <p className="text-[11px] text-mute leading-relaxed">
              Submits the canonical K=4 aggregated proof to the pool contract.
              The contract verifies the proof (cross-contract call to oneproof_verifier),
              records 4 nullifiers, and dispatches 4 XLM transfers to your address &mdash;
              all in ONE Stellar transaction.
            </p>
            <LabeledInput label="amount per recipient (XLM)" value={withdrawAmount} setValue={setWithdrawAmount} disabled={busy} type="number" />
            <ActionButton onClick={runWithdraw} disabled={busy || !wallet.address}>
              {stage === "withdraw-loading"    ? "fetching proof bytes…" :
               stage === "withdraw-signing"    ? "waiting for Freighter…" :
               stage === "withdraw-submitting" ? "submitting…" :
               !wallet.address                 ? "connect wallet to withdraw" :
                                                 "batch-withdraw 4 transfers →"}
            </ActionButton>
          </section>

          {error && (
            <div className="border border-foil bg-ink-2 p-4 mt-3 font-mono text-[11px] text-foil whitespace-pre-wrap break-all">
              {error}
            </div>
          )}

          {lastTx && (stage === "deposit-done" || stage === "withdraw-done") && (
            <div className="pt-6 border-t border-line space-y-2">
              <div className="text-[11px] uppercase tracking-[0.08em] text-signal">
                ✓ {stage === "deposit-done" ? "deposit settled" : "withdrawal batch settled"}
              </div>
              <a href={txUrl(lastTx)} target="_blank" rel="noopener" className="block text-[11px] text-paper hover:text-signal break-all">
                {lastTx}
              </a>
              <a href={txUrl(lastTx)} target="_blank" rel="noopener" className="inline-flex text-[12px] text-signal hover:text-paper">
                inspect on stellar.expert ↗
              </a>
            </div>
          )}
        </div>

        {/* RIGHT — live pool stats */}
        <div className="bg-ink p-6 md:p-7 font-mono space-y-4">
          <SectionLabel n="·" title="pool · live state" />
          {statsErr && (
            <div className="text-[11px] text-foil break-all">stats: {statsErr}</div>
          )}
          {stats && (
            <div className="space-y-3 text-[12px]">
              <Kv k="total deposited" v={
                <span className="text-paper">
                  {(Number(stats.total) / 10_000_000).toFixed(4)} <span className="text-mute text-[10px]">XLM</span>
                </span>
              } />
              <Kv k="commitments" v={<span className="text-paper">{stats.commitmentCount.toLocaleString()}</span>} />
            </div>
          )}
          <div className="pt-3 border-t border-line space-y-2 text-[11px]">
            <Kv k="contract" v={
              <a href={contractUrl(CONTRACTS.oneproofPool)} target="_blank" rel="noopener" className="text-paper hover:text-signal break-all">
                {CONTRACTS.oneproofPool.slice(0, 12)}…{CONTRACTS.oneproofPool.slice(-6)}
              </a>
            } />
            <Kv k="verifier" v={
              <a href={contractUrl(CONTRACTS.oneproofVerifier)} target="_blank" rel="noopener" className="text-mute hover:text-paper break-all">
                {CONTRACTS.oneproofVerifier.slice(0, 12)}…{CONTRACTS.oneproofVerifier.slice(-6)}
              </a>
            } />
            <Kv k="token" v={
              <span className="text-mute break-all">native XLM</span>
            } />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── presentational ───────────────────────────────────────────────────

function Header() {
  return (
    <div className="space-y-1">
      <div className="font-mono text-[12px] uppercase tracking-[0.08em] text-mute">pool</div>
      <h1 className="font-mono text-paper text-xl">
        privacy pool · <span className="text-signal">deposit + batch-withdraw</span> via aggregated proof
      </h1>
      <p className="text-[12px] text-mute pt-2 max-w-3xl leading-relaxed">
        The pool contract holds testnet XLM. Anyone can deposit (your signer is visible).
        Withdrawals settle in batches via ONE aggregated ZK proof — N transfers in one tx.
      </p>
      <div className="mt-3 max-w-3xl border border-line bg-ink-2 p-3">
        <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-signal mb-2">
          why this had to be on Stellar
        </div>
        <p className="text-[12px] text-paper/85 leading-relaxed">
          On EVM you&apos;d call a verifier contract, then a separate multicall to dispatch
          transfers. Here, Soroban runs the proof verification AND moves the assets in a
          single invocation. That atomicity is the Stellar-native primitive — and it&apos;s
          why the on-chain cost stays at <span className="font-mono text-signal">~136K stroops</span> regardless
          of how many withdrawals are inside.
        </p>
      </div>
    </div>
  );
}

function HonestyBanner() {
  return (
    <div className="border border-line bg-ink-2 p-4 font-mono text-[11px] text-paper/90 leading-relaxed">
      <span className="text-foil">HONEST CAVEAT:</span> the demo&apos;s aggregated proof
      attests the four inner proofs are valid but doesn&apos;t bind <em className="not-italic text-paper">specific
      recipients or amounts</em> into the cryptography. A production version would put
      recipient + amount into the circuit&apos;s public inputs. For this demo, the contract
      verifies the proof and dispatches the transfers you requested — the architecture is
      correct, the binding is the next iteration.
    </div>
  );
}

function WalletBanner() {
  const { address, installed, connect, disconnect, error } = useWallet();
  if (address) {
    return (
      <div className="border border-line bg-ink-2 p-3 font-mono flex items-center justify-between gap-3 text-[12px]">
        <div className="flex items-center gap-3">
          <span aria-hidden className="inline-block w-2 h-2 rounded-full bg-signal" />
          <span className="text-mute uppercase tracking-[0.08em]">wallet</span>
          <a href={`${NETWORK.explorerBase}/account/${address}`} target="_blank" rel="noopener" className="text-paper hover:text-signal">
            {address.slice(0, 8)}…{address.slice(-6)}
          </a>
        </div>
        <button onClick={disconnect} className="text-[11px] uppercase tracking-[0.08em] text-mute hover:text-foil">disconnect</button>
      </div>
    );
  }
  if (!installed) {
    return (
      <div className="border border-line bg-ink-2 p-3 font-mono text-[12px] text-mute">
        Freighter not installed · <a className="text-signal hover:text-paper" href="https://freighter.app/" target="_blank" rel="noopener">install →</a>
      </div>
    );
  }
  return (
    <div className="border border-line bg-ink-2 p-3 font-mono space-y-2">
      <div className="text-[12px] text-mute">wallet ready · connect to deposit + withdraw</div>
      {error && <div className="text-[11px] text-foil break-all">{error}</div>}
      <button onClick={connect} className="bg-signal text-ink px-4 py-2 text-[12px] uppercase tracking-[0.08em] hover:bg-signal/90">
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

function LabeledInput({ label, value, setValue, disabled, type = "text" }: { label: string; value: string; setValue: (s: string) => void; disabled: boolean; type?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-mute uppercase tracking-[0.08em]">{label}</span>
      <input type={type} value={value} onChange={(e) => setValue(e.target.value)} disabled={disabled}
        className="bg-ink-2 border border-line text-paper text-sm px-3 py-2 focus:outline-none focus:border-signal disabled:opacity-50" />
    </label>
  );
}

function ActionButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="inline-flex items-center bg-signal text-ink px-4 py-2 text-[12px] uppercase tracking-[0.08em] hover:bg-signal/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
      {children}
    </button>
  );
}

function Kv({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2 items-baseline text-[12px]">
      <span className="text-mute uppercase tracking-[0.08em]">{k}</span>
      <span className="break-all">{v}</span>
    </div>
  );
}

// ─── Stellar plumbing ─────────────────────────────────────────────────

async function deriveCommitmentBytes(nickname: string, amount: string): Promise<Uint8Array> {
  // The on-chain pool just stores opaque BytesN<32>. We derive it as
  // sha256(nickname || ":" || amount) — purely deterministic so the
  // user could reproduce it. This is NOT pedersen-equivalent to the
  // backend's circuit commitment; for the pool's storage purpose it's
  // just an opaque tag. Real binding would tie this to the circuit's
  // pedersen output.
  const enc = new TextEncoder().encode(`${nickname || "anon"}:${amount}`);
  const digest = await crypto.subtle.digest("SHA-256", enc);
  return new Uint8Array(digest);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StellarSdkMod = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FreighterMod = any;

async function submitDeposit(
  StellarSdk: StellarSdkMod,
  freighter: FreighterMod,
  source: string,
  amountStroops: number,
  commitmentBytes: Uint8Array,
): Promise<string> {
  const server = new StellarSdk.rpc.Server(NETWORK.sorobanRpc);
  const account = await server.getAccount(source);
  const pool = new StellarSdk.Contract(CONTRACTS.oneproofPool);

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK.passphrase,
  })
    .addOperation(pool.call(
      "deposit",
      new StellarSdk.Address(source).toScVal(),
      StellarSdk.nativeToScVal(amountStroops, { type: "i128" }),
      StellarSdk.xdr.ScVal.scvBytes(Buffer.from(commitmentBytes)),
    ))
    .setTimeout(60)
    .build();
  const prepared = await server.prepareTransaction(tx);

  const signed = await freighter.signTransaction(prepared.toXDR(), {
    networkPassphrase: NETWORK.passphrase,
    address: source,
  });
  if (!signed?.signedTxXdr) throw new Error("Freighter returned no signed tx" + (signed?.error ? `: ${signed.error}` : ""));
  const signedTx = StellarSdk.TransactionBuilder.fromXDR(signed.signedTxXdr, NETWORK.passphrase);
  const send = await server.sendTransaction(signedTx);
  if (send.status !== "PENDING") throw new Error(`send failed: ${send.status}`);
  return await waitForTx(server, send.hash);
}

async function submitBatchWithdraw(
  StellarSdk: StellarSdkMod,
  freighter: FreighterMod,
  source: string,
  proofBytes: Uint8Array,
  publicInputsBytes: Uint8Array,
  amountPerStroops: number,
): Promise<string> {
  const server = new StellarSdk.rpc.Server(NETWORK.sorobanRpc);
  const account = await server.getAccount(source);
  const pool = new StellarSdk.Contract(CONTRACTS.oneproofPool);

  // Four nullifiers — synthetic per-session so each demo call uses
  // fresh values (the contract rejects duplicates).
  const seed = Date.now().toString();
  const nullifiers = await Promise.all([0, 1, 2, 3].map(async (i) => {
    const enc = new TextEncoder().encode(`${seed}:${i}`);
    return new Uint8Array(await crypto.subtle.digest("SHA-256", enc));
  }));

  const fourSelf = [0, 1, 2, 3].map(() => new StellarSdk.Address(source).toScVal());
  const fourAmounts = [0, 1, 2, 3].map(() => StellarSdk.nativeToScVal(amountPerStroops, { type: "i128" }));
  const fourNullifiers = nullifiers.map((nf) => StellarSdk.xdr.ScVal.scvBytes(Buffer.from(nf)));

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK.passphrase,
  })
    .addOperation(pool.call(
      "batch_withdraw",
      StellarSdk.xdr.ScVal.scvBytes(Buffer.from(proofBytes)),
      StellarSdk.xdr.ScVal.scvBytes(Buffer.from(publicInputsBytes)),
      StellarSdk.xdr.ScVal.scvVec(fourNullifiers),
      StellarSdk.xdr.ScVal.scvVec(fourSelf),
      StellarSdk.xdr.ScVal.scvVec(fourAmounts),
    ))
    .setTimeout(60)
    .build();
  const prepared = await server.prepareTransaction(tx);

  const signed = await freighter.signTransaction(prepared.toXDR(), {
    networkPassphrase: NETWORK.passphrase,
    address: source,
  });
  if (!signed?.signedTxXdr) throw new Error("Freighter returned no signed tx" + (signed?.error ? `: ${signed.error}` : ""));
  const signedTx = StellarSdk.TransactionBuilder.fromXDR(signed.signedTxXdr, NETWORK.passphrase);
  const send = await server.sendTransaction(signedTx);
  if (send.status !== "PENDING") throw new Error(`send failed: ${send.status}`);
  return await waitForTx(server, send.hash);
}

async function waitForTx(server: any, hash: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2_000));
    const status = await server.getTransaction(hash);
    if (status.status === "SUCCESS") return hash;
    if (status.status === "FAILED") throw new Error(`tx ${hash} failed on-chain`);
  }
  throw new Error(`tx ${hash} did not confirm within 60s`);
}

async function fetchPoolStats(): Promise<PoolStats> {
  // Read-only views via stellar-sdk's contract.simulateTransaction.
  // Lazy-import the SDK to keep it out of the initial bundle.
  const StellarSdk = await import("@stellar/stellar-sdk");
  const server = new StellarSdk.rpc.Server(NETWORK.sorobanRpc);

  // Need a syntactically valid source — random throwaway is fine for sim.
  const source = StellarSdk.Keypair.random().publicKey();
  const account = new StellarSdk.Account(source, "0");
  const pool = new StellarSdk.Contract(CONTRACTS.oneproofPool);

  async function simRead(fnName: string): Promise<unknown> {
    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: NETWORK.passphrase,
    })
      .addOperation(pool.call(fnName))
      .setTimeout(60)
      .build();
    const sim = await server.simulateTransaction(tx);
    if (StellarSdk.rpc.Api.isSimulationError(sim)) {
      throw new Error(`${fnName}: ${sim.error}`);
    }
    return sim.result?.retval ? StellarSdk.scValToNative(sim.result.retval) : null;
  }

  const [total, count] = await Promise.all([
    simRead("total"),
    simRead("commitment_count"),
  ]);
  return {
    total:           typeof total === "bigint" ? total : BigInt(total as string ?? "0"),
    commitmentCount: typeof count === "number" ? count : Number(count ?? 0),
  };
}
