"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

type SessionState = "loading" | "signed-in" | "signed-out";

export default function AuthMenu() {
  const supabase = createClientComponentClient();
  const pathname = usePathname();
  const [state, setState] = useState<SessionState>("loading");
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data.session) {
        setState("signed-in");
        setEmail(data.session.user.email ?? null);
      } else {
        setState("signed-out");
      }
    });
    // keep it fresh if user signs in/out somewhere else
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (session) {
        setState("signed-in");
        setEmail(session.user.email ?? null);
      } else {
        setState("signed-out");
        setEmail(null);
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = "/login"; // simple redirect after sign out
  }

  // small, unobtrusive UI for your header
  if (state === "loading") {
    return (
      <div className="h-8 w-24 rounded-lg bg-neutral-800/60 animate-pulse" />
    );
  }

  if (state === "signed-out") {
    // preserve where the user was going: /login?redirect=/settings/voice
    const redirect = pathname && pathname !== "/login" ? `?redirect=${encodeURIComponent(pathname)}` : "";
    return (
      <Link
        href={`/login${redirect}`}
        className="text-sm text-neutral-300 hover:text-white border border-neutral-700 rounded-lg px-3 py-1.5"
      >
        Sign in
      </Link>
    );
  }

  // signed-in
  return (
    <div className="flex items-center gap-3">
      {email && (
        <span className="text-xs text-neutral-400 hidden sm:inline">
          {email}
        </span>
      )}
      <button
        onClick={handleSignOut}
        className="text-sm text-neutral-300 hover:text-white border border-neutral-700 rounded-lg px-3 py-1.5"
        aria-label="Sign out"
      >
        Sign out
      </button>
    </div>
  );
}
