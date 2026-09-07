import { getSupabaseRouteClient } from "@/lib/supabaseRoute";

export type RestaurantStateLevel = "excellent" | "healthy" | "watch" | "risk" | "critical";
export type RestaurantStateDimension =
  | "demand"
  | "operations"
  | "staffing"
  | "service"
  | "marketing"
  | "profitability"
  | "reputation"
  | "execution";

export type RestaurantStateScores = Record<RestaurantStateDimension, number>;

export type RestaurantStateMetricSnapshot = {
  revenue: number | null;
  previousRevenue: number | null;
  revenueDeltaPct: number | null;
  orders: number | null;
  previousOrders: number | null;
  ordersDeltaPct: number | null;
  avgTicket: number | null;
  laborPct: number | null;
  marginPct: number | null;
  refunds: number | null;
  avgRating: number | null;
  reviewIssueCount: number;
  openAlerts: number;
  pendingActions: number;
  executedActions: number;
  memoryLessons: number;
  reusableLessons: number;
  avgOutcomeScore: number | null;
  capturedAt: string | null;
};

export type RestaurantState = {
  locationName: string;
  overallScore: number;
  level: RestaurantStateLevel;
  scores: RestaurantStateScores;
  metrics: RestaurantStateMetricSnapshot;
  primaryRisk: string;
  primaryOpportunity: string;
  executiveSummary: string;
  diagnosis: string[];
  recommendedFocus: string[];
  generatedAt: string;
};

type PerformanceSignalRow = {
  id: string;
  user_id?: string | null;
  location_name: string | null;
  revenue: number | null;
  orders: number | null;
  avg_ticket: number | null;
  labor_pct: number | null;
  margin_pct: number | null;
  refunds: number | null;
  captured_at: string | null;
};

type ReviewRow = {
  id: string;
  location_name: string | null;
  rating: number | null;
  update_time: string | null;
};

type AutoActionRow = {
  id: string;
  location_name: string | null;
  action_type: string | null;
  status: string | null;
  priority_score: number | null;
  updated_at: string | null;
};

type OperatorMemoryRow = {
  id: string;
  location_name: string | null;
  action_type: string | null;
  confidence: string | null;
  outcome_score: number | null;
  reuse_recommended: boolean | null;
  status: string | null;
  updated_at: string | null;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, decimals = 0) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function pctDelta(previous: number | null, current: number | null) {
  if (previous === null || current === null || previous === 0) return null;
  return round(((current - previous) / previous) * 100, 2);
}

function normalizeLocationName(value: string | null | undefined) {
  return (value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sameLocation(a: string | null | undefined, b: string | null | undefined) {
  const left = normalizeLocationName(a);
  const right = normalizeLocationName(b);
  if (!left || !right) return false;
  return left === right;
}

function daysAgoIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function levelFromScore(score: number): RestaurantStateLevel {
  if (score >= 88) return "excellent";
  if (score >= 74) return "healthy";
  if (score >= 58) return "watch";
  if (score >= 40) return "risk";
  return "critical";
}

function scoreDemand(metrics: RestaurantStateMetricSnapshot) {
  let score = 70;
  if (metrics.revenueDeltaPct !== null) score += clamp(metrics.revenueDeltaPct * 1.8, -28, 24);
  if (metrics.ordersDeltaPct !== null) score += clamp(metrics.ordersDeltaPct * 1.5, -22, 20);
  if (metrics.revenue !== null && metrics.revenue > 0) score += 5;
  return clamp(Math.round(score));
}

function scoreOperations(metrics: RestaurantStateMetricSnapshot) {
  let score = 76;
  if (metrics.refunds !== null) score -= clamp(metrics.refunds * 0.6, 0, 34);
  if (metrics.reviewIssueCount > 0) score -= clamp(metrics.reviewIssueCount * 6, 0, 24);
  if (metrics.openAlerts > 0) score -= clamp(metrics.openAlerts * 8, 0, 28);
  if (metrics.executedActions > 0) score += clamp(metrics.executedActions * 1.2, 0, 8);
  return clamp(Math.round(score));
}

function scoreStaffing(metrics: RestaurantStateMetricSnapshot) {
  let score = 72;
  if (metrics.laborPct !== null) {
    if (metrics.laborPct <= 22) score += 10;
    else if (metrics.laborPct <= 28) score += 2;
    else if (metrics.laborPct <= 34) score -= 10;
    else score -= 24;
  }
  if (metrics.refunds !== null && metrics.refunds > 35) score -= 10;
  if (metrics.reviewIssueCount >= 3) score -= 8;
  return clamp(Math.round(score));
}

function scoreService(metrics: RestaurantStateMetricSnapshot) {
  let score = 78;
  if (metrics.avgRating !== null) {
    score += clamp((metrics.avgRating - 4) * 18, -30, 18);
  }
  score -= clamp(metrics.reviewIssueCount * 7, 0, 35);
  if (metrics.refunds !== null) score -= clamp(metrics.refunds * 0.25, 0, 18);
  return clamp(Math.round(score));
}

function scoreMarketing(metrics: RestaurantStateMetricSnapshot) {
  let score = 68;
  if (metrics.ordersDeltaPct !== null) score += clamp(metrics.ordersDeltaPct * 1.2, -18, 18);
  if (metrics.revenueDeltaPct !== null) score += clamp(metrics.revenueDeltaPct * 0.8, -14, 14);
  if (metrics.avgTicket !== null && metrics.avgTicket > 18) score += 4;
  return clamp(Math.round(score));
}

function scoreProfitability(metrics: RestaurantStateMetricSnapshot) {
  let score = 70;
  if (metrics.marginPct !== null) {
    if (metrics.marginPct >= 62) score += 14;
    else if (metrics.marginPct >= 55) score += 5;
    else if (metrics.marginPct >= 45) score -= 10;
    else score -= 24;
  }
  if (metrics.laborPct !== null) score -= clamp((metrics.laborPct - 24) * 1.2, -10, 24);
  if (metrics.refunds !== null) score -= clamp(metrics.refunds * 0.35, 0, 24);
  if (metrics.revenueDeltaPct !== null) score += clamp(metrics.revenueDeltaPct * 0.8, -12, 12);
  return clamp(Math.round(score));
}

function scoreReputation(metrics: RestaurantStateMetricSnapshot) {
  let score = 76;
  if (metrics.avgRating !== null) score += clamp((metrics.avgRating - 4) * 22, -36, 22);
  score -= clamp(metrics.reviewIssueCount * 8, 0, 38);
  return clamp(Math.round(score));
}

function scoreExecution(metrics: RestaurantStateMetricSnapshot) {
  let score = 65;
  if (metrics.pendingActions > 0) score -= clamp(metrics.pendingActions * 5, 0, 25);
  if (metrics.executedActions > 0) score += clamp(metrics.executedActions * 3, 0, 20);
  if (metrics.avgOutcomeScore !== null) score += clamp((metrics.avgOutcomeScore - 50) * 0.45, -18, 22);
  if (metrics.reusableLessons > 0) score += clamp(metrics.reusableLessons * 3, 0, 12);
  return clamp(Math.round(score));
}

function weightedOverall(scores: RestaurantStateScores) {
  const value =
    scores.demand * 0.13 +
    scores.operations * 0.18 +
    scores.staffing * 0.12 +
    scores.service * 0.14 +
    scores.marketing * 0.08 +
    scores.profitability * 0.18 +
    scores.reputation * 0.09 +
    scores.execution * 0.08;
  return clamp(Math.round(value));
}

function lowestDimension(scores: RestaurantStateScores) {
  return Object.entries(scores).sort((a, b) => a[1] - b[1])[0] as [RestaurantStateDimension, number];
}

function highestDimension(scores: RestaurantStateScores) {
  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0] as [RestaurantStateDimension, number];
}

function buildDiagnosis(metrics: RestaurantStateMetricSnapshot, scores: RestaurantStateScores) {
  const diagnosis: string[] = [];
  const [weakest, weakestScore] = lowestDimension(scores);
  const [strongest, strongestScore] = highestDimension(scores);

  diagnosis.push(`${titleCase(weakest)} is the weakest operating dimension at ${weakestScore}/100.`);
  diagnosis.push(`${titleCase(strongest)} is currently the strongest dimension at ${strongestScore}/100.`);

  if (metrics.refunds !== null && metrics.refunds >= 30) {
    diagnosis.push(`Refund pressure is elevated at ${metrics.refunds} refund event(s).`);
  }

  if (metrics.revenueDeltaPct !== null && metrics.revenueDeltaPct < -5) {
    diagnosis.push(`Revenue is down ${Math.abs(round(metrics.revenueDeltaPct, 1))}% from the previous snapshot.`);
  }

  if (metrics.laborPct !== null && metrics.laborPct >= 30) {
    diagnosis.push(`Labor is running high at ${metrics.laborPct}%.`);
  }

  if (metrics.avgOutcomeScore !== null) {
    diagnosis.push(`Measured actions are averaging ${Math.round(metrics.avgOutcomeScore)}/100 outcome quality.`);
  }

  if (diagnosis.length < 3) {
    diagnosis.push("The restaurant has enough signal for monitoring, but more measured outcomes will sharpen recommendations.");
  }

  return diagnosis.slice(0, 5);
}

function buildRecommendedFocus(scores: RestaurantStateScores, metrics: RestaurantStateMetricSnapshot) {
  const focus: string[] = [];
  const sorted = Object.entries(scores).sort((a, b) => a[1] - b[1]) as Array<[RestaurantStateDimension, number]>;

  for (const [dimension] of sorted.slice(0, 3)) {
    if (dimension === "profitability") focus.push("Protect margin before chasing growth.");
    if (dimension === "operations") focus.push("Audit operational leakage: refunds, waste, service recovery, and bottlenecks.");
    if (dimension === "staffing") focus.push("Check labor coverage against peak demand windows.");
    if (dimension === "service") focus.push("Stabilize guest experience and review response workflows.");
    if (dimension === "demand") focus.push("Investigate demand softness before launching broad discounts.");
    if (dimension === "marketing") focus.push("Use controlled campaigns and measure order lift before scaling promotions.");
    if (dimension === "reputation") focus.push("Prioritize rating protection and negative review recovery.");
    if (dimension === "execution") focus.push("Reduce pending actions and close the loop on measured outcomes.");
  }

  if (metrics.reusableLessons > 0) {
    focus.push("Reuse proven playbooks where signals match prior successful situations.");
  }

  return Array.from(new Set(focus)).slice(0, 5);
}

function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildSummary(locationName: string, overall: number, level: RestaurantStateLevel, scores: RestaurantStateScores) {
  const [weakest] = lowestDimension(scores);
  const [strongest] = highestDimension(scores);
  return `${locationName} is currently in ${level} state with an operating score of ${overall}/100. The strongest dimension is ${titleCase(strongest)}, while the biggest watch area is ${titleCase(weakest)}.`;
}

async function safeSelect<T>(query: PromiseLike<{ data: unknown; error: { message?: string } | null }>, fallback: T[]) {
  const { data, error } = await query;
  if (error) {
    console.warn("restaurantState select failed:", error.message);
    return fallback;
  }
  return (Array.isArray(data) ? data : fallback) as T[];
}

function latestTwo(rows: PerformanceSignalRow[]) {
  const sorted = [...rows]
    .filter((row) => row.captured_at)
    .sort((a, b) => String(b.captured_at).localeCompare(String(a.captured_at)));

  return {
    latest: sorted[0] ?? null,
    previous: sorted[1] ?? null,
  };
}

function buildMetrics(params: {
  locationName: string;
  performanceRows: PerformanceSignalRow[];
  reviews: ReviewRow[];
  actions: AutoActionRow[];
  memory: OperatorMemoryRow[];
}): RestaurantStateMetricSnapshot {
  const { locationName, performanceRows, reviews, actions, memory } = params;
  const scopedPerformance = performanceRows.filter((row) => sameLocation(row.location_name, locationName));
  const scopedReviews = reviews.filter((row) => sameLocation(row.location_name, locationName));
  const scopedActions = actions.filter((row) => sameLocation(row.location_name, locationName));
  const scopedMemory = memory.filter((row) => sameLocation(row.location_name, locationName));
  const { latest, previous } = latestTwo(scopedPerformance);

  const ratings = scopedReviews
    .map((row) => asNumber(row.rating))
    .filter((value): value is number => value !== null);

  const avgRating = ratings.length
    ? round(ratings.reduce((sum, value) => sum + value, 0) / ratings.length, 2)
    : null;

  const activeMemory = scopedMemory.filter((row) => row.status === "active");
  const outcomeScores = activeMemory
    .map((row) => asNumber(row.outcome_score))
    .filter((value): value is number => value !== null);

  return {
    revenue: asNumber(latest?.revenue),
    previousRevenue: asNumber(previous?.revenue),
    revenueDeltaPct: pctDelta(asNumber(previous?.revenue), asNumber(latest?.revenue)),
    orders: asNumber(latest?.orders),
    previousOrders: asNumber(previous?.orders),
    ordersDeltaPct: pctDelta(asNumber(previous?.orders), asNumber(latest?.orders)),
    avgTicket: asNumber(latest?.avg_ticket),
    laborPct: asNumber(latest?.labor_pct),
    marginPct: asNumber(latest?.margin_pct),
    refunds: asNumber(latest?.refunds),
    avgRating,
    reviewIssueCount: scopedReviews.filter((row) => asNumber(row.rating) !== null && Number(row.rating) <= 3).length,
    openAlerts: scopedActions.filter((row) => (row.priority_score ?? 0) >= 75 && row.status !== "executed" && row.status !== "dismissed").length,
    pendingActions: scopedActions.filter((row) => row.status === "pending" || row.status === "approved").length,
    executedActions: scopedActions.filter((row) => row.status === "executed").length,
    memoryLessons: activeMemory.length,
    reusableLessons: activeMemory.filter((row) => row.reuse_recommended === true).length,
    avgOutcomeScore: outcomeScores.length
      ? round(outcomeScores.reduce((sum, value) => sum + value, 0) / outcomeScores.length, 1)
      : null,
    capturedAt: latest?.captured_at ?? null,
  };
}

export function computeRestaurantStateFromMetrics(locationName: string, metrics: RestaurantStateMetricSnapshot): RestaurantState {
  const scores: RestaurantStateScores = {
    demand: scoreDemand(metrics),
    operations: scoreOperations(metrics),
    staffing: scoreStaffing(metrics),
    service: scoreService(metrics),
    marketing: scoreMarketing(metrics),
    profitability: scoreProfitability(metrics),
    reputation: scoreReputation(metrics),
    execution: scoreExecution(metrics),
  };

  const overallScore = weightedOverall(scores);
  const level = levelFromScore(overallScore);
  const [weakest] = lowestDimension(scores);
  const [strongest] = highestDimension(scores);

  return {
    locationName,
    overallScore,
    level,
    scores,
    metrics,
    primaryRisk: titleCase(weakest),
    primaryOpportunity: titleCase(strongest),
    executiveSummary: buildSummary(locationName, overallScore, level, scores),
    diagnosis: buildDiagnosis(metrics, scores),
    recommendedFocus: buildRecommendedFocus(scores, metrics),
    generatedAt: new Date().toISOString(),
  };
}

export async function getRestaurantStates(params: {
  userId: string;
  locationName?: string | null;
  lookbackDays?: number;
}): Promise<RestaurantState[]> {
  const { userId, locationName = null, lookbackDays = 45 } = params;
  const supabase = await getSupabaseRouteClient();
  const sinceIso = daysAgoIso(lookbackDays);

  const performanceRows = await safeSelect<PerformanceSignalRow>(
    supabase
      .from("performance_signal_history")
      .select("id, user_id, location_name, revenue, orders, avg_ticket, labor_pct, margin_pct, refunds, captured_at")
      .eq("user_id", userId)
      .gte("captured_at", sinceIso)
      .order("captured_at", { ascending: false }),
    [],
  );

  const reviews = await safeSelect<ReviewRow>(
    supabase
      .from("reviews")
      .select("id, location_name, rating, update_time")
      .eq("user_id", userId)
      .gte("update_time", sinceIso),
    [],
  );

  const actions = await safeSelect<AutoActionRow>(
    supabase
      .from("auto_actions")
      .select("id, location_name, action_type, status, priority_score, updated_at")
      .eq("user_id", userId)
      .gte("updated_at", sinceIso),
    [],
  );

  const memory = await safeSelect<OperatorMemoryRow>(
    supabase
      .from("operator_memory")
      .select("id, location_name, action_type, confidence, outcome_score, reuse_recommended, status, updated_at")
      .eq("user_id", userId),
    [],
  );

  const locationNames = Array.from(
    new Set(
      [
        ...performanceRows.map((row) => row.location_name),
        ...reviews.map((row) => row.location_name),
        ...actions.map((row) => row.location_name),
        ...memory.map((row) => row.location_name),
      ]
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .filter((name) => !locationName || sameLocation(name, locationName)),
    ),
  );

  const names = locationNames.length ? locationNames : [locationName || "Default Location"];

  return names
    .map((name) => {
      const metrics = buildMetrics({ locationName: name, performanceRows, reviews, actions, memory });
      return computeRestaurantStateFromMetrics(name, metrics);
    })
    .sort((a, b) => a.overallScore - b.overallScore);
}

export async function getRestaurantState(params: {
  userId: string;
  locationName?: string | null;
  lookbackDays?: number;
}): Promise<RestaurantState> {
  const states = await getRestaurantStates(params);
  return states[0] ?? computeRestaurantStateFromMetrics(params.locationName || "Default Location", {
    revenue: null,
    previousRevenue: null,
    revenueDeltaPct: null,
    orders: null,
    previousOrders: null,
    ordersDeltaPct: null,
    avgTicket: null,
    laborPct: null,
    marginPct: null,
    refunds: null,
    avgRating: null,
    reviewIssueCount: 0,
    openAlerts: 0,
    pendingActions: 0,
    executedActions: 0,
    memoryLessons: 0,
    reusableLessons: 0,
    avgOutcomeScore: null,
    capturedAt: null,
  });
}

export async function getRestaurantStateSummary(params: {
  userId: string;
  lookbackDays?: number;
}) {
  const states = await getRestaurantStates(params);
  const overallAverage = states.length
    ? Math.round(states.reduce((sum, state) => sum + state.overallScore, 0) / states.length)
    : 0;

  const riskStates = states.filter((state) => state.level === "risk" || state.level === "critical");
  const watchStates = states.filter((state) => state.level === "watch");
  const bestState = [...states].sort((a, b) => b.overallScore - a.overallScore)[0] ?? null;
  const weakestState = [...states].sort((a, b) => a.overallScore - b.overallScore)[0] ?? null;

  return {
    ok: true,
    overallAverage,
    locationCount: states.length,
    riskCount: riskStates.length,
    watchCount: watchStates.length,
    bestLocation: bestState?.locationName ?? null,
    weakestLocation: weakestState?.locationName ?? null,
    primaryRisk: weakestState?.primaryRisk ?? null,
    primaryOpportunity: bestState?.primaryOpportunity ?? null,
    states,
    generatedAt: new Date().toISOString(),
  };
}


export function restaurantStateToPlanningContext(state: RestaurantState) {
  return {
    locationName: state.locationName,
    health:
      state.level === "critical" || state.level === "risk"
        ? "risk"
        : state.level === "watch"
          ? "watch"
          : "healthy",
    scores: state.scores,
    revenue: state.metrics.revenue,
    orders: state.metrics.orders,
    refunds: state.metrics.refunds,
    avgRating: state.metrics.avgRating,
    reviewIssueCount: state.metrics.reviewIssueCount,
    laborPct: state.metrics.laborPct,
    marginPct: state.metrics.marginPct,
    openAlerts: state.metrics.openAlerts,
    topIssue: state.primaryRisk,
    operatorMemoryLessons: state.metrics.memoryLessons,
    averageOutcomeScore: state.metrics.avgOutcomeScore,
    reusableLessons: state.metrics.reusableLessons,
  };
}

export async function getRestaurantPlanningContexts(params: {
  userId: string;
  locationName?: string | null;
  lookbackDays?: number;
}) {
  const states = await getRestaurantStates(params);
  return states.map(restaurantStateToPlanningContext);
}
