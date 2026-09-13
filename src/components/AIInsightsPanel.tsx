"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type InsightSeverity = "low" | "medium" | "high";
type InsightType = "reputation" | "revenue" | "ops" | "growth";
type ActionStatus = "acted" | "monitoring" | "dismissed";
type ValidationStatus = "improving" | "stable" | "worse" | "insufficient_data";
type HealthStatus = "healthy" | "watch" | "risk";

type InsightItem = {
  id: string;
  type: InsightType;
  severity: InsightSeverity;
  title: string;
  summary: string;
  reason: string;
  recommendedAction: string;
  expectedImpact: string;
  href: string;
  cta: string;
};

type AIInsightsResponse = {
  generatedAt: string;
  source: "openai" | "fallback";
  signalSource?: "live" | "fallback";
  insights: InsightItem[];
  locationsAnalyzed?: number;
};

type SignalSnapshot = {
  locationName: string | null;
  avgRating: number | null;
  reviewIssueCount: number | null;
  openAlerts: number | null;
  health: HealthStatus | null;
  topIssue: string | null;
  capturedAt: string;
};

type PerformanceSnapshot = {
  locationName: string | null;
  revenue: number | null;
  orders: number | null;
  avgTicket: number | null;
  laborPct: number | null;
  marginPct: number | null;
  refunds: number | null;
  capturedAt: string;
};

type HistoryRow = {
  id: string;
  source: "openai" | "fallback";
  signal_source: "live" | "fallback";
  locations_analyzed: number;
  insight_count: number;
  payload: AIInsightsResponse;
  created_at: string;
};

type OutcomeRow = {
  id: string;
  dedupe_key: string;
  insight_title: string;
  insight_type: InsightType;
  insight_severity: InsightSeverity;
  action_status: ActionStatus;
  action_note: string;
  href: string | null;
  generated_at: string | null;
  signal_snapshot?: SignalSnapshot | null;
  performance_snapshot?: PerformanceSnapshot | null;
  created_at: string;
  updated_at: string;
};

type ValidationRow = {
  dedupeKey: string;
  insightTitle: string;
  insightType: InsightType;
  actionStatus: ActionStatus;
  validationStatus: ValidationStatus;
  validationSummary: string;
  locationName: string | null;
  updatedAt: string;
  beforeSnapshot: SignalSnapshot | null;
  currentSnapshot: {
    avgRating: number | null;
    reviewIssueCount: number | null;
    openAlerts: number | null;
    health: HealthStatus | null;
    topIssue: string | null;
  } | null;
  beforePerformanceSnapshot: PerformanceSnapshot | null;
  currentPerformanceSnapshot: PerformanceSnapshot | null;
};

type CurrentPerformanceResponse = {
  source: "live" | "fallback";
  items: PerformanceSnapshot[];
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function severityStyles(severity: InsightSeverity) {
  if (severity === "high") {
    return "border border-rose-500/20 bg-rose-500/15 text-rose-300";
  }
  if (severity === "medium") {
    return "border border-amber-500/20 bg-amber-500/15 text-amber-300";
  }
  return "border border-sky-500/20 bg-sky-500/15 text-sky-300";
}

function typeLabel(type: InsightType) {
  switch (type) {
    case "reputation":
      return "Reputation";
    case "revenue":
      return "Revenue";
    case "ops":
      return "Operations";
    case "growth":
      return "Growth";
    default:
      return "Insight";
  }
}

function actionStatusStyles(status: ActionStatus) {
  if (status === "acted") {
    return "border border-emerald-500/20 bg-emerald-500/10 text-emerald-200";
  }
  if (status === "monitoring") {
    return "border border-amber-500/20 bg-amber-500/10 text-amber-200";
  }
  return "border border-white/10 bg-white/5 text-neutral-300";
}

function actionStatusLabel(status: ActionStatus) {
  if (status === "acted") return "Acted";
  if (status === "monitoring") return "Monitoring";
  return "Dismissed";
}

function validationStatusStyles(status: ValidationStatus) {
  if (status === "improving") {
    return "border border-emerald-500/20 bg-emerald-500/10 text-emerald-200";
  }
  if (status === "stable") {
    return "border border-amber-500/20 bg-amber-500/10 text-amber-200";
  }
  if (status === "worse") {
    return "border border-rose-500/20 bg-rose-500/10 text-rose-200";
  }
  return "border border-white/10 bg-white/5 text-neutral-300";
}

function validationStatusLabel(status: ValidationStatus) {
  if (status === "improving") return "Improving";
  if (status === "stable") return "Stable";
  if (status === "worse") return "Worse";
  return "Insufficient data";
}

function healthLabel(health: HealthStatus | null | undefined) {
  if (!health) return "—";
  if (health === "healthy") return "Healthy";
  if (health === "watch") return "Watch";
  return "At Risk";
}

function formatGeneratedAt(value: string | null) {
  if (!value) return "Just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function money(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function numberText(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return String(value);
}

function pctText(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return `${value}%`;
}

function dedupeKeyForInsight(insight: InsightItem, generatedAt: string | null | undefined) {
  return `${generatedAt ?? "unknown"}::${insight.type}::${insight.title}`;
}

function InsightCardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-white/10 bg-black/25 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="h-6 w-28 rounded-full bg-white/10" />
        <div className="h-8 w-28 rounded-lg bg-white/10" />
      </div>
      <div className="h-6 w-3/4 rounded bg-white/10" />
      <div className="mt-3 h-4 w-full rounded bg-white/10" />
      <div className="mt-2 h-4 w-5/6 rounded bg-white/10" />
      <div className="mt-5 space-y-3">
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="h-3 w-28 rounded bg-white/10" />
          <div className="mt-2 h-4 w-full rounded bg-white/10" />
          <div className="mt-2 h-4 w-4/5 rounded bg-white/10" />
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="h-3 w-32 rounded bg-white/10" />
          <div className="mt-2 h-4 w-full rounded bg-white/10" />
          <div className="mt-2 h-4 w-3/4 rounded bg-white/10" />
        </div>
      </div>
    </div>
  );
}

export default function AIInsightsPanel() {
  const [data, setData] = useState<AIInsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [outcomes, setOutcomes] = useState<Record<string, OutcomeRow>>({});
  const [validations, setValidations] = useState<Record<string, ValidationRow>>({});
  const [performanceSignals, setPerformanceSignals] = useState<Record<string, PerformanceSnapshot>>({});
  const [savingOutcomeKey, setSavingOutcomeKey] = useState<string | null>(null);
  const lastSavedKeyRef = useRef<string | null>(null);

  async function loadHistory() {
    try {
      setHistoryLoading(true);
      const res = await fetch("/api/ai-insights/history?limit=5", {
        method: "GET",
        cache: "no-store",
      });

      if (!res.ok) {
        setHistory([]);
        return;
      }

      const json = (await res.json()) as { items?: HistoryRow[] };
      setHistory(Array.isArray(json.items) ? json.items : []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function loadOutcomes() {
    try {
      const res = await fetch("/api/ai-insights/outcomes?limit=50", {
        method: "GET",
        cache: "no-store",
      });

      if (!res.ok) {
        setOutcomes({});
        return;
      }

      const json = (await res.json()) as { items?: OutcomeRow[] };
      const rows = Array.isArray(json.items) ? json.items : [];
      const mapped = rows.reduce<Record<string, OutcomeRow>>((acc, row) => {
        acc[row.dedupe_key] = row;
        return acc;
      }, {});
      setOutcomes(mapped);
    } catch {
      setOutcomes({});
    }
  }

  async function loadValidation() {
    try {
      const res = await fetch("/api/ai-insights/validation", {
        method: "GET",
        cache: "no-store",
      });

      if (!res.ok) {
        setValidations({});
        return;
      }

      const json = (await res.json()) as { items?: ValidationRow[] };
      const rows = Array.isArray(json.items) ? json.items : [];
      const mapped = rows.reduce<Record<string, ValidationRow>>((acc, row) => {
        acc[row.dedupeKey] = row;
        return acc;
      }, {});
      setValidations(mapped);
    } catch {
      setValidations({});
    }
  }

  async function loadPerformanceSignals() {
    try {
      const res = await fetch("/api/performance-signals", {
        method: "GET",
        cache: "no-store",
      });

      if (!res.ok) {
        setPerformanceSignals({});
        return;
      }

      const json = (await res.json()) as CurrentPerformanceResponse;
      const mapped = (json.items || []).reduce<Record<string, PerformanceSnapshot>>((acc, row) => {
        if (row.locationName) acc[row.locationName] = row;
        return acc;
      }, {});
      setPerformanceSignals(mapped);
    } catch {
      setPerformanceSignals({});
    }
  }

  async function saveSnapshot(snapshot: AIInsightsResponse) {
    const key = JSON.stringify({
      generatedAt: snapshot.generatedAt,
      source: snapshot.source,
      signalSource: snapshot.signalSource,
      locationsAnalyzed: snapshot.locationsAnalyzed,
      titles: snapshot.insights.map((i) => i.title),
    });

    if (lastSavedKeyRef.current === key) return;

    try {
      const res = await fetch("/api/ai-insights/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snapshot),
      });

      if (res.ok) {
        lastSavedKeyRef.current = key;
        void loadHistory();
      }
    } catch {
      // silent
    }
  }

  function findPerformanceSnapshotForInsight(insight: InsightItem): PerformanceSnapshot | null {
    const haystack = [
      insight.title,
      insight.summary,
      insight.reason,
      insight.recommendedAction,
    ].join(" ").toLowerCase();

    for (const [locationName, snapshot] of Object.entries(performanceSignals)) {
      if (haystack.includes(locationName.toLowerCase())) {
        return snapshot;
      }
    }

    return null;
  }

  async function saveOutcome(insight: InsightItem, actionStatus: ActionStatus) {
    if (!data?.generatedAt) return;

    const dedupeKey = dedupeKeyForInsight(insight, data.generatedAt);
    const validation = validations[dedupeKey];
    const performanceSnapshot = findPerformanceSnapshotForInsight(insight);

    try {
      setSavingOutcomeKey(dedupeKey);

      const res = await fetch("/api/ai-insights/outcomes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dedupeKey,
          insightTitle: insight.title,
          insightType: insight.type,
          insightSeverity: insight.severity,
          actionStatus,
          href: insight.href,
          generatedAt: data.generatedAt,
          insightPayload: insight,
          signalSnapshot:
            actionStatus === "acted"
              ? validation?.beforeSnapshot ?? {
                  locationName: null,
                  avgRating: null,
                  reviewIssueCount: null,
                  openAlerts: null,
                  health: null,
                  topIssue: null,
                  capturedAt: new Date().toISOString(),
                }
              : null,
          performanceSnapshot: actionStatus === "acted" ? performanceSnapshot : null,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to save outcome");
      }

      await loadOutcomes();
      await loadValidation();
    } catch (err) {
      console.error("saveOutcome error:", err);
    } finally {
      setSavingOutcomeKey(null);
    }
  }

  async function loadInsights() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/ai-insights", {
        method: "GET",
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error("Failed to load AI insights");
      }

      const json = (await res.json()) as AIInsightsResponse;
      setData(json);

      if (Array.isArray(json.insights) && json.insights.length > 0) {
        void saveSnapshot(json);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load AI insights";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadInsights();
    void loadHistory();
    void loadOutcomes();
    void loadValidation();
    void loadPerformanceSignals();
  }, []);

  const generatedLabel = useMemo(
    () => formatGeneratedAt(data?.generatedAt ?? null),
    [data?.generatedAt]
  );

  const insightCount = data?.insights.length ?? 0;
  const highPriorityCount =
    data?.insights.filter((item) => item.severity === "high").length ?? 0;
  const locationsAnalyzed = data?.locationsAnalyzed ?? 0;
  const signalSource = data?.signalSource ?? "fallback";
  const modelSource = data?.source ?? "fallback";

  return (
    <section className="mb-8 rounded-3xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 via-sky-500/5 to-neutral-950 p-6 shadow-xl">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex items-center rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-cyan-200">
            AI Insights Engine
          </div>
          <h2 className="mt-4 text-2xl font-semibold text-white">
            What TurnTableAI thinks you should do next
          </h2>
          <p className="mt-3 text-sm leading-6 text-neutral-300 md:text-base">
            These insights are generated from current restaurant signals so operators can focus on
            the highest-leverage actions first.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4">
            <div className="text-[11px] uppercase tracking-wide text-neutral-500">Insights</div>
            <div className="mt-1 text-2xl font-semibold text-white">
              {loading ? "…" : insightCount}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4">
            <div className="text-[11px] uppercase tracking-wide text-neutral-500">High priority</div>
            <div className="mt-1 text-2xl font-semibold text-white">
              {loading ? "…" : highPriorityCount}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4">
            <div className="text-[11px] uppercase tracking-wide text-neutral-500">
              Locations analyzed
            </div>
            <div className="mt-1 text-2xl font-semibold text-white">
              {loading ? "…" : locationsAnalyzed}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4">
            <div className="text-[11px] uppercase tracking-wide text-neutral-500">Last refresh</div>
            <div className="mt-1 text-sm font-semibold text-white">
              {loading ? "Loading…" : generatedLabel}
            </div>
          </div>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void loadInsights()}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10"
        >
          Refresh AI Insights
        </button>

        {!loading && (
          <>
            <span
              className={cx(
                "rounded-full border px-3 py-1 text-xs",
                signalSource === "live"
                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
                  : "border-amber-500/20 bg-amber-500/10 text-amber-200"
              )}
            >
              Signals: {signalSource === "live" ? "Live connected data" : "Fallback signals"}
            </span>

            <span
              className={cx(
                "rounded-full border px-3 py-1 text-xs",
                modelSource === "openai"
                  ? "border-cyan-500/20 bg-cyan-500/10 text-cyan-200"
                  : "border-white/10 bg-white/5 text-neutral-300"
              )}
            >
              Reasoning: {modelSource === "openai" ? "Live AI" : "Fallback logic"}
            </span>
          </>
        )}

        {error && (
          <span className="rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-xs text-rose-200">
            {error}
          </span>
        )}
      </div>

      {loading ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <InsightCardSkeleton />
          <InsightCardSkeleton />
          <InsightCardSkeleton />
          <InsightCardSkeleton />
        </div>
      ) : data?.insights?.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {data.insights.map((item) => {
            const dedupeKey = dedupeKeyForInsight(item, data.generatedAt);
            const savedOutcome = outcomes[dedupeKey];
            const validation = validations[dedupeKey];
            const isSaving = savingOutcomeKey === dedupeKey;

            return (
              <div key={item.id} className="rounded-2xl border border-white/10 bg-black/25 p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={cx(
                        "rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide",
                        severityStyles(item.severity)
                      )}
                    >
                      {item.severity}
                    </span>
                    <span className="text-xs uppercase tracking-wide text-neutral-500">
                      {typeLabel(item.type)}
                    </span>
                  </div>

                  <Link
                    href={item.href}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 transition hover:bg-white/10"
                  >
                    {item.cta} →
                  </Link>
                </div>

                <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm text-neutral-300">{item.summary}</p>

                <div className="mt-4 space-y-3">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                      Why this matters
                    </div>
                    <div className="mt-1 text-sm text-white/90">{item.reason}</div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                      Recommended action
                    </div>
                    <div className="mt-1 text-sm text-white/90">{item.recommendedAction}</div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                      Expected impact
                    </div>
                    <div className="mt-1 text-sm text-white/90">{item.expectedImpact}</div>
                  </div>
                </div>

                <div className="mt-4 border-t border-white/10 pt-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-white">Outcome tracking</div>
                    {savedOutcome ? (
                      <span
                        className={cx(
                          "rounded-full border px-2.5 py-1 text-[11px]",
                          actionStatusStyles(savedOutcome.action_status)
                        )}
                      >
                        {actionStatusLabel(savedOutcome.action_status)}
                      </span>
                    ) : (
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-neutral-300">
                        No operator outcome yet
                      </span>
                    )}
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3">
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => void saveOutcome(item, "acted")}
                      className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200 transition hover:bg-emerald-500/15 disabled:opacity-50"
                    >
                      {isSaving ? "Saving…" : "Mark Acted"}
                    </button>

                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => void saveOutcome(item, "monitoring")}
                      className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-200 transition hover:bg-amber-500/15 disabled:opacity-50"
                    >
                      {isSaving ? "Saving…" : "Mark Monitoring"}
                    </button>

                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => void saveOutcome(item, "dismissed")}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-neutral-300 transition hover:bg-white/10 disabled:opacity-50"
                    >
                      {isSaving ? "Saving…" : "Dismiss"}
                    </button>
                  </div>

                  {validation ? (
                    <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="text-[11px] uppercase tracking-wide text-neutral-500">
                          Validation
                        </span>
                        <span
                          className={cx(
                            "rounded-full border px-2.5 py-1 text-[11px]",
                            validationStatusStyles(validation.validationStatus)
                          )}
                        >
                          {validationStatusLabel(validation.validationStatus)}
                        </span>
                        {validation.locationName ? (
                          <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[11px] text-neutral-300">
                            {validation.locationName}
                          </span>
                        ) : null}
                      </div>

                      <div className="text-sm text-white/90">{validation.validationSummary}</div>

                      <div className="mt-3 grid gap-3 xl:grid-cols-2">
                        <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                          <div className="mb-2 text-[11px] uppercase tracking-wide text-neutral-500">
                            Before ops signal
                          </div>
                          <div className="space-y-1 text-sm text-neutral-300">
                            <div>Rating: {validation.beforeSnapshot?.avgRating ?? "—"}</div>
                            <div>Review issues: {validation.beforeSnapshot?.reviewIssueCount ?? "—"}</div>
                            <div>Alerts: {validation.beforeSnapshot?.openAlerts ?? "—"}</div>
                            <div>Health: {healthLabel(validation.beforeSnapshot?.health)}</div>
                            <div>Top issue: {validation.beforeSnapshot?.topIssue ?? "—"}</div>
                          </div>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                          <div className="mb-2 text-[11px] uppercase tracking-wide text-neutral-500">
                            Current ops signal
                          </div>
                          <div className="space-y-1 text-sm text-neutral-300">
                            <div>Rating: {validation.currentSnapshot?.avgRating ?? "—"}</div>
                            <div>Review issues: {validation.currentSnapshot?.reviewIssueCount ?? "—"}</div>
                            <div>Alerts: {validation.currentSnapshot?.openAlerts ?? "—"}</div>
                            <div>Health: {healthLabel(validation.currentSnapshot?.health)}</div>
                            <div>Top issue: {validation.currentSnapshot?.topIssue ?? "—"}</div>
                          </div>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                          <div className="mb-2 text-[11px] uppercase tracking-wide text-neutral-500">
                            Before performance
                          </div>
                          <div className="space-y-1 text-sm text-neutral-300">
                            <div>Revenue: {money(validation.beforePerformanceSnapshot?.revenue)}</div>
                            <div>Orders: {numberText(validation.beforePerformanceSnapshot?.orders)}</div>
                            <div>Avg ticket: {money(validation.beforePerformanceSnapshot?.avgTicket)}</div>
                            <div>Labor %: {pctText(validation.beforePerformanceSnapshot?.laborPct)}</div>
                            <div>Margin %: {pctText(validation.beforePerformanceSnapshot?.marginPct)}</div>
                          </div>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                          <div className="mb-2 text-[11px] uppercase tracking-wide text-neutral-500">
                            Current performance
                          </div>
                          <div className="space-y-1 text-sm text-neutral-300">
                            <div>Revenue: {money(validation.currentPerformanceSnapshot?.revenue)}</div>
                            <div>Orders: {numberText(validation.currentPerformanceSnapshot?.orders)}</div>
                            <div>Avg ticket: {money(validation.currentPerformanceSnapshot?.avgTicket)}</div>
                            <div>Labor %: {pctText(validation.currentPerformanceSnapshot?.laborPct)}</div>
                            <div>Margin %: {pctText(validation.currentPerformanceSnapshot?.marginPct)}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-black/25 p-5 text-sm text-neutral-400">
          No insights available right now.
        </div>
      )}

      <div className="mt-8 rounded-3xl border border-white/10 bg-black/20 p-5">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-white">Recent AI Memory</h3>
          <p className="mt-1 text-sm text-neutral-400">
            A record of what TurnTableAI recommended recently and what it was analyzing.
          </p>
        </div>

        {historyLoading ? (
          <div className="text-sm text-neutral-400">Loading insight history…</div>
        ) : history.length > 0 ? (
          <div className="space-y-3">
            {history.map((item) => {
              const payload = item.payload;
              const firstInsight = payload?.insights?.[0];
              const historyKey = firstInsight
                ? dedupeKeyForInsight(firstInsight, payload?.generatedAt)
                : null;
              const historyOutcome = historyKey ? outcomes[historyKey] : null;
              const historyValidation = historyKey ? validations[historyKey] : null;

              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[11px] text-neutral-300">
                      {formatGeneratedAt(item.created_at)}
                    </span>
                    <span
                      className={cx(
                        "rounded-full border px-2.5 py-1 text-[11px]",
                        item.signal_source === "live"
                          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
                          : "border-amber-500/20 bg-amber-500/10 text-amber-200"
                      )}
                    >
                      {item.signal_source === "live" ? "Live signals" : "Fallback signals"}
                    </span>
                    <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[11px] text-neutral-300">
                      {item.insight_count} insights
                    </span>
                    <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[11px] text-neutral-300">
                      {item.locations_analyzed} locations
                    </span>
                    {historyOutcome ? (
                      <span
                        className={cx(
                          "rounded-full border px-2.5 py-1 text-[11px]",
                          actionStatusStyles(historyOutcome.action_status)
                        )}
                      >
                        {actionStatusLabel(historyOutcome.action_status)}
                      </span>
                    ) : null}
                    {historyValidation ? (
                      <span
                        className={cx(
                          "rounded-full border px-2.5 py-1 text-[11px]",
                          validationStatusStyles(historyValidation.validationStatus)
                        )}
                      >
                        {validationStatusLabel(historyValidation.validationStatus)}
                      </span>
                    ) : null}
                  </div>

                  <div className="text-sm font-semibold text-white">
                    {firstInsight?.title ?? "Saved insight snapshot"}
                  </div>
                  <div className="mt-1 text-sm text-neutral-400">
                    {historyValidation?.validationSummary ??
                      firstInsight?.summary ??
                      "Insight memory saved."}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-sm text-neutral-400">
            No saved AI insight history yet.
          </div>
        )}
      </div>

      <div className="mt-8 rounded-3xl border border-white/10 bg-black/20 p-5">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-white">Outcome Validation</h3>
          <p className="mt-1 text-sm text-neutral-400">
            TurnTableAI compares current live ops and performance signals against the snapshots captured when you acted.
          </p>
        </div>

        {Object.keys(validations).length > 0 ? (
          <div className="space-y-3">
            {Object.values(validations).map((item) => (
              <div key={item.dedupeKey} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span
                    className={cx(
                      "rounded-full border px-2.5 py-1 text-[11px]",
                      validationStatusStyles(item.validationStatus)
                    )}
                  >
                    {validationStatusLabel(item.validationStatus)}
                  </span>
                  <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[11px] text-neutral-300">
                    {typeLabel(item.insightType)}
                  </span>
                  {item.locationName ? (
                    <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[11px] text-neutral-300">
                      {item.locationName}
                    </span>
                  ) : null}
                  <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[11px] text-neutral-300">
                    {formatGeneratedAt(item.updatedAt)}
                  </span>
                </div>

                <div className="text-sm font-semibold text-white">{item.insightTitle}</div>
                <div className="mt-1 text-sm text-neutral-400">{item.validationSummary}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-neutral-400">
            No acted outcomes have been validated yet.
          </div>
        )}
      </div>
    </section>
  );
}