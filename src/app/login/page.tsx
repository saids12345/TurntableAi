"use client";

import { useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export default function LoginPage() {
  const supabase = createClientComponentClient();

  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function getRedirectTo() {
    // Read ?redirect=/something from the URL using the browser API
    // (this runs only in the browser, inside event handlers)
    try {
      const params = new URLSearchParams(window.location.search);
      const redirectParam = params.get("redirect");
      if (redirectParam) {
        return `${window.location.origin}${redirectParam}`;
      }
    } catch {
      // ignore if URLSearchParams/window isn't available for some reason
    }
    // Fallback: send them to the home page after login
    return `${window.location.origin}/`;
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setMsg(null);
    setErr(null);

    try {
      const redirectTo = getRedirectTo();

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });

      if (error) throw error;
      setMsg(
        "Check your email for a one-click sign-in link. It may land in spam."
      );
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
      const redirectTo = getRedirectTo();

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });

      if (error) throw error;
      // Browser will redirect to Google; no need to unset sending here
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
          By continuing, you agree to the Terms and acknowledge the Privacy
          Policy.
        </p>
      </div>
    </div>
  );
}
