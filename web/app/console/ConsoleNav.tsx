"use client";

// Tab nav that knows which route it's on (via usePathname), so the
// active tab can pick up the signal color. Client component only because
// of the hook; logic is otherwise trivial.

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/console",           label: "demo" },        // Flow B — the unified product demo
  { href: "/console/pool",      label: "pool" },        // real privacy pool: deposit + batch withdraw
  { href: "/console/verify",    label: "submits" },     // submissions through this site
  { href: "/console/aggregate", label: "aggregator" },  // technical view of the aggregation math
] as const;

export default function ConsoleNav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1 overflow-x-auto">
      {TABS.map((t) => {
        // /console is the demo (exact match); the others use startsWith
        // so deeper sub-routes still keep the tab highlighted.
        const active = t.href === "/console"
          ? pathname === "/console"
          : pathname?.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`group px-3 py-1.5 font-mono text-[12px] uppercase tracking-[0.08em] whitespace-nowrap transition-colors ${
              active ? "text-signal" : "text-mute hover:text-paper"
            }`}
          >
            <span className={active ? "opacity-100" : "opacity-50 group-hover:opacity-100 transition-opacity"}>/</span>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
