// src/components/Navbar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const links = [
  { href: "/", label: "Home" },
  { href: "/social", label: "Social" },
  { href: "/reviews", label: "Reviews" },
  { href: "/sales", label: "Sales" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-neutral-950/70 backdrop-blur">
      <div className="mx-auto flex h-12 max-w-6xl items-center gap-3 px-3">
        {/* Left: badge + brand */}
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900/70 px-2.5 py-1 text-[10px] text-neutral-300">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.6)]" />
            Live • Beta
          </span>

          <Link href="/" className="font-semibold tracking-tight text-neutral-200">
            TurnTable AI
          </Link>
        </div>

        {/* Center: nav links */}
        <nav className="mx-auto flex items-center gap-1">
          {links.map((l) => {
            const active =
              l.href === "/"
                ? pathname === "/"
                : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={clsx(
                  "rounded-md px-3 py-1.5 text-sm text-neutral-300 hover:text-white",
                  active && "bg-white/5 text-white"
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        {/* Right spacer (used to hold toggle before; keep layout balanced) */}
        <div className="w-16" />
      </div>
    </header>
  );
}


