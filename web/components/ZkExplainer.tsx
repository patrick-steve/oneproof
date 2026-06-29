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
        Every private transfer in OneProof runs through the same small
        program. That program proves three things about the user&apos;s
        secret data, without revealing the data itself. The aggregator
        then takes many of these proofs and folds them into one.
      </Prose>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-px bg-line">
        {/* LEFT: the three facts, stacked, each with its equation prominent */}
        <div className="bg-ink p-6 md:p-10 space-y-10">
          <Fact
            n="i"
            title="a commitment"
            equation="c = hash(secret, amount, blinding)"
          >
            A commitment is a one-way fingerprint. The user combines
            their secret values into a short hash <code className="font-mono text-paper">c</code>
            that nobody can reverse to recover the originals. Only{" "}
            <code className="font-mono text-paper">c</code> goes public;
            the inputs stay with the user.
          </Fact>

          <Fact
            n="ii"
            title="a membership proof"
            equation="prove c is one of the published commitments"
          >
            All published commitments are stored in a shared list (a
            Merkle tree). When the user later spends, the proof shows
            that their commitment is somewhere in that list, without
            revealing which entry. Anyone can verify it; nobody can tell
            who spent.
          </Fact>

          <Fact
            n="iii"
            title="a nullifier"
            equation="nf = hash(secret, leafIndex)"
          >
            A nullifier is a one-time burn marker. It&apos;s derived from
            the same secret that built the commitment, but in a way that
            doesn&apos;t reveal which commitment it came from. Once
            published, the nullifier prevents the user from spending the
            same commitment twice.
          </Fact>
        </div>

        {/* RIGHT: real values from the demo proof we ran */}
        <div className="bg-ink p-6 md:p-10 space-y-6">
          <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-mute">
            example values · from our demo proof
          </div>
          <div className="space-y-5 font-mono text-[11px]">
            <KvBlock k="secret"   v="7"      sub="private · the user's seed" />
            <KvBlock k="amount"   v="1000"   sub="private · what they're transferring" />
            <KvBlock k="blinding" v="42"     sub="private · random padding to prevent guessing" />
            <KvBlock
              k="c"
              v={`0x1cdce02c…22cbf`}
              sub="commitment · the one-way hash of the three above"
            />
            <KvBlock
              k="root"
              v={`0x1cdce02c…22cbf`}
              sub="public · the shared list stored on-chain"
              long
            />
            <KvBlock
              k="nf"
              v={`0x1e95b928…29d3`}
              sub="public · the one-time burn marker"
            />
          </div>
          <div className="pt-4 border-t border-line text-[11px] text-mute leading-relaxed">
            Only{" "}
            <span style={{ color: COLORS.signal }}>root</span> and{" "}
            <span style={{ color: COLORS.signal }}>nf</span> are visible
            to the chain. Secret, amount, and blinding never leave the user&apos;s
            machine; the proof attests they were used correctly without
            ever exposing them.
          </div>
        </div>
      </div>

      <div className="space-y-3 max-w-prose">
        <h3 className="font-display font-medium text-paper text-2xl md:text-3xl">
          Where the aggregator fits in.
        </h3>
        <p className="text-body text-mute leading-relaxed">
          Each transfer produces one of these proofs. Without aggregation,
          the chain would have to check every single one. The aggregator
          is a special proof{" "}
          <em className="text-paper not-italic">about other proofs</em>:
          it confirms that four inner proofs all hold, and produces one
          new proof that the chain can check in a single transaction.
          Chain a few aggregators together and you can collapse thousands
          of transfers into one on-chain verification.
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
