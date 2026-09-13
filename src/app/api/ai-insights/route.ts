import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getSupabaseRouteClient } from "@/lib/supabaseRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type InsightSeverity = "low" | "medium" | "high";
type InsightType = "reputation" | "revenue" | "ops" | "growth";

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

type LocationSignal = {
  id: string;
  name: string;
  city: string;
  health: "healthy" | "watch" | "risk";
  salesDeltaPct: number | null;
  reviewIssueCount: number;
  openAlerts: number;
  avgRating: number | null;
  topIssue: string | null;
  recommendedAction: string | null;
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

const FALLBACK_LOCATION_SIGNALS: LocationSignal[] = [
  {
    id: "loc_1",
    name: "Mira Mesa",
    city: "San Diego",
    health: "risk",
    salesDeltaPct: -9,
    reviewIssueCount: 2,
    openAlerts: 3,
    avgRating: 3.9,
    topIssue: "Lunch traffic weak + wait-time complaints",
    recommendedAction: "Review lunch promo and manager follow-up",
  },
  {
    id: "loc_2",
    name: "Chula Vista",
    city: "San Diego",
    health: "healthy",
    salesDeltaPct: 3,
    reviewIssueCount: 0,
    openAlerts: 0,
    avgRating: 4.6,
    topIssue: null,
    recommendedAction: "No action needed",
  },
  {
    id: "loc_3",
    name: "Escondido",
    city: "San Diego",
    health: "watch",
    salesDeltaPct: -4,
    reviewIssueCount: 3,
    openAlerts: 2,
    avgRating: 4.1,
    topIssue: "Service complaints increasing",
    recommendedAction: "Review queue and coach shift lead",
  },
  {
    id: "loc_4",
    name: "La Jolla",
    city: "San Diego",
    health: "healthy",
    salesDeltaPct: 6,
    reviewIssueCount: 1,
    openAlerts: 0,
    avgRating: 4.7,
    topIssue: null,
    recommendedAction: "No action needed",
  },
];

function safeString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function safeSeverity(value: unknown): InsightSeverity {
  return value === "high" || value === "medium" || value === "low" ? value : "medium";
}

function safeType(value: unknown): InsightType {
  return value === "reputation" ||
    value === "revenue" ||
    value === "ops" ||
    value === "growth"
    ? value
    : "ops";
}

function safeHref(value: unknown, type: InsightType): string {
  if (typeof value === "string" && ["/command-center", "/reviews", "/sales"].includes(value)) {
    return value;
  }
  if (type === "reputation") return "/reviews";
  if (type === "revenue" || type === "growth") return "/sales";
  return "/command-center";
}

function safeCta(value: unknown, href: string): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (href === "/reviews") return "Open Reviews";
  if (href === "/sales") return "Open Performance";
  return "Open Command Center";
}

function normalizeInsights(raw: unknown): InsightItem[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item, index) => {
      const record = (item ?? {}) as Record<string, unknown>;
      const type = safeType(record.type);
      const href = safeHref(record.href, type);

      return {
        id: `insight_${index + 1}`,
        type,
        severity: safeSeverity(record.severity),
        title: safeString(record.title, "Operator insight"),
        summary: safeString(record.summary, "A meaningful operating signal was detected."),
        reason: safeString(
          record.reason,
          "This insight was generated from current restaurant operating signals."
        ),
        recommendedAction: safeString(
          record.recommendedAction,
          "Review the linked workflow and take the next best action."
        ),
        expectedImpact: safeString(
          record.expectedImpact,
          "Potential operating improvement if handled quickly."
        ),
        href,
        cta: safeCta(record.cta, href),
      };
    })
    .slice(0, 4);
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

function recommendedActionForIssue(label: string | null, negativeCount: number, avgRating: number | null) {
  if (!label) return negativeCount > 0 ? "Review guest complaints and respond quickly" : "No action needed";

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

function buildFallbackInsights(locations: LocationSignal[]): InsightItem[] {
  const sorted = [...locations].sort((a, b) => {
    const rank = { risk: 0, watch: 1, healthy: 2 };
    return rank[a.health] - rank[b.health];
  });

  const worst = sorted[0];
  const bestGrowth = [...locations]
    .filter((l) => l.health === "healthy")
    .sort((a, b) => (b.salesDeltaPct ?? 0) - (a.salesDeltaPct ?? 0))[0];

  const insights: InsightItem[] = [];

  if (worst) {
    insights.push({
      id: "fallback_1",
      type: worst.avgRating !== null && worst.avgRating < 4 ? "reputation" : "ops",
      severity: worst.health === "risk" ? "high" : "medium",
      title: `${worst.name} is the highest-priority location right now`,
      summary:
        "This location shows the strongest combined risk signals and should get operator attention first.",
      reason:
        "When one location stacks guest sentiment pressure, complaints, and alerts, spreading attention evenly across all stores is weak management.",
      recommendedAction:
        worst.recommendedAction || "Review this location first and clear the most urgent issues.",
      expectedImpact:
        "Fast intervention here is the most likely path to near-term stabilization.",
      href: worst.avgRating !== null && worst.avgRating < 4 ? "/reviews" : "/command-center",
      cta: worst.avgRating !== null && worst.avgRating < 4 ? "Open Reviews" : "Review Priorities",
    });
  }

  if (bestGrowth) {
    insights.push({
      id: "fallback_2",
      type: "growth",
      severity: "low",
      title: `${bestGrowth.name} is the safest location for experimentation`,
      summary:
        "This location is stable enough to test growth ideas without stacking unnecessary operational risk.",
      reason:
        "Healthy stores are where you test new ideas. Weak stores are where you stabilize fundamentals.",
      recommendedAction:
        "Use this location for a high-margin upsell, premium offer, or low-risk promo test.",
      expectedImpact:
        "Better test quality and lower rollout risk for future growth actions.",
      href: "/sales",
      cta: "Open Performance",
    });
  }

  return insights.slice(0, 4);
}

async function getLocationSignalsFromSupabase(userId: string): Promise<LocationSignal[]> {
  const supabase = await getSupabaseRouteClient();

  const { data: locationRows, error: locationError } = await supabase
    .from("review_connections")
    .select("review_locations(id,name,title)")
    .eq("user_id", userId)
    .eq("provider", "google");

  if (locationError) {
    throw locationError;
  }

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

  if (!flattenedLocations.length) {
    return [];
  }

  const sinceIso = daysAgoIso(45);

  const { data: reviewRows, error: reviewError } = await supabase
    .from("reviews")
    .select("id,location_name,rating,text,create_time,update_time")
    .eq("user_id", userId)
    .gte("update_time", sinceIso)
    .order("update_time", { ascending: false });

  if (reviewError) {
    throw reviewError;
  }

  const reviews = (reviewRows || []) as ReviewRow[];

  const signals: LocationSignal[] = flattenedLocations.map((location) => {
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

  return signals;
}

async function getAuthenticatedUserId() {
  const supabase = await getSupabaseRouteClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user?.id ?? null;
}

export async function GET() {
  const userId = await getAuthenticatedUserId();

  let liveSignals: LocationSignal[] = [];
  let signalSource: "live" | "fallback" = "fallback";

  if (userId) {
    try {
      liveSignals = await getLocationSignalsFromSupabase(userId);
      if (liveSignals.length > 0) {
        signalSource = "live";
      }
    } catch (error) {
      console.error("ai-insights signal build error:", error);
    }
  }

  const locationSignals =
    liveSignals.length > 0 ? liveSignals : FALLBACK_LOCATION_SIGNALS;

  const fallbackInsights = buildFallbackInsights(locationSignals);

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      source: "fallback",
      signalSource,
      userId,
      insights: fallbackInsights,
      locationsAnalyzed: locationSignals.length,
    });
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const system = `
You are the AI operating brain for a multi-location restaurant platform.
Your job is to identify the highest-leverage operational insights from restaurant signals.

Return ONLY valid JSON in this exact shape:
{
  "insights": [
    {
      "type": "reputation" | "revenue" | "ops" | "growth",
      "severity": "low" | "medium" | "high",
      "title": string,
      "summary": string,
      "reason": string,
      "recommendedAction": string,
      "expectedImpact": string,
      "href": string,
      "cta": string
    }
  ]
}

Rules:
- Return 3 to 4 insights only.
- Prioritize the highest-leverage insights first.
- Be specific and operator-grade, not generic.
- Tie each insight to actual restaurant action.
- Use href values from this set only: "/command-center", "/reviews", "/sales".
- If salesDeltaPct is null, do not invent revenue claims.
- If reputation or complaint pressure is strongest, prioritize that.
- If a healthy location is best for experimentation, call that out.
- No markdown.
- No explanation outside JSON.
`.trim();

    const user = `
Current location signals:
${JSON.stringify(locationSignals, null, 2)}

Think like a ruthless multi-location restaurant operator.
Find the few actions that matter most right now.
Do not give vague advice.
Do not invent numbers that are not present.
`.trim();

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.2,
    });

    const output = response.output_text?.trim() || "";

    let parsed: unknown = null;
    try {
      parsed = JSON.parse(output);
    } catch {
      parsed = null;
    }

    const insights = normalizeInsights(
      (parsed as { insights?: unknown[] } | null)?.insights
    );

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      source: insights.length > 0 ? "openai" : "fallback",
      signalSource,
      userId,
      insights: insights.length > 0 ? insights : fallbackInsights,
      locationsAnalyzed: locationSignals.length,
    });
  } catch (error) {
    console.error("ai-insights OpenAI error:", error);

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      source: "fallback",
      signalSource,
      userId,
      insights: fallbackInsights,
      locationsAnalyzed: locationSignals.length,
    });
  }
}