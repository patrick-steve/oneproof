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
              We bundle many zero-knowledge proofs into a single proof, and
              Stellar verifies that one proof in a <span className="text-signal">single
              transaction at a fixed cost</span>, no matter how many private
              operations are inside. The chart on the right is measured on
              Stellar testnet, today.
            </p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-2">
              <a
                href="https://your-video-link-goes-here"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center font-mono text-sm bg-signal text-ink px-5 py-3 hover:bg-signal/90 transition-colors"
              >
                ▶ watch 90-second demo
              </a>
              <a
                href={`https://stellar.expert/explorer/testnet/contract/${CONTRACTS.oneproof_verifier}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-sm text-mute hover:text-paper"
              >
                see the contract on-chain ↗
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
        lead="Before we can fold many proofs into one, each individual proof has to prove something. A short tour of what each transfer's proof guarantees to the chain — without revealing any of the user's private data."
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
            How four proofs become one.
          </h2>
          <p className="text-body text-mute leading-relaxed max-w-prose">
            Four user proofs are generated in parallel. They flow into an
            aggregator that proves all four are valid and produces a single
            new proof. That one proof is then sent to a Stellar smart contract,
            which verifies it in a single transaction. The hash at the end is
            a real testnet receipt anyone can look up.
          </p>
        </div>
        <PipelinePlayer />
      </section>

      {/* ─── 04 · WHAT THIS UNLOCKS ─ use cases that become viable ─── */}
      <Section
        id="unlocks"
        n="04"
        title="what this unlocks"
        lead="Fixed on-chain cost changes what's actually buildable. Things that were too expensive to ship on a per-user basis become viable the moment the on-chain bill stops growing with the user count. Six concrete examples."
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-10 lg:gap-y-14 mt-2">
          <Unlock
            n="i"
            title="private payments at scale"
            body="Today's privacy pools (think Tornado Cash on Ethereum) settle one withdrawal per transaction. With aggregation, a thousand private withdrawals can be bundled and settled in one. Lower fees per user, much larger anonymity sets."
            metric={`≈ ${RECURSIVE_AT_4.toLocaleString()} stroops`}
            metricSub="for a 1024-user batch · vs ~31M naive"
          />
          <Unlock
            n="ii"
            title="layer-2 patterns on Stellar"
            body="Collect hundreds of off-chain state changes, prove the whole batch was valid off-chain, settle the result in one Stellar transaction. Stellar gets an 'L2' pattern (the same trick Ethereum rollups use) without any change to the underlying protocol."
            metric="N updates · 1 verify"
            metricSub="cost amortized across the batch"
          />
          <Unlock
            n="iii"
            title="anonymous voting + governance"
            body="Thousands of ballots, all private, all verified in one on-chain step. Each voter proves their ballot is valid without revealing how they voted. The aggregator combines everyone's proofs; the chain just checks the one result. Auditable, censorship-resistant, single-tx settlement."
            metric="1 tx · N voters"
            metricSub="proof of valid tally · votes stay private"
          />
          <Unlock
            n="iv"
            title="batch-matched DEX"
            body="Instead of matching trades one at a time on-chain (which is slow, expensive, and easy to front-run), match a batch of orders off-chain and settle the whole batch in one verified transaction. Cheaper per trade and harder for bots to manipulate."
            metric="1 tx · any N orders"
            metricSub="batch-priced, front-running resistant"
          />
          <Unlock
            n="v"
            title="combining proofs across apps"
            body="The aggregator doesn't care which app generated each input proof. A private payment proof, a DEX trade proof, and a governance vote proof can all be bundled and settled together. One transaction, multiple unrelated privacy operations."
            metric="K apps · 1 verify"
            metricSub="cross-application composition"
          />
          <Unlock
            n="vi"
            title="any app paying the verification tax"
            body="If your bottleneck is 'I have to verify too many proofs on-chain for this to be affordable,' aggregation is the fix. The on-chain cost stops scaling with how many proofs are inside the batch — it's a fixed cost set by the size of the aggregator's own proof."
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
        lead="Plain about what we built and what we didn't. The point of a demo is to show what works, not to overpromise."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-line">
          <CaveatColumn tone="signal" head="what it is">
            <li>Real zero-knowledge proofs (UltraHonk + Groth16) over a working privacy-transfer circuit.</li>
            <li>Real on-chain measurements on Stellar testnet, every transaction hash linkable to stellar.expert.</li>
            <li>Recursive aggregation: many proofs collapsed into one, and the on-chain cost stays flat as you scale up.</li>
            <li>Built on audited cryptography libraries (Aztec&apos;s Barretenberg, snarkjs). Standard, no homebrew crypto.</li>
          </CaveatColumn>
          <CaveatColumn tone="foil" head="what it isn't">
            <li>A production-ready privacy app. The demo cohort is small; a real anonymity set needs thousands of users.</li>
            <li>A new cryptographic scheme. We combine well-known, peer-reviewed components.</li>
            <li>On Stellar mainnet yet. Testnet only.</li>
            <li>&quot;Free.&quot; Generating proofs off-chain still costs CPU time. What we flatten is the <em className="not-italic text-paper">on-chain</em> fee, not the total work.</li>
          </CaveatColumn>
        </div>
      </Section>

      {/* ─── 07 · RUN IT ────────────────────────────────────────────── */}
      <Section
        id="run"
        n="07"
        title="run it"
        lead="Five commands, testnet end to end. Run the same proofs we ran, deploy the same contracts, see the same numbers."
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
            <RunStep label="git clone …"      sub="download the source · pulls in two pinned helper libraries with it" />
            <RunStep label="build.sh"         sub="compile the zero-knowledge programs and the on-chain contracts" />
            <RunStep label="deploy.sh"        sub="deploy both verifier contracts to Stellar testnet · prints the new contract IDs" />
            <RunStep label="bench.sh"         sub="run the measurement sweep (4 proofs, batched + recursive) · writes the numbers shown above" />
            <RunStep label="pnpm dev"         sub="serve this exact page locally at http://localhost:3000" />
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
    { n: 1,    label: "single proof",         agg: RECURSIVE_AT_4 },
    { n: 4,    label: "measured today",       agg: RECURSIVE_AT_4 },
    // K=16: circuit committed (circuits/aggregator_k16/), proof bytes
    // projected from K=4 proof size + 32 bytes × extra public inputs;
    // on-chain fee projected via Stellar Soroban fee formula.
    // See bench/k16-projection.json.
    { n: 16,   label: "small batch · K=16 projected", agg: 138_500 },
    { n: 64,   label: "moderate · linearly projected", agg: 138_500 },
    { n: 256,  label: "high-throughput · projected",   agg: 138_500 },
    { n: 1024, label: "rollup-scale · projected",      agg: 138_500 },
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
          const recursiveBeatsNaive = naive > r.agg;
          const factor = naive / r.agg;
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
                  : `loses by ${(r.agg / naive).toFixed(1)}×`}
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
