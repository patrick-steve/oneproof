// Remotion composition — the OneProof pipeline as a 12-second composition
// played back via <Player> with scroll-scrub. 5 named scenes, each ~2-3s.
//
// The visual language stays in design.md §1: ink ground, hairline borders,
// JetBrains Mono for all numbers, signal teal for the "good" path, mute
// gray for incidental glyphs. No animation flourishes beyond what's
// needed to tell the cause-and-effect story.

import {
  AbsoluteFill,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const COLORS = {
  ink: "#0D1320",
  ink2: "#121A2B",
  line: "#243047",
  paper: "#ECEBE3",
  mute: "#8A93A6",
  signal: "#4AD8C0",
  signalDim: "#1C3A38",
  foil: "#FB7185",
};

const easeOut = (t: number) => 1 - Math.pow(1 - t, 4);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ─── Scene 1 (0–3s): four inner proofs generating ─────────────────────────
function Scene1Inner() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / (fps * 3);
  // Each of the 4 proofs starts staggered (0, 0.25, 0.5, 0.75) and finishes
  // its "prove" at 1.0 of its own progress.
  return (
    <AbsoluteFill style={{ ...sceneStyle, padding: 64 }}>
      <Label>01 · PROVE</Label>
      <Caption>4 inner private-transfer proofs generated off-chain, in parallel.</Caption>
      <div style={{ display: "flex", gap: 24, marginTop: 64 }}>
        {[0, 1, 2, 3].map((i) => {
          const start = i * 0.18;
          const p = Math.max(0, Math.min(1, (t - start) / 0.5));
          const done = p >= 1;
          return (
            <div
              key={i}
              style={{
                flex: 1,
                border: `1px solid ${done ? COLORS.signal : COLORS.line}`,
                padding: 20,
                background: COLORS.ink2,
                opacity: t > start - 0.1 ? 1 : 0.25,
                transition: "border-color 200ms linear",
              }}
            >
              <div style={mono(11, COLORS.mute)}>INNER · proof #{i}</div>
              <div style={mono(14, done ? COLORS.signal : COLORS.paper, 16)}>
                {done ? "verified ✓" : `proving… ${Math.round(p * 100)}%`}
              </div>
              <ProgressBar p={p} done={done} />
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

// ─── Scene 2 (3–5s): four converge into an aggregator hex ────────────────
function Scene2Converge() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = easeOut(Math.min(1, frame / (fps * 1.8)));

  // 4 boxes glide inward toward a central aggregator anchor
  const cx = 640, cy = 420;
  const startX = [180, 460, 820, 1100];
  const startY = [320, 240, 240, 320];

  return (
    <AbsoluteFill style={{ ...sceneStyle, padding: 64 }}>
      <Label>02 · COLLAPSE</Label>
      <Caption>K inner proofs verified inside one aggregator circuit.</Caption>
      <svg viewBox="0 0 1280 720" style={{ width: "100%", height: 520, marginTop: 40 }}>
        {/* aggregator hex appearing */}
        <g opacity={t}>
          <polygon
            points={hexPoints(cx, cy, 80).join(" ")}
            fill="none"
            stroke={COLORS.signal}
            strokeWidth="1.5"
          />
          <text x={cx} y={cy + 6} textAnchor="middle" fontFamily="JetBrains Mono" fontSize="14" fill={COLORS.signal} letterSpacing="0.1em">
            AGG K=4
          </text>
        </g>
        {/* the 4 inner proofs gliding inward */}
        {[0, 1, 2, 3].map((i) => {
          const x = lerp(startX[i], cx, t);
          const y = lerp(startY[i], cy, t);
          const op = lerp(1, 0.2, t);
          return (
            <g key={i} opacity={op}>
              <polygon points={hexPoints(x, y, 22).join(" ")} fill="none" stroke={COLORS.mute} strokeWidth="1" />
              {/* trail line */}
              <line x1={startX[i]} y1={startY[i]} x2={x} y2={y} stroke={COLORS.line} strokeWidth="0.5" strokeDasharray="2 4" />
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
}

// ─── Scene 3 (5–7s): aggregator emits one outer proof ─────────────────────
function Scene3Outer() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = Math.min(1, frame / (fps * 1.6));
  const ringR = lerp(80, 160, easeOut(t));
  const labelOpacity = interpolate(t, [0.3, 0.7], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ ...sceneStyle, padding: 64 }}>
      <Label>03 · EMIT</Label>
      <Caption>One outer UltraHonk proof, ~456 field elements. Keccak transcript.</Caption>
      <svg viewBox="0 0 1280 720" style={{ width: "100%", height: 520, marginTop: 40 }}>
        <g>
          {/* emission ring */}
          <circle cx="640" cy="420" r={ringR} fill="none" stroke={COLORS.signal} strokeWidth="0.5" opacity={1 - t} />
          {/* outer proof glyph */}
          <polygon points={hexPoints(640, 420, 70).join(" ")} fill="none" stroke={COLORS.signal} strokeWidth="2" />
          <polygon points={hexPoints(640, 420, 56).join(" ")} fill="none" stroke={COLORS.signalDim} strokeWidth="0.5" />
          <text x="640" y="426" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="13" fill={COLORS.signal}>
            OUTER PROOF
          </text>
        </g>
        <g opacity={labelOpacity}>
          <text x="640" y="560" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="12" fill={COLORS.mute} letterSpacing="0.1em">
            456 · FIELD · ELEMENTS
          </text>
          <text x="640" y="588" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="11" fill={COLORS.mute} letterSpacing="0.08em">
            transcript · keccak-256
          </text>
        </g>
      </svg>
    </AbsoluteFill>
  );
}

// ─── Scene 4 (7–9s): submit to Soroban ─────────────────────────────────────
function Scene4Submit() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = Math.min(1, frame / (fps * 1.6));
  const proofX = lerp(640, 1040, easeOut(t));

  return (
    <AbsoluteFill style={{ ...sceneStyle, padding: 64 }}>
      <Label>04 · VERIFY</Label>
      <Caption>One Soroban transaction · BN254 pairing check.</Caption>
      <svg viewBox="0 0 1280 720" style={{ width: "100%", height: 520, marginTop: 40 }}>
        {/* proof glyph flying right */}
        <g>
          <polygon points={hexPoints(proofX, 420, 50).join(" ")} fill="none" stroke={COLORS.signal} strokeWidth="1.5" />
        </g>
        {/* trail */}
        <line x1="640" y1="420" x2={proofX} y2="420" stroke={COLORS.line} strokeWidth="0.5" strokeDasharray="3 6" />
        {/* soroban contract glyph */}
        <g opacity={interpolate(t, [0.4, 1], [0.4, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}>
          <rect x="1090" y="370" width="100" height="100" fill="none" stroke={t > 0.95 ? COLORS.signal : COLORS.mute} strokeWidth="1.5" />
          <text x="1140" y="425" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="11" fill={COLORS.mute} letterSpacing="0.1em">
            SOROBAN
          </text>
          <text x="1140" y="442" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="9" fill={COLORS.mute} letterSpacing="0.1em">
            crypto::bn254
          </text>
        </g>
      </svg>
    </AbsoluteFill>
  );
}

// ─── Scene 5 (9–12s): receipt with the real testnet tx hash ────────────────
function Scene5Receipt() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = Math.min(1, frame / (fps * 2));
  const checkOp = interpolate(t, [0.1, 0.4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const hashOp = interpolate(t, [0.4, 0.8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ ...sceneStyle, padding: 64 }}>
      <Label>05 · RECEIPT</Label>
      <Caption>On-chain. Real. Replay any time.</Caption>
      <div
        style={{
          marginTop: 60,
          border: `1px solid ${COLORS.line}`,
          padding: 40,
          background: COLORS.ink2,
        }}
      >
        <div style={{ ...mono(12, COLORS.mute, 0), letterSpacing: "0.1em" }}>STELLAR TESTNET · VERIFY-PROOF TX</div>
        <div
          style={{
            ...mono(13, COLORS.signal, 24),
            opacity: hashOp,
            wordBreak: "break-all",
            lineHeight: 1.7,
          }}
        >
          c4046dc67994d0cc41d966e06f8c3b49a4a443fbb29cd9c88045039c22ae36e6
        </div>
        <div style={{ marginTop: 28, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={mono(11, COLORS.mute, 0)}>LEDGER 3,310,893</span>
          <span style={{ ...mono(13, COLORS.signal, 0), opacity: checkOp }}>✓ VERIFIED</span>
          <span style={mono(11, COLORS.mute, 0)}>FEE 136,009 STROOPS</span>
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ─── Composition root ──────────────────────────────────────────────────────
export const PipelineComposition = () => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: COLORS.ink }}>
      {/* faint grid behind everything */}
      <svg
        viewBox="0 0 1280 720"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.35 }}
      >
        <defs>
          <pattern id="rpattern" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke={COLORS.line} strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="1280" height="720" fill="url(#rpattern)" />
      </svg>
      <Sequence from={0} durationInFrames={fps * 3}>
        <Scene1Inner />
      </Sequence>
      <Sequence from={fps * 3} durationInFrames={fps * 2}>
        <Scene2Converge />
      </Sequence>
      <Sequence from={fps * 5} durationInFrames={fps * 2}>
        <Scene3Outer />
      </Sequence>
      <Sequence from={fps * 7} durationInFrames={fps * 2}>
        <Scene4Submit />
      </Sequence>
      <Sequence from={fps * 9} durationInFrames={fps * 3}>
        <Scene5Receipt />
      </Sequence>
    </AbsoluteFill>
  );
};

// ─── Helpers ───────────────────────────────────────────────────────────────
const sceneStyle: React.CSSProperties = {
  background: COLORS.ink,
  color: COLORS.paper,
  fontFamily: "Switzer, system-ui, sans-serif",
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "JetBrains Mono",
        fontSize: 13,
        color: COLORS.mute,
        textTransform: "uppercase",
        letterSpacing: "0.12em",
      }}
    >
      {children}
    </div>
  );
}

function Caption({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "Switzer, system-ui, sans-serif",
        fontSize: 22,
        color: COLORS.paper,
        marginTop: 12,
        maxWidth: 820,
        lineHeight: 1.4,
      }}
    >
      {children}
    </div>
  );
}

function mono(size: number, color: string, marginTop = 0): React.CSSProperties {
  return {
    fontFamily: "JetBrains Mono",
    fontSize: size,
    color,
    marginTop,
  };
}

function ProgressBar({ p, done }: { p: number; done: boolean }) {
  return (
    <div style={{ marginTop: 18, height: 2, background: COLORS.line, position: "relative" }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          height: 2,
          width: `${p * 100}%`,
          background: done ? COLORS.signal : COLORS.mute,
        }}
      />
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
