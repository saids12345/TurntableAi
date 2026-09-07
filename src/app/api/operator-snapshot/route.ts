import { NextResponse } from "next/server";
import { getSupabaseRouteClient } from "@/lib/supabaseRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type HealthStatus = "healthy" | "watch" | "risk";
type AlertSeverity = "low" | "medium" | "high";
type AlertType = "sales" | "reviews" | "ops";
type ActionStatus = "pending" | "in_progress" | "done";

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

type OperatorSnapshotLocation = {
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

type OperatorSnapshotAlert = {
  id: string;
  severity: AlertSeverity;
  locationName: string;
  type: AlertType;
  title: string;
  description: string;
};

type OperatorSnapshotAction = {
  id: string;
  locationName: string;
  title: string;
  reason: string;
  status: ActionStatus;
  href: string;
};

type PerformanceLocation = {
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
  severity: "low" | "medium" | "high";
  type: "revenue" | "aov" | "labor" | "margin" | "reviews";
  title: string;
  description: string;
};

type PerformanceAction = {
  id: string;
  locationName: string;
  title: string;
  reason: string;
  status: "pending" | "in_progress" | "done";
};

function daysAgoIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function avg(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function numOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
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

function recommendedActionForIssue(label: string | null) {
  if (!label) return "Review guest signals and prioritize follow-up";

  if (label.toLowerCase().includes("wait")) {
    return "Review queue flow, coach shift lead, and respond to delayed-service complaints";
  }

  if (label.toLowerCase().includes("service")) {
    return "Coach front-of-house execution and clear the review backlog quickly";
  }

  if (label.toLowerCase().includes("accuracy")) {
    return "Audit order handoff accuracy and follow up on complaint-heavy tickets";
  }

  if (label.toLowerCase().includes("cleanliness")) {
    return "Run a cleanliness check and escalate site standards immediately";
  }

  if (label.toLowerCase().includes("pricing")) {
    return "Review value perception and tighten the offer before changing pricing";
  }

  if (label.toLowerCase().includes("quality")) {
    return "Inspect prep consistency and review product-quality complaints with the team";
  }

  return "Review complaints and tighten execution";
}

function deriveHealth(params: {
  avgRating: number | null;
  negativeCount: number;
  openAlerts: number;
  salesDeltaPct: number | null;
}) {
  const { avgRating, negativeCount, openAlerts, salesDeltaPct } = params;

  if (
    (avgRating !== null && avgRating < 4) ||
    negativeCount >= 3 ||
    openAlerts >= 3 ||
    (salesDeltaPct !== null && salesDeltaPct <= -8)
  ) {
    return "risk" as const;
  }

  if (
    (avgRating !== null && avgRating < 4.4) ||
    negativeCount >= 1 ||
    openAlerts >= 1 ||
    (salesDeltaPct !== null && salesDeltaPct < 0)
  ) {
    return "watch" as const;
  }

  return "healthy" as const;
}

function commandSeverityFromHealth(health: HealthStatus): AlertSeverity {
  if (health === "risk") return "high";
  if (health === "watch") return "medium";
  return "low";
}

function reviewHref(locationName: string) {
  return `/reviews?location=${encodeURIComponent(locationName)}&severity=high`;
}

function salesHref(locationName: string) {
  return `/sales?location=${encodeURIComponent(locationName)}&sort=risk`;
}

function buildCommandCenterAlerts(locations: OperatorSnapshotLocation[]): OperatorSnapshotAlert[] {
  return locations
    .flatMap((location) => {
      const alerts: OperatorSnapshotAlert[] = [];

      if (location.salesDeltaPct !== null && location.salesDeltaPct <= -8) {
        alerts.push({
          id: `sales-${location.id}`,
          severity: "high",
          locationName: location.name,
          type: "sales",
          title: "Revenue dip detected",
          description: `Sales trend is ${location.salesDeltaPct}% and this location needs immediate attention.`,
        });
      }

      if (
        location.reviewIssueCount >= 2 ||
        (location.avgRating !== null && location.avgRating < 4)
      ) {
        alerts.push({
          id: `reviews-${location.id}`,
          severity: commandSeverityFromHealth(location.health),
          locationName: location.name,
          type: "reviews",
          title: "Review pressure building",
          description:
            location.topIssue ??
            "Guest feedback is trending negatively and should be reviewed quickly.",
        });
      }

      if (location.openAlerts > 0 && alerts.length === 0) {
        alerts.push({
          id: `ops-${location.id}`,
          severity: commandSeverityFromHealth(location.health),
          locationName: location.name,
          type: "ops",
          title: "Operational watch item",
          description:
            location.recommendedAction ?? "This location has open operational signals to review.",
        });
      }

      return alerts;
    })
    .sort((a, b) => {
      const rank = { high: 0, medium: 1, low: 2 };
      return rank[a.severity] - rank[b.severity];
    })
    .slice(0, 8);
}

function buildCommandCenterActions(locations: OperatorSnapshotLocation[]): OperatorSnapshotAction[] {
  return locations
    .flatMap((location) => {
      const actions: OperatorSnapshotAction[] = [];

      if (location.salesDeltaPct !== null && location.salesDeltaPct <= -8) {
        actions.push({
          id: `action-sales-${location.id}`,
          locationName: location.name,
          title: "Launch revenue recovery move",
          reason: `Sales trend is ${location.salesDeltaPct}% and needs immediate intervention.`,
          status: "pending",
          href: salesHref(location.name),
        });
      }

      if (
        location.reviewIssueCount >= 2 ||
        (location.avgRating !== null && location.avgRating < 4)
      ) {
        actions.push({
          id: `action-reviews-${location.id}`,
          locationName: location.name,
          title: "Resolve guest issue pressure",
          reason:
            location.topIssue ??
            "Negative reviews are clustering and need fast operator follow-up.",
          status: "pending",
          href: reviewHref(location.name),
        });
      }

      if (location.health === "watch" && location.openAlerts >= 1) {
        actions.push({
          id: `action-watch-${location.id}`,
          locationName: location.name,
          title: "Monitor location closely",
          reason: "Signals are softening and should be tracked before they worsen.",
          status: "in_progress",
          href: salesHref(location.name),
        });
      }

      if (
        location.health === "healthy" &&
        location.salesDeltaPct !== null &&
        location.salesDeltaPct > 0
      ) {
        actions.push({
          id: `action-growth-${location.id}`,
          locationName: location.name,
          title: "Test a safe growth play",
          reason: "This location is stable enough to test an upsell or promo without high risk.",
          status: "done",
          href: salesHref(location.name),
        });
      }

      if (!actions.length && location.recommendedAction) {
        actions.push({
          id: `action-default-${location.id}`,
          locationName: location.name,
          title: "Review location status",
          reason: location.recommendedAction,
          status: "pending",
          href: salesHref(location.name),
        });
      }

      return actions;
    })
    .sort((a, b) => {
      const rank = { pending: 0, in_progress: 1, done: 2 };
      return rank[a.status] - rank[b.status];
    })
    .slice(0, 10);
}

function buildPerformanceLocations(
  locations: OperatorSnapshotLocation[],
  performanceByLocation: Map<
    string,
    { latest: PerformanceSignalRow | null; previous: PerformanceSignalRow | null }
  >
): PerformanceLocation[] {
  return locations.map((location) => {
    const perfPair = performanceByLocation.get(location.name);

    const latestRevenue = numOrNull(perfPair?.latest?.revenue) ?? 0;
    const previousRevenue = numOrNull(perfPair?.previous?.revenue);
    const latestOrders = numOrNull(perfPair?.latest?.orders) ?? 0;
    const previousOrders = numOrNull(perfPair?.previous?.orders);
    const latestAov = numOrNull(perfPair?.latest?.avg_ticket) ?? 0;
    const previousAov = numOrNull(perfPair?.previous?.avg_ticket);
    const latestLabor = numOrNull(perfPair?.latest?.labor_pct) ?? 0;
    const latestMargin = numOrNull(perfPair?.latest?.margin_pct) ?? 0;
    const latestRefunds = numOrNull(perfPair?.latest?.refunds) ?? 0;

    let revenueDeltaPct = 0;
    if (latestRevenue !== null && previousRevenue !== null && previousRevenue !== 0) {
      revenueDeltaPct = Math.round(((latestRevenue - previousRevenue) / previousRevenue) * 100);
    } else if (location.salesDeltaPct !== null) {
      revenueDeltaPct = location.salesDeltaPct;
    }

    let ordersDeltaPct = 0;
    if (latestOrders !== null && previousOrders !== null && previousOrders !== 0) {
      ordersDeltaPct = Math.round(((latestOrders - previousOrders) / previousOrders) * 100);
    }

    let aovDeltaPct = 0;
    if (latestAov !== null && previousAov !== null && previousAov !== 0) {
      aovDeltaPct = Math.round(((latestAov - previousAov) / previousAov) * 100);
    }

    return {
      id: location.id,
      name: location.name,
      city: location.city,
      health: location.health,
      revenueToday: latestRevenue,
      revenueDeltaPct,
      ordersToday: latestOrders,
      ordersDeltaPct,
      aov: latestAov,
      aovDeltaPct,
      laborPct: latestLabor,
      marginPct: latestMargin,
      avgRating: location.avgRating ?? 0,
      refunds: latestRefunds,
      topIssue: location.topIssue,
      recommendedAction: location.recommendedAction,
    };
  });
}

function perfSeverityFromLocation(location: PerformanceLocation): "low" | "medium" | "high" {
  if (location.health === "risk") return "high";
  if (location.health === "watch") return "medium";
  return "low";
}

function buildPerformanceAlerts(locations: PerformanceLocation[]): PerformanceAlert[] {
  return locations
    .flatMap((location) => {
      const alerts: PerformanceAlert[] = [];

      if (location.revenueDeltaPct <= -8) {
        alerts.push({
          id: `perf-revenue-${location.id}`,
          locationName: location.name,
          severity: "high",
          type: "revenue",
          title: `Revenue down ${Math.abs(location.revenueDeltaPct)}%`,
          description: "Revenue trend needs immediate attention versus baseline.",
        });
      }

      if (location.laborPct > 22) {
        alerts.push({
          id: `perf-labor-${location.id}`,
          locationName: location.name,
          severity: location.laborPct >= 25 ? "high" : "medium",
          type: "labor",
          title: "Labor above target",
          description: `Labor is at ${location.laborPct}%, above the target operating range.`,
        });
      }

      if (location.aovDeltaPct < 0) {
        alerts.push({
          id: `perf-aov-${location.id}`,
          locationName: location.name,
          severity: location.aovDeltaPct <= -3 ? "medium" : "low",
          type: "aov",
          title: "Average ticket softening",
          description: "Average ticket is trending down and may need bundle or upsell attention.",
        });
      }

      if ((location.avgRating ?? 5) < 4.2 || (location.topIssue ?? "").toLowerCase().includes("review")) {
        alerts.push({
          id: `perf-reviews-${location.id}`,
          locationName: location.name,
          severity: perfSeverityFromLocation(location),
          type: "reviews",
          title: "Reputation pressure affecting performance",
          description:
            location.topIssue ?? "Review sentiment may be dragging guest conversion.",
        });
      }

      if (location.marginPct >= 65) {
        alerts.push({
          id: `perf-margin-${location.id}`,
          locationName: location.name,
          severity: "low",
          type: "margin",
          title: "Margin leader",
          description: "Strong margin performance makes this a good low-risk test location.",
        });
      }

      if (!alerts.length) {
        alerts.push({
          id: `perf-generic-${location.id}`,
          locationName: location.name,
          severity: perfSeverityFromLocation(location),
          type: "revenue",
          title: "Performance watch",
          description:
            location.recommendedAction ?? "Review this location’s current KPI mix.",
        });
      }

      return alerts;
    })
    .sort((a, b) => {
      const rank = { high: 0, medium: 1, low: 2 };
      return rank[a.severity] - rank[b.severity];
    })
    .slice(0, 8);
}

function buildPerformanceActions(locations: PerformanceLocation[]): PerformanceAction[] {
  return locations
    .flatMap((location) => {
      const actions: PerformanceAction[] = [];

      if (location.revenueDeltaPct <= -8) {
        actions.push({
          id: `perf-action-revenue-${location.id}`,
          locationName: location.name,
          title: "Launch revenue recovery campaign",
          reason: `Revenue is down ${Math.abs(location.revenueDeltaPct)}% and needs immediate intervention.`,
          status: "pending",
        });
      }

      if (location.laborPct > 22) {
        actions.push({
          id: `perf-action-labor-${location.id}`,
          locationName: location.name,
          title: "Reduce labor waste",
          reason: "Labor is above target and should be tightened against demand.",
          status: "pending",
        });
      }

      if ((location.avgRating ?? 5) < 4.2 || location.topIssue) {
        actions.push({
          id: `perf-action-reviews-${location.id}`,
          locationName: location.name,
          title: "Fix guest friction",
          reason:
            location.topIssue ??
            "Guest experience signals should be addressed before performance worsens.",
          status: "in_progress",
        });
      }

      if (location.health === "healthy" && location.marginPct >= 65) {
        actions.push({
          id: `perf-action-growth-${location.id}`,
          locationName: location.name,
          title: "Test a high-margin growth move",
          reason: "Strong margin and healthy signals make this a safe test location.",
          status: "done",
        });
      }

      if (!actions.length) {
        actions.push({
          id: `perf-action-default-${location.id}`,
          locationName: location.name,
          title: "Review operator follow-up",
          reason:
            location.recommendedAction ??
            "Review this location and decide the next best move.",
          status: "pending",
        });
      }

      return actions;
    })
    .sort((a, b) => {
      const rank = { pending: 0, in_progress: 1, done: 2 };
      return rank[a.status] - rank[b.status];
    })
    .slice(0, 10);
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

    const { data: locationRows, error: locationError } = await supabase
      .from("review_connections")
      .select("review_locations(id,name,title)")
      .eq("user_id", user.id)
      .eq("provider", "google");

    if (locationError) {
      console.error("operator-snapshot location error:", locationError);
      return NextResponse.json({ error: "Failed to load locations" }, { status: 500 });
    }

    const reviewLocations: ReviewLocationRow[] = (locationRows || [])
      .flatMap((row: Record<string, unknown>) => {
        const reviewLocationsValue = row.review_locations;
        return Array.isArray(reviewLocationsValue)
          ? (reviewLocationsValue as ReviewLocationRow[])
          : [];
      })
      .filter(
        (location) =>
          location && typeof location.id === "string" && typeof location.name === "string"
      );

    const sinceReviewsIso = daysAgoIso(45);

    const { data: reviewRows, error: reviewError } = await supabase
      .from("reviews")
      .select("id, location_name, rating, text, update_time")
      .eq("user_id", user.id)
      .gte("update_time", sinceReviewsIso)
      .order("update_time", { ascending: false });

    if (reviewError) {
      console.error("operator-snapshot review error:", reviewError);
      return NextResponse.json({ error: "Failed to load reviews" }, { status: 500 });
    }

    const { data: performanceRows, error: performanceError } = await supabase
      .from("performance_signal_history")
      .select(
        "id, location_name, revenue, orders, avg_ticket, labor_pct, margin_pct, refunds, captured_at"
      )
      .eq("user_id", user.id)
      .order("captured_at", { ascending: false });

    if (performanceError) {
      console.error("operator-snapshot performance error:", performanceError);
      return NextResponse.json({ error: "Failed to load performance signals" }, { status: 500 });
    }

    const reviews = (reviewRows || []) as ReviewRow[];
    const perf = (performanceRows || []) as PerformanceSignalRow[];

    const performanceByLocation = new Map<
      string,
      { latest: PerformanceSignalRow | null; previous: PerformanceSignalRow | null }
    >();

    for (const row of perf) {
      const key = row.location_name;
      const existing = performanceByLocation.get(key);

      if (!existing) {
        performanceByLocation.set(key, { latest: row, previous: null });
        continue;
      }

      if (!existing.previous) {
        performanceByLocation.set(key, { latest: existing.latest, previous: row });
      }
    }

    const allLocationNames = Array.from(
      new Set([
        ...reviewLocations.map((x) => x.title?.trim() || x.name),
        ...perf.map((x) => x.location_name),
      ])
    ).filter(Boolean) as string[];

    const locations: OperatorSnapshotLocation[] = allLocationNames
      .map((locationName, index) => {
        const matchingLocation =
          reviewLocations.find((x) => (x.title?.trim() || x.name) === locationName) ?? null;

        const locationReviews = reviews.filter((review) => review.location_name === locationName);
        const rated = locationReviews
          .map((review) => numOrNull(review.rating))
          .filter((value): value is number => value !== null);

        const avgRatingRaw = avg(rated);
        const avgRating = avgRatingRaw !== null ? Number(avgRatingRaw.toFixed(1)) : null;

        const negativeReviews = locationReviews.filter((review) => {
          const rating = numOrNull(review.rating);
          return rating !== null && rating <= 3;
        });

        const issueBuckets = detectIssueBuckets(negativeReviews);
        const topIssue = topIssueLabel(issueBuckets);

        const perfPair = performanceByLocation.get(locationName);
        const latestRevenue = numOrNull(perfPair?.latest?.revenue);
        const previousRevenue = numOrNull(perfPair?.previous?.revenue);

        let salesDeltaPct: number | null = null;
        if (latestRevenue !== null && previousRevenue !== null && previousRevenue !== 0) {
          salesDeltaPct = Math.round(((latestRevenue - previousRevenue) / previousRevenue) * 100);
        }

        let openAlerts = 0;
        if (avgRating !== null && avgRating < 4) openAlerts += 1;
        if (negativeReviews.length >= 2) openAlerts += 1;
        if (salesDeltaPct !== null && salesDeltaPct < 0) openAlerts += 1;
        if (topIssue) openAlerts += 1;

        const health = deriveHealth({
          avgRating,
          negativeCount: negativeReviews.length,
          openAlerts,
          salesDeltaPct,
        });

        return {
          id: matchingLocation?.id ?? `live-${index + 1}`,
          name: locationName,
          city: "San Diego",
          health,
          salesDeltaPct,
          reviewIssueCount: negativeReviews.length,
          openAlerts,
          avgRating,
          topIssue,
          recommendedAction:
            topIssue
              ? recommendedActionForIssue(topIssue)
              : salesDeltaPct !== null && salesDeltaPct < 0
              ? "Review sales trend and tighten the recovery plan for this location"
              : "No action needed",
        };
      })
      .sort((a, b) => {
        const rank = { risk: 0, watch: 1, healthy: 2 };
        return rank[a.health] - rank[b.health];
      });

    const alerts = buildCommandCenterAlerts(locations);
    const actions = buildCommandCenterActions(locations);

    const performanceLocations = buildPerformanceLocations(locations, performanceByLocation);
    const performanceAlerts = buildPerformanceAlerts(performanceLocations);
    const performanceActions = buildPerformanceActions(performanceLocations);

    return NextResponse.json({
      locations,
      alerts,
      actions,
      performanceLocations,
      performanceAlerts,
      performanceActions,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("operator-snapshot unexpected error:", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}