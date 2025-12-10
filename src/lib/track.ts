// src/lib/track.ts

// Keep this super simple: any string event type is allowed.
export type AnalyticEvent = {
  ts: number; // timestamp
  type: string; // event name, e.g. "review_generated", "review_saved_remote", etc.
  meta?: Record<string, unknown>;
};

const STORAGE_KEY = "ttai:events";

/**
 * Lightweight client-side tracker.
 * Writes a rolling buffer of the last ~200 events to localStorage.
 * It's just for debugging / future analytics, so we swallow all errors.
 */
export function track(event: AnalyticEvent) {
  if (typeof window === "undefined") return;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const existing: AnalyticEvent[] = raw ? JSON.parse(raw) : [];

    const next = [event, ...existing].slice(0, 200);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Don't let analytics ever crash the app
  }
}
