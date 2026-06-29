// "What the proof actually proves." Three facts about the inner circuit,
// each with a callout equation in JetBrains Mono at a real readable
// size, and sample computed values pulled from the actual
// circuits/inner_transfer/Prover.toml on the right.
//
// Avoids the "identical card grid" trap by giving each fact its own
// rhythm: the equation gets visual weight (large mono), the body
// explains in human terms, the example values panel ties it to a real
// proof we ran.

import { COLORS } from "@/lib/colors";

export default function ZkExplainer() {
  return (
    <div className="space-y-12 md:space-y-16">
      <Prose>
        Each private transfer runs the same small circuit. The circuit
        proves three things about the user&apos;s secret data, without
        revealing any of it. Those three facts are what the aggregator
        eats by the dozen.
      </Prose>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-px bg-line">
        {/* LEFT: the three facts, stacked, each with its equation prominent */}
        <div className="bg-ink p-6 md:p-10 space-y-10">
          <Fact
            n="i"
            title="a commitment"
            equation="c = Poseidon(secret, amount, blinding)"
          >
            Every transfer hides amount and recipient inside a one-way
            commitment <code className="font-mono text-paper">c</code>.
            Only the user knows the inputs; everyone else sees the
            commitment. The commitment goes into a public Merkle tree.
          </Fact>

          <Fact
            n="ii"
            title="a membership proof"
            equation="prove c ∈ tree(root) ∧ knowledge of inputs"
          >
            When the user spends, the proof attests that their commitment
            lives somewhere under the published Merkle root, without
            revealing WHICH leaf. Anyone can verify it; nobody can
            de-anonymize.
          </Fact>

          <Fact
            n="iii"
            title="a nullifier"
            equation="nf = Poseidon(secret, leafIndex)"
          >
            The user also reveals a deterministic nullifier so they
            can&apos;t spend the same commitment twice. The nullifier
            doesn&apos;t link back to the commitment; it just stops
            double-spends.
          </Fact>
        </div>

        {/* RIGHT: real values from the demo proof we ran */}
        <div className="bg-ink p-6 md:p-10 space-y-6">
          <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-mute">
            example values · from our demo proof
          </div>
          <div className="space-y-5 font-mono text-[11px]">
            <KvBlock k="secret"   v="7"      sub="private — the user's seed" />
            <KvBlock k="amount"   v="1000"   sub="private" />
            <KvBlock k="blinding" v="42"     sub="private — random pad" />
            <KvBlock
              k="c"
              v={`0x1cdce02c…22cbf`}
              sub="commitment · pedersen hash of the three above"
            />
            <KvBlock
              k="root"
              v={`0x1cdce02c…22cbf`}
              sub="merkle root · what the chain stores"
              long
            />
            <KvBlock
              k="nf"
              v={`0x1e95b928…29d3`}
              sub="nullifier · public, deterministic"
            />
          </div>
          <div className="pt-4 border-t border-line text-[11px] text-mute leading-relaxed">
            Public inputs (visible to the verifier) are{" "}
            <span style={{ color: COLORS.signal }}>root</span> and{" "}
            <span style={{ color: COLORS.signal }}>nf</span>. The verifier
            never sees secret/amount/blinding.
          </div>
        </div>
      </div>

      <div className="space-y-3 max-w-prose">
        <h3 className="font-display font-medium text-paper text-2xl md:text-3xl">
          Where the aggregator fits in.
        </h3>
        <p className="text-body text-mute leading-relaxed">
          Each transfer makes one such proof. Without aggregation, the
          chain would verify each one separately. The aggregator is a
          ZK proof <em className="text-paper not-italic">about other ZK proofs</em>:
          it attests that K inner proofs all check out, and produces a
          single outer proof that the chain verifies in one transaction.
          Stack aggregators in a tree and you can collapse thousands of
          inner proofs into one outer verification.
        </p>
      </div>
    </div>
  );
}

function Fact({
  n,
  title,
  equation,
  children,
}: {
  n: string;
  title: string;
  equation: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-mute">
          {n}
        </span>
        <h3 className="font-display font-medium text-paper text-xl md:text-2xl">
          {title}
        </h3>
      </div>
      <div className="font-mono text-sm md:text-base text-signal py-2 border-l-0 break-words">
        <span aria-hidden className="text-mute mr-3">→</span>
        {equation}
      </div>
      <p className="text-mute text-body leading-relaxed">{children}</p>
    </div>
  );
}

function KvBlock({
  k,
  v,
  sub,
  long,
}: {
  k: string;
  v: string;
  sub: string;
  long?: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-mute uppercase tracking-[0.08em]">{k}</span>
        <span className={`text-paper ${long ? "text-[10px]" : ""} break-all text-right`}>{v}</span>
      </div>
      <div className="text-[10px] text-mute uppercase tracking-[0.06em]">{sub}</div>
    </div>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return <p className="text-body text-mute max-w-prose leading-relaxed">{children}</p>;
}
