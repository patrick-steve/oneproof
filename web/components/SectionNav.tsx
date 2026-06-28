"use client";

// Fixed left-rail nav for the landing. Instrument-panel idiom: numbered
// jumps to the 7 sections, the active one in signal. Highlight via
// IntersectionObserver on each section's id.
//
// Hidden under lg (sub-1024px) because the layout collapses to a single
// column without the rail — the headings still anchor with section
// numbers in-flow.

import { useEffect, useState } from "react";

interface Section { id: string; n: string; label: string; }

const SECTIONS: Section[] = [
  { id: "hero",     n: "00", label: "hero" },
  { id: "wall",     n: "01", label: "wall" },
  { id: "curve",    n: "02", label: "curve" },
  { id: "zk",       n: "03", label: "what zk proves" },
  { id: "pipeline", n: "04", label: "pipeline" },
  { id: "numbers",  n: "05", label: "numbers" },
  { id: "caveats",  n: "06", label: "caveats" },
  { id: "run",      n: "07", label: "run it" },
];

export default function SectionNav() {
  const [active, setActive] = useState<string>("hero");

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (!el) return;
      const obs = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) setActive(s.id);
          });
        },
        { rootMargin: "-40% 0px -55% 0px", threshold: 0 },
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  return (
    <aside
      aria-label="section navigation"
      className="hidden lg:flex fixed top-0 left-0 h-screen w-[88px] xl:w-[112px] z-20 flex-col items-stretch py-8 border-r border-line bg-ink/85 backdrop-blur supports-[backdrop-filter]:bg-ink/55"
    >
      <a href="/" className="px-3 mb-10 font-mono text-[11px] uppercase tracking-[0.08em] text-paper hover:text-signal transition-colors">
        oneproof
      </a>
      <ul className="flex-1 flex flex-col gap-px">
        {SECTIONS.map((s) => {
          const isActive = active === s.id;
          return (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className={`group flex flex-col px-3 py-2 transition-colors ${
                  isActive ? "text-signal" : "text-mute hover:text-paper"
                }`}
              >
                <span className="font-mono text-[10px] tracking-[0.1em]">{s.n}</span>
                <span className={`font-mono text-[11px] mt-0.5 ${isActive ? "" : "opacity-70"} group-hover:opacity-100 transition-opacity`}>
                  {s.label}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
      <div className="mt-6 px-3 font-mono text-[10px] uppercase tracking-[0.08em] text-mute flex flex-col gap-1">
        <a href="/console/verify" className="hover:text-signal transition-colors">→ console</a>
        <span className="text-line">·</span>
        <span>v0.1</span>
      </div>
    </aside>
  );
}
