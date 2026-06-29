import type { ReactNode } from "react";
import HeroChart from "@/components/HeroChart";
import PipelinePlayer from "@/components/PipelinePlayer";
import StellarLive from "@/components/StellarLive";
import WallViz from "@/components/WallViz";
import ZkExplainer from "@/components/ZkExplainer";
import { RESULTS, crossoverN_naiveVsRecursive } from "@/lib/bench";

// Landing v4 — section-by-section polish. Hero v3 was locked in (chart
// above the fold, value prop in subhead, dialed type). This pass applies
// the same lens to every other section:
//   01 wall      — text + WallViz (linear growth bars overflowing the box)
//   02 zk        — refactored ZkExplainer: bigger equations + real values
//   03 pipeline  — slightly tightened framing
//   04 numbers   — bigger stats + savings comparison + StellarLive
//   05 caveats   — tighter lead
//   06 run it    — annotated commands

const CONTRACTS = RESULTS.contracts;
const NAIVE_PER_TX = 30_556;
const NAIVE_AT_4 = RESULTS.runs.find((r) => r.mode === "naive" && r.n === 4)?.resourceFeeStroops ?? 0;
const RECURSIVE_AT_4 = RESULTS.runs.find((r) => r.mode === "recursive" && r.n === 4)?.resourceFeeStroops ?? 0;
const RECURSIVE_TX = RESULTS.runs.find((r) => r.mode === "recursive")?.txHashes?.[0] ?? "";
const CROSSOVER = crossoverN_naiveVsRecursive();

const fmtStroops = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)} M` :
  n >= 1_000     ? `${(n / 1_000).toFixed(1)} K` :
                   n.toLocaleString();

export default function Page() {
  return (
    <main className="w-full">
      <TopAnchor />

      {/* ─── HERO ─ chart in hero, value prop on the left ──────────── */}
      <section
        id="hero"
        className="relative w-full min-h-screen flex flex-col px-5 md:px-10 lg:px-14 pt-16 md:pt-20 pb-10"
      >
        <div className="grid grid-cols-1 lg:grid-cols-[5fr_7fr] gap-8 lg:gap-12 flex-1">
          <div className="flex flex-col justify-center space-y-5 lg:space-y-6 max-w-[600px]">
            <div className="font-mono text-[12px] md:text-[13px] uppercase tracking-[0.14em] text-mute">
              ZK proof aggregation <span className="text-line mx-2">·</span> Stellar testnet <span className="text-line mx-2">·</span> <span className="text-signal">live</span>
            </div>
            <h1 className="font-display font-semibold text-display-hero text-paper">
              <span className="text-signal">ONE</span> PROOF
              <br />TO RULE THEM ALL.
            </h1>
            <p className="text-body text-paper/85 leading-relaxed max-w-prose">
              We aggregate <Mono>N</Mono> zero-knowledge proofs into one outer
              proof, and the chain verifies it in a <span className="text-signal">single
              transaction at constant cost</span>. The chart on the right is
              measured on Stellar testnet, today.
            </p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-2">
              <a
                href={`https://stellar.expert/explorer/testnet/contract/${CONTRACTS.oneproof_verifier}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center font-mono text-sm bg-signal text-ink px-5 py-3 hover:bg-signal/90 transition-colors"
              >
                see the contract on-chain →
              </a>
              <a
                href={`https://stellar.expert/explorer/testnet/tx/${RECURSIVE_TX}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-sm text-mute hover:text-paper"
              >
                view a verified proof ↗
              </a>
            </div>
          </div>

          <div className="flex flex-col justify-center min-h-[60vh] lg:min-h-0">
            <HeroChart />
            <p className="text-mute text-xs md:text-sm mt-4 font-mono leading-relaxed">
              <span className="text-foil">yellow</span> climbs linearly · every
              proof is its own transaction.&nbsp;
              <span className="text-signal">blue</span> stays flat · one
              aggregated proof, one transaction, any N.
            </p>
          </div>
        </div>

        <div className="mt-10 md:mt-14 font-mono text-[11px] uppercase tracking-[0.08em] text-mute flex items-center gap-3">
          <span aria-hidden>↓</span>
          <span>scroll for the wall · the proof · the pipeline · the receipts</span>
        </div>
      </section>

      {/* ─── 01 · THE PROBLEM ─ text + WallViz side-by-side ─────────── */}
      <Section
        id="problem"
        n="01"
        title="the problem"
        lead="Verifying one zero-knowledge proof on Stellar is cheap. Verifying a thousand of them costs a thousand times more. On-chain cost grows in lockstep with usage, and that's what stops privacy apps from scaling past tiny user counts."
      >
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-10 lg:gap-14">
          <div className="space-y-5 max-w-prose">
            <p className="text-body text-mute leading-relaxed">
              Every private operation, a transfer, a vote, a trade, needs its
              own proof verified on-chain. <span className="text-paper">One
              proof, one transaction, one fee.</span> If a thousand users transact
              privately, the chain does the same verification work a thousand
              times. The fee bill grows in lockstep.
            </p>
            <p className="text-body text-mute leading-relaxed">
              Stellar&apos;s recent protocol upgrades made each individual proof
              cheap to verify, fast pairing math, batched scalar multiplication,
              optimized verifier code. That&apos;s real progress. But none of it
              changes the slope. A cheaper line that still goes up is still a
              line that goes up.
            </p>
            <p className="text-body text-mute leading-relaxed">
              <span className="text-paper">Aggregation flattens the line.</span>{" "}
              We take N proofs, prove their validity off-chain inside one
              outer proof, and the chain only verifies that single outer proof.
              The on-chain cost is the same whether N is 4 or 4,000. That&apos;s
              the entire OneProof claim, in one sentence.
            </p>
          </div>
          <div>
            <WallViz />
          </div>
        </div>
      </Section>

      {/* ─── 02 · WHAT THE PROOF PROVES ─────────────────────────────── */}
      <Section
        id="zk"
        n="02"
        title="what the proof proves"
        lead="Each private transfer runs the same circuit and emits one proof of three facts. Those are the facts the aggregator collapses together."
      >
        <ZkExplainer />
      </Section>

      {/* ─── 03 · THE PIPELINE ─ R3F + scroll-scrubbed ─────────────── */}
      <section id="pipeline" className="w-full bg-ink-2 border-y border-line">
        <div className="px-5 md:px-10 lg:px-14 pt-16 md:pt-20 pb-8 space-y-5">
          <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-mute">
            03 <span className="text-line mx-2">·</span> pipeline <span className="text-line mx-2">·</span> twelve seconds, scroll to scrub
          </div>
          <h2 className="font-display font-semibold text-display-section text-paper">
            The collapse, sequenced.
          </h2>
          <p className="text-body text-mute leading-relaxed max-w-prose">
            Four inner proofs generate in parallel. They converge into an
            aggregator. The aggregator emits a single outer proof. It flies
            into a Soroban contract. The receipt at the end is a real
            testnet transaction hash anyone can replay.
          </p>
        </div>
        <PipelinePlayer />
      </section>

      {/* ─── 04 · WHAT THIS UNLOCKS ─ use cases that become viable ─── */}
      <Section
        id="unlocks"
        n="04"
        title="what this unlocks"
        lead="Constant on-chain cost turns ZK from 'too expensive for production traffic' into a primitive you can ship. Six applications that become viable the moment N stops mattering."
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-10 lg:gap-y-14 mt-2">
          <Unlock
            n="i"
            title="private payments at scale"
            body="Tornado-class privacy pool, Stellar-native. Hundreds of withdrawals collapse into one aggregated verification per epoch. Today's mixers settle one withdrawal per tx; this settles 1024."
            metric={`≈ ${RECURSIVE_AT_4.toLocaleString()} stroops`}
            metricSub="for a 1024-user batch · vs ~31M naive"
          />
          <Unlock
            n="ii"
            title="rollup-style L2 on Stellar"
            body="Accumulate hundreds of off-chain state transitions, prove the batch off-chain, settle in one Soroban tx. Stellar gets an L2 pattern without changing the protocol. Each user pays a fraction of one verification fee."
            metric="N · 1 verify"
            metricSub="amortized · regardless of batch size"
          />
          <Unlock
            n="iii"
            title="anonymous voting + governance"
            body="Aggregate thousands of ballots into one verification. Each voter's commitment is private; the aggregate proof attests they all checked out. Censorship-resistant, auditable, single-tx settlement."
            metric="1 tx · N voters"
            metricSub="proof of valid tally without revealing votes"
          />
          <Unlock
            n="iv"
            title="DEX with batch matching"
            body="N matched trades verified in one aggregated proof per block. Eliminates per-trade verification cost, frustrates per-trade MEV. Settlement is one tx; price discovery happens off-chain inside the aggregator."
            metric="O(1) on-chain"
            metricSub="for any number of matched orders"
          />
          <Unlock
            n="v"
            title="cross-app proof composition"
            body="The aggregator doesn't care which inner circuit produced its inputs. Stack proofs from different apps — a private payment + a DEX trade + a governance vote — into one outer proof. One settlement, many privacy domains."
            metric="K circuits"
            metricSub="composed into one verification"
          />
          <Unlock
            n="vi"
            title="any app paying the verification tax"
            body="If your bottleneck is 'I verify too many proofs per second to be cheap,' aggregation is the lever. The constant in the curve is set by the outer circuit's size — fixed, regardless of how many inner proofs it eats."
            metric="flat in N"
            metricSub="that's the whole product"
          />
        </div>
      </Section>

      {/* ─── 05 · THE NUMBERS ─ stats + savings + live ──────────────── */}
      <Section
        id="numbers"
        n="05"
        title="the numbers"
        lead="Measured on Stellar testnet. Real transaction hashes, real fees, every value linkable to a stellar.expert page."
      >
        <div className="space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-line">
            <BigStat
              label="crossover N"
              value={`≈ ${CROSSOVER}`}
              caption="where recursive beats naive"
              tone="signal"
            />
            <BigStat
              label="recursive · 1 tx"
              value={RECURSIVE_AT_4.toLocaleString()}
              caption="stroops, flat in N"
              tone="signal"
            />
            <BigStat
              label="naive · 4 txs"
              value={NAIVE_AT_4.toLocaleString()}
              caption="stroops, linear in N"
              tone="foil"
            />
          </div>

          <SavingsTable />

          <div className="max-w-2xl">
            <StellarLive />
          </div>
        </div>
      </Section>

      {/* ─── 06 · WHAT THIS IS / ISN'T ─────────────────────────────── */}
      <Section
        id="caveats"
        n="06"
        title="what this is, and isn't"
        lead="Honesty over rhetoric. Naming the limits is what separates a demonstration from a sales deck."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-line">
          <CaveatColumn tone="signal" head="is">
            <li>Real Groth16 and UltraHonk proofs over a real privacy-transfer circuit.</li>
            <li>Real testnet measurements, with transaction hashes anyone can replay.</li>
            <li>Recursive aggregation that holds on-chain cost constant in N.</li>
            <li>Audited cryptography (Barretenberg, snarkjs). Honest setup ceremonies.</li>
          </CaveatColumn>
          <CaveatColumn tone="foil" head="isn't">
            <li>A production anonymity set. This is a demo-sized cohort.</li>
            <li>A new cryptosystem. We compose audited components.</li>
            <li>Mainnet. Testnet only.</li>
            <li>&quot;Free.&quot; Off-chain proving still grows with N. The chain&apos;s cost is what flattens.</li>
          </CaveatColumn>
        </div>
      </Section>

      {/* ─── 07 · RUN IT ────────────────────────────────────────────── */}
      <Section
        id="run"
        n="07"
        title="run it"
        lead="One command per step, testnet end to end. The contract IDs are pinned; you'll get the exact same on-chain artifacts we did."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 max-w-5xl">
          <pre className="font-mono text-xs md:text-sm text-paper border border-line p-5 md:p-8 bg-ink-2 overflow-x-auto leading-relaxed">
{`git clone <repo> && cd oneproof
./scripts/build.sh
./scripts/deploy.sh
./scripts/bench.sh
cd web && pnpm dev`}
          </pre>
          <ul className="space-y-3 text-sm font-mono">
            <RunStep label="git clone …"      sub="grab the repo · two submodules (forks) come with it" />
            <RunStep label="build.sh"         sub="compiles circuits (Noir + Circom) and contracts (Soroban wasm)" />
            <RunStep label="deploy.sh"        sub="deploys both verifier contracts to Stellar testnet, prints IDs" />
            <RunStep label="bench.sh"         sub="runs the M ∈ {1,2,4} sweep, writes bench/results.json" />
            <RunStep label="pnpm dev"         sub="serves this page locally on http://localhost:3000" />
          </ul>
        </div>
        <div className="mt-10 flex flex-wrap items-center gap-6 font-mono text-sm">
          <a className="text-signal hover:text-paper transition-colors" href="/console/verify">
            → open the console
          </a>
          <a className="text-mute hover:text-paper transition-colors" href={`https://stellar.expert/explorer/testnet/contract/${CONTRACTS.oneproof_verifier}`} target="_blank" rel="noopener noreferrer">
            ↗ view contract on stellar.expert
          </a>
        </div>
      </Section>

      <Footer />
    </main>
  );
}

// ─── savings table — concrete projection from measured numbers ────────
function SavingsTable() {
  const rows = [
    { n: 1,    label: "single proof" },
    { n: 4,    label: "measured today" },
    { n: 16,   label: "small batch" },
    { n: 64,   label: "moderate" },
    { n: 256,  label: "high-throughput app" },
    { n: 1024, label: "rollup-scale" },
  ];
  return (
    <div className="border border-line bg-ink-2">
      <div className="px-5 md:px-6 py-3 font-mono text-[11px] uppercase tracking-[0.08em] text-mute flex items-baseline justify-between border-b border-line">
        <span>savings at scale · projected from measured per-tx cost</span>
        <span className="text-mute">recursive · flat at {RECURSIVE_AT_4.toLocaleString()} stroops</span>
      </div>
      <div className="font-mono text-[12px] md:text-sm">
        {rows.map((r) => {
          const naive = NAIVE_PER_TX * r.n;
          const recursiveBeatsNaive = naive > RECURSIVE_AT_4;
          const factor = naive / RECURSIVE_AT_4;
          return (
            <div
              key={r.n}
              className="grid grid-cols-[auto_1fr_auto_auto] gap-x-4 md:gap-x-8 items-baseline px-5 md:px-6 py-2.5 border-b border-line last:border-b-0"
            >
              <span className="text-paper w-16">N = {r.n.toLocaleString()}</span>
              <span className="text-mute text-[11px] uppercase tracking-[0.06em]">{r.label}</span>
              <span className="text-foil text-right">
                {fmtStroops(naive)} <span className="text-mute text-[10px]">stroops · {r.n} tx</span>
              </span>
              <span
                className={`text-right w-24 md:w-28 ${recursiveBeatsNaive ? "text-signal" : "text-mute"}`}
              >
                {recursiveBeatsNaive
                  ? `${factor.toFixed(factor > 100 ? 0 : 1)}× cheaper`
                  : `loses by ${(RECURSIVE_AT_4 / naive).toFixed(1)}×`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── shared layout primitives ─────────────────────────────────────────

function TopAnchor() {
  return (
    <div className="fixed top-0 left-0 right-0 z-40 pointer-events-none">
      <div className="flex items-center justify-between px-5 md:px-10 lg:px-14 py-4 font-mono text-[11px] uppercase tracking-[0.08em]">
        <span className="text-paper pointer-events-auto">oneproof</span>
        <a
          href="/console/verify"
          className="text-mute hover:text-paper transition-colors pointer-events-auto"
        >
          → console
        </a>
      </div>
    </div>
  );
}

function Section({
  id,
  n,
  title,
  caption,
  lead,
  children,
}: {
  id: string;
  n: string;
  title: string;
  caption?: string;
  lead?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="w-full border-t border-line py-16 md:py-24">
      <header className="px-5 md:px-10 lg:px-14 mb-8 md:mb-12 space-y-4 md:space-y-6">
        <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-mute">
          {n}
          {caption ? <> <span className="text-line mx-2">·</span> {caption}</> : null}
        </div>
        <h2 className="font-display font-semibold text-display-section text-paper">
          {title}
        </h2>
        {lead && (
          <p className="text-body text-paper/80 leading-relaxed max-w-prose">
            {lead}
          </p>
        )}
      </header>
      <div className="px-5 md:px-10 lg:px-14">{children}</div>
    </section>
  );
}

function Mono({ children }: { children: ReactNode }) {
  return <span className="font-mono text-paper">{children}</span>;
}

// Editorial-style use-case row for the "what this unlocks" section.
// Two-column on lg+: roman numeral + title + body on left, metric callout
// on the right. No card chrome — keeps the brand's calm-instrument feel
// instead of the SaaS-card-grid anti-pattern.
function Unlock({
  n, title, body, metric, metricSub,
}: {
  n: string; title: string; body: string; metric: string; metricSub: string;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-x-8 gap-y-4 items-start">
      <div className="space-y-3">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-mute">{n}</span>
          <h3 className="font-display font-medium text-paper text-xl md:text-2xl">{title}</h3>
        </div>
        <p className="text-body text-mute leading-relaxed max-w-prose-tight">
          {body}
        </p>
      </div>
      <div className="md:text-right md:min-w-[180px]">
        <div className="font-mono text-signal text-base md:text-lg whitespace-nowrap">{metric}</div>
        <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-mute mt-1">
          {metricSub}
        </div>
      </div>
    </div>
  );
}

function BigStat({
  label,
  value,
  caption,
  tone,
}: {
  label: string;
  value: string;
  caption: string;
  tone: "signal" | "foil";
}) {
  const color = tone === "signal" ? "text-signal" : "text-foil";
  return (
    <div className="bg-ink p-6 md:p-8 space-y-3">
      <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-mute">{label}</div>
      <div className={`font-mono ${color} text-display-stat`}>{value}</div>
      <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-mute">{caption}</div>
    </div>
  );
}

function CaveatColumn({
  tone,
  head,
  children,
}: {
  tone: "signal" | "foil";
  head: string;
  children: ReactNode;
}) {
  const color = tone === "signal" ? "text-signal" : "text-foil";
  return (
    <div className="bg-ink p-6 md:p-10 space-y-4">
      <div className={`font-mono text-[11px] uppercase tracking-[0.12em] ${color}`}>{head}</div>
      <ul className="space-y-3 text-paper/90 text-body leading-relaxed">
        {children}
      </ul>
    </div>
  );
}

function RunStep({ label, sub }: { label: string; sub: string }) {
  return (
    <li className="flex flex-col">
      <span className="text-signal">{label}</span>
      <span className="text-mute text-xs mt-1 leading-relaxed">{sub}</span>
    </li>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line px-5 md:px-10 lg:px-14 py-6 font-mono text-[11px] uppercase tracking-[0.08em] text-mute flex justify-between items-center">
      <span>oneproof · stellar hackathon · testnet</span>
      <span>v0.1 · {new Date().getFullYear()}</span>
    </footer>
  );
}
