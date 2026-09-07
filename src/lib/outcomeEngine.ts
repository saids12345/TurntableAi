import { getSupabaseRouteClient } from "@/lib/supabaseRoute";
import {
  verifyDecisionOutcome,
} from "@/lib/brain/outcomeVerification/decisionOutcomeVerifier";

export type OutcomeStatus = "not_ready" | "measured" | "partial" | "failed";
export type LessonStrength = "weak" | "developing" | "strong";
export type MemoryConfidence = "low" | "medium" | "high";

export type OutcomeMetricSnapshot = {
  revenue: number | null;
  orders: number | null;
  avgTicket: number | null;
  laborPct: number | null;
  marginPct: number | null;
  refunds: number | null;
  avgRating: number | null;
  reviewIssueCount: number | null;
  capturedAt: string | null;
};

export type OutcomeDelta = {
  revenueDeltaPct: number | null;
  ordersDeltaPct: number | null;
  avgTicketDeltaPct: number | null;
  laborDeltaPct: number | null;
  marginDeltaPct: number | null;
  refundDeltaPct: number | null;
  ratingDelta: number | null;
  reviewIssueDelta: number | null;
};

export type OutcomeEvaluation = {
  status: OutcomeStatus;
  locationName: string | null;
  actionType: string;
  problemType: string;
  actionTitle: string;
  sourceActionId: string | null;
  sourceOutcomeId: string | null;
  measuredAt: string;
  baseline: OutcomeMetricSnapshot;
  current: OutcomeMetricSnapshot;
  delta: OutcomeDelta;
  outcomeScore: number;
  success: boolean | null;
  lessonStrength: LessonStrength;
  confidence: MemoryConfidence;
  reuseRecommended: boolean;
  summary: string;
  lesson: string;
  evidence: Record<string, unknown>;
};
export function getOutcomeMemorySourceActionId(
  evaluation: Pick<
    OutcomeEvaluation,
    "sourceActionId"
  >,
): string {
  const sourceActionId =
    evaluation.sourceActionId?.trim();

  if (!sourceActionId) {
    throw new Error(
      "Outcome memory verification requires a sourceActionId.",
    );
  }

  return sourceActionId;
}

type AutoActionRow = {
  id: string;
  user_id: string;
  location_name: string | null;
  action_type: string | null;
  title: string | null;
  reason: string | null;
  recommended_payload: Record<string, unknown> | null;
  source_signal: Record<string, unknown> | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type OperatorMemoryRow = {
  id: string;
  user_id: string;
  location_name: string | null;
  problem_type: string;
  action_type: string;
  action_title: string;
  result_summary: string;
  lesson: string;
  confidence: string;
  status: string;
  source_outcome_id: string | null;
  evidence: Record<string, unknown> | null;
  outcome_score?: number | null;
  success?: boolean | null;
  revenue_before?: number | null;
  revenue_after?: number | null;
  rating_before?: number | null;
  rating_after?: number | null;
  lesson_strength?: string | null;
  reuse_recommended?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type PerformanceSignalRow = {
  id: string;
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

const OPERATOR_MEMORY_SELECT =
  "id, user_id, location_name, problem_type, action_type, action_title, result_summary, lesson, confidence, status, source_action_id, source_outcome_id, evidence, outcome_score, success, revenue_before, revenue_after, rating_before, rating_after, lesson_strength, reuse_recommended, created_at, updated_at";
  
function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
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

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/(^_|_$)/g, "");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function pctDelta(before: number | null, after: number | null) {
  if (before === null || after === null || before === 0) return null;
  return round(((after - before) / before) * 100, 2);
}

function daysAgoIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function inferProblemType(action: AutoActionRow | OperatorMemoryRow) {
  const actionType = "action_type" in action ? action.action_type : null;
  const payload = "recommended_payload" in action && isRecord(action.recommended_payload)
    ? action.recommended_payload
    : null;
  const source = "source_signal" in action && isRecord(action.source_signal)
    ? action.source_signal
    : null;
  const reason = "reason" in action ? action.reason : null;

  const learning = payload && isRecord(payload.operatorLearning) ? payload.operatorLearning : null;
  const decision = payload && isRecord(payload.decision) ? payload.decision : null;
  const decisionLearning = decision && isRecord(decision.operatorLearning) ? decision.operatorLearning : null;

  const explicitProblemType =
    asString(learning?.problemType) ??
    asString(learning?.problem_type) ??
    asString(decisionLearning?.problemType) ??
    asString(decisionLearning?.problem_type);

  if (explicitProblemType) return slugify(explicitProblemType);

  const combined = [
    actionType,
    reason,
    asString(payload?.reason),
    asString(source?.topIssue),
    asString(source?.recommendedAction),
    asString(source?.trigger && isRecord(source.trigger) ? source.trigger.summary : null),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (combined.includes("refund")) return "refund_pressure";
  if (combined.includes("rating") || combined.includes("review") || combined.includes("guest")) {
    return "guest_sentiment_risk";
  }
  if (combined.includes("traffic") || combined.includes("revenue") || combined.includes("sales")) {
    return "traffic_or_revenue_decline";
  }
  if (combined.includes("labor") || combined.includes("margin") || combined.includes("waste")) {
    return "margin_or_labor_pressure";
  }
  if (combined.includes("wait") || combined.includes("throughput") || combined.includes("slow")) {
    return "throughput_pressure";
  }

  return slugify(String(actionType || "operator_signal"));
}

function inferActionTitle(action: AutoActionRow | OperatorMemoryRow) {
  if ("title" in action) return action.title || "Executed operator action";
  return action.action_title || "Executed operator action";
}

function buildEmptySnapshot(): OutcomeMetricSnapshot {
  return {
    revenue: null,
    orders: null,
    avgTicket: null,
    laborPct: null,
    marginPct: null,
    refunds: null,
    avgRating: null,
    reviewIssueCount: null,
    capturedAt: null,
  };
}

function buildPerformanceSnapshot(row: PerformanceSignalRow | null): OutcomeMetricSnapshot {
  return {
    revenue: asNumber(row?.revenue),
    orders: asNumber(row?.orders),
    avgTicket: asNumber(row?.avg_ticket),
    laborPct: asNumber(row?.labor_pct),
    marginPct: asNumber(row?.margin_pct),
    refunds: asNumber(row?.refunds),
    avgRating: null,
    reviewIssueCount: null,
    capturedAt: row?.captured_at ?? null,
  };
}

function mergeReviewSnapshot(
  snapshot: OutcomeMetricSnapshot,
  reviews: ReviewRow[],
  locationName: string | null,
  fromIso: string,
  toIso: string
): OutcomeMetricSnapshot {
  const normalizedLocation = normalizeLocationName(locationName);
  const matchingReviews = reviews.filter((review) => {
    const reviewLocation = normalizeLocationName(review.location_name);
    const updatedAt = review.update_time;

    if (!updatedAt) return false;
    if (normalizedLocation && reviewLocation !== normalizedLocation) return false;
    return updatedAt >= fromIso && updatedAt <= toIso;
  });

  const ratings = matchingReviews
    .map((review) => asNumber(review.rating))
    .filter((rating): rating is number => rating !== null);

  const avgRating = ratings.length
    ? round(ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length, 2)
    : null;

  const reviewIssueCount = matchingReviews.filter((review) => {
    const rating = asNumber(review.rating);
    return rating !== null && rating <= 3;
  }).length;

  return {
    ...snapshot,
    avgRating,
    reviewIssueCount,
  };
}

function calculateOutcomeScore(params: {
  actionType: string;
  delta: OutcomeDelta;
  baseline: OutcomeMetricSnapshot;
  current: OutcomeMetricSnapshot;
}) {
  const { actionType, delta, baseline, current } = params;
  let score = 50;

  if (delta.revenueDeltaPct !== null) score += clamp(delta.revenueDeltaPct * 1.5, -25, 30);
  if (delta.ordersDeltaPct !== null) score += clamp(delta.ordersDeltaPct * 1.2, -15, 20);
  if (delta.avgTicketDeltaPct !== null) score += clamp(delta.avgTicketDeltaPct * 0.8, -10, 12);

  if (delta.refundDeltaPct !== null) {
    score += clamp(-delta.refundDeltaPct * 0.8, -25, 30);
  } else if (baseline.refunds !== null && current.refunds !== null) {
    if (current.refunds < baseline.refunds) score += 12;
    if (current.refunds > baseline.refunds) score -= 12;
  }

  if (delta.ratingDelta !== null) score += clamp(delta.ratingDelta * 35, -20, 20);
  if (delta.reviewIssueDelta !== null) score += clamp(-delta.reviewIssueDelta * 6, -18, 18);
  if (delta.laborDeltaPct !== null) score += clamp(-delta.laborDeltaPct * 0.7, -15, 15);
  if (delta.marginDeltaPct !== null) score += clamp(delta.marginDeltaPct * 0.9, -15, 18);

  if (actionType === "margin_protection") {
    if (delta.refundDeltaPct !== null && delta.refundDeltaPct < 0) score += 8;
    if (delta.marginDeltaPct !== null && delta.marginDeltaPct > 0) score += 8;
    if (delta.laborDeltaPct !== null && delta.laborDeltaPct < 0) score += 5;
  }

  if (actionType === "traffic_reactivation" || actionType === "promo_launch") {
    if (delta.revenueDeltaPct !== null && delta.revenueDeltaPct > 0) score += 8;
    if (delta.ordersDeltaPct !== null && delta.ordersDeltaPct > 0) score += 8;
  }

  if (actionType === "service_recovery" || actionType === "review_response_push") {
    if (delta.ratingDelta !== null && delta.ratingDelta > 0) score += 8;
    if (delta.reviewIssueDelta !== null && delta.reviewIssueDelta < 0) score += 8;
  }

  return Math.round(clamp(score, 0, 100));
}

function inferLessonStrength(score: number): LessonStrength {
  if (score >= 75) return "strong";
  if (score >= 55) return "developing";
  return "weak";
}

function inferConfidence(score: number, measuredFields: number): MemoryConfidence {
  if (score >= 75 && measuredFields >= 4) return "high";
  if (score >= 55 && measuredFields >= 2) return "medium";
  return "low";
}

function inferSuccess(score: number): boolean | null {
  if (score >= 65) return true;
  if (score <= 40) return false;
  return null;
}

function countMeasuredFields(snapshot: OutcomeMetricSnapshot) {
  return [
    snapshot.revenue,
    snapshot.orders,
    snapshot.avgTicket,
    snapshot.laborPct,
    snapshot.marginPct,
    snapshot.refunds,
    snapshot.avgRating,
    snapshot.reviewIssueCount,
  ].filter((value) => value !== null).length;
}

function buildDelta(baseline: OutcomeMetricSnapshot, current: OutcomeMetricSnapshot): OutcomeDelta {
  return {
    revenueDeltaPct: pctDelta(baseline.revenue, current.revenue),
    ordersDeltaPct: pctDelta(baseline.orders, current.orders),
    avgTicketDeltaPct: pctDelta(baseline.avgTicket, current.avgTicket),
    laborDeltaPct:
      baseline.laborPct !== null && current.laborPct !== null
        ? round(current.laborPct - baseline.laborPct, 2)
        : null,
    marginDeltaPct:
      baseline.marginPct !== null && current.marginPct !== null
        ? round(current.marginPct - baseline.marginPct, 2)
        : null,
    refundDeltaPct: pctDelta(baseline.refunds, current.refunds),
    ratingDelta:
      baseline.avgRating !== null && current.avgRating !== null
        ? round(current.avgRating - baseline.avgRating, 2)
        : null,
    reviewIssueDelta:
      baseline.reviewIssueCount !== null && current.reviewIssueCount !== null
        ? current.reviewIssueCount - baseline.reviewIssueCount
        : null,
  };
}

function humanDelta(value: number | null, suffix = "%") {
  if (value === null) return "not enough data";
  const sign = value > 0 ? "+" : "";
  return `${sign}${round(value, 1)}${suffix}`;
}

function buildSummary(params: {
  actionTitle: string;
  actionType: string;
  locationName: string | null;
  score: number;
  delta: OutcomeDelta;
}) {
  const { actionTitle, actionType, locationName, score, delta } = params;
  const locationText = locationName ? ` at ${locationName}` : "";

  const lines = [
    `${actionTitle}${locationText} was measured with an outcome score of ${score}/100.`,
    `Revenue changed ${humanDelta(delta.revenueDeltaPct)}, orders changed ${humanDelta(delta.ordersDeltaPct)}, refunds changed ${humanDelta(delta.refundDeltaPct)}, and rating changed ${humanDelta(delta.ratingDelta, " stars")}.`,
  ];

  if (actionType === "margin_protection") {
    lines.push("This action should be judged primarily by refund reduction, labor control, and margin protection.");
  } else if (actionType === "traffic_reactivation" || actionType === "promo_launch") {
    lines.push("This action should be judged primarily by revenue recovery and order growth.");
  } else if (actionType === "service_recovery" || actionType === "review_response_push") {
    lines.push("This action should be judged primarily by rating stabilization and fewer negative reviews.");
  }

  return lines.join(" ");
}

function buildLesson(params: {
  problemType: string;
  actionType: string;
  locationName: string | null;
  score: number;
  reuseRecommended: boolean;
}) {
  const { problemType, actionType, locationName, score, reuseRecommended } = params;
  const locationText = locationName ? ` at ${locationName}` : "";
  const actionText = actionType.replace(/_/g, " ");
  const problemText = problemType.replace(/_/g, " ");

  if (reuseRecommended) {
    return `When ${problemText} appears${locationText}, ${actionText} has measurable supporting evidence and should be considered again. Outcome score: ${score}/100.`;
  }

  return `When ${problemText} appears${locationText}, ${actionText} should remain an operator-reviewed playbook until stronger evidence appears. Outcome score: ${score}/100.`;
}

async function loadReviews(params: {
  supabase: Awaited<ReturnType<typeof getSupabaseRouteClient>>;
  userId: string;
  startIso: string;
}) {
  const { supabase, userId, startIso } = params;

  const { data, error } = await supabase
    .from("reviews")
    .select("id, location_name, rating, update_time")
    .eq("user_id", userId)
    .gte("update_time", startIso)
    .order("update_time", { ascending: true });

  if (error) {
    console.warn("outcomeEngine reviews load failed:", error.message);
    return [] as ReviewRow[];
  }

  return (data ?? []) as ReviewRow[];
}

async function loadPerformanceSignals(params: {
  supabase: Awaited<ReturnType<typeof getSupabaseRouteClient>>;
  userId: string;
  locationName: string | null;
}) {
  const { supabase, userId, locationName } = params;

  let query = supabase
    .from("performance_signal_history")
    .select("id, location_name, revenue, orders, avg_ticket, labor_pct, margin_pct, refunds, captured_at")
    .eq("user_id", userId)
    .order("captured_at", { ascending: true });

  if (locationName) query = query.eq("location_name", locationName);

  const { data, error } = await query;

  if (error) {
    console.warn("outcomeEngine performance load failed:", error.message);
    return [] as PerformanceSignalRow[];
  }

  return (data ?? []) as PerformanceSignalRow[];
}

export function nearestOutcomeSnapshotBefore(
  rows: PerformanceSignalRow[],
  iso: string,
) {
  return [...rows]
    .filter(
      (row) =>
        row.captured_at &&
        row.captured_at <= iso,
    )
    .sort((a, b) =>
      String(b.captured_at).localeCompare(
        String(a.captured_at),
      ),
    )[0] ?? null;
}

export function nearestOutcomeSnapshotAfter(
  rows: PerformanceSignalRow[],
  iso: string,
) {
  return [...rows]
    .filter(
      (row) =>
        row.captured_at &&
        row.captured_at >= iso,
    )
    .sort((a, b) =>
      String(a.captured_at).localeCompare(
        String(b.captured_at),
      ),
    )[0] ?? null;
}

function latestRow(rows: PerformanceSignalRow[]) {
  return [...rows]
    .filter((row) => row.captured_at)
    .sort((a, b) => String(b.captured_at).localeCompare(String(a.captured_at)))[0] ?? null;
}

function stringArray(
  value: unknown,
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is string =>
      typeof item === "string" &&
      item.trim().length > 0,
  );
}

function getDecisionVerificationContract(
  action: AutoActionRow,
) {
  const payload =
    isRecord(action.recommended_payload)
      ? action.recommended_payload
      : null;

  const cognitiveWorkflow =
    payload &&
    isRecord(
      payload.cognitiveWorkflow,
    )
      ? payload.cognitiveWorkflow
      : null;

  const workflowMetadata =
    cognitiveWorkflow &&
    isRecord(
      cognitiveWorkflow.metadata,
    )
      ? cognitiveWorkflow.metadata
      : null;

  const cognitiveProvenance =
    payload &&
    isRecord(
      payload.cognitiveProvenance,
    )
      ? payload.cognitiveProvenance
      : null;

  const expectedOutcome =
    asString(
      cognitiveWorkflow
        ?.expectedOutcome,
    ) ??
    asString(
      cognitiveProvenance
        ?.strategyExpectedOutcome,
    );

  const successMetric =
    asString(
      cognitiveWorkflow
        ?.successMetric,
    );

  const failureConditions =
    stringArray(
      workflowMetadata
        ?.failureConditions,
    );

  return {
    expectedOutcome,
    successMetric,
    failureConditions,
  };
}
export const MIN_OUTCOME_VERIFICATION_AGE_HOURS =
  24;
  export function getEffectiveOutcomeVerificationAgeHours(
  minAgeHours?: number,
): number {
  if (
    typeof minAgeHours !== "number" ||
    !Number.isFinite(minAgeHours)
  ) {
    return MIN_OUTCOME_VERIFICATION_AGE_HOURS;
  }

  return Math.max(
    minAgeHours,
    MIN_OUTCOME_VERIFICATION_AGE_HOURS,
  );
}

export async function evaluateExecutedActionOutcome(params: {
  userId: string;
  action: AutoActionRow;
  minAgeHours?: number;
  reviewWindowDays?: number;
}) {
  const {
  userId,
  action,
  minAgeHours =
    MIN_OUTCOME_VERIFICATION_AGE_HOURS,
  reviewWindowDays = 7,
} = params;

const effectiveMinAgeHours =
  getEffectiveOutcomeVerificationAgeHours(
    minAgeHours,
  );
  const executedAt = action.updated_at ?? action.created_at ?? new Date().toISOString();
  const minReadyAt =
  new Date(
    new Date(executedAt).getTime() +
      effectiveMinAgeHours *
        60 *
        60 *
        1000,
  );

  if (Date.now() < minReadyAt.getTime()) {
    return {
      status: "not_ready" as OutcomeStatus,
      reason: `Action is not old enough to evaluate. Minimum age is ${effectiveMinAgeHours} hour(s).`,
    };
  }

  const supabase = await getSupabaseRouteClient();
  const locationName = action.location_name ?? null;
  const actionType = slugify(action.action_type || "operator_action");
  const problemType = inferProblemType(action);
  const actionTitle = inferActionTitle(action);

  const performanceRows = await loadPerformanceSignals({ supabase, userId, locationName });
  const reviews = await loadReviews({
    supabase,
    userId,
    startIso: daysAgoIso(Math.max(reviewWindowDays * 2, 30)),
  });

  const baselinePerf =
  nearestOutcomeSnapshotBefore(
    performanceRows,
    executedAt,
  );
  const currentPerf =
  nearestOutcomeSnapshotAfter(
    performanceRows,
    minReadyAt.toISOString(),
  );

  const beforeStartIso = new Date(
    new Date(executedAt).getTime() - reviewWindowDays * 24 * 60 * 60 * 1000
  ).toISOString();
  const beforeEndIso = executedAt;
  const afterStartIso = executedAt;
  const afterEndIso = new Date(
    new Date(executedAt).getTime() + reviewWindowDays * 24 * 60 * 60 * 1000
  ).toISOString();

  const baseline = mergeReviewSnapshot(
    buildPerformanceSnapshot(baselinePerf),
    reviews,
    locationName,
    beforeStartIso,
    beforeEndIso
  );

  const current = mergeReviewSnapshot(
    buildPerformanceSnapshot(currentPerf),
    reviews,
    locationName,
    afterStartIso,
    afterEndIso
  );

  const measuredFields = Math.min(countMeasuredFields(baseline), countMeasuredFields(current));
  const delta = buildDelta(baseline, current);
  const outcomeScore = calculateOutcomeScore({ actionType, delta, baseline, current });
  const success = inferSuccess(outcomeScore);
  const lessonStrength = inferLessonStrength(outcomeScore);
  const confidence = inferConfidence(outcomeScore, measuredFields);
  const reuseRecommended = outcomeScore >= 65 && measuredFields >= 2;
  const summary = buildSummary({ actionTitle, actionType, locationName, score: outcomeScore, delta });
  const lesson = buildLesson({ problemType, actionType, locationName, score: outcomeScore, reuseRecommended });

  const evaluation: OutcomeEvaluation = {
    status: measuredFields >= 2 ? "measured" : "partial",
    locationName,
    actionType,
    problemType,
    actionTitle,
    sourceActionId: action.id,
    sourceOutcomeId: null,
    measuredAt: new Date().toISOString(),
    baseline,
    current,
    delta,
    outcomeScore,
    success,
    lessonStrength,
    confidence,
    reuseRecommended,
    summary,
    lesson,
    evidence: {
      source: "outcome_engine",
      version: "v1",
      measuredFields,
      reviewWindowDays,
      executedAt,
      sourceActionId: action.id,
      sourceSignal: action.source_signal ?? null,
      recommendedPayload: action.recommended_payload ?? null,
      baseline,
      current,
      delta,
    },
  };

  const verificationContract =
  getDecisionVerificationContract(
    action,
  );

const outcomeVerification =
  verifyDecisionOutcome({
    evaluation,

    expectedOutcome:
      verificationContract
        .expectedOutcome,

    successMetric:
      verificationContract
        .successMetric,

    failureConditions:
      verificationContract
        .failureConditions,
  });

evaluation.evidence = {
  ...evaluation.evidence,

  outcomeVerification,
};

return evaluation;
}

export async function saveOutcomeToOperatorMemory(params: {
  userId: string;
  evaluation: OutcomeEvaluation;
}) {
  const { userId, evaluation } = params;
  const supabase = await getSupabaseRouteClient();
  const now = new Date().toISOString();
  const sourceActionId =
  getOutcomeMemorySourceActionId(
    evaluation,
  );

  const { data: existingRows, error: lookupError } =
  await supabase
    .from("operator_memory")
    .select("id")
    .eq("user_id", userId)
    .eq(
      "source_action_id",
      sourceActionId
    )
    .eq("status", "active")
    .limit(1);
  if (lookupError) {
    throw new Error(`Failed to check operator memory: ${lookupError.message}`);
  }

  const payload = {
    user_id: userId,
    location_name: evaluation.locationName,
    problem_type: evaluation.problemType,
    action_type: evaluation.actionType,
    action_title: evaluation.actionTitle,
    result_summary: evaluation.summary,
    lesson: evaluation.lesson,
    confidence: evaluation.confidence,
    status: "active",
    source_action_id:
  evaluation.sourceActionId,
    source_outcome_id: evaluation.sourceOutcomeId,
    evidence: evaluation.evidence,
    outcome_score: evaluation.outcomeScore,
    success: evaluation.success,
    revenue_before: evaluation.baseline.revenue,
    revenue_after: evaluation.current.revenue,
    rating_before: evaluation.baseline.avgRating,
    rating_after: evaluation.current.avgRating,
    lesson_strength: evaluation.lessonStrength,
    reuse_recommended: evaluation.reuseRecommended,
    updated_at: now,
  };

  const existingId = existingRows?.[0]?.id;

  if (existingId) {
    const { data, error } = await supabase
      .from("operator_memory")
      .update(payload)
      .eq("id", existingId)
      .select(OPERATOR_MEMORY_SELECT)
      .single();

    if (error) throw new Error(`Failed to update operator memory: ${error.message}`);
    return data as OperatorMemoryRow;
  }

  const { data, error } = await supabase
    .from("operator_memory")
    .insert(payload)
    .select(OPERATOR_MEMORY_SELECT)
    .single();

  if (error) throw new Error(`Failed to insert operator memory: ${error.message}`);
  return data as OperatorMemoryRow;
}

export async function evaluateRecentExecutedActions(params: {
  userId: string;
  limit?: number;
  minAgeHours?: number;
  reviewWindowDays?: number;
}) {
  const {
  userId,
  limit = 20,
  minAgeHours =
    MIN_OUTCOME_VERIFICATION_AGE_HOURS,
  reviewWindowDays = 7,
} = params;
  const supabase = await getSupabaseRouteClient();

  const { data, error } = await supabase
    .from("auto_actions")
    .select(
      "id, user_id, location_name, action_type, title, reason, recommended_payload, source_signal, status, created_at, updated_at"
    )
    .eq("user_id", userId)
    .eq("status", "executed")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to load executed actions: ${error.message}`);

  const actions = (data ?? []) as AutoActionRow[];
  const results: Array<{
    actionId: string;
    saved: boolean;
    evaluation?: OutcomeEvaluation;
    memory?: OperatorMemoryRow;
    skippedReason?: string;
  }> = [];

  for (const action of actions) {
    const outcome = await evaluateExecutedActionOutcome({
      userId,
      action,
      minAgeHours,
      reviewWindowDays,
    });

    if ("reason" in outcome) {
      results.push({ actionId: action.id, saved: false, skippedReason: outcome.reason });
      continue;
    }

    const memory = await saveOutcomeToOperatorMemory({ userId, evaluation: outcome });
    results.push({ actionId: action.id, saved: true, evaluation: outcome, memory });
  }

  return {
    ok: true,
    evaluated: results.length,
    saved: results.filter((result) => result.saved).length,
    results,
    generatedAt: new Date().toISOString(),
  };
}
