"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type SessionState = "loading" | "signed-in" | "signed-out";

export default function AuthMenu() {
  const supabase = getSupabaseBrowserClient();
  const router = useRouter();
  const pathname = usePathname();

  const [state, setState] = useState<SessionState>("loading");
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let unsub: (() => void) | null = null;

    (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data?.user ?? null;
      setUser(u);
      setState(u ? "signed-in" : "signed-out");

      const { data: sub } = supabase.auth.onAuthStateChange(
        (_event: AuthChangeEvent, session: Session | null) => {
          const u2 = session?.user ?? null;
          setUser(u2);
          setState(u2 ? "signed-in" : "signed-out");

          // Important for App Router + SSR cookies
          router.refresh();
        }
      );

      unsub = () => sub.subscription.unsubscribe();
    })();

    return () => {
      if (unsub) unsub();
    };
  }, [supabase, router]);

  async function signOut() {
    await supabase.auth.signOut();
    router.refresh();
    router.push("/");
  }

  const loginHref = `/login?redirect=${encodeURIComponent(pathname || "/")}`;

  if (state === "loading") {
    return (
      <div className="text-sm text-white/70 px-3 py-2 rounded-lg border border-white/10">
        Loading…
      </div>
    );
  }

  if (state === "signed-out") {
    return (
      <Link
        href={loginHref}
        className="text-sm text-white/80 hover:text-white px-3 py-2 rounded-lg border border-white/10 hover:border-white/20"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-white/70">
        {user?.email ?? "Signed in"}
      </span>
      <button
        onClick={signOut}
        className="text-sm text-white/80 hover:text-white px-3 py-2 rounded-lg border border-white/10 hover:border-white/20"
      >
        Sign out
      </button>
    </div>
  );
}
