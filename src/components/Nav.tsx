"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

const publicLinks = [{ href: "/", label: "Home" }];

const appLinks = [
  { href: "/command-center", label: "Command Center" },
  { href: "/brain", label: "Brain" },
  { href: "/reviews", label: "Reviews" },
  { href: "/sales", label: "Performance" },
  { href: "/integrations", label: "Integrations" },
  { href: "/settings", label: "Settings" },
];

function isAllowedStripeStatus(status?: string | null) {
  return status === "trialing" || status === "active" || status === "past_due";
}

export default function Nav() {
  const pathname = usePathname();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [user, setUser] = useState<User | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const billingHref = useMemo(() => {
    const next = pathname?.startsWith("/") ? pathname : "/";
    return `/billing?next=${encodeURIComponent(next)}`;
  }, [pathname]);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoadingProfile(true);

      const { data } = await supabase.auth.getUser();
      const u = data.user ?? null;

      if (!alive) return;
      setUser(u);

      if (!u) {
        setIsPro(false);
        setLoadingProfile(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_pro, plan, stripe_subscription_status")
        .eq("id", u.id)
        .maybeSingle();

      if (!alive) return;

      const pro =
        profile?.is_pro === true ||
        profile?.plan === "pro" ||
        isAllowedStripeStatus(profile?.stripe_subscription_status ?? null);

      setIsPro(!!pro);
      setLoadingProfile(false);
    }

    load();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      load();
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  const links = user ? appLinks : publicLinks;

  return (
    <nav className="flex items-center gap-2">
      <Link
        href={user ? "/command-center" : "/"}
        className="mr-3 flex items-center gap-3"
      >
        <div className="text-sm font-semibold tracking-wide text-white">
          TurnTableAI
        </div>

        {isPro && (
          <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
            Active
          </span>
        )}

        {!isPro && user && loadingProfile && (
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/50">
            …
          </span>
        )}
      </Link>

      {links.map((l) => {
        const active =
          l.href === "/"
            ? pathname === l.href
            : pathname === l.href || pathname?.startsWith(`${l.href}/`);

        return (
          <Link
            key={l.href}
            href={l.href}
            className={`rounded-md px-3 py-1.5 text-sm transition hover:scale-[1.02] active:scale-[0.98] ${
              active
                ? "bg-white/10 font-medium text-white"
                : "text-white/70 hover:bg-white/5"
            }`}
          >
            {l.label}
          </Link>
        );
      })}

      {user && (
        <>
          <Link
            href={billingHref}
            className={`rounded-md px-3 py-1.5 text-sm transition hover:scale-[1.02] active:scale-[0.98] ${
              pathname?.startsWith("/billing")
                ? "bg-white/10 font-medium text-white"
                : "text-white/70 hover:bg-white/5"
            }`}
          >
            Billing
          </Link>

          {!isPro && (
            <Link
              href={billingHref}
              className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-black transition hover:scale-[1.02] active:scale-[0.98]"
            >
              Upgrade
            </Link>
          )}
        </>
      )}
    </nav>
  );
}