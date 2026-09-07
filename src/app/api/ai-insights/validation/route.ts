import { NextResponse } from "next/server";
import { getSupabaseRouteClient } from "@/lib/supabaseRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type InsightType = "reputation" | "revenue" | "ops" | "growth";
type InsightSeverity = "low" | "medium" | "high";
type ActionStatus = "acted" | "monitoring" | "dismissed";
type HealthStatus = "healthy" | "watch" | "risk";
type ValidationStatus = "improving" | "stable" | "worse" | "insufficient_data";

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
  insight_payload: InsightPayload | null;
  signal_snapshot: SignalSnapshot | null;
  performance_snapshot: PerformanceSnapshot | null;
  created_at: string;
  updated_at: string;
};

type ReviewRow = {
  id: string;
  location_name: string | null;
  rating: number | null;
  text: string | null;
  create_time: string | null;
  update_time: string | null;
};

type ReviewLocationRow = {
  id: string;
  name: string;
  title: string | null;
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

type ValidationItem = {
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
  currentPerformanceSnapshot: CurrentPerformance | null;
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
      return Array.isArray(reviewLocations)
        ? (reviewLocations as ReviewLocationRow[])
        : [];
    })
    .filter(
      (location) =>
        location &&
        typeof location.id === "string" &&
        typeof location.name === "string"
    );

  if (!flattenedLocations.length) return [];

  const sinceIso = daysAgoIso(45);

  const { data: reviewRows, error: reviewError } = await supabase
    .from("reviews")
    .select("id,location_name,rating,text,create_time,update_time")
    .eq("user_id", userId)
    .gte("update_time", sinceIso)
    .order("update_time", { ascending: false });

  if (reviewError) throw reviewError;

  const reviews = (reviewRows || []) as ReviewRow[];

  return flattenedLocations.map((location) => {
    const locationReviews = reviews.filter(
      (review) => review.location_name === location.name
    );

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
      recommendedAction: recommendedActionForIssue(
        topIssue,
        negativeReviews.length,
        avgRating
      ),
    };
  });
}

async function getCurrentPerformanceSignals(
  userId: string
): Promise<CurrentPerformance[]> {
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

function findLocationMention<T extends { name?: string; locationName?: string }>(
  texts: string[],
  locations: T[]
) {
  const haystack = texts.join(" ").toLowerCase();

  for (const location of locations) {
    const candidate = location.name ?? location.locationName;
    if (!candidate) continue;

    if (haystack.includes(candidate.toLowerCase())) {
      return location;
    }
  }

  return null;
}

function healthRank(health: HealthStatus | null) {
  if (health === "healthy") return 0;
  if (health === "watch") return 1;
  if (health === "risk") return 2;
  return null;
}

function compareOpsSnapshot(
  before: SignalSnapshot | null,
  current: LocationSignal | null
) {
  if (!before || !current) return null;

  const beforeHealth = healthRank(before.health);
  const currentHealth = healthRank(current.health);

  const ratingDelta =
    before.avgRating !== null && current.avgRating !== null
      ? Number((current.avgRating - before.avgRating).toFixed(1))
      : null;

  const issueDelta =
    before.reviewIssueCount !== null && current.reviewIssueCount !== null
      ? current.reviewIssueCount - before.reviewIssueCount
      : null;

  const alertDelta =
    before.openAlerts !== null && current.openAlerts !== null
      ? current.openAlerts - before.openAlerts
      : null;

  let score = 0;
  const parts: string[] = [];

  if (ratingDelta !== null) {
    if (ratingDelta > 0) score += 2;
    if (ratingDelta < 0) score -= 2;
    parts.push(
      ratingDelta === 0
        ? "rating unchanged"
        : ratingDelta > 0
        ? `rating up ${ratingDelta}`
        : `rating down ${Math.abs(ratingDelta)}`
    );
  }

  if (issueDelta !== null) {
    if (issueDelta < 0) score += 2;
    if (issueDelta > 0) score -= 2;
    parts.push(
      issueDelta === 0
        ? "review issues unchanged"
        : issueDelta < 0
        ? `review issues down ${Math.abs(issueDelta)}`
        : `review issues up ${issueDelta}`
    );
  }

  if (alertDelta !== null) {
    if (alertDelta < 0) score += 1;
    if (alertDelta > 0) score -= 1;
    parts.push(
      alertDelta === 0
        ? "alerts unchanged"
        : alertDelta < 0
        ? `alerts down ${Math.abs(alertDelta)}`
        : `alerts up ${alertDelta}`
    );
  }

  if (beforeHealth !== null && currentHealth !== null && before.health !== current.health) {
    if (currentHealth < beforeHealth) score += 2;
    if (currentHealth > beforeHealth) score -= 2;
    parts.push(`health moved from ${before.health} to ${current.health}`);
  }

  let status: ValidationStatus = "stable";
  if (score >= 2) status = "improving";
  if (score <= -2) status = "worse";

  return {
    status,
    summary: parts.length ? parts.join(", ") : "No meaningful ops delta detected.",
  };
}

function comparePerformanceSnapshot(
  before: PerformanceSnapshot | null,
  current: CurrentPerformance | null
) {
  if (!before || !current) return null;

  const revenueDelta =
    before.revenue !== null && current.revenue !== null
      ? Number((current.revenue - before.revenue).toFixed(2))
      : null;

  const ordersDelta =
    before.orders !== null && current.orders !== null
      ? current.orders - before.orders
      : null;

  const avgTicketDelta =
    before.avgTicket !== null && current.avgTicket !== null
      ? Number((current.avgTicket - before.avgTicket).toFixed(2))
      : null;

  const laborDelta =
    before.laborPct !== null && current.laborPct !== null
      ? Number((current.laborPct - before.laborPct).toFixed(2))
      : null;

  const marginDelta =
    before.marginPct !== null && current.marginPct !== null
      ? Number((current.marginPct - before.marginPct).toFixed(2))
      : null;

  let score = 0;
  const parts: string[] = [];

  if (revenueDelta !== null) {
    if (revenueDelta > 0) score += 2;
    if (revenueDelta < 0) score -= 2;
    parts.push(
      revenueDelta === 0
        ? "revenue unchanged"
        : revenueDelta > 0
        ? `revenue up ${revenueDelta.toFixed(0)}`
        : `revenue down ${Math.abs(revenueDelta).toFixed(0)}`
    );
  }

  if (ordersDelta !== null) {
    if (ordersDelta > 0) score += 1;
    if (ordersDelta < 0) score -= 1;
    parts.push(
      ordersDelta === 0
        ? "orders unchanged"
        : ordersDelta > 0
        ? `orders up ${ordersDelta}`
        : `orders down ${Math.abs(ordersDelta)}`
    );
  }

  if (avgTicketDelta !== null) {
    if (avgTicketDelta > 0) score += 1;
    if (avgTicketDelta < 0) score -= 1;
    parts.push(
      avgTicketDelta === 0
        ? "avg ticket unchanged"
        : avgTicketDelta > 0
        ? `avg ticket up ${avgTicketDelta.toFixed(2)}`
        : `avg ticket down ${Math.abs(avgTicketDelta).toFixed(2)}`
    );
  }

  if (laborDelta !== null) {
    if (laborDelta < 0) score += 1;
    if (laborDelta > 0) score -= 1;
    parts.push(
      laborDelta === 0
        ? "labor unchanged"
        : laborDelta < 0
        ? `labor down ${Math.abs(laborDelta).toFixed(1)} pts`
        : `labor up ${laborDelta.toFixed(1)} pts`
    );
  }

  if (marginDelta !== null) {
    if (marginDelta > 0) score += 1;
    if (marginDelta < 0) score -= 1;
    parts.push(
      marginDelta === 0
        ? "margin unchanged"
        : marginDelta > 0
        ? `margin up ${marginDelta.toFixed(1)} pts`
        : `margin down ${Math.abs(marginDelta).toFixed(1)} pts`
    );
  }

  let status: ValidationStatus = "stable";
  if (score >= 2) status = "improving";
  if (score <= -2) status = "worse";

  return {
    status,
    summary: parts.length ? parts.join(", ") : "No meaningful performance delta detected.",
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

    const { data: outcomeRows, error: outcomeError } = await supabase
      .from("ai_insight_outcomes")
      .select(
        "id, dedupe_key, insight_title, insight_type, insight_severity, action_status, action_note, href, generated_at, insight_payload, signal_snapshot, performance_snapshot, created_at, updated_at"
      )
      .eq("user_id", user.id)
      .eq("action_status", "acted")
      .order("updated_at", { ascending: false })
      .limit(10);

    if (outcomeError) {
      console.error("ai-insights/validation outcomes error:", outcomeError);
      return NextResponse.json(
        { error: "Failed to load acted outcomes" },
        { status: 500 }
      );
    }

    const outcomes = (outcomeRows || []) as OutcomeRow[];
    const locationSignals = await getLocationSignalsFromSupabase(user.id);
    const performanceSignals = await getCurrentPerformanceSignals(user.id);

    const items: ValidationItem[] = outcomes.map((outcome) => {
      const payload = outcome.insight_payload;
      const texts = [
        outcome.insight_title,
        payload?.summary ?? "",
        payload?.reason ?? "",
        payload?.recommendedAction ?? "",
        outcome.signal_snapshot?.locationName ?? "",
        outcome.performance_snapshot?.locationName ?? "",
      ];

      const locationMatch = findLocationMention(texts, locationSignals);
      const perfMatch = findLocationMention(texts, performanceSignals);

      const location = locationMatch
        ? locationSignals.find((x) => x.name === locationMatch.name) ?? null
        : null;

      const performance = perfMatch
        ? performanceSignals.find((x) => x.locationName === perfMatch.locationName) ?? null
        : null;

      const opsDelta = compareOpsSnapshot(outcome.signal_snapshot, location);
      const perfDelta = comparePerformanceSnapshot(
        outcome.performance_snapshot,
        performance
      );

      let finalStatus: ValidationStatus = "insufficient_data";
      const parts: string[] = [];

      if (opsDelta) parts.push(opsDelta.summary);
      if (perfDelta) parts.push(perfDelta.summary);

      const scores = [opsDelta?.status, perfDelta?.status].filter(
        Boolean
      ) as ValidationStatus[];

      if (scores.includes("worse")) {
        finalStatus = "worse";
      } else if (scores.includes("improving")) {
        finalStatus = "improving";
      } else if (scores.includes("stable")) {
        finalStatus = "stable";
      }

      if (!opsDelta && !perfDelta) {
        finalStatus = "insufficient_data";
        parts.push("TurnTableAI does not have enough before/after signal coverage yet.");
      }

      const locationName =
        location?.name ??
        performance?.locationName ??
        outcome.signal_snapshot?.locationName ??
        outcome.performance_snapshot?.locationName ??
        null;

      return {
        dedupeKey: outcome.dedupe_key,
        insightTitle: outcome.insight_title,
        insightType: outcome.insight_type,
        actionStatus: outcome.action_status,
        validationStatus: finalStatus,
        validationSummary: `${locationName ?? "This location"}: ${parts.join(", ")}.`,
        locationName,
        updatedAt: outcome.updated_at,
        beforeSnapshot: outcome.signal_snapshot,
        currentSnapshot: location
          ? {
              avgRating: location.avgRating,
              reviewIssueCount: location.reviewIssueCount,
              openAlerts: location.openAlerts,
              health: location.health,
              topIssue: location.topIssue,
            }
          : null,
        beforePerformanceSnapshot: outcome.performance_snapshot,
        currentPerformanceSnapshot: performance,
      };
    });

    return NextResponse.json({
      items,
      locationsAnalyzed: locationSignals.length,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("ai-insights/validation unexpected error:", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}