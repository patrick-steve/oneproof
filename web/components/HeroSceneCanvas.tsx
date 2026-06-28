"use client";

// The R3F <Canvas> + scene contents. Split out from HeroScene.tsx so the
// outer file stays small and the three.js bundle is genuinely dynamic.

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

// design.md §1 tokens
const COLORS = {
  signal: "#4AD8C0",
  mute: "#8A93A6",
  line: "#243047",
  signalDim: "#1C3A38",
  paper: "#ECEBE3",
};

const LOOP_S = 6.0;
const N_HEX = 16;
const ORBIT_R_INNER = 2.9;
const ORBIT_R_OUTER = 3.4;
const ORBIT_TILT_RAD = (25 * Math.PI) / 180;
const HEX_SMALL_R = 0.13;
const HEX_SMALL_H = 0.08;
const HEX_LARGE_R = 0.75;
const HEX_LARGE_H = 0.3;
const HALO_SIZE = 3.6;

// Phase markers (fraction of LOOP_S)
const DRIFT_END = 2.5 / LOOP_S;     // 0.417
const MERGE_END = 3.0 / LOOP_S;     // 0.5
const HOLD_END  = 5.5 / LOOP_S;     // 0.917
// 1.0 = end of loop = reverse-fade phase boundary

const ease = (t: number) => 1 - Math.pow(1 - t, 4); // ease-out-quart
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

// One small orbiting hex. Drifts inward over the first 2.5s, fades during
// the merge moment, stays invisible while the center hex is on stage, then
// fades back in at its orbit position during the last 0.5s.
function OrbitHex({ index }: { index: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef  = useRef<THREE.MeshBasicMaterial>(null);

  // Stagger the orbit ring so the inner 8 sit at radius_inner and outer 8 at
  // radius_outer. Phase offset on the angle so they don't overlap visually.
  const orbitR = index % 2 === 0 ? ORBIT_R_INNER : ORBIT_R_OUTER;
  const ringHalf = index < 8 ? index : index - 8;
  const angle = (ringHalf / 8) * Math.PI * 2 + (index < 8 ? 0 : Math.PI / 8);

  // base position on the orbit (z-tilted ellipse)
  const baseX = Math.cos(angle) * orbitR;
  const baseY = Math.sin(angle) * orbitR * Math.sin(ORBIT_TILT_RAD);
  const baseZ = Math.sin(angle) * orbitR * Math.cos(ORBIT_TILT_RAD);

  useFrame(({ clock }) => {
    if (!meshRef.current || !matRef.current) return;
    const t = (clock.getElapsedTime() % LOOP_S) / LOOP_S;

    let r: number;       // radius scale factor 0..1 from origin to base
    let opacity: number;

    if (t < DRIFT_END) {
      // 0..2.5s: drift inward, full opacity
      const p = ease(t / DRIFT_END);
      r = 1 - p;
      opacity = 0.55;
    } else if (t < MERGE_END) {
      // 2.5..3s: at origin, fading out
      const p = (t - DRIFT_END) / (MERGE_END - DRIFT_END);
      r = 0;
      opacity = 0.55 * (1 - p);
    } else if (t < HOLD_END) {
      // 3..5.5s: gone
      r = 0;
      opacity = 0;
    } else {
      // 5.5..6s: fade back in at orbit position
      const p = (t - HOLD_END) / (1 - HOLD_END);
      r = 1;
      opacity = 0.55 * p;
    }

    meshRef.current.position.set(baseX * r, baseY * r, baseZ * r);
    matRef.current.opacity = opacity;
  });

  return (
    <mesh ref={meshRef} rotation={[Math.PI / 2, 0, angle]}>
      {/* Cylinder with 6 radial segments = hex prism. Lying on its side so the
          hex face shows toward the camera. */}
      <cylinderGeometry args={[HEX_SMALL_R, HEX_SMALL_R, HEX_SMALL_H, 6]} />
      <meshBasicMaterial
        ref={matRef}
        color={COLORS.mute}
        wireframe
        transparent
        opacity={0.55}
        depthWrite={false}
      />
    </mesh>
  );
}

// The converged "one proof" hex + soft signal-colored halo behind it.
// Invisible during drift, fades in during merge, holds and gently rotates,
// fades out at the very end of the loop.
function ConvergedHex() {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef  = useRef<THREE.MeshBasicMaterial>(null);

  // Halo uses a shader for a real radial gradient — a flat-color disc looks
  // wrong, a sphere with opacity falls off too uniformly.
  const haloMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
          uColor: { value: new THREE.Color(COLORS.signalDim) },
          uOpacity: { value: 0 },
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          uniform float uOpacity;
          varying vec2 vUv;
          void main() {
            float d = distance(vUv, vec2(0.5));
            float core = pow(1.0 - smoothstep(0.0, 0.5, d), 2.2);
            gl_FragColor = vec4(uColor, core * uOpacity);
          }
        `,
      }),
    [],
  );
  const haloRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!meshRef.current || !matRef.current || !haloRef.current) return;
    const t = (clock.getElapsedTime() % LOOP_S) / LOOP_S;

    let opacity = 0;
    let yRot = 0;
    let haloBreathe = 1;

    if (t < DRIFT_END) {
      opacity = 0;
    } else if (t < MERGE_END) {
      // merge in
      opacity = ease((t - DRIFT_END) / (MERGE_END - DRIFT_END));
    } else if (t < HOLD_END) {
      opacity = 1;
      const p = (t - MERGE_END) / (HOLD_END - MERGE_END);
      yRot = p * (45 * Math.PI / 180);
      haloBreathe = 1 + Math.sin(p * Math.PI * 2) * 0.08;
    } else {
      // fade out
      const p = (t - HOLD_END) / (1 - HOLD_END);
      opacity = 1 - p;
    }

    matRef.current.opacity = clamp01(opacity);
    haloMat.uniforms.uOpacity.value = clamp01(opacity * 0.55);
    meshRef.current.rotation.y = yRot;
    haloRef.current.scale.setScalar(haloBreathe);
  });

  return (
    <group>
      <mesh ref={haloRef} position={[0, 0, -0.5]}>
        <planeGeometry args={[HALO_SIZE, HALO_SIZE]} />
        <primitive attach="material" object={haloMat} />
      </mesh>
      <mesh ref={meshRef} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[HEX_LARGE_R, HEX_LARGE_R, HEX_LARGE_H, 6]} />
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

export default function HeroSceneCanvas() {
  return (
    <div className="relative w-full aspect-[16/10] border border-line overflow-hidden bg-ink-2">
      <Canvas
        camera={{ position: [0, 1.2, 7], fov: 35 }}
        gl={{ alpha: true, antialias: true }}
        dpr={[1, 2]}
      >
        {/* Lighting: one warm key + low cool fill. Wireframe basic materials
            don't actually need lights (they're emissive-ish by definition)
            but a faint directional light catches the bevels nicely if we
            ever switch from wireframe to thin-shell shading. */}
        <ambientLight intensity={0.1} color={COLORS.mute} />
        <directionalLight position={[5, 5, 5]} intensity={0.3} color={COLORS.paper} />

        <ConvergedHex />
        {Array.from({ length: N_HEX }).map((_, i) => (
          <OrbitHex key={i} index={i} />
        ))}
      </Canvas>

      <div className="absolute bottom-4 left-4 right-4 flex items-baseline justify-between font-mono text-[11px] uppercase tracking-[0.08em] text-mute pointer-events-none">
        <span>scene · K = 4 inner proofs collapse to 1</span>
        <span className="text-signal">one proof</span>
      </div>
    </div>
  );
}
