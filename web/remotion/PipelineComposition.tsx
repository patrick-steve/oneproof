// Pipeline composition v2 — Remotion + R3F via @remotion/three.
//
// Five scenes, twelve seconds, all 3D, visually consistent with the hero
// scene (same hex prism vocabulary, same palette). The scroll-scrubbed
// <Player> in PipelinePlayer.tsx drives currentFrame; this composition
// turns frame state into camera/mesh transforms.
//
// Scene plan (12s @ 30fps = 360 frames):
//   0–3s  · 4 inner proof hexes pulse in parallel
//   3–5s  · they glide to the center, fuse into one aggregator hex
//   5–7s  · aggregator emits an outer proof glyph (signal-blue, with halo)
//   7–9s  · outer proof flies right into a Soroban contract glyph (cube)
//   9–12s · receipt: hash typewrite-style + fee counter ticking up

import {
  AbsoluteFill,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { COLORS } from "@/lib/colors";

const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

// ─── Composition root ──────────────────────────────────────────────────
export const PipelineComposition = () => {
  const { fps, width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: COLORS.ink, color: COLORS.paper }}>
      {/* faint measurement grid behind the 3D stage */}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.45 }}
      >
        <defs>
          <pattern id="rgrid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d={`M 48 0 L 0 0 0 48`} fill="none" stroke={COLORS.line} strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width={width} height={height} fill="url(#rgrid)" />
      </svg>

      {/* The 3D stage. Single Canvas; per-scene logic gates visibility/
          position so we don't tear down GL state between scenes. */}
      <AbsoluteFill>
        <ThreeCanvas
          width={width}
          height={height}
          gl={{ alpha: true, antialias: true }}
          camera={{ position: [0, 0.6, 7], fov: 38 }}
        >
          <ambientLight intensity={0.18} color={COLORS.mute} />
          <directionalLight position={[5, 4, 6]} intensity={0.4} color={COLORS.paper} />
          <ThreeStage />
        </ThreeCanvas>
      </AbsoluteFill>

      {/* HTML overlays for each scene's typography. Scenes time-gate via
          <Sequence>; only the active scene's overlay paints. */}
      <Sequence from={0}                          durationInFrames={fps * 3}>      <Scene1Overlay /></Sequence>
      <Sequence from={fps * 3}                    durationInFrames={fps * 2}>      <Scene2Overlay /></Sequence>
      <Sequence from={fps * 5}                    durationInFrames={fps * 2}>      <Scene3Overlay /></Sequence>
      <Sequence from={fps * 7}                    durationInFrames={fps * 2}>      <Scene4Overlay /></Sequence>
      <Sequence from={fps * 9}                    durationInFrames={fps * 3}>      <Scene5Overlay /></Sequence>
    </AbsoluteFill>
  );
};

// ─── 3D stage that drives all scenes from a single frame number ────────
function ThreeStage() {
  return (
    <>
      <InnerProofGroup />
      <AggregatorHex />
      <OuterProofGlyph />
      <ContractGlyph />
    </>
  );
}

// Four small inner hexes, arranged in a horizontal row for scene 1, then
// glide inward to fuse at the center during scene 2, then disappear.
function InnerProofGroup() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const refs = useRef<(THREE.Mesh | null)[]>([null, null, null, null]);
  const mats = useRef<(THREE.MeshBasicMaterial | null)[]>([null, null, null, null]);

  useFrame(() => {
    const t = frame / fps; // seconds
    refs.current.forEach((mesh, i) => {
      if (!mesh || !mats.current[i]) return;
      const baseX = (i - 1.5) * 1.6;
      const baseY = 0;

      let x = baseX, y = baseY, opacity = 0;
      if (t < 3) {
        // scene 1: hexes pulse in place; opacity ramps in stagger
        const localStart = i * 0.2;
        const op = clamp01((t - localStart) / 0.5);
        opacity = op * (0.7 + 0.3 * Math.sin(t * 6 + i));
      } else if (t < 5) {
        // scene 2: glide inward
        const p = easeOutQuart(clamp01((t - 3) / 1.6));
        x = baseX * (1 - p);
        y = baseY;
        opacity = 1 - p * 0.7;
      } else {
        opacity = 0;
      }
      mesh.position.set(x, y, 0);
      mats.current[i].opacity = opacity;
    });
  });

  return (
    <group>
      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[0.45, 0.45, 0.18, 6]} />
          <meshBasicMaterial
            ref={(el) => { mats.current[i] = el; }}
            color={COLORS.mute}
            wireframe
            transparent
            opacity={0}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

// The aggregator: a hex prism that fades in during scene 2 (merge), holds
// through scene 3 (rotating + halo breathing), then flies right during
// scene 4 and is hidden in scene 5.
function AggregatorHex() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const haloMatRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(() => {
    const t = frame / fps;
    if (!meshRef.current || !matRef.current || !haloRef.current || !haloMatRef.current) return;

    let x = 0, opacity = 0, haloOp = 0, yRot = 0, scale = 1;

    if (t < 3) {
      opacity = 0;
    } else if (t < 5) {
      // fade in during merge
      const p = easeOutQuart(clamp01((t - 4) / 1));
      opacity = p;
      haloOp = p * 0.6;
      yRot = p * 0.6;
    } else if (t < 7) {
      // hold + slow rotate, halo breathes
      const p = (t - 5) / 2;
      opacity = 1;
      haloOp = 0.55 + Math.sin(p * Math.PI * 2) * 0.1;
      yRot = 0.6 + p * 0.9;
      scale = 1 + Math.sin(p * Math.PI * 2) * 0.04;
    } else if (t < 9) {
      // fly right toward contract
      const p = easeInOutCubic(clamp01((t - 7) / 1.6));
      x = p * 4;
      opacity = 1 - p * 0.3;
      haloOp = (1 - p) * 0.5;
      yRot = 1.5 + p * 0.6;
    } else {
      opacity = 0;
      haloOp = 0;
    }

    meshRef.current.position.x = x;
    meshRef.current.rotation.y = yRot;
    meshRef.current.scale.setScalar(scale);
    matRef.current.opacity = opacity;
    haloRef.current.position.x = x;
    haloRef.current.scale.setScalar(scale * 1.4);
    haloMatRef.current.opacity = haloOp;
  });

  return (
    <group>
      <mesh ref={haloRef} position={[0, 0, -0.5]}>
        <planeGeometry args={[3.5, 3.5]} />
        <shaderMaterial
          ref={haloMatRef}
          transparent
          depthWrite={false}
          uniforms={{
            uColor: { value: new THREE.Color(COLORS.signal) },
            uOpacity: { value: 0 },
          }}
          vertexShader={`
            varying vec2 vUv;
            void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
          `}
          fragmentShader={`
            uniform vec3 uColor; uniform float uOpacity;
            varying vec2 vUv;
            void main() {
              float d = distance(vUv, vec2(0.5));
              float core = pow(1.0 - smoothstep(0.0, 0.5, d), 2.4);
              gl_FragColor = vec4(uColor, core * uOpacity * 0.45);
            }
          `}
        />
      </mesh>
      <mesh ref={meshRef} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1.0, 1.0, 0.4, 6]} />
        <meshBasicMaterial
          ref={matRef}
          color={COLORS.signal}
          wireframe
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

// The outer proof glyph emitted during scene 3 (a smaller signal hex with
// expanding emission ring). Largely overlaps the aggregator visually; it
// represents the "single outer proof" you'd actually submit on-chain.
function OuterProofGlyph() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const ringMatRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(() => {
    const t = frame / fps;
    if (!meshRef.current || !matRef.current || !ringRef.current || !ringMatRef.current) return;

    let opacity = 0, ringScale = 1, ringOp = 0;

    if (t > 5 && t < 7) {
      const p = clamp01((t - 5) / 0.6);
      opacity = p;
      ringScale = 1 + p * 3;
      ringOp = (1 - p) * 0.6;
    } else if (t >= 7 && t < 9) {
      opacity = 1;
    } else if (t >= 9) {
      opacity = 0;
    }

    matRef.current.opacity = opacity;
    ringRef.current.scale.setScalar(ringScale);
    ringMatRef.current.opacity = ringOp;
  });

  return (
    <group>
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.1, 0.02, 8, 64]} />
        <meshBasicMaterial
          ref={ringMatRef}
          color={COLORS.signal}
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={meshRef} position={[0, 0, 0.01]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.55, 0.55, 0.22, 6]} />
        <meshBasicMaterial
          ref={matRef}
          color={COLORS.signal}
          wireframe
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

// Soroban contract glyph (a wireframe cube). Visible from scene 4 onward;
// flashes when the outer proof "hits" it (around t=8.5s).
function ContractGlyph() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(() => {
    const t = frame / fps;
    if (!meshRef.current || !matRef.current) return;

    let opacity = 0;
    let color = new THREE.Color(COLORS.mute);

    if (t > 6.5 && t < 9) {
      opacity = clamp01((t - 6.5) / 0.5);
      // flash signal at moment of contact (t ~ 8.5)
      const flash = clamp01((t - 8.2) / 0.3) * clamp01((8.8 - t) / 0.3);
      color = new THREE.Color(COLORS.mute).lerp(new THREE.Color(COLORS.signal), flash);
    } else if (t >= 9) {
      opacity = 1;
      color = new THREE.Color(COLORS.signal);
    }

    matRef.current.opacity = opacity;
    matRef.current.color = color;
    // gentle Y rotation throughout
    meshRef.current.rotation.y = t * 0.25;
  });

  return (
    <mesh ref={meshRef} position={[4.5, 0, 0]}>
      <boxGeometry args={[0.9, 0.9, 0.9]} />
      <meshBasicMaterial
        ref={matRef}
        color={COLORS.mute}
        wireframe
        transparent
        opacity={0}
        depthWrite={false}
      />
    </mesh>
  );
}

// ─── HTML overlays per scene ───────────────────────────────────────────

const overlayBase: React.CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  padding: 64,
  fontFamily: "Switzer, system-ui, sans-serif",
};

function SceneEyebrow({ n, label }: { n: string; label: string }) {
  return (
    <div style={{
      fontFamily: "JetBrains Mono",
      fontSize: 13,
      color: COLORS.mute,
      textTransform: "uppercase",
      letterSpacing: "0.12em",
    }}>
      {n} · {label}
    </div>
  );
}

function SceneTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: "Clash Display, system-ui, sans-serif",
      fontSize: 56,
      fontWeight: 600,
      color: COLORS.paper,
      letterSpacing: "-0.015em",
      lineHeight: 1.0,
      marginTop: 18,
      maxWidth: 720,
    }}>
      {children}
    </div>
  );
}

function Scene1Overlay() {
  return (
    <div style={overlayBase}>
      <SceneEyebrow n="01" label="prove" />
      <SceneTitle>4 inner proofs, in parallel.</SceneTitle>
    </div>
  );
}

function Scene2Overlay() {
  return (
    <div style={overlayBase}>
      <SceneEyebrow n="02" label="collapse" />
      <SceneTitle>Verified inside one aggregator circuit.</SceneTitle>
    </div>
  );
}

function Scene3Overlay() {
  return (
    <div style={overlayBase}>
      <SceneEyebrow n="03" label="emit" />
      <SceneTitle>One outer UltraHonk proof.</SceneTitle>
      <div style={{ fontFamily: "JetBrains Mono", fontSize: 12, color: COLORS.mute, marginTop: 16, letterSpacing: "0.1em" }}>
        456 · field · elements · keccak · transcript
      </div>
    </div>
  );
}

function Scene4Overlay() {
  return (
    <div style={overlayBase}>
      <SceneEyebrow n="04" label="verify" />
      <SceneTitle>One Soroban tx · BN254 pairing check.</SceneTitle>
    </div>
  );
}

function Scene5Overlay() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = (frame - fps * 9) / fps; // local seconds within scene 5

  const checkOpacity = interpolate(t, [0.1, 0.5], [0, 1], { extrapolateRight: "clamp" });
  // Fee ticks up to the real measured value over 1.5s
  const TARGET_FEE = 136009;
  const feeP = clamp01((t - 0.4) / 1.5);
  const fee = Math.round(easeOutQuart(feeP) * TARGET_FEE);
  const hashOpacity = interpolate(t, [0.4, 1.0], [0, 1], { extrapolateRight: "clamp" });

  return (
    <div style={overlayBase}>
      <SceneEyebrow n="05" label="receipt" />
      <SceneTitle>On-chain. Real. Replay any time.</SceneTitle>
      <div style={{
        marginTop: 32,
        padding: 28,
        border: `1px solid ${COLORS.line}`,
        background: COLORS.ink2,
        maxWidth: 920,
      }}>
        <div style={{
          fontFamily: "JetBrains Mono",
          fontSize: 11,
          color: COLORS.mute,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}>
          stellar testnet · verify-proof tx
        </div>
        <div style={{
          fontFamily: "JetBrains Mono",
          fontSize: 14,
          color: COLORS.signal,
          marginTop: 18,
          lineHeight: 1.6,
          opacity: hashOpacity,
          wordBreak: "break-all",
        }}>
          c4046dc67994d0cc41d966e06f8c3b49a4a443fbb29cd9c88045039c22ae36e6
        </div>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginTop: 22,
          fontFamily: "JetBrains Mono",
          fontSize: 12,
          color: COLORS.mute,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}>
          <span>ledger · 3,310,893</span>
          <span style={{ color: COLORS.signal, opacity: checkOpacity }}>✓ verified</span>
          <span>fee · <span style={{ color: COLORS.paper }}>{fee.toLocaleString()}</span> stroops</span>
        </div>
      </div>
    </div>
  );
}
