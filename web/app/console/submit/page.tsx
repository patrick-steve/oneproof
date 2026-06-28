export default function SubmitPage() {
  return (
    <div className="max-w-6xl mx-auto px-5 md:px-8 py-10 md:py-16">
      <div className="border border-line p-6 font-mono space-y-3 max-w-2xl">
        <div className="text-[11px] uppercase tracking-[0.08em] text-mute">submit · wallet path</div>
        <p className="text-paper text-base leading-relaxed">
          Coming next: paste in a Groth16 proof + vk, sign with Freighter,
          watch it verify on testnet.
        </p>
        <p className="text-mute text-sm leading-relaxed">
          Wallet wiring (Freighter), proof-form UX, and the simulate-then-send
          path land in the next commit. Verify tab is fully live in the meantime.
        </p>
      </div>
    </div>
  );
}
