# OneProof – design.md

Spec for the landing page + live dashboard. This is a build brief for Claude Code, not loose direction. Follow the token system exactly; derive every color and type choice from §1. En dashes with spaces ( – ), never em dashes.

The page has one job: make a visitor understand, in the first five seconds, that **on-chain cost stays flat no matter how many proofs go in.** The whole design serves that one fact.

---

## §1. Brand system

The subject is a measuring instrument. OneProof measures the on-chain cost of verification and shows that aggregation flattens it. So the aesthetic is an **instrument panel** – precise, calm, numeric – not the default dark-mode-crypto look and deliberately not Stellar's space imagery (that would be the templated choice for anything on Stellar). The page reads like an oscilloscope, not a token launch.

The two brand colors *are the two lines on the chart*: the aggregated line that stays flat (the hero) and the naive line that explodes (the foil). The whole identity is "one line stays calm."

### Palette (use these exact values)
```
--ink        #0D1320   /* ground – deep instrument indigo, not pure black */
--ink-2      #121A2B   /* raised panels, cards */
--line       #243047   /* hairlines, grid, borders */
--paper      #ECEBE3   /* display type, warm near-white */
--mute       #8A93A6   /* body text, labels, cool slate */
--signal     #4AD8C0   /* AGGREGATED line + primary accent – calm teal, "the good line" */
--foil       #FB7185   /* NAIVE line – warm coral, "the line that explodes" */
--signal-dim #1C3A38   /* signal at low alpha for fills/glows */
```
Signal is used with restraint: the aggregated line, the primary CTA, one or two key numbers. Foil appears only where the naive cost is shown. Everything else is ink, paper, mute, line. Do not introduce other accent colors.

### Type
```
Display : "Clash Display"   (Fontshare)  – wide, engineered caps; used large and sparingly
Body    : "Switzer"         (Fontshare)  – neutral, quiet, high legibility
Mono    : "JetBrains Mono"               – ALL numbers, N values, costs, tx hashes, code
```
Mono is thematic, not decorative: this is a product about numbers, so every number on the page is set in mono. That rule alone gives the page its identity. Display is for headlines only. Body carries everything else.

Type scale (desktop): display hero 72/64px, section heads 36px, body 18/28, labels 13px mono uppercase tracked +0.08em. Tighten the hero leading; let the display face's width do the work.

### Layout concept
A single centered column on a wide instrument ground, with a persistent faint measurement grid (--line at low alpha) bleeding behind everything, like graph paper under an instrument readout. Generous vertical rhythm. No rounded-corner card soup – panels have 1px --line borders and 0–4px radius, squared and precise.

### Signature element
**The scrubbable cost readout in the hero.** A live line chart with an N slider directly under it. Dragging N redraws two lines in real time: the coral naive line climbing steeply, the teal aggregated line lying flat across the bottom. This is the thesis as an interactive object – the visitor *operates the instrument* and watches the foil line explode while the signal line refuses to move. It is the one bold thing on the page; everything else stays quiet around it.

## §2. Page structure (ASCII wireframe, desktop)

```
┌──────────────────────────────────────────────────────────┐
│  oneproof ·                              [docs] [github] │   nav, mono wordmark
├──────────────────────────────────────────────────────────┤
│                                                          │
│   ONE PROOF                                              │   display, --paper
│   TO RULE THEM ALL.                                      │   "ONE" can be --signal
│                                                          │
│   Aggregate N proofs into one the chain verifies once.   │   body, --mute
│   Constant-cost ZK on Stellar.                           │
│                                                          │
│   ┌────────────────────────────────────────────────┐    │
│   │            ╱ naive (coral, exploding)           │    │   THE SIGNATURE
│   │          ╱                                      │    │   live chart
│   │        ╱                                        │    │   --foil line
│   │      ╱                                          │    │
│   │ ───────────────────────  aggregated (teal,flat)│    │   --signal line
│   │  N = [────●────────────] 64                     │    │   slider, mono
│   │  on-chain cost: 1 tx · <cost> instrs            │    │   mono readout
│   └────────────────────────────────────────────────┘    │
│   [ run it on testnet → ]      view the proof on-chain   │   --signal CTA
│                                                          │
├──────────────────────────────────────────────────────────┤
│  THE WALL                                                │   problem section
│  Verifying N proofs costs N verifications. That linear   │
│  wall is why private apps don't scale on-chain. <small   │
│  rising-cost viz>                                        │
├──────────────────────────────────────────────────────────┤
│  HOW IT WORKS            01 → 02 → 03                    │   numbered: real sequence
│  01 prove   inner private-transfer proofs, off-chain     │   diagram, 3 stages
│  02 collapse aggregator verifies K → 1, tree to a root   │
│  03 verify  Soroban checks one proof · BN254 + Poseidon  │   Protocol 25/26 callout
├──────────────────────────────────────────────────────────┤
│  THE NUMBERS                                             │   real bench data
│  ┌────────┐ ┌────────┐ ┌────────┐                        │   mono stat panels
│  │crossover│ │cost @  │ │ tx @   │  ← from results.json   │
│  │  N=__   │ │N=1024  │ │N=1024  │                        │
│  └────────┘ └────────┘ └────────┘                        │
├──────────────────────────────────────────────────────────┤
│  WHAT THIS IS / ISN'T                                    │   honest caveats
│  is: real testnet numbers, real proofs, audited parts    │   two columns
│  isn't: production anonymity set, new crypto, mainnet    │
├──────────────────────────────────────────────────────────┤
│  RUN IT                                                  │   CTA + repo
│  one command · testnet · open source     [github →]      │
├──────────────────────────────────────────────────────────┤
│  oneproof · stellar hacks: real-world zk · testnet      │   footer, mono
└──────────────────────────────────────────────────────────┘
```

## §3. Copy direction

Voice: a precise instrument, not a salesperson. Active voice, plain verbs, sentence case in body, no hype words ("revolutionary", "seamless", "unlock"). The numbers carry the persuasion; the copy just points at them.

- Hero head: **ONE PROOF TO RULE THEM ALL.** (set "ONE" in --signal)
- Hero sub: "Aggregate N proofs into one the chain verifies once. Constant-cost ZK on Stellar."
- Hero readout label: "on-chain cost" with the live mono value beside it.
- Problem head: "The wall." Body: "Verifying N proofs costs roughly N verifications. That linear wall is why private apps stall on-chain at single-digit throughput."
- How-it-works stage verbs: **prove · collapse · verify** (collapse is the brand verb – use it).
- Numbers section: each panel is one mono number with a small label. No sentences.
- The punchline line near the chart, stated plainly: "The chain doesn't care how many proofs are inside."
- Caveats head: "What this is, and isn't." Keep both columns honest and confident – naming limits builds trust and almost no landing page does it, which makes it distinctive here.

## §4. The signature chart (build notes)

- Library: Recharts (already in the artifact stack) or a hand-rolled SVG line chart. Two series: naive (foil, e.g. linear/steep), aggregated (signal, flat). X axis = N, log or linear with a clear steep-vs-flat contrast.
- Data source: `bench/results.json` for the real committed curve; the slider interpolates/reads measured points and shows the cost readout in mono. If a live run is wired, the slider can trigger a single-N testnet run and update the readout from the real tx.
- The flat signal line should visibly *not move* as N scrubs up while the foil line shoots off the top – that contrast is the entire pitch. Make the foil line exit the top of the frame at high N rather than rescaling the axis to contain it; the explosion is the point.
- Never render placeholder/zero data. If `results.json` lacks a point, the chart shows only measured points and the slider clamps to the measured range.

## §5. Motion

One orchestrated load moment: on first paint, both lines draw left-to-right over ~900ms – the foil line accelerating up and off-frame, the signal line tracing flat. After that, motion is limited to the slider redraw and quiet hover states on CTAs/links. No scroll-jacking, no ambient particles, no parallax. The instrument is calm; only the chart moves.

`prefers-reduced-motion`: lines render in their final state with no draw animation; slider still works.

## §6. Tech + quality floor

- Next.js (App Router) + Tailwind. Fonts via Fontshare (Clash Display, Switzer) + JetBrains Mono (Google Fonts or self-hosted).
- Tailwind theme extends the §1 hex values as named tokens (`ink`, `paper`, `signal`, `foil`, `mute`, `line`); never hardcode hex in components.
- Responsive to 375px: hero stacks, chart stays full-width and remains the first thing seen, slider stays usable with touch.
- Accessibility floor: visible keyboard focus rings (in --signal), the slider is keyboard-operable with aria-valuenow/min/max, contrast on --paper/--mute over --ink meets AA, the chart has a text equivalent of the headline numbers for screen readers.
- No browser storage APIs. State is in-memory (React state) only.
- Deploy: Vercel. Dashboard reads committed `results.json` so it renders correctly even if testnet is down during judging; live single-N runs are additive, not required.

## §7. What would make this templated (avoid)

If the result ends up as a near-black page with one acid-green accent and a big-number-over-small-label hero, it has collapsed into the crypto default – stop and re-derive from §1. The tells that it's right instead: mono numbers everywhere, the two-color chart-as-identity, the measurement-grid ground, the "collapse" verb, and the caveats section that most projects would hide. The boldness budget is spent entirely on the scrubbable chart; everything else stays quiet.
