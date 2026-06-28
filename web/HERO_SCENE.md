# Hero scene — R3F implementation notes

> Replaces the earlier Spline-hosted plan. Pure code, ships from the repo,
> no external service, no `.splinecode` blob in git history. The visual is
> identical to what `design.md` §1 calls for.

## Why R3F over Spline

- **Brand fit**: wireframe hex prisms + single key light + transparent
  background is the exact use case `<meshBasicMaterial wireframe>` was
  built for. Spline shines for organic/photographic 3D; we want geometric.
- **Lighter bundle**: Spline runtime added ~200 KB on top of three.js;
  `@react-three/fiber` adds ~30 KB. Three.js itself is loaded either way.
- **Diffable**: every primitive, color, and animation curve is plain JSX.
- **Direct state coupling**: GSAP/scroll progress lives in React state,
  and R3F reads React state via hooks. No bridge layer.
- **No service / no auth / no MCP server config**: plain `pnpm add`.

The tradeoff: code authoring instead of visual drag-and-drop. For our
specific calm-geometric aesthetic that's a feature, not a regression.

## File layout

```
web/components/
  HeroScene.tsx        — outer wrapper. SSR-safe via next/dynamic
                          with ssr:false. Renders <HeroSkeleton> as the
                          loading fallback until the R3F canvas mounts.
  HeroSceneCanvas.tsx  — the actual <Canvas> + scene. Three components:
                            • <ConvergedHex>   — the converged "one proof"
                              + signal-colored halo (custom shader)
                            • <OrbitHex>       — one of 16 small orbiting
                              hex prisms with its own per-frame animation
                            • <HeroSceneCanvas> — composes them under
                              <Canvas> with the lights
  HeroSkeleton.tsx     — hand-rolled SVG fallback for SSR + loading.
                          Tells the same visual story in 2D so the page
                          works without JS.
```

## Animation timing

A 6-second loop divided into 4 phases. Easing is ease-out-quart
throughout (per `design.md` §5 motion rules + the impeccable shared
laws "ease out with exponential curves").

```
phase        | window (s)  | small hexes              | converged hex + halo
-------------+-------------+--------------------------+--------------------------
drift        | 0.0 → 2.5   | drift inward, full op    | invisible
merge        | 2.5 → 3.0   | at origin, fade out      | fade in
hold         | 3.0 → 5.5   | invisible                | hold, slow Y rotation,
             |             |                          | halo breathes ±8%
fade reset   | 5.5 → 6.0   | fade back in at orbit    | fade out
```

Camera is static throughout. No dolly, no orbit. The page reads as a
viewer watching an instrument readout, not as a flythrough.

## Geometry / material choices

- Hex prism = `<cylinderGeometry args={[radius, radius, height, 6]} />`.
  6 radial segments turns a cylinder into a hexagonal prism. Rotated
  90° on X so the hex face points at the camera.
- Wireframe via `<meshBasicMaterial wireframe transparent depthWrite={false} />`.
  basic material is unaffected by lights — exactly what we want for the
  "drawn instrument schematic" look.
- Halo uses a custom `ShaderMaterial` with a radial gradient in the
  fragment shader (`pow(1 - smoothstep(0, 0.5, d), 2.2)`). A flat-color
  disc looks wrong; a sphere with opacity falls off too uniformly.
- `depthWrite: false` on transparent materials so the halo doesn't
  punch a hole in the depth buffer that would clip nearby hexes.

## Performance

- 18 meshes total (16 small + 1 large + 1 halo plane).
- Triangle count well under 1k.
- One `useFrame` callback per mesh = ~18 callbacks per render frame.
  Negligible. Runs at 60fps on a 5-year-old laptop.
- `dpr={[1, 2]}` caps device pixel ratio at 2× on retina screens —
  prevents pointless rendering at 3× on phones.

## What gets ripped out if we pivot

If we ever decide R3F is the wrong call and want to go full
pre-rendered video / PNG sequence instead:

1. Delete `HeroScene.tsx` and `HeroSceneCanvas.tsx`.
2. Uninstall `@react-three/fiber`, `@react-three/drei`, `three`.
3. Replace `<HeroScene />` in `app/page.tsx` with whatever new
   component (e.g. a Remotion-rendered `<video>` element).
4. `HeroSkeleton.tsx` survives — it's pure SVG with no R3F deps.
