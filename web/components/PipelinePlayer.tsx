"use client";

// Embed the Remotion <Player> and scroll-scrub it via GSAP ScrollTrigger.
// The Player is set to NOT auto-play; scroll position drives currentFrame
// directly via the ref. This is the "operating the instrument" gesture
// applied to the pipeline animation — the visitor's scroll IS the timeline.
//
// Reduced-motion path: the Player jumps to the last frame on mount.

import { useRef, useEffect } from "react";
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

export default function PipelinePlayer() {
  const containerRef = useRef<HTMLDivElement>(null);
  // Player ref must be `any` here because Remotion's `PlayerRef` type lives
  // inside the dynamically-imported module and won't be available at TS
  // resolution time. Runtime API stays stable: .seekTo(frame).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
  }, []);

  useGSAP(
    () => {
      if (!containerRef.current) return;
      const reduced =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (reduced) {
        // Jump to the end frame so the receipt is visible without animation
        playerRef.current?.seekTo(DURATION_FRAMES - 1);
        return;
      }

      ScrollTrigger.create({
        trigger: containerRef.current,
        start: "top top",
        end: "+=200%",
        pin: true,
        pinSpacing: true,
        scrub: 0.5,
        onUpdate: (self) => {
          const target = Math.floor(self.progress * (DURATION_FRAMES - 1));
          playerRef.current?.seekTo(target);
        },
      });
    },
    { scope: containerRef },
  );

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
          <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-mute px-4 py-3 border-t border-line flex justify-between">
            <span>pipeline · scroll to scrub</span>
            <span>30fps · 12.0s · 5 scenes</span>
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
