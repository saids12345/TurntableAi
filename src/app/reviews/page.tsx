// src/app/reviews/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useToast } from "../../components/Toast";
import Shimmer from "../../components/Shimmer";
import { PresetBar } from "../../components/Presets";
import { useDraft } from "../../lib/useDraft";
import { track } from "../../lib/track";
import ReviewInboxModal, {
  InboxReview,
} from "../../components/ReviewInboxModal";

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

type ReviewAnalysis = {
  detectedRating: number | null;
  toneLabel: string | null;
  lengthSuggestion: Length | null;
  sentimentSummary: string | null;
  issues: string[];
};

type HistoryItem = {
  ts: number;
  inputs: Inputs;
  reply: string;
  tags: string[];
  note: string;
};

type TonePreset = {
  id: string;
  label: string;
  subtitle: string;
  tone: Tone;
  length: Length;
  policy_apologize?: boolean;
  policy_no_admission?: boolean;
  policy_offer_remedy_if_low?: boolean;
};

type SavePayload = {
  reviewId: string;
  reply: string;
  tags: string[];
  note: string;
  status?: "drafted" | "approved" | "posted" | "rejected";
};

const TONE_PRESETS: TonePreset[] = [
  {
    id: "chill-cafe",
    label: "Chill café",
    subtitle: "Warm, friendly, concise",
    tone: "Warm",
    length: "short",
    policy_apologize: true,
    policy_no_admission: true,
    policy_offer_remedy_if_low: true,
  },
  {
    id: "fast-casual",
    label: "Fast casual",
    subtitle: "Direct but upbeat",
    tone: "Friendly",
    length: "medium",
    policy_apologize: true,
    policy_no_admission: true,
    policy_offer_remedy_if_low: true,
  },
  {
    id: "elevated",
    label: "Fine dining",
    subtitle: "Professional & polished",
    tone: "Professional",
    length: "medium",
    policy_apologize: true,
    policy_no_admission: true,
    policy_offer_remedy_if_low: true,
  },
];

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
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [note, setNote] = useState<string>("");
  const [activeHistoryTs, setActiveHistoryTs] = useState<number | null>(null);

  const [analysis, setAnalysis] = useState<ReviewAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // Inbox modal state
  const [inboxOpen, setInboxOpen] = useState(false);
  const [inboxItems, setInboxItems] = useState<InboxReview[]>([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxError, setInboxError] = useState<string | null>(null);

  // When a review comes from the inbox, use its id to sync to Supabase
  const [currentReviewId, setCurrentReviewId] = useState<string | null>(null);

  // Offline drafts + online indicator
  const { isOnline } = useDraft<Inputs>("draft:reviews", inputs, (v) =>
    setInputs(v)
  );

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem("reviewResponderHistory");
      if (raw) {
        const parsed = JSON.parse(raw) as HistoryItem[];

        // ensure tags / note always exist
        setHistory(
          parsed.map((h) => ({
            ts: h.ts,
            inputs: h.inputs,
            reply: h.reply,
            tags: Array.isArray(h.tags) ? h.tags : [],
            note: typeof h.note === "string" ? h.note : "",
          }))
        );
      }
    } catch {
      // ignore
    }
  }, []);

  // Persist history (keep last 5) to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        "reviewResponderHistory",
        JSON.stringify(history.slice(0, 5))
      );
    } catch {
      // ignore
    }
  }, [history]);

  function update<K extends keyof Inputs>(key: K, value: Inputs[K]) {
    setInputs((s) => ({ ...s, [key]: value }));
  }

  const reviewChars = useMemo(
    () => inputs.reviewText.length,
    [inputs.reviewText]
  );

  // helper: upsert into history by ts
  function addHistoryItem(item: HistoryItem) {
    setHistory((prev) => {
      const existingIndex = prev.findIndex((h) => h.ts === item.ts);
      if (existingIndex === -1) {
        return [item, ...prev].slice(0, 5);
      }
      const clone = [...prev];
      clone[existingIndex] = item;
      return clone;
    });
  }

  // Cmd/Ctrl + Enter to submit
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.key.toLowerCase() === "enter" &&
        !loading
      ) {
        const form = document.querySelector("form");
        (form as HTMLFormElement | null)?.dispatchEvent(
          new Event("submit", { cancelable: true, bubbles: true })
        );
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [loading]);

  // 🔍 Auto-analyze review text (debounced)
  useEffect(() => {
    if (!isOnline) {
      setAnalysis(null);
      setAnalyzing(false);
      return;
    }

    const text = inputs.reviewText.trim();
    if (!text || text.length < 30) {
      setAnalysis(null);
      setAnalyzing(false);
      return;
    }

    setAnalyzing(true);

    const timeout = window.setTimeout(async () => {
      try {
        const res = await fetch("/api/review-analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reviewText: text }),
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data?.error || "Failed to analyze");

        const normalized: ReviewAnalysis = {
          detectedRating:
            typeof data.detectedRating === "number"
              ? data.detectedRating
              : null,
          toneLabel:
            typeof data.toneLabel === "string" ? data.toneLabel : null,
          lengthSuggestion: ["short", "medium", "long"].includes(
            data.lengthSuggestion
          )
            ? (data.lengthSuggestion as Length)
            : null,
          sentimentSummary:
            typeof data.sentimentSummary === "string"
              ? data.sentimentSummary
              : null,
          issues: Array.isArray(data.issues)
            ? data.issues.filter((x: unknown) => typeof x === "string")
            : [],
        };

        setAnalysis(normalized);
      } catch {
        // silent failure
      } finally {
        setAnalyzing(false);
      }
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [inputs.reviewText, isOnline]);

  async function onGenerate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    // keep whatever tags/note user has set

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

      const tsKey = Date.now();
      const item: HistoryItem = {
        ts: tsKey,
        inputs,
        reply: text,
        tags: selectedTags,
        note,
      };

      addHistoryItem(item);
      setActiveHistoryTs(tsKey);

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
    setSelectedTags(item.tags || []);
    setNote(item.note || "");
    setActiveHistoryTs(item.ts);
    setError("");
  }

  function applyPreset(preset: TonePreset) {
    update("tone", preset.tone);
    update("length", preset.length);
    if (typeof preset.policy_apologize === "boolean") {
      update("policy_apologize", preset.policy_apologize);
    }
    if (typeof preset.policy_no_admission === "boolean") {
      update("policy_no_admission", preset.policy_no_admission);
    }
    if (typeof preset.policy_offer_remedy_if_low === "boolean") {
      update(
        "policy_offer_remedy_if_low",
        preset.policy_offer_remedy_if_low
      );
    }
    push({ msg: `Applied "${preset.label}" tone`, type: "info" });
  }

  function toggleTag(tag: string) {
    setSelectedTags((current) =>
      current.includes(tag)
        ? current.filter((t) => t !== tag)
        : [...current, tag]
    );
  }

  async function saveCurrent() {
    if (!reply.trim()) {
      push({ msg: "Generate a reply first", type: "error" });
      return;
    }

    const tsKey = activeHistoryTs ?? Date.now();
    const item: HistoryItem = {
      ts: tsKey,
      inputs,
      reply,
      tags: selectedTags,
      note,
    };

    // Local history update (instant)
    addHistoryItem(item);
    if (!activeHistoryTs) setActiveHistoryTs(tsKey);

    push({ msg: "Reply saved with notes/tags", type: "success" });
    track({ ts: Date.now(), type: "review_saved_local" });

    // If we don't know which review this belongs to, skip remote sync
    if (!currentReviewId) {
      // This happens when the user just pasted a review instead of using Inbox
      console.log("No currentReviewId, skipping Supabase sync");
      return;
    }

    // Background sync to Supabase (best-effort)
    try {
      const status: SavePayload["status"] =
        selectedTags.includes("Posted to Google") ||
        selectedTags.includes("Posted to Yelp")
          ? "posted"
          : "drafted";

      const payload: SavePayload = {
        reviewId: currentReviewId,
        reply,
        tags: selectedTags,
        note,
        status,
      };

      const res = await fetch("/api/review-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        track({ ts: Date.now(), type: "review_saved_remote" });
        return;
      }

      if (res.status === 401) {
        push({
          msg: "Signed out: local copy saved. Sign in to sync across devices.",
          type: "info",
        });
        return;
      }

      // other errors: just log
      // eslint-disable-next-line no-console
      console.error("review-save failed", await res.text());
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("review-save error", err);
    }
  }

  async function handleOpenInbox() {
    setInboxOpen(true);
    setInboxError(null);

    if (inboxItems.length > 0) return;

    setInboxLoading(true);
    try {
      const res = await fetch("/api/review-inbox", {
        method: "GET",
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data?.error || "Failed to load inbox");

      const items: InboxReview[] = Array.isArray(data?.items)
        ? (data.items as InboxReview[])
        : [];

      setInboxItems(items);
      track({ ts: Date.now(), type: "review_inbox_opened" });
    } catch (err: any) {
      setInboxError(err.message || "Failed to load inbox");
    } finally {
      setInboxLoading(false);
    }
  }

  function handleSelectInboxReview(item: InboxReview) {
    setInputs((prev) => ({
      ...prev,
      reviewText: item.review_text,
      platform: (item.platform as Platform) || prev.platform,
      rating:
        typeof item.rating === "number" ? item.rating : prev.rating ?? null,
    }));
    setReply("");
    setError("");
    setAnalysis(null);
    setSelectedTags([]);
    setNote("");
    setActiveHistoryTs(null);
    setInboxOpen(false);

    // Try to capture the review id from the inbox item
    const reviewId =
      (item as any).id ?? (item as any).review_id ?? null;
    setCurrentReviewId(reviewId);

    track({ ts: Date.now(), type: "review_inbox_inserted" });
  }

  return (
    <div className="min-h-screen w-full px-3 pb-12 pt-10 sm:px-4 md:px-8">
      <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-black/30 p-6 shadow-2xl backdrop-blur">
        <h1 className="text-center text-3xl font-semibold tracking-tight">
          Review Responder 💬
        </h1>
        <p className="mt-2 text-center text-sm text-white/70">
          Paste a customer review and generate an on-brand, platform-ready
          reply.
        </p>

        {/* Integrations CTA */}
        <div className="mt-4 flex flex-col items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-100 sm:flex-row">
          <span>
            Want automatic alerts when new Google reviews come in for your café
            or restaurant?
          </span>
          <Link
            href="/integrations"
            className="rounded-full border border-amber-400/70 bg-amber-500/20 px-3 py-1 text-[11px] font-medium uppercase tracking-wide hover:bg-amber-500/30"
          >
            Go to integrations →
          </Link>
        </div>

        {!isOnline && (
          <div className="mt-2 text-center text-xs text-amber-300">
            Offline — drafts auto-saved locally.
          </div>
        )}

        {/* AI analysis bar */}
        {(analysis || analyzing) && (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white/80">
            <span className="font-medium text-white/90">AI scan</span>

            {analysis?.toneLabel && (
              <span className="rounded-full bg-white/10 px-2 py-0.5">
                Tone: {analysis.toneLabel}
              </span>
            )}

            {analysis?.detectedRating && (
              <button
                type="button"
                onClick={() => update("rating", analysis.detectedRating)}
                className="rounded-full border border-white/20 px-2 py-0.5 hover:bg-white/10"
              >
                Use {analysis.detectedRating}★
              </button>
            )}

            {analysis?.lengthSuggestion && (
              <button
                type="button"
                onClick={() =>
                  update("length", analysis.lengthSuggestion as Length)
                }
                className="rounded-full border border-white/20 px-2 py-0.5 hover:bg-white/10"
              >
                Set {analysis.lengthSuggestion} length
              </button>
            )}

            {analysis?.issues?.length ? (
              <span className="truncate text-[11px] text-white/70">
                Issues: {analysis.issues.slice(0, 2).join(" • ")}
                {analysis.issues.length > 2 ? "…" : ""}
              </span>
            ) : null}

            <span className="ml-auto text-[11px] text-white/60">
              {analyzing ? "Analyzing…" : "Scan ready"}
            </span>
          </div>
        )}

        {/* Saved presets bar */}
        <PresetBar name="reviews" value={inputs} onLoad={(v) => setInputs(v)} />

        {/* Brand tone presets */}
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className="mt-1 text-white/60">Brand tone:</span>
          {TONE_PRESETS.map((p) => {
            const active =
              inputs.tone === p.tone && inputs.length === p.length;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p)}
                className={`flex flex-col rounded-xl border px-3 py-2 text-left transition hover:bg-white/5 ${
                  active
                    ? "border-fuchsia-400/70 bg-fuchsia-500/10"
                    : "border-white/10"
                }`}
              >
                <span className="text-[11px] font-semibold">{p.label}</span>
                <span className="text-[11px] text-white/60">
                  {p.subtitle}
                </span>
              </button>
            );
          })}
        </div>

        <form onSubmit={onGenerate} className="mt-6 grid gap-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <label className="block text-sm text-white/80">Platform</label>
              <select
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
                value={inputs.platform}
                onChange={(e) =>
                  update("platform", e.target.value as Platform)
                }
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
                onChange={(e) =>
                  update("length", e.target.value as Length)
                }
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
                onChange={(e) =>
                  update("language", e.target.value as Language)
                }
              >
                {["English", "Spanish", "Arabic"].map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="block text-sm text-white/80">
                Business (optional)
              </label>
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
                value={inputs.business || ""}
                onChange={(e) => update("business", e.target.value)}
                placeholder="TurnTable Cafe"
              />
            </div>
            <div>
              <label className="block text-sm text-white/80">
                City (optional)
              </label>
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
                value={inputs.city || ""}
                onChange={(e) => update("city", e.target.value)}
                placeholder="San Diego"
              />
            </div>
            <div>
              <label className="block text-sm text-white/80">
                Rating (optional)
              </label>
              <select
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
                value={
                  inputs.rating === null || typeof inputs.rating === "undefined"
                    ? "auto"
                    : String(inputs.rating)
                }
                onChange={(e) =>
                  update(
                    "rating",
                    e.target.value === "auto"
                      ? null
                      : (Number(e.target.value) as number)
                  )
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
                onChange={(e) =>
                  update("policy_apologize", e.target.checked)
                }
              />
              Brief apology if appropriate
            </label>
            <label className="flex items-center gap-2 text-sm text-white/80">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={inputs.policy_no_admission}
                onChange={(e) =>
                  update("policy_no_admission", e.target.checked)
                }
              />
              No legal admission of fault
            </label>
            <label className="flex items-center gap-2 text-sm text-white/80">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={inputs.policy_offer_remedy_if_low}
                onChange={(e) =>
                  update("policy_offer_remedy_if_low", e.target.checked)
                }
              />
              Offer remedy if rating ≤ 3★
            </label>
          </div>

          <div>
            <label className="block text-sm text-white/80">
              Paste the customer review
              <span className="ml-2 text-xs text-white/50">
                ({reviewChars.toLocaleString()} /{" "}
                {MAX_CHARS.toLocaleString()} chars)
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

          {/* Tag chips + note field */}
          <div className="grid gap-3 md:grid-cols-[2fr,3fr]">
            <div>
              <div className="mb-1 text-xs font-semibold text-white/70">
                Quick tags
              </div>
              <div className="flex flex-wrap gap-2 text-[11px]">
                {[
                  "Posted to Google",
                  "Posted to Yelp",
                  "Needs manager approval",
                  "Escalated to owner",
                  "Staff coaching",
                ].map((tag) => {
                  const active = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`rounded-full border px-3 py-1 transition ${
                        active
                          ? "border-fuchsia-400 bg-fuchsia-500/20"
                          : "border-white/15 bg-black/40 hover:bg-white/5"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-white/70">
                Internal note (optional)
              </label>
              <textarea
                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Example: Waiting on manager to approve a comp for this guest."
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-xl bg-gradient-to-r from-fuchsia-500 to-purple-600 px-5 py-3 text-sm font-medium text-white transition hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
            >
              {loading ? "Generating…" : "Generate Reply"}
            </button>
            <button
              type="button"
              onClick={saveCurrent}
              disabled={!reply.trim()}
              className="rounded-xl border border-white/20 bg-black/40 px-4 py-3 text-xs font-medium text-white/80 transition hover:bg-white/5 disabled:opacity-40"
            >
              Save reply + notes
            </button>
            <button
              type="button"
              onClick={handleOpenInbox}
              className="rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-xs font-medium text-white/80 transition hover:bg-white/5"
            >
              Insert from inbox
            </button>
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
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-950/30 p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {reply && (
          <div className="mt-6 rounded-xl border border-white/10 bg-black/30 p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Suggested Reply</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => copy(reply)}
                  className="rounded-md border border-white/10 px-3 py-1 text-xs text-white/80 transition hover:bg-white/5 hover:scale-[1.02] active:scale-[0.98]"
                >
                  Copy
                </button>
              </div>
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
            <div className="mb-2 text-sm font-semibold text-white/80">
              Recent (last 5)
            </div>
            <div className="grid gap-3">
              {history.map((h) => {
                const active = h.ts === activeHistoryTs;
                return (
                  <button
                    key={h.ts}
                    onClick={() => loadFromHistory(h)}
                    className={`w-full rounded-lg border bg-black/30 p-3 text-left text-xs text-white/80 transition hover:bg-white/5 hover:scale-[1.01] active:scale-[0.99] ${
                      active ? "border-fuchsia-400/70" : "border-white/10"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="line-clamp-1">
                        {new Date(h.ts).toLocaleString()} —{" "}
                        {h.inputs.platform} · {h.inputs.tone} ·{" "}
                        {h.inputs.length}
                      </div>
                      {h.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {h.tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-white/10 px-2 py-0.5 text-[10px]"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {h.note && (
                      <div className="mt-1 line-clamp-1 text-[11px] text-white/60">
                        Note: {h.note}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Inbox modal */}
        <ReviewInboxModal
          open={inboxOpen}
          onClose={() => setInboxOpen(false)}
          items={inboxItems}
          loading={inboxLoading}
          error={inboxError || undefined}
          currentPlatform={inputs.platform}
          onSelect={handleSelectInboxReview}
        />
      </div>
    </div>
  );
}


