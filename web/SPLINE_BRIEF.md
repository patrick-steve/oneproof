# Spline scene brief — OneProof hero

> One scene to build in spline.design. Public-shared URL drops into
> `web/components/SplineHero.tsx` (`SPLINE_SCENE_URL`) and the page is done.
> Whole job is **~60 minutes** of Spline work if you stay disciplined.

The scene illustrates *one fact*: many small proofs **collapse** into one.
The visitor sees this in the first 3 seconds. Nothing else is the scene's
job. The numbers and the chart say everything else.

---

## 1 · Scene one-liner

> A cluster of small hex-shaped proof glyphs orbits a center. They drift
> inward, merge, and become **one** larger hex with a soft teal halo. The
> camera holds still. Then the scene loops.

## 2 · Geometry (what to build)

- **One large hex prism** at the world origin — the converged "one proof."
  - Wireframe-ish: ~80% opacity edges, ~10% face fill. Not solid neon.
  - Size: ~1.5 units across the flat. Slight bevel (0.02) so the edges
    catch light without looking plastic.
- **16 small hex prisms** arranged in two concentric tilted orbits (8 + 8)
  around the center.
  - Diameter ~0.25 units. Same wireframe style as the large hex, dimmer.
  - Slight Y rotation per hex so they don't all face the camera identically.
  - Tilt the orbital plane ~25° off horizontal so the cluster has depth.
- **Thin guide lines** from each small hex to the center, very low alpha
  (~10%). Optional — the SVG skeleton uses these and they read clearly,
  but they're not load-bearing.
- **No floor, no horizon, no skybox.** Transparent background so the
  scene blends into the page's `#0D1320` ground.

## 3 · Colors (use these exact hex values)

These are the brand tokens from `design.md` §1 — do not invent others.

| Token | Hex | Where |
|---|---|---|
| `ink` | `#0D1320` | Background — set canvas background to this OR transparent (preferred) |
| `signal` | `#4AD8C0` | The CONVERGED "one proof" hex (edges + glow) |
| `mute` | `#8A93A6` | The 16 small orbiting hexes (edges) |
| `line` | `#243047` | Guide lines, ambient hints |
| `signal-dim` | `#1C3A38` | Halo behind the converged hex (low alpha) |

**No coral / foil.** That color is reserved for the "naive" cost line on
the chart. Putting it in the hero would dilute its job.

**No neon glow stacks**, **no chromatic aberration**, **no rim lighting**
that looks like a crypto launch. One soft volumetric halo behind the
center hex, that's it.

## 4 · Animation

Loop length: **~6 seconds**. Easing: ease-out-quart (Spline's `Easing
Out` quartic preset). The motion is calm, not bouncy.

1. `t = 0.0s`  — 16 hexes orbit at radius ~3 units. Center hex absent / 0
   opacity. Halo absent.
2. `t = 0.0–2.5s` — small hexes drift inward along their guide lines.
   Their opacity stays at 100% the whole way; size unchanged. Camera
   does not move.
3. `t = 2.5–3.0s` — small hexes pass through the center, become 0 opacity,
   and disappear. As they pass through, the center hex fades in (0 → 100%
   opacity) and the halo fades in (0 → 40% opacity).
4. `t = 3.0–5.5s` — center hex slowly rotates on its Y axis (45° over 2.5s).
   Halo gently breathes ±10% scale.
5. `t = 5.5–6.0s` — quick reverse: center hex fades out, halo fades out, 16
   orbit hexes fade back in at their starting positions.
6. Loop.

Implementation in Spline: use the **States** panel — define `start`,
`converging`, `converged`, `pre-loop` states for each object, then a
single timeline cycles through them.

## 5 · Camera

- **Static.** Camera position: slight downward tilt (~12°), pulled back
  enough that the outer orbit fills ~80% of the frame width.
- No dolly, no orbit, no auto-rotate. The user is *watching*, not flying
  through. If the camera is moving, the scene is failing.
- Field of view: 35° (slight telephoto — flatter perspective reads as
  more "instrument readout," less "game engine").

## 6 · Lighting

- One **directional key light** from upper-right at ~30% intensity, slight
  warm tint toward `#ECEBE3` (the `paper` color).
- One **ambient fill** at low intensity (10%), cool.
- **No point lights inside the hexes.** The signal-colored glow comes
  from the halo material, not from a light source.

## 7 · Materials

- For the hex outlines, use **emissive matte** material (Spline material
  with emission color = signal/mute, very low diffuse, no roughness).
- For the halo, a soft sphere with **opacity gradient** centered on the
  converged hex. Color = `signal-dim` (`#1C3A38`) blending out to fully
  transparent.

## 8 · Performance budget

- Total polygon count under **20k**. Spline gets slow above ~50k on
  modest laptops; we want this scene to run on a 5-year-old MacBook Air
  without thermal throttling.
- No reflections, no PBR roughness/metalness maps, no AO baking. Plain
  emissive + opacity is enough.

## 9 · Export (the bit that produces the URL I need)

1. In spline.design, click **Export** (top-right).
2. Choose **Code Export → React** if available, **OR** **Public Web URL**.
3. Set **Background** = **Transparent**.
4. Set **Auto Play** = **On**, **Loop** = **On**.
5. Copy the URL. It looks like:
   ```
   https://prod.spline.design/<scene-id>/scene.splinecode
   ```
6. Paste it into me, or directly into
   `web/components/SplineHero.tsx` at the constant `SPLINE_SCENE_URL`.

## 10 · Anti-references (what failure looks like)

Don't ship if any of these are true:

- ❌ The scene has a glowing infinite floor / disco grid.
- ❌ The hexes leave neon trails.
- ❌ Chromatic aberration on edges.
- ❌ Camera auto-orbits, makes you sea-sick.
- ❌ The converged "one proof" is rainbow / multi-color.
- ❌ More than two brand colors visible at any time.
- ❌ Polygon count over 50k or scene >5 MB.

If any of these are true the scene drifts toward the templated
crypto-launch aesthetic that `design.md` §7 explicitly warns against.

## 11 · Fallback already shipped

If for any reason you don't want to build a Spline scene right now, the
page already renders a hand-rolled SVG hero
(`web/components/HeroSkeleton.tsx`) that tells the same story in 2D. The
page does not break without you. Setting `SPLINE_SCENE_URL = null`
keeps the skeleton.
