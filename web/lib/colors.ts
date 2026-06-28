// Single source of truth for brand color hex values. Tailwind class names
// reference the SAME tokens via tailwind.config.ts. When SVG/Canvas/Three.js
// content needs raw hex (because Tailwind classes don't reach inside those),
// import from here so we never drift.
//
// Palette V2: black + white + blue + yellow.

export const COLORS = {
  ink:       "#0A0A0C",
  ink2:      "#14141A",
  line:      "#1F1F26",
  paper:     "#F4F4EE",
  mute:      "#7C7C82",
  signal:    "#5FB7FF", // calm blue — recursive (flat) line
  foil:      "#FFD24F", // warm yellow — naive (exploding) line
  signalDim: "#15324E", // low-alpha signal for fills/glows
} as const;
