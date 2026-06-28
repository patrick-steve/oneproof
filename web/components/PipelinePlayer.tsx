"use client";

// Lazy wrapper around PipelinePlayerImpl. The Impl statically imports the
// Remotion Player + the R3F PipelineComposition + three.js — heavy stuff
// we do NOT want in the landing's critical-path bundle. Dynamic-import
// with ssr:false keeps all of it in a separate chunk that only loads
// when the user actually scrolls to the pipeline section.

import dynamic from "next/dynamic";

const PipelinePlayerImpl = dynamic(() => import("./PipelinePlayerImpl"), {
  ssr: false,
  loading: () => <PipelineLoading />,
});

export default function PipelinePlayer() {
  return <PipelinePlayerImpl />;
}

function PipelineLoading() {
  return (
    <div className="relative h-screen w-full">
      <div className="absolute inset-0 flex items-center justify-center px-4 md:px-8">
        <div className="w-full max-w-5xl border border-line bg-ink-2">
          <div className="w-full aspect-video flex items-center justify-center">
            <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-mute">
              pipeline · loading composition…
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
