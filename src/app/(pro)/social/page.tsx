"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/Toast";
import Shimmer from "@/components/Shimmer";
import { PresetBar } from "@/components/Presets";
import { useDraft } from "@/lib/useDraft";
import { track } from "@/lib/track";

type Mode = "captions" | "reels" | "both";
type Length = "short" | "medium" | "long";
type Language = "English" | "Spanish" | "Arabic";

type Inputs = {
  prompt: string;
  mode: Mode;
  tone: string;
  platform: "Instagram" | "TikTok";
  city: string;
  length: Length;
  brand?: string;
  cuisine?: string;
  special?: string;
  language: Language;
};

type HistoryItem = { ts: number; inputs: Inputs; output: string };

const TONES = ["Playful", "Classy", "Bold", "Friendly", "Witty", "Professional"];
const LANGS: Language[] = ["English", "Spanish", "Arabic"];
const MAX_IG_CHARS = 2200;

export default function SocialGeneratorPage() {
  const { push } = useToast();
  const [inputs, setInputs] = useState<Inputs>({
    prompt: "",
    mode: "both",
    tone: "Friendly",
    platform: "Instagram",
    city: "San Diego",
    length: "medium",
    brand: "",
    cuisine: "",
    special: "",
    language: "English",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [result, setResult] = useState<string>("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [editable, setEditable] = useState(false);

  // Offline drafts + online indicator
  const { isOnline } = useDraft<Inputs>("draft:social", inputs, (v) => setInputs(v));

  useEffect(() => {
    try {
      const raw = localStorage.getItem("socialGenHistory");
      if (raw) setHistory(JSON.parse(raw));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("socialGenHistory", JSON.stringify(history.slice(0, 5)));
    } catch {}
  }, [history]);

  const charCount = useMemo(() => inputs.prompt.length, [inputs.prompt]);
  function update<K extends keyof Inputs>(key: K, value: Inputs[K]) {
    setInputs((s) => ({ ...s, [key]: value }));
  }

  // Cmd/Ctrl + Enter
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "enter" && !loading) {
        const form = document.querySelector("form");
        (form as HTMLFormElement | null)?.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [loading]);

  async function onGenerate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult("");

    try {
      const res = await fetch("/api/generate-social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inputs),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to generate");
      const output = (data?.output as string) || "";
      setResult(output);
      setHistory((h) => [{ ts: Date.now(), inputs, output }, ...h].slice(0, 5));
      track({ ts: Date.now(), type: "social_generated" });
      push({ msg: "Done! Generated successfully.", type: "success" });
    } catch (err: any) {
      push({ msg: err.message || "Something went wrong", type: "error" });
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function pasteFromHistory(item: HistoryItem) {
    setInputs(item.inputs);
    setResult(item.output);
    setError("");
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      push({ msg: "Copied to clipboard", type: "success" });
    } catch {
      push({ msg: "Couldn’t copy—select manually.", type: "error" });
    }
  }

  const variants = useMemo(() => {
    if (!result) return [];
    const chunks = result
      .split(/^###\s*Variant\s*\d+/im)
      .map((c) => c.trim())
      .filter(Boolean);
    if (chunks.length <= 1) {
      const fallback = result.split(/\n{2,}/).filter(Boolean);
      return fallback.slice(0, 3);
    }
    return chunks.slice(0, 3);
  }, [result]);

  return (
    <div className="min-h-screen w-full px-3 pb-12 pt-10 sm:px-4 md:px-8">
      <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-black/30 p-6 shadow-2xl backdrop-blur">
        <h1 className="text-center text-3xl font-semibold tracking-tight">Social Generator ✨</h1>
        <p className="mt-2 text-center text-sm text-white/70">
          Create on-brand captions & TikTok/Reel ideas in a click.
        </p>
        {!isOnline && <div className="mt-2 text-center text-xs text-amber-300">Offline — drafts auto-saved locally.</div>}

        <PresetBar name="social" value={inputs} onLoad={(v) => setInputs(v)} />

        <form onSubmit={onGenerate} className="mt-6 grid gap-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="block text-sm text-white/80">Mode</label>
              <select
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
                value={inputs.mode}
                onChange={(e) => update("mode", e.target.value as Mode)}
              >
                <option value="captions">Captions</option>
                <option value="reels">Reel Ideas</option>
                <option value="both">Both</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-white/80">Tone</label>
              <select
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
                value={inputs.tone}
                onChange={(e) => update("tone", e.target.value)}
              >
                {TONES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-white/80">Language</label>
              <select
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
                value={inputs.language}
                onChange={(e) => update("language", e.target.value as Language)}
              >
                {LANGS.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="block text-sm text-white/80">Platform</label>
              <select
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
                value={inputs.platform}
                onChange={(e) => update("platform", e.target.value as Inputs["platform"])}
              >
                <option>Instagram</option>
                <option>TikTok</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-white/80">Hashtag city/area</label>
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
                value={inputs.city}
                onChange={(e) => update("city", e.target.value)}
                placeholder="San Diego"
              />
            </div>
            <div>
              <label className="block text-sm text-white/80">Length</label>
              <select
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
                value={inputs.length}
                onChange={(e) => update("length", e.target.value as Length)}
              >
                <option value="short">Short (≤ 80 words)</option>
                <option value="medium">Medium (≤ 140 words)</option>
                <option value="long">Long (≤ 220 words)</option>
              </select>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="block text-sm text-white/80">Brand (optional)</label>
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
                value={inputs.brand}
                onChange={(e) => update("brand", e.target.value)}
                placeholder="TurnTable Cafe"
              />
            </div>
            <div>
              <label className="block text-sm text-white/80">Cuisine (optional)</label>
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
                value={inputs.cuisine}
                onChange={(e) => update("cuisine", e.target.value)}
                placeholder="Yemeni coffee, pastries"
              />
            </div>
            <div>
              <label className="block text-sm text-white/80">Special / promo (optional)</label>
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
                value={inputs.special}
                onChange={(e) => update("special", e.target.value)}
                placeholder="BOGO latte Tue 2–5pm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-white/80">
              Describe what you want
              <span className="ml-2 text-xs text-white/50">
                ({charCount.toLocaleString()} / {MAX_IG_CHARS.toLocaleString()} chars)
              </span>
            </label>
            <textarea
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-sm leading-6"
              rows={4}
              value={inputs.prompt}
              onChange={(e) => update("prompt", e.target.value)}
              placeholder="Example: Launching our new cardamom latte this weekend..."
              maxLength={MAX_IG_CHARS}
              required
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-gradient-to-r from-fuchsia-500 to-purple-600 px-5 py-3 text-sm font-medium text-white transition hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
            >
              {loading ? "Generating…" : "Generate 3 Variants"}
            </button>
            <label className="flex items-center gap-2 text-xs text-white/70">
              <input type="checkbox" checked={editable} onChange={(e) => setEditable(e.target.checked)} />
              Editable box under variants
            </label>
          </div>
        </form>

        {loading && (
          <div className="mt-4">
            <Shimmer className="h-24" />
            <div className="mt-2 grid gap-2 md:grid-cols-3">
              <Shimmer className="h-20" />
              <Shimmer className="h-20" />
              <Shimmer className="h-20" />
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-950/30 p-3 text-sm text-red-200">{error}</div>
        )}

        {variants.length > 0 && (
          <div className="mt-6 grid gap-4">
            {variants.map((v, i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-black/30 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Variant {i + 1}</h3>
                  <button
                    onClick={() => copy(v)}
                    className="rounded-md border border-white/10 px-3 py-1 text-xs text-white/80 transition hover:bg-white/5 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Copy
                  </button>
                </div>
                <pre className="whitespace-pre-wrap text-sm text-white/90">{v}</pre>
              </div>
            ))}

            {editable && (
              <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Editable Output</h3>
                  <button
                    onClick={() => copy(result)}
                    className="rounded-md border border-white/10 px-3 py-1 text-xs text-white/80 transition hover:bg-white/5 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Copy
                  </button>
                </div>
                <textarea
                  className="h-56 w-full rounded-lg border border-white/10 bg-black/40 p-3 text-sm"
                  value={result}
                  onChange={(e) => setResult(e.target.value)}
                />
              </div>
            )}
          </div>
        )}

        {history.length > 0 && (
          <div className="mt-8">
            <div className="mb-2 text-sm font-semibold text-white/80">Recent (last 5)</div>
            <div className="grid gap-3">
              {history.map((h) => (
                <button
                  key={h.ts}
                  onClick={() => pasteFromHistory(h)}
                  className="w-full rounded-lg border border-white/10 bg-black/30 p-3 text-left text-xs text-white/80 transition hover:bg-white/5 hover:scale-[1.01] active:scale-[0.99]"
                >
                  <div className="line-clamp-1">
                    {new Date(h.ts).toLocaleString()} — {h.inputs.prompt}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

