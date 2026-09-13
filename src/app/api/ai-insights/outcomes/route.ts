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

type OutcomeBody = {
  type: InsightType;
  severity: InsightSeverity;
  title: string;
  summary: string;
  reason: string;
  recommendedAction: string;
  expectedImpact?: string;
  href?: string;
  cta?: string;
  locationName?: string | null;
  actionStatus?: ActionStatus;
  actionNote?: string;
};

type OutcomeRow = {
  id: string;
  dedupe_key?: string | null;
  insight_title?: string | null;
  insight_type?: string | null;
  insight_severity?: string | null;
  action_status?: string | null;
  action_note?: string | null;
  href?: string | null;
  generated_at?: string | null;
  insight_payload?: Record<string, unknown> | null;
  signal_snapshot?: Record<string, unknown> | null;
  performance_snapshot?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

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

function normalizeOutcome(row: OutcomeRow) {
  const payload = isRecord(row.insight_payload) ? row.insight_payload : null;
  const signal = isRecord(row.signal_snapshot) ? row.signal_snapshot : null;

  const title =
    row.insight_title ??
    asString(payload?.title) ??
    asString(payload?.summary) ??
    "Executed Action";

  const summary =
    asString(payload?.summary) ??
    row.action_note ??
    asString(payload?.reason) ??
    "Outcome recorded";

  const actionType =
    row.insight_type ??
    asString(payload?.type) ??
    asString(payload?.action_type) ??
    "action";

  const locationName =
    asString(signal?.locationName) ??
    asString(signal?.location_name) ??
    asString(payload?.locationName) ??
    asString(payload?.location_name) ??
    "location";

  return {
    id: row.id,
    generated_at: row.generated_at ?? row.updated_at ?? row.created_at ?? undefined,
    outcome_type: row.action_status ?? "monitoring",
    action_type: actionType,
    location_name: locationName,
    title,
    summary,
    href: row.href ?? asString(payload?.href) ?? "/command-center",
  };
}

async function getSignalSnapshotForLocation(
  userId: string,
  locationName?: string | null
): Promise<SignalSnapshot | null> {
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
        location &&
        typeof location.id === "string" &&
        typeof location.name === "string"
    );

  if (!flattenedLocations.length) return null;

  let matchedLocation =
    flattenedLocations.find(
      (location) =>
        location.title?.trim().toLowerCase() === locationName?.trim().toLowerCase()
    ) ??
    flattenedLocations.find(
      (location) => location.name.trim().toLowerCase() === locationName?.trim().toLowerCase()
    ) ??
    null;

  if (!matchedLocation && locationName) {
    matchedLocation =
      flattenedLocations.find(
        (location) =>
          locationName.toLowerCase().includes((location.title || "").toLowerCase()) ||
          locationName.toLowerCase().includes(location.name.toLowerCase())
      ) ?? null;
  }

  if (!matchedLocation) return null;

  const sinceIso = daysAgoIso(45);

  const { data: reviewRows, error: reviewError } = await supabase
    .from("reviews")
    .select("id,location_name,rating,text,update_time")
    .eq("user_id", userId)
    .eq("location_name", matchedLocation.name)
    .gte("update_time", sinceIso)
    .order("update_time", { ascending: false });

  if (reviewError) throw reviewError;

  const reviews = (reviewRows || []) as ReviewRow[];

  const rated = reviews
    .map((review) => (typeof review.rating === "number" ? review.rating : null))
    .filter((value): value is number => value !== null);

  const avgRatingRaw = avg(rated);
  const avgRating = avgRatingRaw !== null ? Number(avgRatingRaw.toFixed(1)) : null;

  const negativeReviews = reviews.filter(
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
    locationName: matchedLocation.title?.trim() || matchedLocation.name,
    avgRating,
    reviewIssueCount: negativeReviews.length,
    openAlerts,
    health,
    topIssue,
    capturedAt: new Date().toISOString(),
  };
}

async function getPerformanceSnapshotForLocation(
  userId: string,
  locationName?: string | null
): Promise<PerformanceSnapshot | null> {
  if (!locationName) return null;

  const supabase = await getSupabaseRouteClient();

  const { data, error } = await supabase
    .from("performance_signal_history")
    .select(
      "location_name, revenue, orders, avg_ticket, labor_pct, margin_pct, refunds, captured_at"
    )
    .eq("user_id", userId)
    .eq("location_name", locationName)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    locationName: String(data.location_name),
    revenue: numOrNull(data.revenue),
    orders: numOrNull(data.orders),
    avgTicket: numOrNull(data.avg_ticket),
    laborPct: numOrNull(data.labor_pct),
    marginPct: numOrNull(data.margin_pct),
    refunds: numOrNull(data.refunds),
    capturedAt: String(data.captured_at),
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

    const { data, error } = await supabase
      .from("ai_insight_outcomes")
      .select(
        "id, dedupe_key, insight_title, insight_type, insight_severity, action_status, action_note, href, generated_at, insight_payload, signal_snapshot, performance_snapshot, created_at, updated_at"
      )
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("ai-insights/outcomes GET error:", error);
      return NextResponse.json({ error: "Failed to load outcomes" }, { status: 500 });
    }

    const items = ((data || []) as OutcomeRow[]).map(normalizeOutcome);

    return NextResponse.json({
      ok: true,
      items,
      rawItems: data || [],
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("ai-insights/outcomes GET unexpected error:", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await getSupabaseRouteClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as OutcomeBody;

    const title = String(body?.title ?? "").trim();
    const summary = String(body?.summary ?? "").trim();
    const reason = String(body?.reason ?? "").trim();
    const recommendedAction = String(body?.recommendedAction ?? "").trim();

    if (!title || !summary || !reason || !recommendedAction || !body?.type || !body?.severity) {
      return NextResponse.json(
        { error: "Missing required insight fields" },
        { status: 400 }
      );
    }

    const normalizedLocationName =
      typeof body.locationName === "string" && body.locationName.trim()
        ? body.locationName.trim()
        : null;

    const dedupeKey = buildDedupeKey({
      type: body.type,
      severity: body.severity,
      title,
      locationName: normalizedLocationName,
    });

    const insightPayload: InsightPayload = {
      type: body.type,
      severity: body.severity,
      title,
      summary,
      reason,
      recommendedAction,
      expectedImpact: body.expectedImpact?.trim() || "Operational improvement",
      href: body.href?.trim() || "/command-center",
      cta: body.cta?.trim() || "Open Command Center",
    };

    const signalSnapshot = await getSignalSnapshotForLocation(user.id, normalizedLocationName);
    const performanceSnapshot = await getPerformanceSnapshotForLocation(
      user.id,
      normalizedLocationName
    );

    const { data: existing, error: existingError } = await supabase
      .from("ai_insight_outcomes")
      .select("id")
      .eq("user_id", user.id)
      .eq("dedupe_key", dedupeKey)
      .maybeSingle();

    if (existingError) {
      console.error("ai-insights/outcomes existing check error:", existingError);
      return NextResponse.json({ error: "Failed to check existing outcome" }, { status: 500 });
    }

    const row = {
      user_id: user.id,
      dedupe_key: dedupeKey,
      insight_title: title,
      insight_type: body.type,
      insight_severity: body.severity,
      action_status: body.actionStatus ?? ("monitoring" as ActionStatus),
      action_note: body.actionNote?.trim() || "",
      href: insightPayload.href,
      generated_at: new Date().toISOString(),
      insight_payload: insightPayload,
      signal_snapshot: signalSnapshot,
      performance_snapshot: performanceSnapshot,
      updated_at: new Date().toISOString(),
    };

    if (existing?.id) {
      const { error: updateError } = await supabase
        .from("ai_insight_outcomes")
        .update(row)
        .eq("id", existing.id);

      if (updateError) {
        console.error("ai-insights/outcomes update error:", updateError);
        return NextResponse.json({ error: "Failed to update outcome" }, { status: 500 });
      }

      return NextResponse.json({
        ok: true,
        mode: "updated",
        dedupeKey,
      });
    }

    const { error: insertError } = await supabase.from("ai_insight_outcomes").insert(row);

    if (insertError) {
      console.error("ai-insights/outcomes insert error:", insertError);
      return NextResponse.json({ error: "Failed to save outcome" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      mode: "created",
      dedupeKey,
    });
  } catch (error) {
    console.error("ai-insights/outcomes POST unexpected error:", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}