import { NextResponse } from "next/server";
import { TRUSTED_PERFORMANCE_SOURCES } from "@/lib/performanceSignalTrust";
import { loadSquareProductionConnections } from "@/lib/squareConnectionReader";
import { verifySquarePerformanceRow } from "@/lib/verifiedSquarePerformance";
import { getSupabaseRouteClient } from "@/lib/supabaseRoute";
import { requireProForApi } from "@/lib/requirePro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type HealthStatus = "healthy" | "watch" | "risk" | "unknown";
type PerfSeverity = "low" | "medium" | "high";
type AlertType = "revenue" | "aov" | "labor" | "margin" | "reviews";
type ActionStatus = "pending" | "in_progress" | "done";
type PriorityLabel = "urgent" | "high" | "normal" | "low";

type ReviewRow = {
  id: string;
  location_name: string | null;
  rating: number | null;
  text: string | null;
  update_time: string | null;
};

type PerformanceSignalRow = {
  id: string;
  location_name: string;
  source_system: string | null;
  source_record_id: string | null;
  revenue: number | null;
  orders: number | null;
  avg_ticket: number | null;
  labor_pct: number | null;
  margin_pct: number | null;
  refunds: number | null;
  captured_at: string;
};

type LocationPerformance = {
  id: string;
  name: string;
  city: string;
  health: HealthStatus;
  revenueToday: number | null;
  revenueDeltaPct: number | null;
  ordersToday: number | null;
  ordersDeltaPct: number | null;
  aov: number | null;
  aovDeltaPct: number | null;
  laborPct: number | null;
  marginPct: number | null;
  avgRating: number | null;
  refunds: number | null;
  topIssue: string | null;
  recommendedAction: string | null;
};

type PerformanceAlert = {
  id: string;
  locationName: string;
  severity: PerfSeverity;
  type: AlertType;
  title: string;
  description: string;
  priorityScore: number;
  priorityLabel: PriorityLabel;
  priorityReason: string;
};

type PerformanceAction = {
  id: string;
  locationName: string;
  title: string;
  reason: string;
  status: ActionStatus;
  priorityScore: number;
  priorityLabel: PriorityLabel;
  priorityReason: string;
};

function daysAgoIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function numOrZero(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function numOrNull(value: unknown, allowNegative = false): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && (allowNegative || value >= 0) ? value : null;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && (allowNegative || parsed >= 0) ? parsed : null;
  }

  return null;
}

function avg(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function detectTopIssue(texts: string[]) {
  const combined = texts.join(" ").toLowerCase();

  if (
    combined.includes("wait") ||
    combined.includes("slow") ||
    combined.includes("delay") ||
    combined.includes("line")
  ) {
    return "Service speed is creating guest friction.";
  }

  if (
    combined.includes("wrong order") ||
    combined.includes("incorrect") ||
    combined.includes("missing") ||
    combined.includes("forgot")
  ) {
    return "Order accuracy issues are affecting guest experience.";
  }

  if (
    combined.includes("dirty") ||
    combined.includes("messy") ||
    combined.includes("bathroom") ||
    combined.includes("clean")
  ) {
    return "Cleanliness concerns may be hurting repeat visits.";
  }

  if (
    combined.includes("price") ||
    combined.includes("pricing") ||
    combined.includes("expensive") ||
    combined.includes("overpriced")
  ) {
    return "Value perception may be limiting conversion.";
  }

  if (
    combined.includes("stale") ||
    combined.includes("cold") ||
    combined.includes("burnt") ||
    combined.includes("taste") ||
    combined.includes("quality")
  ) {
    return "Product quality complaints may be dragging performance.";
  }

  return null;
}

function measuredAtLeast(
  value: number | null,
  threshold: number,
): boolean {
  return value !== null && value >= threshold;
}

function changePct(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function pctAtMost(value: number | null, threshold: number): value is number {
  return value !== null && value <= threshold;
}

function pctBelow(value: number | null, threshold: number): value is number {
  return value !== null && value < threshold;
}

function ratingBelow(value: number | null, threshold: number): boolean {
  return value !== null && value < threshold;
}

function recommendedAction(params: {
  revenueDeltaPct: number | null;
  laborPct: number | null;
  avgRating: number | null;
  topIssue: string | null;
}) {
  const { revenueDeltaPct, laborPct, avgRating, topIssue } = params;

  if (pctAtMost(revenueDeltaPct, -8) && measuredAtLeast(laborPct, 24)) {
    return "Launch a traffic recovery move and tighten labor coverage immediately.";
  }

  if (pctBelow(revenueDeltaPct, 0)) {
    return "Review demand softness and push a targeted recovery offer.";
  }

  if (measuredAtLeast(laborPct, 24)) {
    return "Reduce labor drag during slow windows and rebalance staffing.";
  }

  if (ratingBelow(avgRating, 4)) {
    return "Address guest complaints fast and stabilize service execution.";
  }

  if (topIssue) {
    return "Resolve the top guest friction point before scaling promos.";
  }

  return "No action needed.";
}

function deriveHealth(params: {
  revenueDeltaPct: number | null;
  laborPct: number | null;
  avgRating: number | null;
}): HealthStatus {
  const { revenueDeltaPct, laborPct, avgRating } = params;

  if (pctAtMost(revenueDeltaPct, -8) || measuredAtLeast(laborPct, 25) || ratingBelow(avgRating, 4)) return "risk";
  if (pctBelow(revenueDeltaPct, 0) || measuredAtLeast(laborPct, 22) || ratingBelow(avgRating, 4.4)) return "watch";
  if (revenueDeltaPct === null || laborPct === null || avgRating === null) {
    return "unknown";
  }
  return "healthy";
}

function buildPriority(params: {
  location: LocationPerformance;
  type: AlertType;
  status?: ActionStatus;
}) {
  const { location, type, status } = params;

  let score = 0;
  const reasons: string[] = [];

  if (location.health === "risk") {
    score += 35;
    reasons.push("location at risk");
  } else if (location.health === "watch") {
    score += 18;
    reasons.push("location on watch");
  }

  if (pctAtMost(location.revenueDeltaPct, -10)) {
    score += 28;
    reasons.push("double-digit revenue decline");
  } else if (pctAtMost(location.revenueDeltaPct, -8)) {
    score += 22;
    reasons.push("strong revenue decline");
  } else if (pctBelow(location.revenueDeltaPct, 0)) {
    score += 10;
  }

  if (pctAtMost(location.ordersDeltaPct, -8)) {
    score += 12;
    reasons.push("orders dropping");
  } else if (pctBelow(location.ordersDeltaPct, 0)) {
    score += 5;
  }

  if (pctAtMost(location.aovDeltaPct, -5)) {
    score += 10;
    reasons.push("average ticket weakening");
  } else if (pctBelow(location.aovDeltaPct, 0)) {
    score += 4;
  }

  if (measuredAtLeast(location.laborPct, 26)) {
    score += 22;
    reasons.push("labor materially above target");
  } else if (measuredAtLeast(location.laborPct, 24)) {
    score += 14;
    reasons.push("labor above target");
  } else if (measuredAtLeast(location.laborPct, 22)) {
    score += 6;
  }

  if (ratingBelow(location.avgRating, 4)) {
    score += 20;
    reasons.push("rating below 4.0");
  } else if (ratingBelow(location.avgRating, 4.2)) {
    score += 10;
  }

  if (location.refunds !== null && location.refunds >= 50) {
    score += 10;
    reasons.push("refund pressure");
  } else if (location.refunds !== null && location.refunds >= 25) {
    score += 5;
  }

  if (location.topIssue) {
    score += 8;
    reasons.push("guest friction detected");
  }

  if (type === "revenue" && pctAtMost(location.revenueDeltaPct, -8)) score += 10;
  if (type === "labor" && measuredAtLeast(location.laborPct, 24)) score += 10;
  if (type === "reviews" && (ratingBelow(location.avgRating, 4.1) || location.topIssue)) score += 10;
  if (type === "margin" && measuredAtLeast(location.marginPct, 66)) score -= 18;

  if (status === "pending") {
    score += 8;
    reasons.push("not acted on yet");
  } else if (status === "in_progress") {
    score -= 4;
  } else if (status === "done") {
    score -= 24;
  }

  let priorityLabel: PriorityLabel = "low";
  if (score >= 80) priorityLabel = "urgent";
  else if (score >= 55) priorityLabel = "high";
  else if (score >= 28) priorityLabel = "normal";

  return {
    priorityScore: score,
    priorityLabel,
    priorityReason: reasons.length ? reasons.join(", ") : "low urgency",
  };
}

export async function GET() {
  await requireProForApi();

  try {
    const supabase = await getSupabaseRouteClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // A Google Business Profile location has no verified cross-provider link to
    // this Square location yet. Only fetch Square performance here; do not join
    // reviews by display name or present unverifiable review-derived insights.
    const { data: performanceRows, error: performanceError } = await supabase
      .from("performance_signal_history")
      .select(
        "id, location_name, source_system, source_record_id, revenue, orders, avg_ticket, labor_pct, margin_pct, refunds, captured_at"
      )
      .eq("user_id", user.id)
      .in("source_system", [...TRUSTED_PERFORMANCE_SOURCES])
      .order("captured_at", { ascending: false });

    if (performanceError) {
      console.error("operator-snapshot/performance performance error:", performanceError);
      return NextResponse.json({ error: "Failed to load performance data" }, { status: 500 });
    }

    const connections = await loadSquareProductionConnections(user.id);
    const perf = ((performanceRows ?? []) as PerformanceSignalRow[])
      .map((row) => verifySquarePerformanceRow(row, user.id, connections))
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    const groupedPerf = new Map<
      string,
      { locationName: string; latest: PerformanceSignalRow | null; previous: PerformanceSignalRow | null }
    >();

    for (const verified of perf) {
      const row = verified.row;
      const key = verified.connectionKey;
      const existing = groupedPerf.get(key);

      if (!existing) {
        groupedPerf.set(key, { locationName: verified.locationName, latest: row, previous: null });
        continue;
      }

      if (!existing.previous) {
        groupedPerf.set(key, { locationName: existing.locationName, latest: existing.latest, previous: row });
      }
    }

    const nowMs = Date.now();
    const maxSnapshotAgeMs = 72 * 60 * 60 * 1000;
    const locations: LocationPerformance[] = Array.from(groupedPerf.entries())
      .filter(([, pair]) => {
        const capturedMs = Date.parse(pair.latest?.captured_at ?? "");
        return Number.isFinite(capturedMs) &&
          capturedMs <= nowMs &&
          nowMs - capturedMs <= maxSnapshotAgeMs;
      })
      .map(
      ([, pair], index) => {
        const locationName = pair.locationName;
        const latest = pair.latest;
        const previous = pair.previous;

        const revenueToday = numOrNull(latest?.revenue);
        const ordersToday = numOrNull(latest?.orders);
        const aov = numOrNull(latest?.avg_ticket);
        const laborPct = numOrNull(latest?.labor_pct);
        const marginPct = numOrNull(latest?.margin_pct, true);
        const refunds = numOrNull(latest?.refunds);

        const previousRevenue = numOrNull(previous?.revenue);
        const previousOrders = numOrNull(previous?.orders);
        const previousAov = numOrNull(previous?.avg_ticket);

        const latestSource = latest?.source_record_id ?? "";
        const previousSource = previous?.source_record_id ?? "";
        const latestCapturedMs = Date.parse(latest?.captured_at ?? "");
        const previousCapturedMs = Date.parse(previous?.captured_at ?? "");
        const comparisonGapMs = latestCapturedMs - previousCapturedMs;

        const comparablePeriods =
          latestSource.length > 10 &&
          previousSource.length > 10 &&
          latestSource.slice(0, -10) === previousSource.slice(0, -10) &&
          latestSource.slice(-10) > previousSource.slice(-10) &&
          Number.isFinite(comparisonGapMs) &&
          comparisonGapMs > 0 &&
          comparisonGapMs <= 72 * 60 * 60 * 1000;

        const revenueDeltaPct = comparablePeriods
          ? changePct(revenueToday, previousRevenue) : null;
        const ordersDeltaPct = comparablePeriods
          ? changePct(ordersToday, previousOrders) : null;
        const aovDeltaPct = comparablePeriods
          ? changePct(aov, previousAov) : null;

        // Cross-provider identity is not established: missing, not zero or healthy.
        const avgRating: number | null = null;
        const topIssue: string | null = null;
        const health = deriveHealth({ revenueDeltaPct, laborPct, avgRating });

        return {
          id: `live_perf_${index + 1}`,
          name: locationName,
          city: "",
          health,
          revenueToday,
          revenueDeltaPct,
          ordersToday,
          ordersDeltaPct,
          aov,
          aovDeltaPct,
          laborPct,
          marginPct,
          avgRating,
          refunds,
          topIssue,
          recommendedAction: health === "unknown" ? null : recommendedAction({
            revenueDeltaPct,
            laborPct,
            avgRating,
            topIssue,
          }),
        };
      }
    );

    const sortedLocations = [...locations].sort((a, b) => {
      const rank: Record<HealthStatus, number> = { risk: 0, watch: 1, unknown: 2, healthy: 3 };
      return rank[a.health] - rank[b.health];
    });

    const alerts: PerformanceAlert[] = sortedLocations
      .flatMap((location) => {
        const items: PerformanceAlert[] = [];

        if (pctAtMost(location.revenueDeltaPct, -8)) {
          items.push({
            id: `alert-revenue-${location.id}`,
            locationName: location.name,
            severity: "high",
            type: "revenue",
            title: `Revenue down ${Math.abs(location.revenueDeltaPct)}%`,
            description: "Revenue trend is materially weaker than the previous snapshot.",
            ...buildPriority({ location, type: "revenue" }),
          });
        }

        if (measuredAtLeast(location.laborPct, 24)) {
          items.push({
            id: `alert-labor-${location.id}`,
            locationName: location.name,
            severity: measuredAtLeast(location.laborPct, 26) ? "high" : "medium",
            type: "labor",
            title: "Labor above target",
            description: "Labor is running high versus an efficient operating range.",
            ...buildPriority({ location, type: "labor" }),
          });
        }

        if (ratingBelow(location.avgRating, 4.1) || location.topIssue) {
          items.push({
            id: `alert-reviews-${location.id}`,
            locationName: location.name,
            severity: ratingBelow(location.avgRating, 4) ? "high" : "medium",
            type: "reviews",
            title: "Guest sentiment pressure",
            description:
              location.topIssue ?? "Review signals suggest guest experience is softening.",
            ...buildPriority({ location, type: "reviews" }),
          });
        }

        if (measuredAtLeast(location.marginPct, 66)) {
          items.push({
            id: `alert-margin-${location.id}`,
            locationName: location.name,
            severity: "low",
            type: "margin",
            title: "Margin leader",
            description: "This location is a strong candidate for a safe growth test.",
            ...buildPriority({ location, type: "margin" }),
          });
        }

        return items;
      })
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .slice(0, 8);

    const actions: PerformanceAction[] = [];

    return NextResponse.json({
      locations: sortedLocations,
      alerts,
      actions,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("operator-snapshot/performance unexpected error:", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}