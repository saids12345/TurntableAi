"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

type Goal = "operations" | "reputation" | "revenue" | "growth" | "all";
type Draft = { name: string; count: string; goal: Goal };
type Identity = {
  name: string;
  expectedLocationCount: number;
  primaryGoal: Goal;
};
type SavedRestaurant = {
  id: string;
  name: string;
  expected_location_count: number;
  primary_goal: Goal;
};
type OnboardingResponse = {
  ok?: boolean;
  restaurant?: SavedRestaurant | null;
  progress?: { current_step: string; completed_at: string | null } | null;
};
type SaveState = "idle" | "unsaved" | "saving" | "saved" | "error";

const GOALS: { value: Goal; label: string; detail: string }[] = [
  { value: "operations", label: "Run smoother", detail: "Spot operational friction earlier" },
  { value: "reputation", label: "Protect reputation", detail: "Understand reviews and recurring issues" },
  { value: "revenue", label: "Improve revenue", detail: "Find opportunities in daily performance" },
  { value: "growth", label: "Grow locations", detail: "Build a repeatable playbook" },
  { value: "all", label: "See the full picture", detail: "Bring operations, reviews, and sales together" },
];

const STEPS = ["Restaurant", "Locations", "Connections", "Readiness"];

function parseDraft(draft: Draft): Identity | null {
  const name = draft.name.trim();
  const count = Number(draft.count);
  if (
    name.length < 1 || name.length > 160 ||
    /[\u0000-\u001F\u007F]/.test(name) ||
    !/^\d+$/.test(draft.count) || !Number.isInteger(count) ||
    count < 1 || count > 100
  ) return null;
  return { name, expectedLocationCount: count, primaryGoal: draft.goal };
}

export default function OnboardingClient() {
  const [draft, setDraft] = useState<Draft>({ name: "", count: "1", goal: "operations" });
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedStep, setSavedStep] = useState<string | null>(null);
  const lastSavedRef = useRef<string | null>(null);
  const latestKeyRef = useRef("");
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    const controller = new AbortController();
    setLoaded(false);
    setLoadFailed(false);

    async function load() {
      try {
        const response = await fetch("/api/onboarding", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (response.status === 401) {
          window.location.assign("/login?redirect=%2Fonboarding");
          return;
        }
        if (!response.ok) throw new Error("load_failed");
        const body = (await response.json()) as OnboardingResponse;
        if (body.ok !== true) throw new Error("load_failed");
        if (controller.signal.aborted) return;

        if (body.restaurant) {
          const value: Draft = {
            name: body.restaurant.name,
            count: String(body.restaurant.expected_location_count),
            goal: body.restaurant.primary_goal,
          };
          setDraft(value);
          const normalized = parseDraft(value);
          lastSavedRef.current = normalized ? JSON.stringify(normalized) : null;
          setSaveState("saved");
        } else {
          setDraft({ name: "", count: "1", goal: "operations" });
          lastSavedRef.current = null;
          setSaveState("idle");
        }
        setSavedStep(body.progress?.current_step ?? null);
        setLoaded(true);
      } catch {
        if (!controller.signal.aborted) setLoadFailed(true);
      }
    }

    void load();
    return () => controller.abort();
  }, [retry]);

  const persist = useCallback((value: Identity): Promise<void> => {
    const key = JSON.stringify(value);
    queueRef.current = queueRef.current.catch(() => undefined).then(async () => {
      if (lastSavedRef.current !== key) {
        const response = await fetch("/api/onboarding", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(value),
          cache: "no-store",
        });
        if (response.status === 401) {
          window.location.assign("/login?redirect=%2Fonboarding");
          throw new Error("session_expired");
        }
        if (!response.ok) throw new Error("save_failed");
        const body = (await response.json()) as OnboardingResponse;
        if (body.ok !== true) throw new Error("save_failed");
        lastSavedRef.current = key;
        setSavedStep(body.progress?.current_step ?? null);
      }
      if (latestKeyRef.current === key) setSaveState("saved");
    });
    return queueRef.current;
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const value = parseDraft(draft);
    const key = value ? JSON.stringify(value) : "";
    latestKeyRef.current = key;
    if (key && key === lastSavedRef.current) {
      setSaveState("saved");
      return;
    }
    setSaveState("unsaved");
    if (!value) return;

    const timer = window.setTimeout(() => {
      setSaveState("saving");
      void persist(value).catch(() => {
        if (latestKeyRef.current === key) setSaveState("error");
      });
    }, 850);
    return () => window.clearTimeout(timer);
  }, [draft, loaded, persist]);

  async function saveNow(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = parseDraft(draft);
    if (!value) {
      setSaveState("unsaved");
      return;
    }
    const key = JSON.stringify(value);
    latestKeyRef.current = key;
    setSaveState("saving");
    try {
      await persist(value);
    } catch {
      if (latestKeyRef.current === key) setSaveState("error");
    }
  }


  async function continueToLocations() {
    const value = parseDraft(draft);
    if (!value || saveState === "saving") return;
    const key = JSON.stringify(value);
    latestKeyRef.current = key;
    setSaveState("saving");
    try {
      await persist(value);
      window.location.assign("/onboarding/locations");
    } catch {
      if (latestKeyRef.current === key) setSaveState("error");
    }
  }

  const valid = parseDraft(draft) !== null;
  const statusText = saveState === "saving" ? "Saving securely…"
    : saveState === "saved" ? "Saved to your account"
    : saveState === "error" ? "Couldn't save. Use Save now to retry."
    : saveState === "unsaved" ? "Changes not yet saved" : "Ready to set up";

  return (
    <main className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6 lg:pt-16">
      <div className="mb-10 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">TurnTableAI / Getting started</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">Your restaurants, one clear view.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400 sm:text-base">
            Tell us about your business. We'll tailor your setup before connecting any live data.
          </p>
        </div>
        <Link href="/billing" className="rounded-full border border-white/15 px-4 py-2 text-sm text-neutral-300 transition hover:border-white/40 hover:text-white">Billing &amp; account</Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[245px_minmax(0,1fr)]">
        <aside className="h-fit rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Your setup</p>
          <ol className="space-y-5">
            {STEPS.map((step, index) => (
              <li key={step} className="flex items-start gap-3">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${index === 0 ? "bg-cyan-300 text-neutral-950" : "border border-white/15 text-neutral-500"}`}>{index + 1}</span>
                <div>
                  <p className={`text-sm font-medium ${index === 0 ? "text-white" : "text-neutral-500"}`}>{step}</p>
                  <p className="mt-1 text-xs text-neutral-500">{index === 0 ? "Current step" : "Up next"}</p>
                </div>
              </li>
            ))}
          </ol>
          {savedStep && savedStep !== "restaurant" && (
            <p className="mt-6 rounded-xl border border-cyan-300/15 bg-cyan-300/5 p-3 text-xs leading-5 text-cyan-100/80">
              Your account has saved setup progress. Your previous selections remain intact.
            </p>
          )}
        </aside>

        <section className="overflow-hidden rounded-3xl border border-white/10 bg-neutral-950/80 shadow-2xl shadow-black/20">
          <div className="border-b border-white/10 bg-gradient-to-r from-cyan-400/10 via-indigo-400/5 to-transparent p-6 sm:p-9">
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-200">Step 1 of 4</span>
              <span className="text-xs text-neutral-400">About 1 minute</span>
            </div>
            <h2 className="mt-5 text-2xl font-semibold tracking-tight sm:text-3xl">Tell us about your restaurant group</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-neutral-400">
              Start with a few basics. You can change these details later.
            </p>
          </div>

          {!loaded ? (
            <div className="p-8" role="status" aria-live="polite">
              {loadFailed ? (
                <div>
                  <h3 className="font-medium">We couldn't load your setup.</h3>
                  <p className="mt-2 text-sm text-neutral-400">Your saved details haven't been changed.</p>
                  <button type="button" onClick={() => setRetry(value => value + 1)} className="mt-5 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black">Try again</button>
                </div>
              ) : <p className="text-sm text-neutral-400">Loading your saved restaurant details…</p>}
            </div>
          ) : (
            <form onSubmit={saveNow} className="space-y-8 p-6 sm:p-9">
              <div>
                <label htmlFor="restaurant-name" className="block text-sm font-medium text-white">Restaurant or group name</label>
                <p className="mt-1 text-xs text-neutral-400">Use the name you recognize across your locations.</p>
                <input id="restaurant-name" autoComplete="organization" required maxLength={160} value={draft.name} onChange={event => setDraft(previous => ({ ...previous, name: event.target.value }))} placeholder="e.g. Harbor Coffee Group" className="mt-3 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder:text-neutral-600 focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/20" />
              </div>

              <div>
                <label htmlFor="location-count" className="block text-sm font-medium text-white">How many locations do you operate?</label>
                <p className="mt-1 text-xs text-neutral-400">An estimate is fine. You'll add each location individually next.</p>
                <div className="mt-3 flex max-w-xs items-center gap-3">
                  <input id="location-count" type="number" inputMode="numeric" min={1} max={100} step={1} required value={draft.count} onChange={event => setDraft(previous => ({ ...previous, count: event.target.value }))} className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white focus:border-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300/20" />
                  <span className="text-sm text-neutral-400">locations</span>
                </div>
              </div>

              <fieldset>
                <legend className="text-sm font-medium text-white">What's most important to improve first?</legend>
                <p className="mt-1 text-xs text-neutral-400">This helps us personalize the setup, not limit your features.</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {GOALS.map(item => (
                    <label key={item.value} className={`cursor-pointer rounded-xl border p-4 transition focus-within:ring-2 focus-within:ring-cyan-300/40 ${draft.goal === item.value ? "border-cyan-300/60 bg-cyan-300/10" : "border-white/10 bg-white/[0.02] hover:border-white/25"}`}>
                      <span className="flex items-start gap-3">
                        <input type="radio" name="restaurant-goal" value={item.value} checked={draft.goal === item.value} onChange={() => setDraft(previous => ({ ...previous, goal: item.value }))} className="mt-1 accent-cyan-300" />
                        <span>
                          <span className="block text-sm font-medium text-white">{item.label}</span>
                          <span className="mt-1 block text-xs leading-5 text-neutral-400">{item.detail}</span>
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6">
                <p role={saveState === "error" ? "alert" : "status"} aria-live="polite" className={`text-sm ${saveState === "error" ? "text-rose-300" : saveState === "saved" ? "text-emerald-300" : "text-neutral-400"}`}>
                  {statusText}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <button type="submit" disabled={!valid || saveState === "saving"} className="rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold text-neutral-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40">
                    Save now
                  </button>
                  <button type="button" onClick={() => void continueToLocations()} disabled={!valid || saveState === "saving"} className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-40">
                    Save &amp; continue to locations
                  </button>
                </div>
              </div>
              <p className="text-xs leading-5 text-neutral-500">Valid changes save automatically after a short pause. Continue saves your latest selections before moving to the next step.</p>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
