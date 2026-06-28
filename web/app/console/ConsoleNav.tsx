"use client";

// Tab nav that knows which route it's on (via usePathname), so the
// active tab can pick up the signal color. Client component only because
// of the hook; logic is otherwise trivial.

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/console/verify",    label: "verify" },
  { href: "/console/submit",    label: "submit" },
  { href: "/console/aggregate", label: "aggregate" },
] as const;

export default function ConsoleNav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1 overflow-x-auto">
      {TABS.map((t) => {
        const active = pathname?.startsWith(t.href);
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
