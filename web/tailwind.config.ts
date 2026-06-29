import type { Config } from "tailwindcss";

// design.md §1 — exact hex values, named so components never hardcode.
// The two brand colors ARE the two lines on the chart.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // PALETTE V2 — black + white + blue + yellow.
        // signal (blue)  = the calm constant. Flat recursive line.
        // foil   (yellow) = the warning. Linear naive line that explodes.
        // Per impeccable: tint neutrals slightly so they're not pure black/white.
        ink:         "#0A0A0C", // background — near-black with neutral tint
        "ink-2":     "#14141A", // raised panels
        line:        "#1F1F26", // hairlines, grid, borders
        paper:       "#F4F4EE", // headlines + display text — warm near-white
        mute:        "#7C7C82", // body copy + labels — calm gray
        signal:      "#5FB7FF", // calm blue — the flat recursive line
        foil:        "#FFD24F", // warm yellow — the rising naive line
        "signal-dim": "#15324E", // signal at low alpha for fills/glows
      },
      fontFamily: {
        // Display: Clash Display (Fontshare) — wide engineered caps
        display: ['"Clash Display"', "system-ui", "sans-serif"],
        // Body: Switzer (Fontshare) — neutral high-legibility
        sans: ["Switzer", "system-ui", "sans-serif"],
        // Mono: JetBrains Mono — ALL numbers, this is the rule
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      fontSize: {
        // §1 type scale, bumped to editorial / viewport-relative for the
        // full-bleed layout. The brand calls for display type that "does
        // the work" — these are now genuinely large.
        // V3 — dialed back so a 1920px screen doesn't get 350px tall letters.
        // 11vw at 1920px = ~211px (was 345px); reads as "huge headline"
        // without breaking layout or feeling like a billboard.
        "display-hero":    ["clamp(2.75rem, 11vw, 10rem)", { lineHeight: "0.9",  letterSpacing: "-0.025em" }],
        "display-section": ["clamp(2rem, 5vw, 4.5rem)",    { lineHeight: "0.98", letterSpacing: "-0.018em" }],
        "display-stat":    ["clamp(2rem, 5.5vw, 5rem)",    { lineHeight: "0.95", letterSpacing: "-0.02em" }],
        "body":            ["1.125rem",                   { lineHeight: "1.65" }],
        "label":           ["0.8125rem",                  { letterSpacing: "0.08em" }],
      },
      maxWidth: {
        // Per impeccable: body copy capped at 65–75ch. Used inside full-
        // bleed sections to constrain paragraphs without forcing the
        // visualizations into the same straitjacket.
        "prose-tight": "62ch",
        "prose":       "72ch",
      },
      borderRadius: {
        // §1: squared panels, 0-4px radius
        DEFAULT: "2px",
        md: "4px",
      },
    },
  },
  plugins: [],
};
export default config;
