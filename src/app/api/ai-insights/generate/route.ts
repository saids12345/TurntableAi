import { NextResponse } from "next/server";
import { getSupabaseRouteClient } from "@/lib/supabaseRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type InsightType = "reputation" | "revenue" | "ops" | "growth";
type InsightSeverity = "low" | "medium" | "high";
type ActionStatus = "acted" | "monitoring" | "dismissed";
type HealthStatus = "healthy" | "watch" | "risk";

type InsightPayload = {
  id?: string;
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

type ReviewRow = {
  id: string;
  location_name: string | null;
  rating: number | null;
  text: string | null;
  update_time: string | null;
};

type ReviewLocationRow = {
  id: string;
  name: string;
  title: string | null;
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

type LocationSignal = {
  id: string;
  name: string;
  city: string;
  health: HealthStatus;
  salesDeltaPct: number | null;
  reviewIssueCount: number;
  openAlerts: number;
  avgRating: number | null;
  topIssue: string | null;
  recommendedAction: string | null;
};

type CurrentPerformance = {
  locationName: string;
  revenue: number | null;
  orders: number | null;
  avgTicket: number | null;
  laborPct: number | null;
  marginPct: number | null;
  refunds: number | null;
  capturedAt: string;
};

type GeneratedInsight = {
  dedupeKey: string;
  title: string;
  type: InsightType;
  severity: InsightSeverity;
  locationName: string | null;
  payload: InsightPayload;
  actionStatus: ActionStatus;
  actionNote: string;
  signalSnapshot: SignalSnapshot | null;
  performanceSnapshot: PerformanceSnapshot | null;
};

function numOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function avg(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function daysAgoIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function buildDedupeKey(params: {
  type: InsightType;
  severity: InsightSeverity;
  title: string;
  locationName?: string | null;
}) {
  const locationPart = params.locationName ? slugify(params.locationName) : "global";
  return [
    "insight",
    params.type,
    params.severity,
    locationPart,
    slugify(params.title).slice(0, 80),
  ].join(":");
}

function detectIssueBuckets(reviews: ReviewRow[]) {
  const buckets = {
    wait_time: 0,
    service: 0,
    wrong_order: 0,
    cleanliness: 0,
    pricing: 0,
    food_quality: 0,
    general: 0,
  };

  for (const review of reviews) {
    const text = (review.text || "").toLowerCase();

    if (!text.trim()) {
      buckets.general += 1;
      continue;
    }

    let matched = false;

    if (
      text.includes("wait") ||
      text.includes("slow") ||
      text.includes("line") ||
      text.includes("delay") ||
      text.includes("late")
    ) {
      buckets.wait_time += 1;
      matched = true;
    }

    if (
      text.includes("staff") ||
      text.includes("rude") ||
      text.includes("service") ||
      text.includes("attitude") ||
      text.includes("employee")
    ) {
      buckets.service += 1;
      matched = true;
    }

    if (
      text.includes("wrong order") ||
      text.includes("incorrect") ||
      text.includes("missing") ||
      text.includes("forgot") ||
      text.includes("mixed up")
    ) {
      buckets.wrong_order += 1;
      matched = true;
    }

    if (
      text.includes("dirty") ||
      text.includes("clean") ||
      text.includes("messy") ||
      text.includes("bathroom")
    ) {
      buckets.cleanliness += 1;
      matched = true;
    }

    if (
      text.includes("expensive") ||
      text.includes("overpriced") ||
      text.includes("price") ||
      text.includes("cost")
    ) {
      buckets.pricing += 1;
      matched = true;
    }

    if (
      text.includes("cold") ||
      text.includes("stale") ||
      text.includes("burnt") ||
      text.includes("taste") ||
      text.includes("flavor") ||
      text.includes("quality")
    ) {
      buckets.food_quality += 1;
      matched = true;
    }

    if (!matched) {
      buckets.general += 1;
    }
  }

  return buckets;
}

function topIssueLabel(buckets: ReturnType<typeof detectIssueBuckets>) {
  const entries = Object.entries(buckets).sort((a, b) => b[1] - a[1]);
  const [topKey, topValue] = entries[0] ?? ["general", 0];

  if (!topValue) return null;

  switch (topKey) {
    case "wait_time":
      return "Wait-time complaints increasing";
    case "service":
      return "Service complaints increasing";
    case "wrong_order":
      return "Order accuracy complaints increasing";
    case "cleanliness":
      return "Cleanliness complaints increasing";
    case "pricing":
      return "Value and pricing complaints increasing";
    case "food_quality":
      return "Food or drink quality complaints increasing";
    default:
      return "Guest complaint pressure increasing";
  }
}

function recommendedActionForIssue(
  label: string | null,
  negativeCount: number,
  avgRating: number | null
) {
  if (!label) {
    return negativeCount > 0
      ? "Review guest complaints and respond quickly"
      : "No action needed";
  }

  if (label.toLowerCase().includes("wait")) {
    return "Review queue flow, coach shift lead, and reply to affected guests quickly";
  }

  if (label.toLowerCase().includes("service")) {
    return "Coach front-of-house execution and clear the current review backlog";
  }

  if (label.toLowerCase().includes("accuracy")) {
    return "Audit handoff accuracy and follow up on complaint-heavy tickets";
  }

  if (label.toLowerCase().includes("cleanliness")) {
    return "Run a cleanliness check and escalate site standards immediately";
  }

  if (label.toLowerCase().includes("pricing")) {
    return avgRating !== null && avgRating < 4
      ? "Review value perception and tighten messaging around your core offer"
      : "Monitor pricing feedback before adjusting offer structure";
  }

  if (label.toLowerCase().includes("quality")) {
    return "Review product quality consistency and inspect prep standards";
  }

  return "Review complaints, respond quickly, and tighten execution";
}

function deriveHealth(params: {
  avgRating: number | null;
  negativeCount: number;
  openAlerts: number;
}) {
  const { avgRating, negativeCount, openAlerts } = params;

  if ((avgRating !== null && avgRating < 4) || negativeCount >= 3 || openAlerts >= 3) {
    return "risk" as const;
  }

  if ((avgRating !== null && avgRating < 4.4) || negativeCount >= 1 || openAlerts >= 1) {
    return "watch" as const;
  }

  return "healthy" as const;
}

async function getLocationSignalsFromSupabase(userId: string): Promise<LocationSignal[]> {
  const supabase = await getSupabaseRouteClient();

  const { data: locationRows, error: locationError } = await supabase
    .from("review_connections")
    .select("review_locations(id,name,title)")
    .eq("user_id", userId)
    .eq("provider", "google");

  if (locationError) throw locationError;

  const flattenedLocations: ReviewLocationRow[] = (locationRows || [])
    .flatMap((row: Record<string, unknown>) => {
      const reviewLocations = row.review_locations;
      return Array.isArray(reviewLocations) ? (reviewLocations as ReviewLocationRow[]) : [];
    })
    .filter(
      (location) =>
        location && typeof location.id === "string" && typeof location.name === "string"
    );

  if (!flattenedLocations.length) return [];

  const sinceIso = daysAgoIso(45);

  const { data: reviewRows, error: reviewError } = await supabase
    .from("reviews")
    .select("id,location_name,rating,text,update_time")
    .eq("user_id", userId)
    .gte("update_time", sinceIso)
    .order("update_time", { ascending: false });

  if (reviewError) throw reviewError;

  const reviews = (reviewRows || []) as ReviewRow[];

  return flattenedLocations.map((location) => {
    const locationReviews = reviews.filter((review) => review.location_name === location.name);

    const rated = locationReviews
      .map((review) => (typeof review.rating === "number" ? review.rating : null))
      .filter((value): value is number => value !== null);

    const avgRatingRaw = avg(rated);
    const avgRating = avgRatingRaw !== null ? Number(avgRatingRaw.toFixed(1)) : null;

    const negativeReviews = locationReviews.filter(
      (review) => typeof review.rating === "number" && review.rating <= 3
    );

    const issueBuckets = detectIssueBuckets(negativeReviews);
    const topIssue = topIssueLabel(issueBuckets);

    let openAlerts = 0;
    if (avgRating !== null && avgRating < 4) openAlerts += 1;
    if (negativeReviews.length >= 2) openAlerts += 1;
    if (topIssue) openAlerts += 1;

    const health = deriveHealth({
      avgRating,
      negativeCount: negativeReviews.length,
      openAlerts,
    });

    return {
      id: location.id,
      name: location.title?.trim() || location.name,
      city: "Unknown",
      health,
      salesDeltaPct: null,
      reviewIssueCount: negativeReviews.length,
      openAlerts,
      avgRating,
      topIssue,
      recommendedAction: recommendedActionForIssue(topIssue, negativeReviews.length, avgRating),
    };
  });
}

async function getCurrentPerformanceSignals(userId: string): Promise<CurrentPerformance[]> {
  const supabase = await getSupabaseRouteClient();

  const { data, error } = await supabase
    .from("performance_signal_history")
    .select(
      "location_name, revenue, orders, avg_ticket, labor_pct, margin_pct, refunds, captured_at"
    )
    .eq("user_id", userId)
    .order("captured_at", { ascending: false });

  if (error) throw error;

  const latestByLocation = new Map<string, CurrentPerformance>();

  for (const row of data || []) {
    const locationName = String(row.location_name);
    if (latestByLocation.has(locationName)) continue;

    latestByLocation.set(locationName, {
      locationName,
      revenue: numOrNull(row.revenue),
      orders: numOrNull(row.orders),
      avgTicket: numOrNull(row.avg_ticket),
      laborPct: numOrNull(row.labor_pct),
      marginPct: numOrNull(row.margin_pct),
      refunds: numOrNull(row.refunds),
      capturedAt: String(row.captured_at),
    });
  }

  return Array.from(latestByLocation.values());
}

function findTopRevenueRisk(performanceSignals: CurrentPerformance[]) {
  const candidates = performanceSignals
    .filter(
      (x) =>
        typeof x.revenue === "number" &&
        typeof x.laborPct === "number" &&
        (x.laborPct >= 24 || x.revenue <= 4000)
    )
    .sort((a, b) => {
      const scoreA = (a.laborPct ?? 0) - (a.revenue ?? 0) / 1000;
      const scoreB = (b.laborPct ?? 0) - (b.revenue ?? 0) / 1000;
      return scoreB - scoreA;
    });

  return candidates[0] ?? null;
}

function findTopReviewRisk(locationSignals: LocationSignal[]) {
  const candidates = locationSignals
    .filter(
      (x) =>
        x.health !== "healthy" ||
        x.reviewIssueCount >= 2 ||
        (typeof x.avgRating === "number" && x.avgRating < 4.2)
    )
    .sort((a, b) => {
      const rank = { risk: 2, watch: 1, healthy: 0 };
      const scoreA = rank[a.health] * 10 + a.reviewIssueCount + a.openAlerts;
      const scoreB = rank[b.health] * 10 + b.reviewIssueCount + b.openAlerts;
      return scoreB - scoreA;
    });

  return candidates[0] ?? null;
}

function findTopGrowthLocation(performanceSignals: CurrentPerformance[]) {
  const candidates = performanceSignals
    .filter(
      (x) =>
        typeof x.marginPct === "number" &&
        typeof x.avgTicket === "number" &&
        x.marginPct >= 64
    )
    .sort((a, b) => {
      const scoreA = (a.marginPct ?? 0) + (a.avgTicket ?? 0);
      const scoreB = (b.marginPct ?? 0) + (b.avgTicket ?? 0);
      return scoreB - scoreA;
    });

  return candidates[0] ?? null;
}

function buildRevenueInsight(
  performance: CurrentPerformance
): GeneratedInsight {
  const title = `${performance.locationName} lunch recovery campaign`;
  const payload: InsightPayload = {
    type: "revenue",
    severity: "high",
    title,
    summary:
      "Revenue pressure and labor inefficiency suggest this location needs an immediate recovery move.",
    reason:
      "This store is showing one of the weakest performance profiles right now, with revenue softness and labor pressure combining into a higher-risk operating pattern.",
    recommendedAction:
      "Launch a targeted lunch recovery promo and tighten staffing before the midday rush.",
    expectedImpact:
      "Higher lunch traffic, better labor efficiency, and stronger near-term revenue recovery.",
    href: "/sales",
    cta: "Open Performance",
  };

  return {
    dedupeKey: buildDedupeKey({
      type: payload.type,
      severity: payload.severity,
      title: payload.title,
      locationName: performance.locationName,
    }),
    title,
    type: payload.type,
    severity: payload.severity,
    locationName: performance.locationName,
    payload,
    actionStatus: "monitoring",
    actionNote: "",
    signalSnapshot: null,
    performanceSnapshot: {
      locationName: performance.locationName,
      revenue: performance.revenue,
      orders: performance.orders,
      avgTicket: performance.avgTicket,
      laborPct: performance.laborPct,
      marginPct: performance.marginPct,
      refunds: performance.refunds,
      capturedAt: performance.capturedAt,
    },
  };
}

function buildReputationInsight(location: LocationSignal): GeneratedInsight {
  const title = `${location.name} guest recovery follow-up`;
  const payload: InsightPayload = {
    type: "reputation",
    severity: location.health === "risk" ? "high" : "medium",
    title,
    summary:
      "Guest sentiment pressure is building at this location and needs operator follow-up now.",
    reason:
      location.topIssue ??
      "Review pressure and open alerts suggest the guest experience is starting to slip.",
    recommendedAction:
      location.recommendedAction ??
      "Review complaint patterns, coach the team, and respond to guests quickly.",
    expectedImpact:
      "Lower review risk, stronger guest trust, and fewer unresolved complaints.",
    href: "/reviews",
    cta: "Open Reviews",
  };

  return {
    dedupeKey: buildDedupeKey({
      type: payload.type,
      severity: payload.severity,
      title: payload.title,
      locationName: location.name,
    }),
    title,
    type: payload.type,
    severity: payload.severity,
    locationName: location.name,
    payload,
    actionStatus: "monitoring",
    actionNote: "",
    signalSnapshot: {
      locationName: location.name,
      avgRating: location.avgRating,
      reviewIssueCount: location.reviewIssueCount,
      openAlerts: location.openAlerts,
      health: location.health,
      topIssue: location.topIssue,
      capturedAt: new Date().toISOString(),
    },
    performanceSnapshot: null,
  };
}

function buildGrowthInsight(performance: CurrentPerformance): GeneratedInsight {
  const title = `${performance.locationName} upsell growth test`;
  const payload: InsightPayload = {
    type: "growth",
    severity: "low",
    title,
    summary:
      "This location is strong enough to be used as a safe testing ground for growth plays.",
    reason:
      "Healthy margin structure and average ticket performance suggest this store can absorb a controlled upsell experiment with low operational risk.",
    recommendedAction:
      "Test a high-margin upsell bundle or featured add-on at this location first.",
    expectedImpact:
      "Higher average ticket and cleaner rollout of future cross-location growth plays.",
    href: "/sales",
    cta: "Open Performance",
  };

  return {
    dedupeKey: buildDedupeKey({
      type: payload.type,
      severity: payload.severity,
      title: payload.title,
      locationName: performance.locationName,
    }),
    title,
    type: payload.type,
    severity: payload.severity,
    locationName: performance.locationName,
    payload,
    actionStatus: "monitoring",
    actionNote: "",
    signalSnapshot: null,
    performanceSnapshot: {
      locationName: performance.locationName,
      revenue: performance.revenue,
      orders: performance.orders,
      avgTicket: performance.avgTicket,
      laborPct: performance.laborPct,
      marginPct: performance.marginPct,
      refunds: performance.refunds,
      capturedAt: performance.capturedAt,
    },
  };
}

async function enrichSnapshots(
  generated: GeneratedInsight[],
  locationSignals: LocationSignal[],
  performanceSignals: CurrentPerformance[]
) {
  return generated.map((item) => {
    const matchedSignal =
      item.locationName
        ? locationSignals.find((x) => x.name.toLowerCase() === item.locationName?.toLowerCase()) ??
          null
        : null;

    const matchedPerformance =
      item.locationName
        ? performanceSignals.find(
            (x) => x.locationName.toLowerCase() === item.locationName?.toLowerCase()
          ) ?? null
        : null;

    return {
      ...item,
      signalSnapshot:
        item.signalSnapshot ??
        (matchedSignal
          ? {
              locationName: matchedSignal.name,
              avgRating: matchedSignal.avgRating,
              reviewIssueCount: matchedSignal.reviewIssueCount,
              openAlerts: matchedSignal.openAlerts,
              health: matchedSignal.health,
              topIssue: matchedSignal.topIssue,
              capturedAt: new Date().toISOString(),
            }
          : null),
      performanceSnapshot:
        item.performanceSnapshot ??
        (matchedPerformance
          ? {
              locationName: matchedPerformance.locationName,
              revenue: matchedPerformance.revenue,
              orders: matchedPerformance.orders,
              avgTicket: matchedPerformance.avgTicket,
              laborPct: matchedPerformance.laborPct,
              marginPct: matchedPerformance.marginPct,
              refunds: matchedPerformance.refunds,
              capturedAt: matchedPerformance.capturedAt,
            }
          : null),
    };
  });
}

async function upsertGeneratedInsights(userId: string, insights: GeneratedInsight[]) {
  if (!insights.length) return { saved: 0 };

  const supabase = await getSupabaseRouteClient();

  for (const insight of insights) {
    const { data: existing, error: existingError } = await supabase
      .from("ai_insight_outcomes")
      .select("id, action_status")
      .eq("user_id", userId)
      .eq("dedupe_key", insight.dedupeKey)
      .maybeSingle();

    if (existingError) throw existingError;

    const row = {
      user_id: userId,
      dedupe_key: insight.dedupeKey,
      insight_title: insight.payload.title,
      insight_type: insight.payload.type,
      insight_severity: insight.payload.severity,
      action_status: existing?.action_status ?? insight.actionStatus,
      action_note: insight.actionNote,
      href: insight.payload.href,
      generated_at: new Date().toISOString(),
      insight_payload: insight.payload,
      signal_snapshot: insight.signalSnapshot,
      performance_snapshot: insight.performanceSnapshot,
      updated_at: new Date().toISOString(),
    };

    if (existing?.id) {
      const { error: updateError } = await supabase
        .from("ai_insight_outcomes")
        .update(row)
        .eq("id", existing.id);

      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase
        .from("ai_insight_outcomes")
        .insert(row);

      if (insertError) throw insertError;
    }
  }

  return { saved: insights.length };
}

export async function POST() {
  try {
    const supabase = await getSupabaseRouteClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const locationSignals = await getLocationSignalsFromSupabase(user.id);
    const performanceSignals = await getCurrentPerformanceSignals(user.id);

    const generated: GeneratedInsight[] = [];

    const revenueRisk = findTopRevenueRisk(performanceSignals);
    if (revenueRisk) {
      generated.push(buildRevenueInsight(revenueRisk));
    }

    const reviewRisk = findTopReviewRisk(locationSignals);
    if (reviewRisk) {
      generated.push(buildReputationInsight(reviewRisk));
    }

    const growthLocation = findTopGrowthLocation(performanceSignals);
    if (
      growthLocation &&
      !generated.some(
        (x) =>
          x.locationName?.toLowerCase() === growthLocation.locationName.toLowerCase() &&
          x.type === "growth"
      )
    ) {
      generated.push(buildGrowthInsight(growthLocation));
    }

    const enriched = await enrichSnapshots(generated, locationSignals, performanceSignals);
    const result = await upsertGeneratedInsights(user.id, enriched);

    return NextResponse.json({
      ok: true,
      saved: result.saved,
      insights: enriched.map((x) => ({
        dedupeKey: x.dedupeKey,
        title: x.payload.title,
        type: x.payload.type,
        severity: x.payload.severity,
        locationName: x.locationName,
      })),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("ai-insights/generate unexpected error:", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}