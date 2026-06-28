import type { Config } from "tailwindcss";

// design.md §1 — exact hex values, named so components never hardcode.
// The two brand colors ARE the two lines on the chart.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink:         "#0D1320", // ground - deep instrument indigo
        "ink-2":     "#121A2B", // raised panels
        line:        "#243047", // hairlines / grid
        paper:       "#ECEBE3", // display type, warm near-white
        mute:        "#8A93A6", // body text, cool slate
        signal:      "#4AD8C0", // AGGREGATED line, "the good line"
        foil:        "#FB7185", // NAIVE line, "the line that explodes"
        "signal-dim": "#1C3A38",
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
        "display-hero":    ["clamp(3.5rem, 11vw, 11rem)", { lineHeight: "0.92", letterSpacing: "-0.025em" }],
        "display-section": ["clamp(2rem, 5vw, 4rem)",     { lineHeight: "1.0",  letterSpacing: "-0.015em" }],
        "display-stat":    ["clamp(2.5rem, 6vw, 5.5rem)", { lineHeight: "1.0",  letterSpacing: "-0.02em" }],
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
