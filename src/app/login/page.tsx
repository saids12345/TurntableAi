"use client";

import { useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useSearchParams } from "next/navigation";

export default function LoginPage() {
  const supabase = createClientComponentClient();
  const qp = useSearchParams();

  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setMsg(null);
    setErr(null);

    try {
      // If we were redirected here (e.g. from /settings/voice), return there after sign-in
      const redirectParam = qp.get("redirect");
      const redirectTo =
        `${window.location.origin}${redirectParam ?? ""}` ||
        `${window.location.origin}/`;

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });

      if (error) throw error;
      setMsg("Check your email for a one-click sign-in link. It may land in spam.");
    } catch (e: any) {
      setErr(e.message || "Could not send magic link.");
    } finally {
      setSending(false);
    }
  }

  async function signInWithGoogle() {
    setSending(true);
    setErr(null);
    setMsg(null);
    try {
      const redirectParam = qp.get("redirect");
      const redirectTo =
        `${window.location.origin}${redirectParam ?? ""}` ||
        `${window.location.origin}/`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (error) throw error;
      // browser will redirect to Google; no need to unset sending here
    } catch (e: any) {
      setErr(e.message || "Google sign-in failed.");
      setSending(false);
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Sign in</h1>
          <p className="text-sm text-neutral-400 mt-1">
            Use a magic link to sign in. No password required.
          </p>
        </div>

        <form onSubmit={sendMagicLink} className="space-y-3">
          <label className="block text-sm text-neutral-300">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1 w-full rounded-xl bg-neutral-900 border border-neutral-700 px-3 py-2 outline-none"
            />
          </label>

          <button
            type="submit"
            disabled={sending}
            className="w-full rounded-xl bg-white text-black font-medium py-2 disabled:opacity-60"
          >
            {sending ? "Sending…" : "Send magic link"}
          </button>
        </form>

        <div className="my-5 h-px bg-neutral-800" />

        {/* Optional OAuth button — enable Google in Supabase to use */}
        <button
          onClick={signInWithGoogle}
          disabled={sending}
          className="w-full rounded-xl border border-neutral-700 py-2 hover:bg-neutral-900 disabled:opacity-60"
        >
          Continue with Google
        </button>

        {msg && <p className="text-emerald-400 mt-4">{msg}</p>}
        {err && <p className="text-red-400 mt-4">{err}</p>}

        <p className="text-xs text-neutral-500 mt-6">
          By continuing, you agree to the Terms and acknowledge the Privacy Policy.
        </p>
      </div>
    </div>
  );
}
