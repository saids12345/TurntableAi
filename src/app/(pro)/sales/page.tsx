"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  buildSnapshotHash,
  markPerformanceSnapshotsCaptured,
  normalizePerformanceSnapshots,
  shouldCapturePerformanceSnapshots,
  type PerformanceSignalSnapshot,
} from "@/lib/performanceSignals";
import { track } from "@/lib/track";

type HealthStatus = "healthy" | "watch" | "risk";
type PerfSeverity = "low" | "medium" | "high";
type PriorityLabel = "urgent" | "high" | "normal" | "low";

type LocationPerformance = {
  id: string;
  name: string;
  city: string;
  health: HealthStatus;
  revenueToday: number;
  revenueDeltaPct: number;
  ordersToday: number;
  ordersDeltaPct: number;
  aov: number;
  aovDeltaPct: number;
  laborPct: number;
  marginPct: number;
  avgRating: number;
  refunds?: number;
  topIssue: string | null;
  recommendedAction: string | null;
};

type PerformanceAlert = {
  id: string;
  locationName: string;
  severity: PerfSeverity;
  type: "revenue" | "aov" | "labor" | "margin" | "reviews";
  title: string;
  description: string;
  priorityScore?: number;
  priorityLabel?: PriorityLabel;
  priorityReason?: string;
};

type PerformanceAction = {
  id: string;
  locationName: string;
  title: string;
  reason: string;
  status: "pending" | "in_progress" | "done";
  priorityScore?: number;
  priorityLabel?: PriorityLabel;
  priorityReason?: string;
};

const SEED_LOCATIONS: LocationPerformance[] = [
  {
    id: "perf_1",
    name: "Mira Mesa",
    city: "San Diego",
    health: "risk",
    revenueToday: 3825,
    revenueDeltaPct: -9,
    ordersToday: 188,
    ordersDeltaPct: -7,
    aov: 20.35,
    aovDeltaPct: -2,
    laborPct: 26,
    marginPct: 58,
    avgRating: 3.9,
    refunds: 72,
    topIssue: "Revenue and lunch traffic are both slipping.",
    recommendedAction: "Launch lunch recovery promo and review labor coverage.",
  },
  {
    id: "perf_2",
    name: "Chula Vista",
    city: "San Diego",
    health: "healthy",
    revenueToday: 4410,
    revenueDeltaPct: 3,
    ordersToday: 219,
    ordersDeltaPct: 2,
    aov: 20.14,
    aovDeltaPct: 1,
    laborPct: 19,
    marginPct: 64,
    avgRating: 4.6,
    refunds: 18,
    topIssue: null,
    recommendedAction: "No action needed.",
  },
  {
    id: "perf_3",
    name: "Escondido",
    city: "San Diego",
    health: "watch",
    revenueToday: 3990,
    revenueDeltaPct: -4,
    ordersToday: 201,
    ordersDeltaPct: -3,
    aov: 19.85,
    aovDeltaPct: -1,
    laborPct: 22,
    marginPct: 61,
    avgRating: 4.1,
    refunds: 36,
    topIssue: "Service pressure is affecting reviews and conversion.",
    recommendedAction: "Approve replies and tighten shift execution.",
  },
  {
    id: "perf_4",
    name: "La Jolla",
    city: "San Diego",
    health: "healthy",
    revenueToday: 5120,
    revenueDeltaPct: 6,
    ordersToday: 246,
    ordersDeltaPct: 5,
    aov: 20.81,
    aovDeltaPct: 1,
    laborPct: 18,
    marginPct: 67,
    avgRating: 4.7,
    refunds: 12,
    topIssue: null,
    recommendedAction: "Test a high-margin upsell offer.",
  },
];

const SEED_ALERTS: PerformanceAlert[] = [
  {
    id: "pa_1",
    locationName: "Mira Mesa",
    severity: "high",
    type: "revenue",
    title: "Revenue down 9%",
    description: "Largest sales drop in the group compared to same day last week.",
    priorityScore: 88,
    priorityLabel: "urgent",
    priorityReason: "double-digit revenue decline, labor materially above target",
  },
  {
    id: "pa_2",
    locationName: "Mira Mesa",
    severity: "high",
    type: "labor",
    title: "Labor above target",
    description: "Labor is at 26%, above the target operating range.",
    priorityScore: 79,
    priorityLabel: "high",
    priorityReason: "labor materially above target, location at risk",
  },
  {
    id: "pa_3",
    locationName: "Escondido",
    severity: "medium",
    type: "reviews",
    title: "Service pressure affecting conversion",
    description: "Negative review trend aligns with lower order volume.",
    priorityScore: 56,
    priorityLabel: "high",
    priorityReason: "guest friction detected, location on watch",
  },
  {
    id: "pa_4",
    locationName: "La Jolla",
    severity: "low",
    type: "margin",
    title: "Margin leader",
    description: "Highest margin in the group. Strong candidate for upsell testing.",
    priorityScore: 14,
    priorityLabel: "low",
    priorityReason: "stable margin-positive opportunity",
  },
];

const SEED_ACTIONS: PerformanceAction[] = [
  {
    id: "pact_1",
    locationName: "Mira Mesa",
    title: "Reduce lunch-hour labor waste",
    reason: "High labor % and lower revenue are compressing performance.",
    status: "pending",
    priorityScore: 82,
    priorityLabel: "urgent",
    priorityReason: "not acted on yet, labor materially above target, revenue decline",
  },
  {
    id: "pact_2",
    locationName: "Mira Mesa",
    title: "Run lunch recovery campaign",
    reason: "Revenue and orders both declined versus baseline.",
    status: "pending",
    priorityScore: 78,
    priorityLabel: "high",
    priorityReason: "not acted on yet, strong revenue decline, orders dropping",
  },
  {
    id: "pact_3",
    locationName: "Escondido",
    title: "Fix service bottlenecks",
    reason: "Review pressure suggests operational drag during rush periods.",
    status: "in_progress",
    priorityScore: 49,
    priorityLabel: "normal",
    priorityReason: "guest friction detected, already in progress",
  },
  {
    id: "pact_4",
    locationName: "La Jolla",
    title: "Promote top-margin item",
    reason: "Strong stability makes this the safest test location.",
    status: "done",
    priorityScore: 12,
    priorityLabel: "low",
    priorityReason: "completed growth test",
  },
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function num(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function asHealth(value: unknown): HealthStatus {
  return value === "healthy" || value === "watch" || value === "risk" ? value : "watch";
}

function asSeverity(value: unknown): PerfSeverity {
  return value === "low" || value === "medium" || value === "high" ? value : "medium";
}

function asActionStatus(value: unknown): PerformanceAction["status"] {
  return value === "pending" || value === "in_progress" || value === "done"
    ? value
    : "pending";
}

function asAlertType(value: unknown): PerformanceAlert["type"] {
  return value === "revenue" ||
    value === "aov" ||
    value === "labor" ||
    value === "margin" ||
    value === "reviews"
    ? value
    : "revenue";
}

function asPriorityLabel(value: unknown): PriorityLabel {
  return value === "urgent" || value === "high" || value === "normal" || value === "low"
    ? value
    : "normal";
}

function money(value: number) {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function pct(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value}%`;
}

function healthStyles(health: HealthStatus) {
  if (health === "healthy") {
    return {
      badge: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20",
      label: "Healthy",
    };
  }
  if (health === "watch") {
    return {
      badge: "bg-amber-500/15 text-amber-300 border border-amber-500/20",
      label: "Watch",
    };
  }
  return {
    badge: "bg-rose-500/15 text-rose-300 border border-rose-500/20",
    label: "At Risk",
  };
}

function severityStyles(severity: PerfSeverity) {
  if (severity === "high") {
    return "bg-rose-500/15 text-rose-300 border border-rose-500/20";
  }
  if (severity === "medium") {
    return "bg-amber-500/15 text-amber-300 border border-amber-500/20";
  }
  return "bg-sky-500/15 text-sky-300 border border-sky-500/20";
}

function actionStatusStyles(status: PerformanceAction["status"]) {
  if (status === "done") {
    return "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20";
  }
  if (status === "in_progress") {
    return "bg-amber-500/15 text-amber-300 border border-amber-500/20";
  }
  return "bg-white/10 text-white/80 border border-white/10";
}

function priorityStyles(priority?: PriorityLabel) {
  if (priority === "urgent") {
    return "border border-rose-500/30 bg-rose-500/15 text-rose-200";
  }
  if (priority === "high") {
    return "border border-amber-500/30 bg-amber-500/15 text-amber-200";
  }
  if (priority === "normal") {
    return "border border-sky-500/30 bg-sky-500/15 text-sky-200";
  }
  return "border border-white/10 bg-white/10 text-white/70";
}

function SummaryCard(props: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-900/50 p-4 shadow-sm">
      <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-400">
        {props.label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-white">{props.value}</div>
      {props.sub ? <div className="mt-1 text-sm text-neutral-500">{props.sub}</div> : null}
    </div>
  );
}

function SectionHeader(props: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-lg font-semibold text-white">{props.title}</h2>
        {props.subtitle ? <p className="mt-1 text-sm text-neutral-400">{props.subtitle}</p> : null}
      </div>
      {props.right ? <div className="shrink-0">{props.right}</div> : null}
    </div>
  );
}

function sortLocations(
  items: LocationPerformance[],
  sortBy: "risk" | "revenue" | "labor"
): LocationPerformance[] {
  const rank = { risk: 0, watch: 1, healthy: 2 };

  return [...items].sort((a, b) => {
    if (sortBy === "revenue") return a.revenueDeltaPct - b.revenueDeltaPct;
    if (sortBy === "labor") return b.laborPct - a.laborPct;
    return rank[a.health] - rank[b.health];
  });
}

function deriveAlertTypeFromLocation(location: LocationPerformance): PerformanceAlert["type"] {
  if (location.laborPct > 22) return "labor";
  if (location.aovDeltaPct < 0) return "aov";
  if (location.marginPct >= 65) return "margin";
  if (
    (location.avgRating ?? 5) < 4.2 ||
    (location.topIssue ?? "").toLowerCase().includes("review")
  ) {
    return "reviews";
  }
  return "revenue";
}

function buildFallbackAlerts(locations: LocationPerformance[]): PerformanceAlert[] {
  return locations.slice(0, 4).map((location, index) => ({
    id: `live-alert-${location.id}-${index}`,
    locationName: location.name,
    severity: location.health === "risk" ? "high" : location.health === "watch" ? "medium" : "low",
    type: deriveAlertTypeFromLocation(location),
    title:
      location.health === "risk"
        ? "Performance risk detected"
        : location.health === "watch"
        ? "Watch this location closely"
        : "Stable performance",
    description:
      location.topIssue ??
      location.recommendedAction ??
      "Monitor this location’s current KPI trend.",
    priorityScore: location.health === "risk" ? 75 : location.health === "watch" ? 45 : 15,
    priorityLabel: location.health === "risk" ? "high" : location.health === "watch" ? "normal" : "low",
    priorityReason:
      location.health === "risk"
        ? "location at risk"
        : location.health === "watch"
        ? "location on watch"
        : "stable performance",
  }));
}

function buildFallbackActions(locations: LocationPerformance[]): PerformanceAction[] {
  return locations.slice(0, 6).map((location, index) => ({
    id: `live-action-${location.id}-${index}`,
    locationName: location.name,
    title:
      location.health === "risk"
        ? "Intervene on KPI decline"
        : location.health === "watch"
        ? "Monitor and tighten execution"
        : "Run a low-risk growth test",
    reason:
      location.recommendedAction ??
      location.topIssue ??
      "Review this location and decide the next best operator move.",
    status:
      location.health === "risk"
        ? "pending"
        : location.health === "watch"
        ? "in_progress"
        : "done",
    priorityScore: location.health === "risk" ? 78 : location.health === "watch" ? 44 : 10,
    priorityLabel: location.health === "risk" ? "high" : location.health === "watch" ? "normal" : "low",
    priorityReason:
      location.health === "risk"
        ? "not acted on yet"
        : location.health === "watch"
        ? "monitoring recommended"
        : "completed or low urgency",
  }));
}

function normalizeLocationPerformance(input: unknown, index: number): LocationPerformance | null {
  if (!input || typeof input !== "object") return null;
  const row = input as Record<string, unknown>;

  const name = text(row.name || row.locationName);
  if (!name) return null;

  const revenueToday = num(row.revenueToday ?? row.revenue ?? row.salesToday, 0);
  const ordersToday = num(row.ordersToday ?? row.orders, 0);
  const aov = num(row.aov ?? row.avgTicket ?? row.avg_ticket, 0);
  const laborPct = num(row.laborPct ?? row.labor_pct, 0);
  const marginPct = num(row.marginPct ?? row.margin_pct, 0);
  const avgRating = num(row.avgRating ?? row.avg_rating, 0);

  return {
    id: text(row.id, `live-perf-${index + 1}`),
    name,
    city: text(row.city, "San Diego"),
    health: asHealth(row.health),
    revenueToday,
    revenueDeltaPct: num(row.revenueDeltaPct ?? row.salesDeltaPct, 0),
    ordersToday,
    ordersDeltaPct: num(row.ordersDeltaPct, 0),
    aov,
    aovDeltaPct: num(row.aovDeltaPct ?? row.avgTicketDeltaPct, 0),
    laborPct,
    marginPct,
    avgRating,
    refunds: num(row.refunds, 0),
    topIssue: text(row.topIssue, "") || null,
    recommendedAction: text(row.recommendedAction, "") || null,
  };
}

function normalizePerformanceAlert(input: unknown, index: number): PerformanceAlert | null {
  if (!input || typeof input !== "object") return null;
  const row = input as Record<string, unknown>;

  const title = text(row.title);
  const locationName = text(row.locationName ?? row.location_name);
  if (!title || !locationName) return null;

  return {
    id: text(row.id, `perf-alert-${index + 1}`),
    locationName,
    severity: asSeverity(row.severity),
    type: asAlertType(row.type),
    title,
    description: text(row.description, "Review this KPI signal."),
    priorityScore: num(row.priorityScore, 0),
    priorityLabel: asPriorityLabel(row.priorityLabel),
    priorityReason: text(row.priorityReason, ""),
  };
}

function normalizePerformanceAction(input: unknown, index: number): PerformanceAction | null {
  if (!input || typeof input !== "object") return null;
  const row = input as Record<string, unknown>;

  const title = text(row.title);
  const locationName = text(row.locationName ?? row.location_name);
  if (!title || !locationName) return null;

  return {
    id: text(row.id, `perf-action-${index + 1}`),
    locationName,
    title,
    reason: text(row.reason, "Review this action."),
    status: asActionStatus(row.status),
    priorityScore: num(row.priorityScore, 0),
    priorityLabel: asPriorityLabel(row.priorityLabel),
    priorityReason: text(row.priorityReason, ""),
  };
}

export default function PerformanceMonitorPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [sortBy, setSortBy] = useState<"risk" | "revenue" | "labor">("risk");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [captureStatus, setCaptureStatus] = useState<
    "idle" | "saving" | "saved" | "skipped" | "error"
  >("idle");

  const [liveLocations, setLiveLocations] = useState<LocationPerformance[]>([]);
  const [liveAlerts, setLiveAlerts] = useState<PerformanceAlert[]>([]);
  const [liveActions, setLiveActions] = useState<PerformanceAction[]>([]);
  const [signalsLoading, setSignalsLoading] = useState(true);
  const [signalsError, setSignalsError] = useState<string | null>(null);

  const didAttemptCaptureRef = useRef(false);
  const locationRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const hasAutoScrolledRef = useRef(false);
  const hasHydratedFromUrlRef = useRef(false);

  useEffect(() => {
    const sort = searchParams.get("sort");
    const location = searchParams.get("location");

    if (sort === "risk" || sort === "revenue" || sort === "labor") {
      setSortBy(sort);
    } else {
      setSortBy("risk");
    }

    if (location?.trim()) {
      setLocationFilter(location);
    } else {
      setLocationFilter("all");
    }

    hasHydratedFromUrlRef.current = true;
  }, [searchParams]);

  useEffect(() => {
    if (!hasHydratedFromUrlRef.current) return;

    const params = new URLSearchParams(searchParams.toString());

    if (sortBy === "risk") {
      params.delete("sort");
    } else {
      params.set("sort", sortBy);
    }

    if (locationFilter === "all") {
      params.delete("location");
    } else {
      params.set("location", locationFilter);
    }

    const next = params.toString();
    const current = searchParams.toString();

    if (next !== current) {
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    }
  }, [sortBy, locationFilter, pathname, router, searchParams]);

  useEffect(() => {
    async function loadLiveSnapshot() {
      try {
        setSignalsLoading(true);
        setSignalsError(null);

        const res = await fetch("/api/operator-snapshot/performance", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        });

        if (!res.ok) {
          const textBody = await res.text();
          throw new Error(textBody || "Failed to load operator snapshot");
        }

        const json = (await res.json()) as Record<string, unknown>;

        const rawLocations =
          (Array.isArray(json.performanceLocations) ? json.performanceLocations : null) ??
          (Array.isArray(json.locations) ? json.locations : null) ??
          [];

        const rawAlerts =
          (Array.isArray(json.performanceAlerts) ? json.performanceAlerts : null) ??
          (Array.isArray(json.alerts) ? json.alerts : null) ??
          [];

        const rawActions =
          (Array.isArray(json.performanceActions) ? json.performanceActions : null) ??
          (Array.isArray(json.actions) ? json.actions : null) ??
          [];

        const mappedLocations = rawLocations
          .map((item, index) => normalizeLocationPerformance(item, index))
          .filter((item): item is LocationPerformance => item !== null);

        const mappedAlerts = rawAlerts
          .map((item, index) => normalizePerformanceAlert(item, index))
          .filter((item): item is PerformanceAlert => item !== null);

        const mappedActions = rawActions
          .map((item, index) => normalizePerformanceAction(item, index))
          .filter((item): item is PerformanceAction => item !== null);

        if (mappedLocations.length > 0) {
          setLiveLocations(mappedLocations);
          setLiveAlerts(
            mappedAlerts.length > 0 ? mappedAlerts : buildFallbackAlerts(mappedLocations)
          );
          setLiveActions(
            mappedActions.length > 0 ? mappedActions : buildFallbackActions(mappedLocations)
          );
        } else {
          setLiveLocations([]);
          setLiveAlerts([]);
          setLiveActions([]);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to load live performance snapshot";
        setSignalsError(message);
        setLiveLocations([]);
        setLiveAlerts([]);
        setLiveActions([]);
      } finally {
        setSignalsLoading(false);
      }
    }

    void loadLiveSnapshot();
  }, []);

  const boardLocations = useMemo(() => {
    return liveLocations.length > 0 ? liveLocations : SEED_LOCATIONS;
  }, [liveLocations]);

  const boardAlerts = useMemo(() => {
    if (liveLocations.length > 0) {
      return liveAlerts.length > 0 ? liveAlerts : buildFallbackAlerts(liveLocations);
    }
    return SEED_ALERTS;
  }, [liveAlerts, liveLocations]);

  const boardActions = useMemo(() => {
    if (liveLocations.length > 0) {
      return liveActions.length > 0 ? liveActions : buildFallbackActions(liveLocations);
    }
    return SEED_ACTIONS;
  }, [liveActions, liveLocations]);

  const summary = useMemo(() => {
    const atRisk = boardLocations.filter((l) => l.health === "risk").length;
    const avgRevenueDelta =
      boardLocations.length > 0
        ? Math.round(
            (boardLocations.reduce((sum, l) => sum + l.revenueDeltaPct, 0) /
              boardLocations.length) *
              10
          ) / 10
        : 0;
    const highAlerts = boardAlerts.filter((a) => a.severity === "high").length;
    const pendingActions = boardActions.filter((a) => a.status === "pending").length;

    return { atRisk, avgRevenueDelta, highAlerts, pendingActions };
  }, [boardLocations, boardAlerts, boardActions]);

  const filteredLocations = useMemo(() => {
    if (locationFilter === "all") return boardLocations;
    return boardLocations.filter((location) => location.name === locationFilter);
  }, [boardLocations, locationFilter]);

  const sortedLocations = useMemo(() => {
    return sortLocations(filteredLocations, sortBy);
  }, [filteredLocations, sortBy]);

  const matchedLocation = useMemo(() => {
    if (locationFilter === "all") return null;
    return boardLocations.find((location) => location.name === locationFilter) ?? null;
  }, [boardLocations, locationFilter]);

  const topPerformer = useMemo(() => {
    return [...boardLocations].sort((a, b) => b.marginPct - a.marginPct)[0] ?? boardLocations[0];
  }, [boardLocations]);

  const autoCaptureSnapshots = useMemo<PerformanceSignalSnapshot[]>(() => {
    return normalizePerformanceSnapshots(
      boardLocations.map((location) => ({
        locationName: location.name,
        revenue: location.revenueToday,
        orders: location.ordersToday,
        avgTicket: location.aov,
        laborPct: location.laborPct,
        marginPct: location.marginPct,
        refunds: location.refunds ?? null,
        capturedAt: new Date().toISOString(),
      }))
    );
  }, [boardLocations]);

  useEffect(() => {
    async function autoCapture() {
      if (didAttemptCaptureRef.current) return;
      if (boardLocations.length === 0) return;

      didAttemptCaptureRef.current = true;

      const decision = shouldCapturePerformanceSnapshots({
        items: autoCaptureSnapshots,
        minIntervalMs: 30 * 60 * 1000,
      });

      if (!decision.ok) {
        setCaptureStatus("skipped");
        return;
      }

      const itemsToCapture = decision.items ?? [];

      try {
        setCaptureStatus("saving");

        const res = await fetch("/api/performance-signals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: itemsToCapture }),
        });

        if (!res.ok) {
          throw new Error("Failed to auto-capture performance snapshots");
        }

        const hash = buildSnapshotHash(itemsToCapture);
        markPerformanceSnapshotsCaptured(hash);

        track({
          ts: Date.now(),
          type: "performance_snapshot_saved",
          meta: {
            locations: itemsToCapture.length,
          },
        });

        setCaptureStatus("saved");
      } catch (error) {
        console.error("performance auto-capture error:", error);
        setCaptureStatus("error");
      }
    }

    void autoCapture();
  }, [autoCaptureSnapshots, boardLocations]);

  useEffect(() => {
    if (!matchedLocation || hasAutoScrolledRef.current) return;

    const node = locationRefs.current[matchedLocation.id];
    if (!node) return;

    const timer = window.setTimeout(() => {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
      hasAutoScrolledRef.current = true;
    }, 250);

    return () => window.clearTimeout(timer);
  }, [matchedLocation, sortedLocations]);

  function clearFocus() {
    setLocationFilter("all");
    setSortBy("risk");
    hasAutoScrolledRef.current = false;
  }

  return (
    <div className="min-h-screen w-full px-4 pb-12 pt-8 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 rounded-3xl border border-white/10 bg-gradient-to-br from-neutral-900 via-neutral-950 to-black p-6 shadow-2xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-300">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
                Performance Operations
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-white md:text-4xl">
                Performance Monitor
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-400 md:text-base">
                Monitor revenue, orders, average ticket, labor pressure, and margin performance
                across every location from one operator view.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-200">
                  Auto-capture: KPI memory enabled
                </span>

                {signalsLoading && (
                  <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs text-amber-200">
                    Loading live performance…
                  </span>
                )}

                {!signalsLoading && !signalsError && liveLocations.length > 0 && (
                  <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
                    Live performance snapshot loaded
                  </span>
                )}

                {signalsError && (
                  <span className="rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-xs text-rose-200">
                    Using fallback performance data
                  </span>
                )}

                {locationFilter !== "all" && (
                  <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs text-violet-200">
                    Focus: {locationFilter}
                  </span>
                )}

                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-300">
                  Sort: {sortBy}
                </span>

                {captureStatus === "saving" && (
                  <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs text-amber-200">
                    Saving performance snapshot…
                  </span>
                )}

                {captureStatus === "saved" && (
                  <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
                    Performance snapshot saved
                  </span>
                )}

                {captureStatus === "skipped" && (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-300">
                    No new snapshot needed yet
                  </span>
                )}

                {captureStatus === "error" && (
                  <span className="rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-xs text-rose-200">
                    Snapshot save failed
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={clearFocus}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10"
              >
                Clear Focus
              </button>
              <Link
                href="/command-center"
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 transition hover:bg-white/10"
              >
                Back to Command Center
              </Link>
              <Link
                href="/reviews"
                className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:scale-[1.02]"
              >
                Open Reviews →
              </Link>
            </div>
          </div>
        </div>

        {signalsError ? (
          <div className="mb-6 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">
            {signalsError}
          </div>
        ) : null}

        <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="At-risk locations"
            value={summary.atRisk}
            sub="Highest operator priority"
          />
          <SummaryCard
            label="Avg revenue trend"
            value={pct(summary.avgRevenueDelta)}
            sub="Across all locations"
          />
          <SummaryCard
            label="High alerts"
            value={summary.highAlerts}
            sub="Needs action now"
          />
          <SummaryCard
            label="Pending actions"
            value={summary.pendingActions}
            sub="Not completed yet"
          />
        </div>

        <section className="mb-8 rounded-3xl border border-white/10 bg-neutral-950/60 p-5 shadow-xl">
          <div className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
            <div>
              <SectionHeader
                title="Today’s Performance Snapshot"
                subtitle="Use this to quickly spot which locations are helping or hurting the group."
              />

              <div className="grid gap-4 md:grid-cols-2">
                <div
                  className={cx(
                    "rounded-2xl border p-4",
                    matchedLocation?.id === sortedLocations[0]?.id
                      ? "border-violet-400/40 bg-violet-500/10"
                      : "border-white/10 bg-neutral-900/50"
                  )}
                >
                  <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                    Biggest risk today
                  </div>
                  <div className="mt-2 text-lg font-semibold text-white">
                    {sortedLocations[0]?.name ?? "—"}
                  </div>
                  <div className="mt-1 text-sm text-neutral-400">
                    {sortedLocations[0]?.topIssue ??
                      sortedLocations[0]?.recommendedAction ??
                      "No issue detected."}
                  </div>
                </div>

                <div
                  className={cx(
                    "rounded-2xl border p-4",
                    matchedLocation?.id === topPerformer?.id
                      ? "border-violet-400/40 bg-violet-500/10"
                      : "border-white/10 bg-neutral-900/50"
                  )}
                >
                  <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                    Strongest location
                  </div>
                  <div className="mt-2 text-lg font-semibold text-white">
                    {topPerformer?.name ?? "—"}
                  </div>
                  <div className="mt-1 text-sm text-neutral-400">
                    {topPerformer ? `Highest margin in the group at ${topPerformer.marginPct}%.` : "—"}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-neutral-900/50 p-4">
              <div className="mb-3 text-sm font-semibold text-white">Sort location board</div>
              <div className="grid gap-3">
                <button
                  onClick={() => setSortBy("risk")}
                  className={cx(
                    "rounded-xl border px-4 py-2 text-sm transition",
                    sortBy === "risk"
                      ? "border-violet-400/50 bg-violet-500/10 text-white"
                      : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
                  )}
                >
                  Sort by risk
                </button>
                <button
                  onClick={() => setSortBy("revenue")}
                  className={cx(
                    "rounded-xl border px-4 py-2 text-sm transition",
                    sortBy === "revenue"
                      ? "border-violet-400/50 bg-violet-500/10 text-white"
                      : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
                  )}
                >
                  Sort by revenue trend
                </button>
                <button
                  onClick={() => setSortBy("labor")}
                  className={cx(
                    "rounded-xl border px-4 py-2 text-sm transition",
                    sortBy === "labor"
                      ? "border-violet-400/50 bg-violet-500/10 text-white"
                      : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
                  )}
                >
                  Sort by labor %
                </button>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.5fr,1fr]">
          <section className="rounded-3xl border border-white/10 bg-neutral-950/60 p-5 shadow-xl">
            <SectionHeader
              title="Location Performance Board"
              subtitle="Compare revenue, orders, average ticket, labor, and margin across the group."
              right={
                <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-neutral-400">
                  {sortedLocations.length} location{sortedLocations.length === 1 ? "" : "s"}
                </div>
              }
            />

            <div className="space-y-4">
              {sortedLocations.map((location) => {
                const health = healthStyles(location.health);
                const isFocused = matchedLocation?.id === location.id;

                return (
                  <button
                    key={location.id}
                    onClick={() => {
                      setLocationFilter(location.name);
                      hasAutoScrolledRef.current = false;

                      track({
                        ts: Date.now(),
                        type: "location_card_clicked",
                        meta: {
                          location: location.name,
                          health: location.health,
                        },
                      });
                    }}
                    ref={(node) => {
                      locationRefs.current[location.id] = node;
                    }}
                    className={cx(
                      "w-full text-left rounded-2xl border p-4 transition",
                      isFocused
                        ? "border-violet-400/50 bg-violet-500/10 shadow-[0_0_0_1px_rgba(167,139,250,0.15)]"
                        : "border-white/10 bg-neutral-900/50 hover:bg-white/5"
                    )}
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-lg font-semibold text-white">{location.name}</h3>
                          <span
                            className={cx(
                              "rounded-full px-2.5 py-1 text-xs font-medium",
                              health.badge
                            )}
                          >
                            {health.label}
                          </span>
                          {isFocused && (
                            <span className="rounded-full border border-violet-400/30 bg-violet-500/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-violet-200">
                              Focused
                            </span>
                          )}
                          <span className="text-xs text-neutral-500">{location.city}</span>
                        </div>

                        <p className="mt-3 text-sm text-neutral-400">
                          {location.topIssue ?? "No major issue detected."}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:min-w-[520px]">
                        <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-3">
                          <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                            Revenue
                          </div>
                          <div className="mt-1 text-base font-semibold text-white">
                            {money(location.revenueToday)}
                          </div>
                          <div
                            className={cx(
                              "mt-1 text-xs",
                              location.revenueDeltaPct < 0
                                ? "text-rose-300"
                                : "text-emerald-300"
                            )}
                          >
                            {pct(location.revenueDeltaPct)}
                          </div>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-3">
                          <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                            Orders
                          </div>
                          <div className="mt-1 text-base font-semibold text-white">
                            {location.ordersToday}
                          </div>
                          <div
                            className={cx(
                              "mt-1 text-xs",
                              location.ordersDeltaPct < 0
                                ? "text-rose-300"
                                : "text-emerald-300"
                            )}
                          >
                            {pct(location.ordersDeltaPct)}
                          </div>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-3">
                          <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                            Avg ticket
                          </div>
                          <div className="mt-1 text-base font-semibold text-white">
                            {money(location.aov)}
                          </div>
                          <div
                            className={cx(
                              "mt-1 text-xs",
                              location.aovDeltaPct < 0
                                ? "text-rose-300"
                                : "text-emerald-300"
                            )}
                          >
                            {pct(location.aovDeltaPct)}
                          </div>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-3">
                          <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                            Labor %
                          </div>
                          <div
                            className={cx(
                              "mt-1 text-base font-semibold",
                              location.laborPct > 22 ? "text-rose-300" : "text-white"
                            )}
                          >
                            {location.laborPct}%
                          </div>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-3">
                          <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                            Margin %
                          </div>
                          <div className="mt-1 text-base font-semibold text-white">
                            {location.marginPct}%
                          </div>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-3">
                          <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                            Avg rating
                          </div>
                          <div className="mt-1 text-base font-semibold text-white">
                            {location.avgRating.toFixed(1)}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl border border-white/10 bg-black/30 px-4 py-3">
                      <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                        Recommended action
                      </div>
                      <div className="mt-1 text-sm text-white/90">
                        {location.recommendedAction ?? "No action recommended."}
                      </div>

                      <div className="mt-3 flex justify-end">
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/reviews?location=${encodeURIComponent(location.name)}`);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              e.stopPropagation();
                              router.push(`/reviews?location=${encodeURIComponent(location.name)}`);
                            }
                          }}
                          className="text-xs text-violet-300 hover:text-violet-200"
                        >
                          View reviews →
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="space-y-6">
            <section className="rounded-3xl border border-white/10 bg-neutral-950/60 p-5 shadow-xl">
              <SectionHeader
                title="Performance Alerts"
                subtitle="The biggest KPI issues across the group."
              />

              <div className="space-y-3">
                {boardAlerts
                  .filter((alert) =>
                    locationFilter === "all" ? true : alert.locationName === locationFilter
                  )
                  .map((alert) => (
                    <div
                      key={alert.id}
                      className={cx(
                        "rounded-2xl border p-4",
                        locationFilter !== "all" && alert.locationName === locationFilter
                          ? "border-violet-400/40 bg-violet-500/10"
                          : "border-white/10 bg-neutral-900/50"
                      )}
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={cx(
                              "rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide",
                              severityStyles(alert.severity)
                            )}
                          >
                            {alert.severity}
                          </span>
                          {alert.priorityLabel ? (
                            <span
                              className={cx(
                                "rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide",
                                priorityStyles(alert.priorityLabel)
                              )}
                            >
                              {alert.priorityLabel}
                            </span>
                          ) : null}
                        </div>
                        <span className="text-xs text-neutral-500">{alert.locationName}</span>
                      </div>

                      <div className="text-sm font-semibold text-white">{alert.title}</div>
                      <div className="mt-1 text-sm text-neutral-400">{alert.description}</div>

                      {(alert.priorityReason || typeof alert.priorityScore === "number") && (
                        <div className="mt-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                          <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                            Priority context
                          </div>
                          <div className="mt-1 text-xs text-neutral-300">
                            {alert.priorityReason || "Priority signal detected."}
                            {typeof alert.priorityScore === "number"
                              ? ` · Score ${alert.priorityScore}`
                              : ""}
                          </div>
                        </div>
                      )}

                      <div className="mt-3 text-[11px] uppercase tracking-wide text-neutral-500">
                        {alert.type}
                      </div>
                    </div>
                  ))}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-neutral-950/60 p-5 shadow-xl">
              <SectionHeader
                title="Recommended Actions"
                subtitle="What the operator should do next."
              />

              <div className="space-y-3">
                {boardActions
                  .filter((action) =>
                    locationFilter === "all" ? true : action.locationName === locationFilter
                  )
                  .map((action) => (
                    <div
                      key={action.id}
                      className={cx(
                        "rounded-2xl border p-4",
                        locationFilter !== "all" && action.locationName === locationFilter
                          ? "border-violet-400/40 bg-violet-500/10"
                          : "border-white/10 bg-neutral-900/50"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-white">{action.title}</div>
                          <div className="mt-1 text-sm text-neutral-400">{action.reason}</div>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <span
                            className={cx(
                              "rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide",
                              actionStatusStyles(action.status)
                            )}
                          >
                            {action.status.replace("_", " ")}
                          </span>

                          {action.priorityLabel ? (
                            <span
                              className={cx(
                                "rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide",
                                priorityStyles(action.priorityLabel)
                              )}
                            >
                              {action.priorityLabel}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {(action.priorityReason || typeof action.priorityScore === "number") && (
                        <div className="mt-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                          <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                            Why this ranks here
                          </div>
                          <div className="mt-1 text-xs text-neutral-300">
                            {action.priorityReason || "Priority signal detected."}
                            {typeof action.priorityScore === "number"
                              ? ` · Score ${action.priorityScore}`
                              : ""}
                          </div>
                        </div>
                      )}

                      <div className="mt-3 text-xs text-neutral-500">{action.locationName}</div>
                    </div>
                  ))}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-neutral-950/60 p-5 shadow-xl">
              <SectionHeader
                title="Operator Notes"
                subtitle="How to interpret the board."
              />

              <ul className="space-y-2 text-sm text-neutral-300">
                <li>• Treat revenue drops and labor spikes together, not in isolation.</li>
                <li>• AOV weakness usually signals bundle or upsell opportunity.</li>
                <li>• Repeated review issues often show up before performance fully slips.</li>
                <li>• Strong locations are your safest testing ground for margin improvements.</li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}