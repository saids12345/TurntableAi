import { getSupabaseRouteClient } from "@/lib/supabaseRoute";

export type HealthStatus = "healthy" | "watch" | "risk";
export type AlertSeverity = "low" | "medium" | "high";
export type AlertType = "sales" | "reviews" | "ops";
export type ActionStatus = "pending" | "in_progress" | "done";
export type ReviewSeverity = "low" | "medium" | "high";
export type ReviewStatus = "new" | "drafted" | "escalated" | "resolved";
export type Platform = "Google" | "Yelp";
export type IssueType =
  | "wait_time"
  | "food_quality"
  | "staff_behavior"
  | "wrong_order"
  | "cleanliness"
  | "pricing"
  | "general";

export type CommandCenterLocation = {
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

export type CommandCenterAlert = {
  id: string;
  severity: AlertSeverity;
  locationName: string;
  type: AlertType;
  title: string;
  description: string;
};

export type CommandCenterAction = {
  id: string;
  locationName: string;
  title: string;
  reason: string;
  status: ActionStatus;
  href: string;
};

export type BriefingItem = {
  id: string;
  locationName: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  recommendedAction: string;
};

export type MorningBriefing = {
  headline: string;
  summary: string;
  resolvedWins: number;
  items: BriefingItem[];
};

export type ReviewItem = {
  id: string;
  locationName: string;
  platform: Platform;
  reviewerName: string;
  rating: number;
  reviewText: string;
  createdAt: string;
  severity: ReviewSeverity;
  status: ReviewStatus;
  issueType: IssueType;
  suggestedReply: string;
  note: string;
};

export type LocationPerformance = {
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

type ReviewRow = {
  id: string;
  location_name: string | null;
  rating: number | null;
  text: string | null;
  reviewer_name?: string | null;
  platform?: string | null;
  update_time: string | null;
  create_time?: string | null;
  owner_reply?: string | null;
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

function daysAgoIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function avg(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function numOrZero(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function numOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function normalizeLocationName(value: string | null | undefined) {
  return (value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePlatform(value: string | null | undefined): Platform {
  return value?.toLowerCase().includes("yelp") ? "Yelp" : "Google";
}

function issueTypeFromText(text: string): IssueType {
  const lower = text.toLowerCase();

  if (
    lower.includes("wait") ||
    lower.includes("slow") ||
    lower.includes("line") ||
    lower.includes("delay") ||
    lower.includes("late")
  ) {
    return "wait_time";
  }

  if (
    lower.includes("wrong order") ||
    lower.includes("incorrect") ||
    lower.includes("missing") ||
    lower.includes("forgot") ||
    lower.includes("mixed up")
  ) {
    return "wrong_order";
  }

  if (
    lower.includes("dirty") ||
    lower.includes("clean") ||
    lower.includes("messy") ||
    lower.includes("bathroom")
  ) {
    return "cleanliness";
  }

  if (
    lower.includes("expensive") ||
    lower.includes("overpriced") ||
    lower.includes("price") ||
    lower.includes("cost")
  ) {
    return "pricing";
  }

  if (
    lower.includes("cold") ||
    lower.includes("stale") ||
    lower.includes("burnt") ||
    lower.includes("taste") ||
    lower.includes("flavor") ||
    lower.includes("quality")
  ) {
    return "food_quality";
  }

  if (
    lower.includes("staff") ||
    lower.includes("rude") ||
    lower.includes("service") ||
    lower.includes("attitude") ||
    lower.includes("employee")
  ) {
    return "staff_behavior";
  }

  return "general";
}

function reviewSeverityFromRating(rating: number): ReviewSeverity {
  if (rating <= 2) return "high";
  if (rating === 3 || rating === 4) return "medium";
  return "low";
}

function reviewStatusFromRatingAndReply(rating: number, ownerReply?: string | null): ReviewStatus {
  if (ownerReply?.trim()) return "resolved";
  if (rating <= 2) return "escalated";
  if (rating === 3) return "drafted";
  return "new";
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

    if (!matched) buckets.general += 1;
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

function severityFromLocation(location: CommandCenterLocation): AlertSeverity {
  if (location.health === "risk") return "high";
  if (location.health === "watch") return "medium";
  return "low";
}

function reviewHref(locationName: string) {
  return `/reviews?location=${encodeURIComponent(locationName)}&severity=high`;
}

function salesHref(locationName: string) {
  return `/sales?location=${encodeURIComponent(locationName)}&sort=risk`;
}

function buildLocationAlert(location: CommandCenterLocation): CommandCenterAlert | null {
  if (location.salesDeltaPct !== null && location.salesDeltaPct <= -8) {
    return {
      id: `sales-${location.id}`,
      severity: "high",
      locationName: location.name,
      type: "sales",
      title: "Revenue dip detected",
      description: `Sales trend is ${location.salesDeltaPct}% and this location needs immediate attention.`,
    };
  }

  if (location.reviewIssueCount >= 2 || (location.avgRating !== null && location.avgRating < 4)) {
    return {
      id: `reviews-${location.id}`,
      severity: severityFromLocation(location),
      locationName: location.name,
      type: "reviews",
      title: "Review pressure building",
      description:
        location.topIssue ??
        "Guest feedback is trending negatively and should be reviewed quickly.",
    };
  }

  if (location.openAlerts > 0) {
    return {
      id: `ops-${location.id}`,
      severity: severityFromLocation(location),
      locationName: location.name,
      type: "ops",
      title: "Operational watch item",
      description:
        location.recommendedAction ?? "This location has open operational signals to review.",
    };
  }

  return null;
}

function buildActionsForLocation(location: CommandCenterLocation): CommandCenterAction[] {
  const actions: CommandCenterAction[] = [];

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

  if (location.reviewIssueCount >= 2 || (location.avgRating !== null && location.avgRating < 4)) {
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
}

function buildBriefing(
  locations: CommandCenterLocation[],
  alerts: CommandCenterAlert[],
  actions: CommandCenterAction[]
): MorningBriefing {
  const needsAttention = locations.filter((l) => l.health !== "healthy").length;
  const resolvedWins = actions.filter((a) => a.status === "done").length;

  const topRiskLocations = [...locations]
    .sort((a, b) => {
      const rank = { risk: 0, watch: 1, healthy: 2 };
      return rank[a.health] - rank[b.health];
    })
    .slice(0, 3);

  const items: BriefingItem[] = topRiskLocations.map((location, index) => {
    const matchingAlert = alerts.find((a) => a.locationName === location.name) ?? null;

    return {
      id: `briefing-${location.id}-${index}`,
      locationName: location.name,
      type: matchingAlert?.type ?? "ops",
      severity: matchingAlert?.severity ?? severityFromLocation(location),
      title:
        matchingAlert?.title ??
        (location.health === "risk"
          ? "Immediate operator attention needed"
          : location.health === "watch"
            ? "Monitor this location closely"
            : "Stable performance"),
      description:
        matchingAlert?.description ??
        location.topIssue ??
        "This location is currently stable with no major issues detected.",
      recommendedAction:
        location.recommendedAction ?? "Review current performance and guest signals.",
    };
  });

  const leadSales = locations.find((l) => l.salesDeltaPct !== null && l.salesDeltaPct <= -8);
  const leadReview = locations.find(
    (l) => l.reviewIssueCount >= 2 || (l.avgRating !== null && l.avgRating < 4)
  );
  const stableLocation = locations.find((l) => l.health === "healthy");

  const summaryParts: string[] = [];

  if (leadSales) summaryParts.push(`Start with revenue pressure at ${leadSales.name}`);
  if (leadReview && leadReview.name !== leadSales?.name) {
    summaryParts.push(`watch guest sentiment at ${leadReview.name}`);
  }
  if (stableLocation) {
    summaryParts.push(`${stableLocation.name} is your safest location for controlled growth tests`);
  }

  const summary =
    summaryParts.length > 0
      ? `${summaryParts.join(", ")}.`
      : "No major risk cluster detected right now. Stay focused on consistent execution across locations.";

  return {
    headline: `${needsAttention} location${needsAttention === 1 ? "" : "s"} need attention today`,
    summary,
    resolvedWins,
    items,
  };
}

function buildSuggestedReply(review: ReviewRow) {
  const reviewer = review.reviewer_name?.trim() || "there";
  const rating = numOrNull(review.rating) ?? 0;
  const text = review.text?.trim() || "";
  const issueType = issueTypeFromText(text);

  if (rating <= 2) {
    switch (issueType) {
      case "wait_time":
        return `Thanks for sharing this feedback, ${reviewer}. We’re sorry the wait felt longer than it should have. We’re reviewing service flow with the team and would appreciate the chance to make this right.`;
      case "wrong_order":
        return `${reviewer}, we’re sorry your order was not handled correctly. That’s not the experience we want anyone to have, and we’d appreciate the chance to follow up and make it right.`;
      case "cleanliness":
        return `${reviewer}, we’re sorry this visit missed the mark. Your feedback on cleanliness is important, and we’re reviewing it with the team immediately.`;
      case "food_quality":
        return `Thanks for letting us know, ${reviewer}. We’re sorry the quality did not meet expectations, and we’re reviewing this with the team right away.`;
      case "pricing":
        return `Thanks for the honest feedback, ${reviewer}. We take value perception seriously and appreciate you sharing your experience with us.`;
      default:
        return `Thanks for sharing this feedback, ${reviewer}. We’re sorry this visit did not meet expectations and appreciate the chance to improve.`;
    }
  }

  if (rating === 3 || rating === 4) {
    return `Thanks for the feedback, ${reviewer}. We appreciate the note and are using it to improve the guest experience.`;
  }

  return `Thank you so much, ${reviewer}. We’re glad you had a great experience and appreciate the support.`;
}

export async function getOperatorSnapshot(userId: string) {
  const supabase = await getSupabaseRouteClient();

  let locationRows: unknown[] = [];
  let reviewRows: ReviewRow[] = [];
  let performanceRows: PerformanceSignalRow[] = [];

  try {
    const { data, error } = await supabase
      .from("review_connections")
      .select("review_locations(id,name,title)")
      .eq("user_id", userId)
      .eq("provider", "google");

    if (error) {
      throw new Error(`review_connections query failed: ${error.message}`);
    }

    locationRows = Array.isArray(data) ? data : [];
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : "Failed to load review connections"
    );
  }

  const reviewLocations: ReviewLocationRow[] = locationRows
    .flatMap((row) => {
      const safeRow =
        row && typeof row === "object" && !Array.isArray(row)
          ? (row as Record<string, unknown>)
          : null;

      const reviewLocationsValue = safeRow?.review_locations;
      return Array.isArray(reviewLocationsValue)
        ? (reviewLocationsValue as ReviewLocationRow[])
        : [];
    })
    .filter(
      (location) =>
        location &&
        typeof location.id === "string" &&
        typeof location.name === "string"
    );

  const locationLookup = new Map<string, { id: string; displayName: string }>();

  for (const location of reviewLocations) {
    const displayName = location.title?.trim() || location.name;
    const normalized = normalizeLocationName(displayName);
    if (!normalized) continue;

    locationLookup.set(normalized, {
      id: location.id,
      displayName,
    });
  }

  const sinceReviewsIso = daysAgoIso(45);

  try {
    const { data, error } = await supabase
      .from("reviews")
      .select("id, location_name, rating, text, reviewer_name, update_time, create_time")
      .eq("user_id", userId)
      .gte("update_time", sinceReviewsIso)
      .order("update_time", { ascending: false });

    if (error) {
      throw new Error(`reviews query failed: ${error.message}`);
    }

    reviewRows = (Array.isArray(data) ? data : []) as ReviewRow[];
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Failed to load reviews");
  }

  try {
    const { data, error } = await supabase
      .from("performance_signal_history")
      .select(
        "id, location_name, revenue, orders, avg_ticket, labor_pct, margin_pct, refunds, captured_at"
      )
      .eq("user_id", userId)
      .order("captured_at", { ascending: false });

    if (error) {
      throw new Error(`performance_signal_history query failed: ${error.message}`);
    }

    performanceRows = (Array.isArray(data) ? data : []) as PerformanceSignalRow[];
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : "Failed to load performance signal history"
    );
  }

  const reviews = reviewRows;
  const perf = performanceRows;

  const performanceByLocation = new Map<
    string,
    { latest: PerformanceSignalRow | null; previous: PerformanceSignalRow | null }
  >();

  for (const row of perf) {
    const key = normalizeLocationName(row.location_name);
    if (!key) continue;

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
      ...reviews
        .map((x) => x.location_name)
        .filter((value): value is string => typeof value === "string" && !!value.trim()),
    ])
  ).filter(Boolean) as string[];

  const locations: CommandCenterLocation[] = allLocationNames.map((locationName, index) => {
    const normalizedName = normalizeLocationName(locationName);
    const matchingLocation = locationLookup.get(normalizedName) ?? null;

    const locationReviews = reviews.filter(
      (review) => normalizeLocationName(review.location_name) === normalizedName
    );

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

    const perfPair = performanceByLocation.get(normalizedName);
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

    const recommendedAction =
      topIssue
        ? recommendedActionForIssue(topIssue)
        : salesDeltaPct !== null && salesDeltaPct < 0
          ? "Review sales trend and tighten the recovery plan for this location"
          : "No action needed";

    return {
      id: matchingLocation?.id ?? `live-${index + 1}`,
      name: matchingLocation?.displayName ?? locationName,
      city: "San Diego",
      health,
      salesDeltaPct,
      reviewIssueCount: negativeReviews.length,
      openAlerts,
      avgRating,
      topIssue,
      recommendedAction,
    };
  });

  const sortedLocations = [...locations].sort((a, b) => {
    const rank = { risk: 0, watch: 1, healthy: 2 };
    return rank[a.health] - rank[b.health];
  });

  const alerts = sortedLocations
    .map(buildLocationAlert)
    .filter((x): x is CommandCenterAlert => x !== null)
    .sort((a, b) => {
      const rank = { high: 0, medium: 1, low: 2 };
      return rank[a.severity] - rank[b.severity];
    })
    .slice(0, 6);

  const actions = sortedLocations
    .flatMap(buildActionsForLocation)
    .sort((a, b) => {
      const rank = { pending: 0, in_progress: 1, done: 2 };
      return rank[a.status] - rank[b.status];
    })
    .slice(0, 8);

  const briefing = buildBriefing(sortedLocations, alerts, actions);

  const reviewItems: ReviewItem[] = reviews.map((review) => {
    const rating = numOrZero(review.rating);
    const text = review.text?.trim() || "";
    const createdAt = review.update_time || review.create_time || new Date().toISOString();

    return {
      id: review.id,
      locationName: review.location_name?.trim() || "Unknown Location",
      platform: normalizePlatform(review.platform),
      reviewerName: review.reviewer_name?.trim() || "Guest",
      rating,
      reviewText: text || "No review text provided.",
      createdAt,
      severity: reviewSeverityFromRating(rating),
      status: reviewStatusFromRatingAndReply(rating, review.owner_reply),
      issueType: issueTypeFromText(text),
      suggestedReply: buildSuggestedReply(review),
      note: "",
    };
  });

  const performanceItems: LocationPerformance[] = sortedLocations.map((location) => {
    const perfPair = performanceByLocation.get(normalizeLocationName(location.name));
    const latest = perfPair?.latest;
    const previous = perfPair?.previous;

    const revenueToday = numOrZero(latest?.revenue);
    const ordersToday = numOrZero(latest?.orders);
    const aov = numOrZero(latest?.avg_ticket);
    const laborPct = numOrZero(latest?.labor_pct);
    const marginPct = numOrZero(latest?.margin_pct);
    const refunds = numOrZero(latest?.refunds);

    let ordersDeltaPct = 0;
    const previousOrders = numOrNull(previous?.orders);
    if (previousOrders !== null && previousOrders !== 0) {
      ordersDeltaPct = Math.round(((ordersToday - previousOrders) / previousOrders) * 100);
    }

    let aovDeltaPct = 0;
    const previousAov = numOrNull(previous?.avg_ticket);
    if (previousAov !== null && previousAov !== 0) {
      aovDeltaPct = Math.round(((aov - previousAov) / previousAov) * 100);
    }

    return {
      id: location.id,
      name: location.name,
      city: location.city,
      health: location.health,
      revenueToday,
      revenueDeltaPct: location.salesDeltaPct ?? 0,
      ordersToday,
      ordersDeltaPct,
      aov,
      aovDeltaPct,
      laborPct,
      marginPct,
      avgRating: location.avgRating ?? 0,
      refunds,
      topIssue: location.topIssue,
      recommendedAction: location.recommendedAction,
    };
  });

  return {
    locations: sortedLocations,
    alerts,
    actions,
    briefing,
    reviews: reviewItems,
    performance: performanceItems,
    generatedAt: new Date().toISOString(),
  };
}