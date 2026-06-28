export default function AggregatePage() {
  return (
    <div className="max-w-6xl mx-auto px-5 md:px-8 py-10 md:py-16">
      <div className="border border-line p-6 font-mono space-y-3 max-w-2xl">
        <div className="text-[11px] uppercase tracking-[0.08em] text-mute">aggregate · the K-to-1 path</div>
        <p className="text-paper text-base leading-relaxed">
          Coming next: the real measured aggregation (4 inner proofs → 1 outer on
          testnet) + an interactive N-vs-cost simulator + the operator console
          view of what a continuously running aggregator service would expose.
        </p>
        <p className="text-mute text-sm leading-relaxed">
          This is the thesis tab. We will not ship empty state here.
        </p>
      </div>
    </div>
  );
}
