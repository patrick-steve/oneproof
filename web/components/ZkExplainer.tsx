// "What ZK proofs actually do here" - the human-language explainer that
// sits between the abstract one-liner ("aggregate N proofs into one") and
// the numbers. No jargon dump; structured as three plain-language facts
// about the inner circuit, the aggregator, and the on-chain verifier.

export default function ZkExplainer() {
  return (
    <section className="space-y-8">
      <div className="space-y-3">
        <h2 className="font-display font-semibold text-display-section text-paper">
          What the ZK proof actually proves.
        </h2>
        <p className="text-body text-mute max-w-2xl">
          The whole system runs because each user can prove something
          true about their own transaction without revealing the
          transaction. That proof is what gets aggregated.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-line">
        <Fact
          n="01"
          head="A commitment"
          eq="c = H(secret, amount, blinding)"
          body="Each transfer hides the amount and recipient inside a one-way commitment c. Only the user knows the inputs; everyone else just sees c. The commitment goes into a public Merkle tree."
        />
        <Fact
          n="02"
          head="A membership proof"
          eq="prove c ∈ tree(root) AND knowledge of inputs"
          body="When the user later spends, they prove that their secret commitment lives somewhere under the published Merkle root, without revealing WHICH leaf. Anyone can verify the proof; nobody can de-anonymize the user."
        />
        <Fact
          n="03"
          head="A nullifier"
          eq="nf = H(secret, leafIndex)"
          body="The user also reveals a deterministic nullifier so they can't spend the same commitment twice. The nullifier doesn't link back to c; it just stops double-spends."
        />
      </div>

      <div className="space-y-3 pt-4">
        <h3 className="font-display font-medium text-xl text-paper">
          Where the aggregator fits in.
        </h3>
        <p className="text-body text-mute max-w-2xl">
          Each transfer makes one such proof. Without aggregation, the chain
          would verify each one separately. The aggregator is a ZK proof
          <em className="text-paper not-italic"> about other ZK proofs</em>: it
          attests that K inner proofs all check out, and produces a single
          outer proof that the chain verifies in one transaction. Stack
          aggregators in a tree and you can collapse thousands of inner
          proofs into one outer verification.
        </p>
      </div>
    </section>
  );
}

function Fact({ n, head, eq, body }: { n: string; head: string; eq: string; body: string }) {
  return (
    <div className="bg-ink p-5 space-y-3">
      <div className="font-mono text-[13px] uppercase tracking-[0.08em] text-mute">{n}</div>
      <div className="font-display font-medium text-paper text-xl">{head}</div>
      <div className="font-mono text-xs text-signal/90 break-words">{eq}</div>
      <p className="text-sm text-mute leading-relaxed">{body}</p>
    </div>
  );
}
