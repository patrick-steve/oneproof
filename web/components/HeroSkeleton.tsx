// On-brand SVG fallback for the R3F hero scene. Renders while three.js
// loads OR before a scene is wired. Same composition as the live scene
// (16 small hex glyphs orbiting a converged center hex with a soft halo)
// so the page tells the same story either way.

import { COLORS } from "@/lib/colors";

export default function HeroSkeleton({ reason }: { reason: "awaiting-scene" | "loading-scene" }) {
  return (
    <div
      className="relative w-full h-full min-h-[400px] border border-line overflow-hidden bg-ink-2"
      role="img"
      aria-label="Cluster of proof glyphs collapsing into one"
    >
      <svg
        viewBox="0 0 800 500"
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
      >
        <defs>
          <pattern id="hero-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke={COLORS.line} strokeWidth="0.5" opacity="0.5" />
          </pattern>
          <radialGradient id="signal-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor={COLORS.signal}    stopOpacity="0.35" />
            <stop offset="60%"  stopColor={COLORS.signal}    stopOpacity="0.06" />
            <stop offset="100%" stopColor={COLORS.signal}    stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="800" height="500" fill="url(#hero-grid)" />

        <circle cx="400" cy="260" r="120" fill="url(#signal-glow)" />

        {Array.from({ length: 16 }).map((_, i) => {
          const angle = (i / 16) * Math.PI * 2;
          const r = 180 + (i % 3) * 12;
          const cx = 400 + Math.cos(angle) * r;
          const cy = 260 + Math.sin(angle) * r * 0.55;
          const size = 9;
          const opacity = 0.45 + (i % 3) * 0.18;
          return (
            <polygon
              key={i}
              points={hexPoints(cx, cy, size).join(" ")}
              fill="none"
              stroke={COLORS.mute}
              strokeWidth="1"
              opacity={opacity}
            />
          );
        })}

        {Array.from({ length: 16 }).map((_, i) => {
          const angle = (i / 16) * Math.PI * 2;
          const r = 180 + (i % 3) * 12;
          const x1 = 400 + Math.cos(angle) * r;
          const y1 = 260 + Math.sin(angle) * r * 0.55;
          return (
            <line
              key={`l-${i}`}
              x1={x1}
              y1={y1}
              x2={400}
              y2={260}
              stroke={COLORS.line}
              strokeWidth="0.5"
              strokeDasharray="2 4"
              opacity="0.55"
            />
          );
        })}

        <polygon
          points={hexPoints(400, 260, 40).join(" ")}
          fill="none"
          stroke={COLORS.signal}
          strokeWidth="1.5"
        />
        <polygon
          points={hexPoints(400, 260, 30).join(" ")}
          fill="none"
          stroke={COLORS.signal}
          strokeWidth="0.5"
          opacity="0.5"
        />
      </svg>

      <div className="absolute bottom-4 left-4 right-4 flex items-baseline justify-between font-mono text-[11px] uppercase tracking-[0.08em] text-mute">
        <span>
          {reason === "awaiting-scene" ? "scene · pending" : "scene · loading"}
        </span>
        <span className="text-signal">one proof · K = 4</span>
      </div>
    </div>
  );
}

function hexPoints(cx: number, cy: number, r: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts.map(([x, y]) => [Number(x.toFixed(2)), Number(y.toFixed(2))]);
}
