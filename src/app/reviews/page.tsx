"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "../../components/Toast"; // ✅ only the hook (global provider is in layout)
import Shimmer from "../../components/Shimmer";
import { PresetBar } from "../../components/Presets";
import { useDraft } from "../../lib/useDraft";
import { track } from "../../lib/track";

type Platform = "Google" | "Yelp";
type Tone = "Friendly" | "Professional" | "Witty" | "Warm" | "Direct";
type Length = "short" | "medium" | "long";
type Language = "English" | "Spanish" | "Arabic";

type Inputs = {
  reviewText: string;
  rating?: number | null;
  platform: Platform;
  tone: Tone;
  business?: string;
  city?: string;
  length: Length;
  policy_apologize: boolean;
  policy_no_admission: boolean;
  policy_offer_remedy_if_low: boolean;
  language: Language;
};

type HistoryItem = { ts: number; inputs: Inputs; reply: string };
const MAX_CHARS = 4000;

export default function ReviewResponderPage() {
  const { push } = useToast();

  const [inputs, setInputs] = useState<Inputs>({
    reviewText: "",
    rating: null,
    platform: "Google",
    tone: "Friendly",
    business: "TurnTable Cafe",
    city: "San Diego",
    length: "medium",
    policy_apologize: true,
    policy_no_admission: true,
    policy_offer_remedy_if_low: true,
    language: "English",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [reply, setReply] = useState<string>("");
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Offline drafts + online indicator
  const { isOnline } = useDraft<Inputs>("draft:reviews", inputs, (v) => setInputs(v));

  useEffect(() => {
    try {
      const raw = localStorage.getItem("reviewResponderHistory");
      if (raw) setHistory(JSON.parse(raw));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("reviewResponderHistory", JSON.stringify(history.slice(0, 5)));
    } catch {}
  }, [history]);

  function update<K extends keyof Inputs>(key: K, value: Inputs[K]) {
    setInputs((s) => ({ ...s, [key]: value }));
  }

  const reviewChars = useMemo(() => inputs.reviewText.length, [inputs.reviewText]);

  // Cmd/Ctrl + Enter to submit
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
    setReply("");

    try {
      const res = await fetch("/api/review-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inputs),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to generate");
      const text = (data?.reply as string) || "";
      setReply(text);
      setHistory((h) => [{ ts: Date.now(), inputs, reply: text }, ...h].slice(0, 5));
      track({ ts: Date.now(), type: "review_generated" });
      push({ msg: "Reply generated", type: "success" });
    } catch (err: any) {
      push({ msg: err.message || "Something went wrong", type: "error" });
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      push({ msg: "Copied to clipboard", type: "success" });
    } catch {
      push({ msg: "Couldn’t copy—select manually.", type: "error" });
    }
  }

  function loadFromHistory(item: HistoryItem) {
    setInputs(item.inputs);
    setReply(item.reply);
    setError("");
  }

  return (
    <div className="min-h-screen w-full px-3 pb-12 pt-10 sm:px-4 md:px-8">
      <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-black/30 p-6 shadow-2xl backdrop-blur">
        <h1 className="text-center text-3xl font-semibold tracking-tight">Review Responder 💬</h1>
        <p className="mt-2 text-center text-sm text-white/70">
          Paste a customer review and generate an on-brand, platform-ready reply.
        </p>
        {!isOnline && <div className="mt-2 text-center text-xs text-amber-300">Offline — drafts auto-saved locally.</div>}

        <PresetBar name="reviews" value={inputs} onLoad={(v) => setInputs(v)} />

        <form onSubmit={onGenerate} className="mt-6 grid gap-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <label className="block text-sm text-white/80">Platform</label>
              <select
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
                value={inputs.platform}
                onChange={(e) => update("platform", e.target.value as Platform)}
              >
                <option>Google</option>
                <option>Yelp</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-white/80">Tone</label>
              <select
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
                value={inputs.tone}
                onChange={(e) => update("tone", e.target.value as Tone)}
              >
                <option>Friendly</option>
                <option>Professional</option>
                <option>Witty</option>
                <option>Warm</option>
                <option>Direct</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-white/80">Length</label>
              <select
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
                value={inputs.length}
                onChange={(e) => update("length", e.target.value as Length)}
              >
                <option value="short">Short (≤ 60 words)</option>
                <option value="medium">Medium (≤ 120 words)</option>
                <option value="long">Long (≤ 180 words)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-white/80">Language</label>
              <select
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
                value={inputs.language}
                onChange={(e) => update("language", e.target.value as Language)}
              >
                {["English", "Spanish", "Arabic"].map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="block text-sm text-white/80">Business (optional)</label>
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
                value={inputs.business || ""}
                onChange={(e) => update("business", e.target.value)}
                placeholder="TurnTable Cafe"
              />
            </div>
            <div>
              <label className="block text-sm text-white/80">City (optional)</label>
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
                value={inputs.city || ""}
                onChange={(e) => update("city", e.target.value)}
                placeholder="San Diego"
              />
            </div>
            <div>
              <label className="block text-sm text-white/80">Rating (optional)</label>
              <select
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
                value={inputs.rating === null ? "auto" : String(inputs.rating)}
                onChange={(e) =>
                  update("rating", e.target.value === "auto" ? null : (Number(e.target.value) as number))
                }
              >
                <option value="auto">Auto-detect</option>
                <option value="5">5 ★</option>
                <option value="4">4 ★</option>
                <option value="3">3 ★</option>
                <option value="2">2 ★</option>
                <option value="1">1 ★</option>
              </select>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-3">
            <label className="flex items-center gap-2 text-sm text-white/80">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={inputs.policy_apologize}
                onChange={(e) => update("policy_apologize", e.target.checked)}
              />
              Brief apology if appropriate
            </label>
            <label className="flex items-center gap-2 text-sm text-white/80">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={inputs.policy_no_admission}
                onChange={(e) => update("policy_no_admission", e.target.checked)}
              />
              No legal admission of fault
            </label>
            <label className="flex items-center gap-2 text-sm text-white/80">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={inputs.policy_offer_remedy_if_low}
                onChange={(e) => update("policy_offer_remedy_if_low", e.target.checked)}
              />
              Offer remedy if rating ≤ 3★
            </label>
          </div>

          <div>
            <label className="block text-sm text-white/80">
              Paste the customer review
              <span className="ml-2 text-xs text-white/50">
                ({reviewChars.toLocaleString()} / {MAX_CHARS.toLocaleString()} chars)
              </span>
            </label>
            <textarea
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-sm leading-6"
              rows={6}
              value={inputs.reviewText}
              onChange={(e) => update("reviewText", e.target.value)}
              placeholder="Example: The latte was great but my order took too long..."
              maxLength={MAX_CHARS}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-1 w-full rounded-xl bg-gradient-to-r from-fuchsia-500 to-purple-600 px-5 py-3 text-sm font-medium text-white transition hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? "Generating…" : "Generate Reply"}
          </button>
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

        {reply && (
          <div className="mt-6 rounded-xl border border-white/10 bg-black/30 p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Suggested Reply</h3>
              <button
                onClick={() => copy(reply)}
                className="rounded-md border border-white/10 px-3 py-1 text-xs text-white/80 transition hover:bg-white/5 hover:scale-[1.02] active:scale-[0.98]"
              >
                Copy
              </button>
            </div>
            <textarea
              className="h-56 w-full rounded-lg border border-white/10 bg-black/40 p-3 text-sm"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
            />
          </div>
        )}

        {history.length > 0 && (
          <div className="mt-8">
            <div className="mb-2 text-sm font-semibold text-white/80">Recent (last 5)</div>
            <div className="grid gap-3">
              {history.map((h) => (
                <button
                  key={h.ts}
                  onClick={() => loadFromHistory(h)}
                  className="w-full rounded-lg border border-white/10 bg-black/30 p-3 text-left text-xs text-white/80 transition hover:bg-white/5 hover:scale-[1.01] active:scale-[0.99]"
                >
                  <div className="line-clamp-1">
                    {new Date(h.ts).toLocaleString()} — {h.inputs.platform} · {h.inputs.tone} · {h.inputs.length}
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




