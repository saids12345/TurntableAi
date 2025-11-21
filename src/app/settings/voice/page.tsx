// src/app/settings/voice/page.tsx
"use client";
import { useEffect, useState } from "react";

export default function BrandVoicePage() {
  const [samples, setSamples] = useState<string[]>(["", "", ""]);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const res = await fetch("/api/voice-profile");
      const j = await res.json();
      if (j.error) setError(j.error);
      setProfile(j.profile);
      if (j.profile?.samples?.length) setSamples(j.profile.samples);
    } catch (err: any) {
      setError("Failed to load voice profile.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  function updateSample(i: number, val: string) {
    setSamples((prev) => prev.map((s, idx) => (idx === i ? val : s)));
  }

  function addSample() {
    setSamples((s) => [...s, ""]);
  }

  async function save() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/voice-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ samples }),
      });
      const j = await res.json();
      if (j.error) setError(j.error);
      setProfile(j.profile);
    } catch (err: any) {
      setError("Failed to save profile.");
    } finally {
      setLoading(false);
    }
  }

  async function reset() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/voice-profile", { method: "DELETE" });
      const j = await res.json();
      if (j.error) setError(j.error);
      else {
        setProfile(null);
        setSamples(["", "", ""]);
      }
    } catch (err: any) {
      setError("Failed to reset profile.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <h1 className="text-2xl font-semibold mb-1">Brand Voice</h1>
      <p className="text-sm text-gray-400 mb-6">
        Paste 3–5 real captions or review replies. We’ll learn your voice and apply it to posts & replies.
      </p>

      <div className="space-y-3">
        {samples.map((s, i) => (
          <textarea
            key={i}
            value={s}
            onChange={(e) => updateSample(i, e.target.value)}
            placeholder={`Sample ${i + 1}`}
            className="w-full min-h-[84px] rounded-xl bg-neutral-900 border border-neutral-700 p-3 outline-none"
          />
        ))}
      </div>

      <div className="flex items-center gap-3 mt-3">
        <button
          onClick={addSample}
          className="px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700"
        >
          + Add another
        </button>
        <button
          onClick={save}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-white text-black font-medium disabled:opacity-60"
        >
          {loading ? "Saving…" : "Save & Generate Style"}
        </button>
        {profile && (
          <button
            onClick={reset}
            className="px-3 py-2 rounded-lg bg-red-600 text-white"
          >
            Reset
          </button>
        )}
      </div>

      {/* 🧠 Smart error message */}
      {error && (
        <p className="text-red-400 mt-3">
          {error === "Unauthorized" ? (
            <>
              You’re not signed in.{" "}
              <a
                href="/login?redirect=/settings/voice"
                className="underline hover:text-red-300"
              >
                Sign in
              </a>{" "}
              and try again.
            </>
          ) : (
            error
          )}
        </p>
      )}

      {profile?.style_guide && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-2">Your Style Guide</h2>
          <pre className="whitespace-pre-wrap text-sm bg-neutral-900 border border-neutral-700 rounded-xl p-4">
            {profile.style_guide}
          </pre>
        </div>
      )}
    </div>
  );
}
