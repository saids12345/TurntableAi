// src/app/login/page.tsx
"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const supabase = getSupabaseBrowserClient();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function getRedirectPath() {
    // supports /login?redirect=/reviews OR /login?redirect=/billing?next=%2Freviews
    try {
      const params = new URLSearchParams(window.location.search);
      const redirectParam = params.get("redirect");
      if (redirectParam && redirectParam.startsWith("/")) return redirectParam;
    } catch {}
    return "/billing";
  }

  function getAuthCallbackUrl(nextPath: string) {
    // Always route back through our callback so cookies are set server-side correctly.
    const origin = window.location.origin;
    return `${origin}/auth/callback?redirect=${encodeURIComponent(nextPath)}`;
  }

  async function signUpWithEmailPassword(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setMsg(null);
    setErr(null);

    try {
      if (!password || password.length < 6) {
        throw new Error("Password must be at least 6 characters.");
      }

      const redirectPath = getRedirectPath();
      const emailRedirectTo = getAuthCallbackUrl(redirectPath);

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo,
        },
      });

      if (error) throw error;

      setMsg(
        "Check your email to verify your account. After verification, you’ll be redirected back and continue."
      );
    } catch (e: any) {
      setErr(e?.message || "Sign up failed.");
    } finally {
      setSending(false);
    }
  }

  async function signInWithEmailPassword(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setMsg(null);
    setErr(null);

    try {
      const redirectPath = getRedirectPath();

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // hard navigation ensures the server sees auth cookies
      if (data?.session) {
        window.location.assign(redirectPath);
        return;
      }

      // fallback
      window.location.assign(redirectPath);
    } catch (e: any) {
      setErr(e?.message || "Sign in failed.");
    } finally {
      setSending(false);
    }
  }

  async function continueWithGoogle() {
    setSending(true);
    setErr(null);
    setMsg(null);

    try {
      const redirectPath = getRedirectPath();
      const redirectTo = getAuthCallbackUrl(redirectPath);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });

      if (error) throw error;
      // OAuth will redirect away
    } catch (e: any) {
      setErr(e?.message || "Google sign-in failed.");
      setSending(false);
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">
            {mode === "signin" ? "Sign in" : "Create your account"}
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            {mode === "signin"
              ? "Sign in with your email and password."
              : "Sign up with email + password. We’ll send a verification link to your inbox."}
          </p>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl border border-neutral-800 bg-neutral-900/40 p-1">
          <button
            type="button"
            onClick={() => {
              setMode("signin");
              setMsg(null);
              setErr(null);
            }}
            className={[
              "rounded-lg py-2 text-sm font-medium",
              mode === "signin"
                ? "bg-white text-black"
                : "text-neutral-200 hover:bg-neutral-800/60",
            ].join(" ")}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setMsg(null);
              setErr(null);
            }}
            className={[
              "rounded-lg py-2 text-sm font-medium",
              mode === "signup"
                ? "bg-white text-black"
                : "text-neutral-200 hover:bg-neutral-800/60",
            ].join(" ")}
          >
            Sign up
          </button>
        </div>

        <form
          onSubmit={mode === "signin" ? signInWithEmailPassword : signUpWithEmailPassword}
          className="space-y-3"
        >
          <label className="block text-sm text-neutral-300">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1 w-full rounded-xl bg-neutral-900 border border-neutral-700 px-3 py-2 outline-none"
              autoComplete="email"
            />
          </label>

          <label className="block text-sm text-neutral-300">
            Password
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "signup" ? "Create a password (6+ chars)" : "Your password"}
              className="mt-1 w-full rounded-xl bg-neutral-900 border border-neutral-700 px-3 py-2 outline-none"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              minLength={6}
            />
          </label>

          <button
            type="submit"
            disabled={sending}
            className="w-full rounded-xl bg-white text-black font-medium py-2 disabled:opacity-60"
          >
            {sending ? "Working…" : mode === "signin" ? "Sign in" : "Create account (verify email)"}
          </button>
        </form>

        <div className="my-5 h-px bg-neutral-800" />

        <button
          onClick={continueWithGoogle}
          disabled={sending}
          className="w-full rounded-xl border border-neutral-700 py-2 hover:bg-neutral-900 disabled:opacity-60"
        >
          Continue with Google
        </button>

        {msg && <p className="text-emerald-400 mt-4 text-sm">{msg}</p>}
        {err && <p className="text-red-400 mt-4 text-sm">{err}</p>}

        <p className="text-xs text-neutral-500 mt-6">
          By continuing, you agree to the Terms and acknowledge the Privacy Policy.
        </p>
      </div>
    </div>
  );
}
