"use client";

// Hero 3D scene — R3F replacement for the earlier Spline path.
//
// Visual: 16 small hex prisms in two tilted orbits drift inward, vanish into a
// single converged hex with a soft signal-colored halo, then reverse and loop.
// 6 second cycle, ease-out-quart throughout. Camera static. Calm, geometric,
// instrument-panel — exactly what design.md §1 asks for.
//
// SSR path: the page renders <HeroSkeleton /> server-side. R3F's <Canvas>
// dynamically loads client-side and replaces it. Three.js bundle stays out of
// the critical path.

import dynamic from "next/dynamic";
import HeroSkeleton from "./HeroSkeleton";

const SceneCanvas = dynamic(() => import("./HeroSceneCanvas"), {
  ssr: false,
  loading: () => <HeroSkeleton reason="loading-scene" />,
});

export default function HeroScene() {
  return <SceneCanvas />;
}
