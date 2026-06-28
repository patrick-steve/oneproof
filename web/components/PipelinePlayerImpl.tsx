"use client";

// Embed the Remotion <Player> and scroll-scrub it via GSAP ScrollTrigger.
// Pinned for 1.5 viewports of scroll, with a visible mono progress readout
// so the user always knows where they are in the pin. Pin skipped if
// prefers-reduced-motion OR if the Player hasn't reported ready yet.
//
// Reduced-motion path jumps to last frame and renders un-pinned.

import { useRef, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { PipelineComposition } from "@/remotion/PipelineComposition";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

const Player = dynamic(() => import("@remotion/player").then((m) => m.Player), {
  ssr: false,
  loading: () => <PipelineSkeleton />,
});

const FPS = 30;
const DURATION_S = 12;
const DURATION_FRAMES = FPS * DURATION_S;
const PIN_DISTANCE = "+=150%"; // 1.5 viewports

const SCENE_LABELS = ["prove", "collapse", "emit", "verify", "receipt"];
// scene boundaries in fraction of total duration (matches the Sequence
// `from` values in PipelineComposition.tsx: 0, 3, 5, 7, 9, 12 seconds)
const SCENE_STARTS = [0, 3, 5, 7, 9].map((s) => s / DURATION_S);

export default function PipelinePlayer() {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
  }, []);

  // The Player loads asynchronously; we mark it ready a tick after mount
  // so we can guard the pin against pinning a still-loading skeleton.
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 500);
    return () => clearTimeout(t);
  }, []);

  useGSAP(
    () => {
      if (!containerRef.current || !ready) return;
      const reduced =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (reduced) {
        playerRef.current?.seekTo(DURATION_FRAMES - 1);
        setProgress(1);
        return;
      }

      const trigger = ScrollTrigger.create({
        trigger: containerRef.current,
        start: "top top",
        end: PIN_DISTANCE,
        pin: true,
        pinSpacing: true,
        scrub: 0.5,
        onUpdate: (self) => {
          const target = Math.floor(self.progress * (DURATION_FRAMES - 1));
          playerRef.current?.seekTo(target);
          setProgress(self.progress);
        },
      });

      return () => trigger.kill();
    },
    { scope: containerRef, dependencies: [ready] },
  );

  // Which scene index is "current" given progress?
  const sceneIdx = (() => {
    let i = 0;
    for (let k = 0; k < SCENE_STARTS.length; k++) {
      if (progress >= SCENE_STARTS[k]) i = k;
    }
    return i;
  })();

  return (
    <div ref={containerRef} className="relative h-screen w-full">
      <div className="absolute inset-0 flex items-center justify-center px-4 md:px-8">
        <div className="w-full max-w-5xl border border-line bg-ink-2">
          <Player
            ref={playerRef}
            component={PipelineComposition}
            durationInFrames={DURATION_FRAMES}
            compositionWidth={1280}
            compositionHeight={720}
            fps={FPS}
            controls={false}
            autoPlay={false}
            loop={false}
            showVolumeControls={false}
            allowFullscreen={false}
            doubleClickToFullscreen={false}
            clickToPlay={false}
            style={{ width: "100%", height: "auto", aspectRatio: "16 / 9" }}
          />

          {/* Footer: progress indicator + scene labels. The visitor always
              knows where they are in the pin; if scroll feels stuck, the
              progress readout reassures them it's scroll-driven, not broken. */}
          <div className="border-t border-line">
            <div className="px-4 py-3 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.08em] text-mute gap-4">
              <span>pipeline · scroll to scrub</span>
              <span className="text-paper">
                {String(sceneIdx + 1).padStart(2, "0")} / 05 · {SCENE_LABELS[sceneIdx]}
              </span>
              <span>{Math.round(progress * 100)}%</span>
            </div>
            <div className="h-[2px] bg-line">
              <div
                className="h-full bg-signal transition-[width] duration-100 ease-linear"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PipelineSkeleton() {
  return (
    <div className="w-full aspect-video border border-line bg-ink-2 flex items-center justify-center">
      <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-mute">
        pipeline · loading composition…
      </div>
    </div>
  );
}
