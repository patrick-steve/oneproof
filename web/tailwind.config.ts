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
        // §1 type scale (desktop)
        "display-hero":    ["4.5rem", { lineHeight: "4rem", letterSpacing: "-0.02em" }], // 72/64
        "display-section": ["2.25rem", { lineHeight: "2.5rem" }], // 36
        "body":            ["1.125rem", { lineHeight: "1.75rem" }], // 18/28
        "label":           ["0.8125rem", { letterSpacing: "0.08em" }], // 13, +0.08em
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
