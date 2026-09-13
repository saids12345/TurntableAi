import { NextResponse } from "next/server";
import { getSupabaseRouteClient } from "@/lib/supabaseRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type HealthStatus = "healthy" | "watch" | "risk";
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
  revenueToday: number;
  revenueDeltaPct: number;
  ordersToday: number;
  ordersDeltaPct: number;
  aov: number;
  aovDeltaPct: number;
  laborPct: number;
  marginPct: number;
  avgRating: number;
  refunds: number;
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

function recommendedAction(params: {
  revenueDeltaPct: number;
  laborPct: number;
  avgRating: number;
  topIssue: string | null;
}) {
  const { revenueDeltaPct, laborPct, avgRating, topIssue } = params;

  if (revenueDeltaPct <= -8 && laborPct >= 24) {
    return "Launch a traffic recovery move and tighten labor coverage immediately.";
  }

  if (revenueDeltaPct < 0) {
    return "Review demand softness and push a targeted recovery offer.";
  }

  if (laborPct >= 24) {
    return "Reduce labor drag during slow windows and rebalance staffing.";
  }

  if (avgRating < 4) {
    return "Address guest complaints fast and stabilize service execution.";
  }

  if (topIssue) {
    return "Resolve the top guest friction point before scaling promos.";
  }

  return "No action needed.";
}

function deriveHealth(params: {
  revenueDeltaPct: number;
  laborPct: number;
  avgRating: number;
}): HealthStatus {
  const { revenueDeltaPct, laborPct, avgRating } = params;

  if (revenueDeltaPct <= -8 || laborPct >= 25 || avgRating < 4) return "risk";
  if (revenueDeltaPct < 0 || laborPct >= 22 || avgRating < 4.4) return "watch";
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

  if (location.revenueDeltaPct <= -10) {
    score += 28;
    reasons.push("double-digit revenue decline");
  } else if (location.revenueDeltaPct <= -8) {
    score += 22;
    reasons.push("strong revenue decline");
  } else if (location.revenueDeltaPct < 0) {
    score += 10;
  }

  if (location.ordersDeltaPct <= -8) {
    score += 12;
    reasons.push("orders dropping");
  } else if (location.ordersDeltaPct < 0) {
    score += 5;
  }

  if (location.aovDeltaPct <= -5) {
    score += 10;
    reasons.push("average ticket weakening");
  } else if (location.aovDeltaPct < 0) {
    score += 4;
  }

  if (location.laborPct >= 26) {
    score += 22;
    reasons.push("labor materially above target");
  } else if (location.laborPct >= 24) {
    score += 14;
    reasons.push("labor above target");
  } else if (location.laborPct >= 22) {
    score += 6;
  }

  if (location.avgRating < 4) {
    score += 20;
    reasons.push("rating below 4.0");
  } else if (location.avgRating < 4.2) {
    score += 10;
  }

  if (location.refunds >= 50) {
    score += 10;
    reasons.push("refund pressure");
  } else if (location.refunds >= 25) {
    score += 5;
  }

  if (location.topIssue) {
    score += 8;
    reasons.push("guest friction detected");
  }

  if (type === "revenue" && location.revenueDeltaPct <= -8) score += 10;
  if (type === "labor" && location.laborPct >= 24) score += 10;
  if (type === "reviews" && (location.avgRating < 4.1 || location.topIssue)) score += 10;
  if (type === "margin" && location.marginPct >= 66) score -= 18;

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
  try {
    const supabase = await getSupabaseRouteClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sinceIso = daysAgoIso(45);

    const [
      { data: performanceRows, error: performanceError },
      { data: reviewRows, error: reviewError },
    ] = await Promise.all([
      supabase
        .from("performance_signal_history")
        .select(
          "id, location_name, revenue, orders, avg_ticket, labor_pct, margin_pct, refunds, captured_at"
        )
        .eq("user_id", user.id)
        .order("captured_at", { ascending: false }),
      supabase
        .from("reviews")
        .select("id, location_name, rating, text, update_time")
        .eq("user_id", user.id)
        .gte("update_time", sinceIso)
        .order("update_time", { ascending: false }),
    ]);

    if (performanceError) {
      console.error("operator-snapshot/performance performance error:", performanceError);
      return NextResponse.json({ error: "Failed to load performance data" }, { status: 500 });
    }

    if (reviewError) {
      console.error("operator-snapshot/performance reviews error:", reviewError);
      return NextResponse.json({ error: "Failed to load review data" }, { status: 500 });
    }

    const perf = (performanceRows ?? []) as PerformanceSignalRow[];
    const reviews = (reviewRows ?? []) as ReviewRow[];

    const groupedPerf = new Map<
      string,
      { latest: PerformanceSignalRow | null; previous: PerformanceSignalRow | null }
    >();

    for (const row of perf) {
      const key = row.location_name;
      const existing = groupedPerf.get(key);

      if (!existing) {
        groupedPerf.set(key, { latest: row, previous: null });
        continue;
      }

      if (!existing.previous) {
        groupedPerf.set(key, { latest: existing.latest, previous: row });
      }
    }

    const locations: LocationPerformance[] = Array.from(groupedPerf.entries()).map(
      ([locationName, pair], index) => {
        const latest = pair.latest;
        const previous = pair.previous;

        const revenueToday = numOrZero(latest?.revenue);
        const ordersToday = numOrZero(latest?.orders);
        const aov = numOrZero(latest?.avg_ticket);
        const laborPct = numOrZero(latest?.labor_pct);
        const marginPct = numOrZero(latest?.margin_pct);
        const refunds = numOrZero(latest?.refunds);

        const previousRevenue = numOrZero(previous?.revenue);
        const previousOrders = numOrZero(previous?.orders);
        const previousAov = numOrZero(previous?.avg_ticket);

        const revenueDeltaPct =
          previousRevenue > 0
            ? Math.round(((revenueToday - previousRevenue) / previousRevenue) * 100)
            : 0;
        const ordersDeltaPct =
          previousOrders > 0
            ? Math.round(((ordersToday - previousOrders) / previousOrders) * 100)
            : 0;
        const aovDeltaPct =
          previousAov > 0 ? Math.round(((aov - previousAov) / previousAov) * 100) : 0;

        const locationReviews = reviews.filter((r) => r.location_name === locationName);
        const ratedValues = locationReviews
          .map((r) => (typeof r.rating === "number" ? r.rating : null))
          .filter((v): v is number => v !== null);

        const avgRatingRaw = avg(ratedValues);
        const avgRating = avgRatingRaw !== null ? Number(avgRatingRaw.toFixed(1)) : 4.5;

        const negativeTexts = locationReviews
          .filter((r) => typeof r.rating === "number" && r.rating <= 3)
          .map((r) => r.text ?? "");

        const topIssue = detectTopIssue(negativeTexts);
        const health = deriveHealth({ revenueDeltaPct, laborPct, avgRating });

        return {
          id: `live_perf_${index + 1}`,
          name: locationName,
          city: "San Diego",
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
          recommendedAction: recommendedAction({
            revenueDeltaPct,
            laborPct,
            avgRating,
            topIssue,
          }),
        };
      }
    );

    const sortedLocations = [...locations].sort((a, b) => {
      const rank: Record<HealthStatus, number> = { risk: 0, watch: 1, healthy: 2 };
      return rank[a.health] - rank[b.health];
    });

    const alerts: PerformanceAlert[] = sortedLocations
      .flatMap((location) => {
        const items: PerformanceAlert[] = [];

        if (location.revenueDeltaPct <= -8) {
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

        if (location.laborPct >= 24) {
          items.push({
            id: `alert-labor-${location.id}`,
            locationName: location.name,
            severity: location.laborPct >= 26 ? "high" : "medium",
            type: "labor",
            title: "Labor above target",
            description: "Labor is running high versus an efficient operating range.",
            ...buildPriority({ location, type: "labor" }),
          });
        }

        if (location.avgRating < 4.1 || location.topIssue) {
          items.push({
            id: `alert-reviews-${location.id}`,
            locationName: location.name,
            severity: location.avgRating < 4 ? "high" : "medium",
            type: "reviews",
            title: "Guest sentiment pressure",
            description:
              location.topIssue ?? "Review signals suggest guest experience is softening.",
            ...buildPriority({ location, type: "reviews" }),
          });
        }

        if (location.marginPct >= 66) {
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

    const actions: PerformanceAction[] = sortedLocations
      .flatMap((location) => {
        const items: PerformanceAction[] = [];

        if (location.revenueDeltaPct <= -8) {
          const status: ActionStatus = "pending";
          items.push({
            id: `action-revenue-${location.id}`,
            locationName: location.name,
            title: "Run revenue recovery plan",
            reason: "Sales trend is weak enough to need immediate intervention.",
            status,
            ...buildPriority({ location, type: "revenue", status }),
          });
        }

        if (location.laborPct >= 24) {
          const status: ActionStatus = "pending";
          items.push({
            id: `action-labor-${location.id}`,
            locationName: location.name,
            title: "Reduce labor drag",
            reason: "Labor is elevated and may be compressing performance.",
            status,
            ...buildPriority({ location, type: "labor", status }),
          });
        }

        if (location.avgRating < 4.1 || location.topIssue) {
          const status: ActionStatus = "in_progress";
          items.push({
            id: `action-review-${location.id}`,
            locationName: location.name,
            title: "Fix guest friction fast",
            reason: location.topIssue ?? "Negative guest signals should be addressed quickly.",
            status,
            ...buildPriority({ location, type: "reviews", status }),
          });
        }

        if (location.health === "healthy" && location.marginPct >= 64) {
          const status: ActionStatus = "done";
          items.push({
            id: `action-growth-${location.id}`,
            locationName: location.name,
            title: "Test a margin-friendly growth play",
            reason: "This location is stable enough for a low-risk experiment.",
            status,
            ...buildPriority({ location, type: "margin", status }),
          });
        }

        return items;
      })
      .sort((a, b) => b.priorityScore - a.priorityScore);

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