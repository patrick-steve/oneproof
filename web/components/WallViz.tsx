// Section 01 visualization — "the wall." Four growth rows showing what
// you'd pay naive-verifying N proofs on Stellar testnet. The longest
// bar deliberately overflows the container: that's the wall, visually.
//
// Numbers are calibrated from the actual measured naive per-tx fee
// (30,556 stroops, from results.json bench at M=4). Linear in N.

const PER_TX_STROOPS = 30_556;
const N_ROWS = [1, 4, 64, 1024] as const;

export default function WallViz() {
  // Bar widths scale so that N=64 fills the container; N=1024 then
  // overflows by a factor of 16, intentionally clipped by overflow-hidden.
  const MAX_VISIBLE_N = 64;
  const widthForN = (n: number) =>
    Math.min((n / MAX_VISIBLE_N) * 100, 1600); // cap at 1600% so it's clipped, not infinite

  const formatStroops = (n: number) => {
    const total = PER_TX_STROOPS * n;
    if (total >= 1_000_000) return `${(total / 1_000_000).toFixed(2)} M`;
    if (total >= 1_000)     return `${(total / 1_000).toFixed(1)} K`;
    return total.toLocaleString();
  };

  return (
    <div className="border border-line bg-ink-2 p-5 md:p-6 font-mono">
      <div className="flex items-baseline justify-between mb-5 text-[11px] uppercase tracking-[0.08em]">
        <span className="text-mute">naive · cost vs N · stellar testnet</span>
        <span className="text-mute">{PER_TX_STROOPS.toLocaleString()} stroops × N</span>
      </div>

      <div className="space-y-4 overflow-hidden relative">
        {N_ROWS.map((n) => {
          const w = widthForN(n);
          const clipped = w >= 1500;
          return (
            <div key={n} className="space-y-1.5">
              <div className="flex items-baseline justify-between text-[11px] uppercase tracking-[0.08em]">
                <span className="text-mute">
                  N = <span className="text-paper">{n.toLocaleString()}</span>
                </span>
                <span className="text-foil">
                  {formatStroops(n)}{" "}
                  <span className="text-mute text-[10px]">stroops · {n} tx</span>
                </span>
              </div>
              <div className="relative h-2 bg-line/40">
                <div
                  className="absolute inset-y-0 left-0 bg-foil"
                  style={{ width: `${w}%` }}
                />
                {clipped && (
                  <div className="absolute top-0 right-0 bottom-0 px-2 flex items-center bg-ink-2 border-l border-foil text-[10px] uppercase tracking-[0.08em] text-foil">
                    off the chart →
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 pt-4 border-t border-line text-[11px] text-mute leading-relaxed">
        Every proof is its own transaction. Past N = 64 you&apos;ve burned
        ~2 million stroops just on verification — and you&apos;ve sent 64
        separate transactions to do it. Aggregation collapses all of
        them into one.
      </div>
    </div>
  );
}
