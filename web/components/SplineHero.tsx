"use client";

// Spline-hosted 3D hero. Lazy-loaded so the ~600 KB three.js + runtime bundle
// is NOT in the critical path. While loading (or when no URL is set yet) we
// show a calm hand-rolled SVG placeholder that's on-brand with design.md §1.

import { Suspense, lazy } from "react";
import HeroSkeleton from "./HeroSkeleton";

// CONFIG — drop the public scene URL here once authored in spline.design.
// Format: https://prod.spline.design/<scene-id>/scene.splinecode
// Until set, the page renders the skeleton (which is genuinely on-brand,
// so we can ship without a Spline URL if needed).
export const SPLINE_SCENE_URL: string | null = null;

// Lazy so SSR doesn't try to import three.js
const Spline = lazy(() =>
  import("@splinetool/react-spline/next").then((m) => ({ default: m.default })),
);

export default function SplineHero() {
  if (!SPLINE_SCENE_URL) {
    return <HeroSkeleton reason="awaiting-scene" />;
  }
  return (
    <div className="relative w-full aspect-[16/10] border border-line overflow-hidden bg-ink-2">
      <Suspense fallback={<HeroSkeleton reason="loading-scene" />}>
        <Spline scene={SPLINE_SCENE_URL} className="absolute inset-0" />
      </Suspense>
    </div>
  );
}
