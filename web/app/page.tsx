import HeroChart from "@/components/HeroChart";
import HeroScene from "@/components/HeroScene";
import PipelinePlayer from "@/components/PipelinePlayer";
import StellarLive from "@/components/StellarLive";
import ZkExplainer from "@/components/ZkExplainer";
import { RESULTS, crossoverN_naiveVsRecursive } from "@/lib/bench";

const CONTRACTS = RESULTS.contracts;
const NAIVE_AT_4 = RESULTS.runs.find((r) => r.mode === "naive" && r.n === 4)?.resourceFeeStroops ?? 0;
const RECURSIVE_AT_4 = RESULTS.runs.find((r) => r.mode === "recursive" && r.n === 4)?.resourceFeeStroops ?? 0;
const RECURSIVE_TX = RESULTS.runs.find((r) => r.mode === "recursive")?.txHashes?.[0] ?? "";
const CROSSOVER = crossoverN_naiveVsRecursive();

export default function Page() {
  return (
    <main>
      <div className="max-w-3xl mx-auto px-5 md:px-8 py-10 md:py-16 space-y-24">
        {/* ─── Nav ──────────────────────────────────────────────────── */}
        <nav className="flex items-center justify-between">
          <div className="font-mono text-paper text-base tracking-wide">
            oneproof <span className="text-mute">·</span>
          </div>
          <div className="font-mono text-xs text-mute space-x-4">
            <a className="hover:text-paper" href={`https://stellar.expert/explorer/testnet/contract/${CONTRACTS.oneproof_verifier}`}>contract ↗</a>
          </div>
        </nav>

        {/* ─── Hero ─────────────────────────────────────────────────── */}
        <section className="space-y-6">
          <h1 className="font-display font-semibold text-display-hero text-paper leading-none">
            <span className="text-signal">ONE</span> PROOF
            <br />TO RULE THEM ALL.
          </h1>
          <p className="text-body text-mute max-w-xl leading-relaxed">
            Each private transfer makes a zero-knowledge proof. We collapse N proofs into
            one the chain verifies once. Constant-cost ZK on Stellar.
          </p>
          {/* R3F: 16 small hex prisms collapse into one. 6s auto-loop. */}
          <HeroScene />
          <div className="flex items-center gap-6 pt-1">
            <a
              href={`https://stellar.expert/explorer/testnet/contract/${CONTRACTS.oneproof_verifier}`}
              className="inline-flex items-center font-mono text-sm bg-signal text-ink px-4 py-2.5 hover:bg-signal/90 transition-colors"
            >
              see the contract on-chain →
            </a>
            <a
              href={`https://stellar.expert/explorer/testnet/tx/${RECURSIVE_TX}`}
              className="font-mono text-sm text-mute hover:text-paper"
            >
              view a verified proof ↗
            </a>
          </div>
        </section>

        {/* ─── The wall (problem) ──────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="font-display font-semibold text-display-section text-paper">The wall.</h2>
          <p className="text-body text-mute max-w-2xl">
            Verifying N proofs costs roughly N verifications. That linear wall is why
            private apps stall on-chain at single-digit throughput. Stellar Protocol 25
            and 26 shipped the primitives that make individual proofs cheap (BN254 host
            functions, MSM). The wall stays linear without aggregation.
          </p>
        </section>

        {/* ─── The cost curve (chart in its own section) ───────────── */}
        <section className="space-y-4">
          <h2 className="font-display font-semibold text-display-section text-paper">
            The cost curve.
          </h2>
          <p className="text-body text-mute max-w-2xl">
            Drag the slider. The naive line climbs linearly; the recursive line refuses
            to move.
          </p>
          <HeroChart />
          <p className="text-mute text-sm leading-relaxed italic max-w-xl">
            The chain does not care how many proofs are inside.
          </p>
        </section>

        {/* ─── What the ZK proof actually proves ──────────────────── */}
        <ZkExplainer />

        {/* ─── How it works (flow diagram, not a card grid) ───────── */}
        <section className="space-y-8">
          <div className="flex items-baseline gap-6 flex-wrap">
            <h2 className="font-display font-semibold text-display-section text-paper">
              How it works.
            </h2>
            <span className="label text-mute">prove → collapse → verify</span>
          </div>
          <FlowDiagram />
        </section>
      </div>

      {/* ─── The pipeline (scroll-scrubbed Remotion, full-bleed) ───── */}
      <section className="bg-ink-2 border-y border-line">
        <div className="max-w-3xl mx-auto px-5 md:px-8 pt-16 pb-8 space-y-3">
          <h2 className="font-display font-semibold text-display-section text-paper">
            The pipeline.
          </h2>
          <p className="text-body text-mute max-w-2xl">
            Scroll to scrub the timeline. Five scenes, twelve seconds. What you see
            ends in a real testnet transaction hash anyone can replay.
          </p>
        </div>
        <PipelinePlayer />
      </section>

      <div className="max-w-3xl mx-auto px-5 md:px-8 py-16 md:py-24 space-y-24">
        {/* ─── The numbers + live ─────────────────────────────────── */}
        <section className="space-y-6">
          <h2 className="font-display font-semibold text-display-section text-paper">
            The numbers.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono">
            <Stat label="crossover (N) where recursive beats naive" value={`N ≈ ${CROSSOVER}`} accent="signal" />
            <Stat label="cost @ N = 4 (recursive · 1 tx)" value={`${RECURSIVE_AT_4.toLocaleString()} stroops`} />
            <Stat label="cost @ N = 4 (naive · 4 txs)" value={`${NAIVE_AT_4.toLocaleString()} stroops`} accent="foil" />
          </div>
          <StellarLive />
          <p className="text-mute text-xs font-mono">
            committed measurements: Stellar testnet · {RESULTS.generatedAt}
          </p>
        </section>

        {/* ─── What this is / isn't ───────────────────────────────── */}
        <section className="space-y-6">
          <h2 className="font-display font-semibold text-display-section text-paper">
            What this is, and isn&apos;t.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-sm">
            <div className="border border-line p-5">
              <div className="label text-signal mb-3">is</div>
              <ul className="space-y-2 text-paper/90">
                <li>Real Groth16 and UltraHonk proofs over a real privacy-transfer circuit.</li>
                <li>Real testnet measurements, including transaction hashes anyone can replay.</li>
                <li>Recursive aggregation that holds on-chain cost constant in N.</li>
                <li>Audited cryptography (Barretenberg, snarkjs). Honest setup ceremonies.</li>
              </ul>
            </div>
            <div className="border border-line p-5">
              <div className="label text-foil mb-3">isn&apos;t</div>
              <ul className="space-y-2 text-paper/90">
                <li>A production anonymity set. This is a demo-sized cohort.</li>
                <li>A new cryptosystem. We compose audited components.</li>
                <li>Mainnet. Testnet only.</li>
                <li>&quot;Free&quot;: off-chain proving still grows with N. The chain&apos;s cost is what flattens.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ─── Run it ─────────────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="font-display font-semibold text-display-section text-paper">Run it.</h2>
          <p className="text-mute text-body">One command, testnet, open source.</p>
          <pre className="font-mono text-xs text-paper border border-line p-4 bg-ink-2 overflow-x-auto">
{`git clone <repo> && cd oneproof
./scripts/build.sh        # build circuits + contracts
./scripts/deploy.sh       # deploy to testnet
./scripts/bench.sh        # measure, write bench/results.json
cd web && pnpm dev        # see this page locally`}
          </pre>
        </section>

        {/* ─── Footer ──────────────────────────────────────────────── */}
        <footer className="border-t border-line pt-6 font-mono text-xs text-mute flex justify-between">
          <span>oneproof · stellar hacks: real-world zk · testnet</span>
          <span>v0.1 · {new Date().getFullYear()}</span>
        </footer>
      </div>
    </main>
  );
}

// Replaces the 3-identical-card pattern with a connected flow diagram.
// No cards, no repeated rectangular shape; just numbered stops with
// arrows that visually carry from one verb to the next. Stacks vertically
// on narrow screens.
function FlowDiagram() {
  const stages = [
    { n: "01", verb: "prove",     body: "Each private transfer is one inner Noir proof. Off-chain, parallel, cheap to scale." },
    { n: "02", verb: "collapse",  body: "An aggregator circuit verifies K inner proofs and emits one outer proof. Tree-compose for any N." },
    { n: "03", verb: "verify",    body: "One Soroban call verifies the single outer proof on BN254 host functions from Protocol 25 and 26." },
  ];
  return (
    <div className="flex flex-col md:grid md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-start gap-6 md:gap-8">
      {stages.map((s, i) => (
        <div key={s.n} className="contents">
          <div className="space-y-2">
            <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-mute">{s.n}</div>
            <div className="font-display font-medium text-paper text-2xl">{s.verb}</div>
            <p className="text-mute text-sm leading-relaxed">{s.body}</p>
          </div>
          {i < stages.length - 1 && (
            <div className="font-mono text-mute text-2xl md:text-3xl md:pt-6 select-none" aria-hidden>
              <span className="block md:hidden">↓</span>
              <span className="hidden md:block">→</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: "signal" | "foil" }) {
  const color = accent === "signal" ? "text-signal" : accent === "foil" ? "text-foil" : "text-paper";
  return (
    <div className="border border-line p-4">
      <div className="label text-mute">{label}</div>
      <div className={`${color} text-xl mt-2`}>{value}</div>
    </div>
  );
}
