import type { ReactNode } from "react";
import HeroChart from "@/components/HeroChart";
import PipelinePlayer from "@/components/PipelinePlayer";
import StellarLive from "@/components/StellarLive";
import ZkExplainer from "@/components/ZkExplainer";
import { RESULTS, crossoverN_naiveVsRecursive } from "@/lib/bench";

// Landing v3 — judge-eye polish. The cost chart is the actual thesis;
// it now lives in the hero so a first-time visitor sees the curve above
// the fold instead of having to scroll to section 02. The decorative
// orbiting-hexes 3D scene is removed from the hero (it still lives in
// the Remotion pipeline section below, where it earns its keep by
// telling a sequenced story).
//
// Palette stays V2 (black + blue + yellow). Type scale dialed back so
// a 1920px monitor doesn't get 350px-tall letters.

const CONTRACTS = RESULTS.contracts;
const NAIVE_AT_4 = RESULTS.runs.find((r) => r.mode === "naive" && r.n === 4)?.resourceFeeStroops ?? 0;
const RECURSIVE_AT_4 = RESULTS.runs.find((r) => r.mode === "recursive" && r.n === 4)?.resourceFeeStroops ?? 0;
const RECURSIVE_TX = RESULTS.runs.find((r) => r.mode === "recursive")?.txHashes?.[0] ?? "";
const CROSSOVER = crossoverN_naiveVsRecursive();

export default function Page() {
  return (
    <main className="w-full">
      <TopAnchor />

      {/* ─── HERO ─ value prop + chart side-by-side on desktop ─────────── */}
      <section
        id="hero"
        className="relative w-full min-h-screen flex flex-col px-5 md:px-10 lg:px-14 pt-20 md:pt-24 pb-12"
      >
        <div className="grid grid-cols-1 lg:grid-cols-[5fr_7fr] gap-10 lg:gap-14 flex-1">
          {/* LEFT — value prop */}
          <div className="flex flex-col justify-center space-y-6 lg:space-y-8 max-w-[680px]">
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

          {/* RIGHT — the chart, the actual demo */}
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

      {/* ─── 01 · THE WALL ─────────────────────────────────────────────── */}
      <Section id="wall" n="01" title="the wall">
        <Prose>
          Verifying N proofs costs roughly N verifications. That linear wall is
          why private apps stall on-chain at single-digit throughput. Stellar
          Protocol 25 and 26 shipped the primitives that make individual proofs
          cheap (BN254 host functions, MSM). The wall stays linear without
          aggregation.
        </Prose>
      </Section>

      {/* ─── 02 · WHAT THE PROOF PROVES ─ moved up; judges need this early ─── */}
      <Section id="zk" n="02" title="what the proof proves">
        <ZkExplainer />
      </Section>

      {/* ─── 03 · THE PIPELINE ─ full-bleed, R3F + scroll-scrubbed ─────── */}
      <section id="pipeline" className="w-full bg-ink-2 border-y border-line">
        <div className="px-5 md:px-10 lg:px-14 pt-16 md:pt-20 pb-8 space-y-4">
          <Eyebrow>03 · pipeline</Eyebrow>
          <h2 className="font-display font-semibold text-display-section text-paper">
            The collapse, scrubbed in scroll.
          </h2>
          <Prose>
            Five scenes, twelve seconds. Inner proofs generate in parallel,
            converge into an aggregator, emit a single outer proof, fly into
            a Soroban contract. The receipt at the end is a real testnet
            transaction hash anyone can replay.
          </Prose>
        </div>
        <PipelinePlayer />
      </section>

      {/* ─── 04 · THE NUMBERS ─ huge mono readouts + live counter ───── */}
      <Section id="numbers" n="04" title="the numbers" caption="measured · stellar testnet">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-line mt-2">
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
        <div className="mt-10 max-w-2xl">
          <StellarLive />
        </div>
      </Section>

      {/* ─── 05 · WHAT THIS IS / ISN'T ─────────────────────────────── */}
      <Section id="caveats" n="05" title="what this is, and isn't" caption="honesty over rhetoric">
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

      {/* ─── 06 · RUN IT ───────────────────────────────────────────── */}
      <Section id="run" n="06" title="run it" caption="one command · testnet · open source">
        <pre className="font-mono text-xs md:text-sm text-paper border border-line p-5 md:p-8 bg-ink-2 overflow-x-auto leading-relaxed max-w-3xl">
{`git clone <repo> && cd oneproof
./scripts/build.sh        # circuits + contracts
./scripts/deploy.sh       # testnet
./scripts/bench.sh        # bench/results.json
cd web && pnpm dev        # this page, locally`}
        </pre>
        <div className="mt-8 flex flex-wrap items-center gap-6 font-mono text-sm">
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
  children,
}: {
  id: string;
  n: string;
  title: string;
  caption?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="w-full border-t border-line py-16 md:py-24"
    >
      <header className="px-5 md:px-10 lg:px-14 mb-8 md:mb-12 space-y-3 md:space-y-5">
        <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-mute">
          {n}{caption ? <> <span className="text-line mx-2">·</span> {caption}</> : null}
        </div>
        <h2 className="font-display font-semibold text-display-section text-paper">
          {title}
        </h2>
      </header>
      <div className="px-5 md:px-10 lg:px-14">{children}</div>
    </section>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-mute">
      {children}
    </div>
  );
}

function Prose({ children }: { children: ReactNode }) {
  return (
    <p className="text-body text-mute max-w-prose leading-relaxed">
      {children}
    </p>
  );
}

function Mono({ children }: { children: ReactNode }) {
  return <span className="font-mono text-paper">{children}</span>;
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

function Footer() {
  return (
    <footer className="border-t border-line px-5 md:px-10 lg:px-14 py-6 font-mono text-[11px] uppercase tracking-[0.08em] text-mute flex justify-between items-center">
      <span>oneproof · stellar hackathon · testnet</span>
      <span>v0.1 · {new Date().getFullYear()}</span>
    </footer>
  );
}
