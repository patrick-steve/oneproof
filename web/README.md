# web/ — landing page + live cost dashboard

Per `design.md`. Built with Next.js 15 App Router + Tailwind 3.

## Layout

```
app/
  layout.tsx     root layout, fonts, body
  page.tsx       landing page sections per design.md §2
  globals.css    Tailwind + measurement-grid background + focus rings
components/
  HeroChart.tsx  the signature scrubbable cost chart (§4)
lib/
  bench.ts       reads ../../bench/results.json, projects the 3 cost lines
tailwind.config.ts  brand tokens from design.md §1
```

## Dev

```
cd web
pnpm install
pnpm dev          # http://localhost:3000
```

## Build

```
node_modules/.bin/next build   # bypass pnpm install-check; sharp build is intentionally ignored
```

Output: static pages under `.next/`. Single route `/`. ~105 kB first load.

## Deploy (Vercel)

```
npx vercel        # link to project, deploy preview
npx vercel --prod # production
```

The page is fully static — every value on screen is either measured
(see `bench/results.json` + tx hashes linked to stellar.expert) or
projected from a measured anchor. No client-side network calls needed
to render the chart.

## Why this layout

- **Two-color identity** (signal/foil) — the chart lines ARE the brand.
- **Mono numbers everywhere** — the project is about numbers; the rule
  gives the page its calm-instrument identity.
- **Squared panels, hairline borders** — the look of a measuring
  instrument, not a token launch.
- **One bold element** (the scrubbable chart); everything else stays quiet.

Per `design.md` §7, the failure mode is "near-black page with one
acid-green accent and a big-number-over-small-label hero" (the crypto
default). If it ever drifts there, re-derive from §1.
