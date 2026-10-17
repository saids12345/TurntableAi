import { NextResponse } from "next/server";
import { resolveUniqueConnectedGoogleLocation } from "@/lib/connectedGoogleReviewEvidence";
import { getSupabaseRouteClient } from "@/lib/supabaseRoute";
import { requireProForApi } from "@/lib/requirePro";
import {
  verifyAutoActionEvidence,
} from "@/lib/autoActionEvidenceServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {
  canTransitionAutoActionStatus,
  type AutoActionStatus,
} from "@/lib/autoActionStatus";
import {
  buildProvisionalMemoryEvidence,
} from "@/lib/operatorMemoryTrust";

type AutoActionType =
  | "promo_launch"
  | "review_response_push"
  | "labor_adjustment"
  | "performance_push"
  | "operator_review"
  | "growth_test"
  | "service_recovery"
  | "throughput_stabilization"
  | "margin_protection"
  | "traffic_reactivation";

type AutoActionRow = {
  id: string;
  user_id: string;
  location_name: string;
  action_type: string;
  title: string;
  reason: string;
  recommended_payload: Record<string, unknown> | null;
  source_signal: Record<string, unknown> | null;
  status: AutoActionStatus;
  execution_claim_token?: string | null;
  execution_claimed_at?: string | null;
  priority_score: number;
  created_at: string;
  updated_at: string;
};

type ReviewRow = {
  id: string;
  user_id: string;
  provider_review_id: string | null;
  location_name: string | null;
  rating: number | null;
  text: string | null;
  reviewer_name: string | null;
  update_time: string | null;
};

type ReviewWorkflowRow = {
  id: string;
  user_id: string;
  review_id: string;
  status: "new" | "drafted" | "escalated" | "resolved";
  note: string;
  suggested_reply: string;
  created_at: string;
  updated_at: string;
};

type ExecutionResult = {
  ok: boolean;
  actionType: string;
  executionSummary: string;
  workflowItemsCreated?: number;
  executionMode?: string | null;
  downstreamRecords?: Array<Record<string, unknown>>;
};

type OutcomeWriteResult = {
  ok: boolean;
  mode: "rich" | "minimal" | "skipped";
  error?: string;
};

type MemoryWriteResult = {
  ok: boolean;
  mode: "upserted" | "inserted" | "skipped";
  error?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function normalizeStatus(value: unknown): AutoActionStatus | null {
  if (
    value === "pending" ||
    value === "approved" ||
    value === "executed" ||
    value === "dismissed"
  ) {
    return value;
  }

  return null;
}

function normalizeActionType(value: unknown): AutoActionType | null {
  if (
    value === "promo_launch" ||
    value === "review_response_push" ||
    value === "labor_adjustment" ||
    value === "performance_push" ||
    value === "operator_review" ||
    value === "growth_test" ||
    value === "service_recovery" ||
    value === "throughput_stabilization" ||
    value === "margin_protection" ||
    value === "traffic_reactivation"
  ) {
    return value;
  }

  return null;
}

function daysAgoIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/(^_|_$)/g, "");
}

function inferProblemTypeFromAction(item: AutoActionRow) {
  const reason = `${item.title} ${item.reason}`.toLowerCase();
  const actionType = normalizeActionType(item.action_type) ?? "operator_review";

  if (actionType === "margin_protection" || reason.includes("refund")) {
    return "refund_or_margin_pressure";
  }

  if (actionType === "throughput_stabilization" || reason.includes("wait") || reason.includes("service speed")) {
    return "throughput_pressure";
  }

  if (actionType === "service_recovery" || actionType === "review_response_push" || reason.includes("review")) {
    return "guest_sentiment_risk";
  }

  if (actionType === "traffic_reactivation" || actionType === "promo_launch" || reason.includes("traffic") || reason.includes("revenue")) {
    return "traffic_or_revenue_decline";
  }

  if (actionType === "labor_adjustment" || reason.includes("labor")) {
    return "labor_pressure";
  }

  return slugify(actionType || "operator_signal");
}

function inferLessonFromExecution(item: AutoActionRow, executionResult: ExecutionResult) {
  const problemType = inferProblemTypeFromAction(item);
  const actionType = normalizeActionType(item.action_type) ?? "operator_review";
  const location = item.location_name ? ` at ${item.location_name}` : "";

  if (problemType === "refund_or_margin_pressure") {
    return `When refund or margin pressure appears${location}, prioritize operational leakage review and service recovery before broad discounting.`;
  }

  if (problemType === "throughput_pressure") {
    return `When throughput or service-speed pressure appears${location}, review bottlenecks and shift execution before pushing new demand.`;
  }

  if (problemType === "guest_sentiment_risk") {
    return `When guest sentiment risk appears${location}, prioritize service recovery and review reply workflows quickly.`;
  }

  if (problemType === "traffic_or_revenue_decline") {
    return `When traffic or revenue softens${location}, use recovery campaigns only after checking reputation and operational stability.`;
  }

  if (problemType === "labor_pressure") {
    return `When labor pressure appears${location}, tighten staffing and daypart execution before adding new campaigns.`;
  }

  return `When ${problemType.replace(/_/g, " ")} appears${location}, ${actionType.replace(/_/g, " ")} should be considered as a candidate operator move. Result observed: ${executionResult.executionSummary}`;
}

function inferMemoryConfidence(item: AutoActionRow, executionResult: ExecutionResult) {
  let score = 0;
  if (item.recommended_payload) score += 1;
  if (item.source_signal) score += 1;
  if ((executionResult.downstreamRecords?.length ?? 0) > 0) score += 1;
  if ((executionResult.workflowItemsCreated ?? 0) > 0) score += 1;
  if (item.priority_score >= 75) score += 1;

  if (score >= 4) return "high";
  if (score >= 2) return "medium";
  return "low";
}

function inferIssueFromReview(text: string) {
  const lower = text.toLowerCase();

  if (
    lower.includes("wait") ||
    lower.includes("slow") ||
    lower.includes("delay") ||
    lower.includes("line") ||
    lower.includes("late")
  ) {
    return "service speed";
  }

  if (
    lower.includes("wrong order") ||
    lower.includes("incorrect") ||
    lower.includes("missing") ||
    lower.includes("forgot")
  ) {
    return "order accuracy";
  }

  if (
    lower.includes("dirty") ||
    lower.includes("messy") ||
    lower.includes("cleanliness") ||
    lower.includes("bathroom")
  ) {
    return "cleanliness";
  }

  if (
    lower.includes("rude") ||
    lower.includes("staff") ||
    lower.includes("attitude") ||
    lower.includes("employee")
  ) {
    return "service";
  }

  if (
    lower.includes("stale") ||
    lower.includes("cold") ||
    lower.includes("burnt") ||
    lower.includes("taste") ||
    lower.includes("quality")
  ) {
    return "product quality";
  }

  if (
    lower.includes("price") ||
    lower.includes("pricing") ||
    lower.includes("expensive") ||
    lower.includes("overpriced")
  ) {
    return "value";
  }

  return "the experience";
}

function buildSuggestedReply(review: ReviewRow) {
  const reviewer = cleanText(review.reviewer_name) || "there";
  const issue = inferIssueFromReview(cleanText(review.text));

  return `Hi ${reviewer}, thank you for sharing this feedback. We’re sorry to hear ${issue} missed the mark on your visit. We’re reviewing this with our team so we can improve quickly. If you’re open to it, please reach out to us directly so we can follow up and make things right.`;
}

function getActionPlan(item: AutoActionRow) {
  const payload = isRecord(item.recommended_payload) ? item.recommended_payload : null;
  return payload && isRecord(payload.actionPlan) ? payload.actionPlan : null;
}

function getDecision(item: AutoActionRow) {
  const payload = isRecord(item.recommended_payload) ? item.recommended_payload : null;
  return payload && isRecord(payload.decision) ? payload.decision : null;
}

function getBusinessContext(item: AutoActionRow) {
  const payload = isRecord(item.recommended_payload) ? item.recommended_payload : null;
  return payload && isRecord(payload.businessContext) ? payload.businessContext : null;
}

function getExpectedMetrics(item: AutoActionRow) {
  const payload = isRecord(item.recommended_payload) ? item.recommended_payload : null;
  return payload && isRecord(payload.expectedMetrics) ? payload.expectedMetrics : null;
}

function getExecutionMode(item: AutoActionRow) {
  const actionPlan = getActionPlan(item);
  return asString(actionPlan?.executionMode) ?? null;
}

function getChecklist(item: AutoActionRow) {
  const actionPlan = getActionPlan(item);
  return asStringArray(actionPlan?.checklist);
}

function getRecommendedMove(item: AutoActionRow) {
  const actionPlan = getActionPlan(item);

  return (
    asString(actionPlan?.suggestedOffer) ??
    asString(actionPlan?.suggestedWorkflow) ??
    asString(actionPlan?.focus) ??
    asString(actionPlan?.campaignType) ??
    null
  );
}

function buildChecklistExecution(params: {
  item: AutoActionRow;
  actionType: AutoActionType;
  taskType: string;
  summaryPrefix: string;
  recommendedMove?: string | null;
}) {
  const { item, actionType, taskType, summaryPrefix, recommendedMove } = params;
  const checklist = getChecklist(item);
  const executionMode = getExecutionMode(item);

  return {
    ok: true,
    actionType,
    executionMode,
    executionSummary: `${summaryPrefix} for ${item.location_name}. ${
      recommendedMove ? `Recommended move: ${recommendedMove}. ` : ""
    }${
      checklist.length
        ? `Prepared ${checklist.length} downstream step(s).`
        : "No downstream records were required."
    }`,
    workflowItemsCreated: 0,
    downstreamRecords: checklist.map((step, index) => ({
      id: `${item.id}:${taskType}:${index + 1}`,
      type: taskType,
      title: step,
      status: "planned",
    })),
  } satisfies ExecutionResult;
}

async function executeReviewDraftWorkflow(params: {
  supabase: Awaited<ReturnType<typeof getSupabaseRouteClient>>;
  userId: string;
  locationName: string;
  actionType: "review_response_push" | "service_recovery";
}) {
  const { supabase, userId, locationName, actionType } = params;
  const sinceIso = daysAgoIso(45);

  const { data: connected, error: connectionError } = await supabase
    .from("review_connections")
    .select("review_locations(name,title)")
    .eq("user_id", userId)
    .eq("provider", "google");

  if (connectionError) {
    throw new Error("Google review connection verification unavailable");
  }

  const connectedLocations = (connected ?? []).flatMap((connection) =>
    Array.isArray(connection.review_locations)
      ? connection.review_locations
      : [],
  );
  const googleLocationId = resolveUniqueConnectedGoogleLocation(
    connectedLocations, locationName,
  );
  if (!googleLocationId) {
    throw new Error("Cannot uniquely verify connected Google review location");
  }

  const { data: reviewRows, error: reviewError } = await supabase
    .from("reviews")
    .select("id, user_id, provider_review_id, location_name, rating, text, reviewer_name, update_time")
    .eq("user_id", userId)
    .eq("provider", "google")
    .eq("location_name", googleLocationId)
    .lte("rating", 3)
    .gte("update_time", sinceIso)
    .order("update_time", { ascending: false })
    .limit(5);

  if (reviewError) {
    console.error("auto-actions execute reviews error:", reviewError);
    throw new Error("Failed to load reviews for execution");
  }

  // Database filtering is owner/provider/resource scoped. Recheck the
  // returned identity before any downstream workflow write.
  const reviews = ((reviewRows ?? []) as ReviewRow[]).filter((row) => {
    const rating = row.rating;
    return typeof row.id === "string" && row.id.length > 0 &&
      row.user_id === userId &&
      row.location_name === googleLocationId &&
      typeof row.provider_review_id === "string" &&
      row.provider_review_id.trim().length > 0 &&
      typeof rating === "number" &&
      Number.isFinite(rating) && rating >= 1 && rating <= 3 &&
      typeof row.update_time === "string" &&
      Number.isFinite(Date.parse(row.update_time)) &&
      Date.parse(row.update_time) >= Date.parse(sinceIso) &&
      Date.parse(row.update_time) <= Date.now();
  });

  // A no-op is NOT confirmed execution. Keep the durable execution claim
  // for operator reconciliation rather than recording fabricated work.
  if (!reviews.length) {
    throw new Error("No verified low-rated Google reviews remain for execution");
  }

  const now = new Date().toISOString();

  const workflowPayload = reviews.map((review) => ({
    user_id: userId,
    review_id: review.id,
    status: actionType === "service_recovery" ? ("escalated" as const) : ("drafted" as const),
    note:
      actionType === "service_recovery"
        ? `Auto-created by TurnTableAI service recovery execution for ${locationName}.`
        : `Auto-created by TurnTableAI from auto action execution for ${locationName}.`,
    suggested_reply: buildSuggestedReply(review),
    updated_at: now,
  }));

  const { data: workflowRows, error: workflowError } = await supabase
    .from("review_workflow_states")
    // Insert only. NEVER rewrite a resolved/escalated/drafted workflow or
    // its owner-edited note/reply, even when requests race.
    .upsert(workflowPayload, {
      onConflict: "user_id,review_id",
      ignoreDuplicates: true,
    })
    .select("id, user_id, review_id, status, note, suggested_reply, created_at, updated_at");

  if (workflowError) {
    console.error("auto-actions execute workflow error:", workflowError);
    throw new Error("Failed to create drafted review workflow items");
  }

  const rows = (workflowRows ?? []) as ReviewWorkflowRow[];

  // Only newly inserted, owner-scoped rows are proof of execution.
  // No rows (including all-conflict/no-op saves) must not be reported
  // as success or marked executed. Keep the durable claim for review.
  const eligibleReviewIds = new Set(reviews.map((review) => review.id));
  const returnedReviewIds = new Set<string>();
  const expectedStatus = actionType === "service_recovery"
    ? "escalated"
    : "drafted";
  const rowsConfirmed = rows.length > 0 && rows.every((row) => {
    if (
      typeof row.id !== "string" || !row.id.trim() ||
      row.user_id !== userId ||
      typeof row.review_id !== "string" ||
      !eligibleReviewIds.has(row.review_id) ||
      returnedReviewIds.has(row.review_id) ||
      row.status !== expectedStatus
    ) {
      return false;
    }
    returnedReviewIds.add(row.review_id);
    return true;
  });
  if (!rowsConfirmed) {
    throw new Error("No verified newly inserted review workflows");
  }

  return {
    ok: true,
    actionType,
    executionSummary:
      actionType === "service_recovery"
        ? `Created or escalated ${rows.length} service recovery workflow item(s) for ${locationName}.`
        : `Created or updated ${rows.length} drafted review reply workflow item(s) for ${locationName}.`,
    workflowItemsCreated: rows.length,
    downstreamRecords: rows.map((row) => ({
      id: row.id,
      type: "review_workflow_states",
      status: row.status,
      review_id: row.review_id,
    })),
  } satisfies ExecutionResult;
}

async function executePromoLaunch(params: { item: AutoActionRow }) {
  const { item } = params;

  return buildChecklistExecution({
    item,
    actionType: "promo_launch",
    taskType: "promo_task",
    summaryPrefix: "Marked promo launch ready",
    recommendedMove: getRecommendedMove(item),
  });
}

async function executeTrafficReactivation(params: { item: AutoActionRow }) {
  const { item } = params;

  return buildChecklistExecution({
    item,
    actionType: "traffic_reactivation",
    taskType: "traffic_reactivation_task",
    summaryPrefix: "Marked traffic recovery plan ready",
    recommendedMove: getRecommendedMove(item),
  });
}

async function executeLaborAdjustment(params: { item: AutoActionRow }) {
  const { item } = params;

  return buildChecklistExecution({
    item,
    actionType: "labor_adjustment",
    taskType: "labor_review_task",
    summaryPrefix: "Marked labor adjustment review as executed",
  });
}

async function executeMarginProtection(params: { item: AutoActionRow }) {
  const { item } = params;

  return buildChecklistExecution({
    item,
    actionType: "margin_protection",
    taskType: "margin_protection_task",
    summaryPrefix: "Marked margin protection workflow as executed",
    recommendedMove: getRecommendedMove(item),
  });
}

async function executeThroughputStabilization(params: { item: AutoActionRow }) {
  const { item } = params;

  return buildChecklistExecution({
    item,
    actionType: "throughput_stabilization",
    taskType: "throughput_stabilization_task",
    summaryPrefix: "Marked throughput stabilization workflow as executed",
    recommendedMove: getRecommendedMove(item),
  });
}

async function executePerformancePush(params: { item: AutoActionRow }) {
  const { item } = params;

  return buildChecklistExecution({
    item,
    actionType: "performance_push",
    taskType: "performance_task",
    summaryPrefix: "Marked performance stabilization workflow as executed",
  });
}

async function executeOperatorReview(params: { item: AutoActionRow }) {
  const { item } = params;

  return buildChecklistExecution({
    item,
    actionType: "operator_review",
    taskType: "operator_review_task",
    summaryPrefix: "Marked operator review complete",
  });
}

async function executeGrowthTest(params: { item: AutoActionRow }) {
  const { item } = params;

  return buildChecklistExecution({
    item,
    actionType: "growth_test",
    taskType: "growth_test_task",
    summaryPrefix: "Marked growth test ready",
    recommendedMove: getRecommendedMove(item),
  });
}

async function applyExecutionSideEffects(params: {
  supabase: Awaited<ReturnType<typeof getSupabaseRouteClient>>;
  item: AutoActionRow;
}) {
  const { supabase, item } = params;
  const actionType = normalizeActionType(item.action_type) ?? "operator_review";

  switch (actionType) {
    case "review_response_push":
      return executeReviewDraftWorkflow({
        supabase,
        userId: item.user_id,
        locationName: item.location_name,
        actionType: "review_response_push",
      });

    case "service_recovery":
      return executeReviewDraftWorkflow({
        supabase,
        userId: item.user_id,
        locationName: item.location_name,
        actionType: "service_recovery",
      });

    case "promo_launch":
      return executePromoLaunch({ item });

    case "traffic_reactivation":
      return executeTrafficReactivation({ item });

    case "labor_adjustment":
      return executeLaborAdjustment({ item });

    case "margin_protection":
      return executeMarginProtection({ item });

    case "throughput_stabilization":
      return executeThroughputStabilization({ item });

    case "performance_push":
      return executePerformancePush({ item });

    case "growth_test":
      return executeGrowthTest({ item });

    case "operator_review":
    default:
      return executeOperatorReview({ item });
  }
}

async function recordExecutionOutcome(params: {
  supabase: Awaited<ReturnType<typeof getSupabaseRouteClient>>;
  item: AutoActionRow;
  executionResult: ExecutionResult;
}) {
  const { supabase, item, executionResult } = params;
  const generatedAt = new Date().toISOString();
  const actionType = normalizeActionType(item.action_type) ?? "operator_review";
  const problemType = inferProblemTypeFromAction(item);

  const insightType =
    actionType === "review_response_push" || actionType === "service_recovery"
      ? "reputation"
      : actionType === "promo_launch" || actionType === "traffic_reactivation"
        ? "revenue"
        : actionType === "growth_test"
          ? "growth"
          : "ops";

  const insightSeverity =
    item.priority_score >= 90 ? "high" : item.priority_score >= 55 ? "medium" : "low";

  const dedupeKey = [
    "auto_action_outcome",
    item.user_id,
    item.id,
    actionType,
  ]
    .map((part) => String(part).toLowerCase().replace(/[^a-z0-9_:-]+/g, "_"))
    .join(":");

  const insightPayload = {
    type: insightType,
    severity: insightSeverity,
    title: item.title,
    summary: executionResult.executionSummary,
    reason: item.reason,
    recommendedAction: getRecommendedMove(item) ?? item.title,
    expectedImpact: "Operator action executed and recorded for future learning.",
    href: "/command-center",
    cta: "Open Command Center",
    action_type: actionType,
    locationName: item.location_name,
    autoActionId: item.id,
    executionResult,
    recommendedPayload: item.recommended_payload,
    sourceSignal: item.source_signal,
  };

  const signalSnapshot = {
    locationName: item.location_name,
    problemType,
    actionType,
    priorityScore: item.priority_score,
    decision: getDecision(item),
    businessContext: getBusinessContext(item),
    expectedMetrics: getExpectedMetrics(item),
    capturedAt: generatedAt,
  };

  const performanceSnapshot = {
    source: "auto_actions_execution",
    workflowItemsCreated: executionResult.workflowItemsCreated ?? 0,
    executionMode: executionResult.executionMode ?? getExecutionMode(item),
    downstreamRecords: executionResult.downstreamRecords ?? [],
    capturedAt: generatedAt,
  };

  const row = {
    user_id: item.user_id,
    dedupe_key: dedupeKey,
    insight_title: item.title,
    insight_type: insightType,
    insight_severity: insightSeverity,
    action_status: "acted",
    action_note: executionResult.executionSummary,
    href: "/command-center",
    generated_at: generatedAt,
    insight_payload: insightPayload,
    signal_snapshot: signalSnapshot,
    performance_snapshot: performanceSnapshot,
    updated_at: generatedAt,
  };

  const { error: upsertError } = await supabase
    .from("ai_insight_outcomes")
    .upsert(row, {
      onConflict: "user_id,dedupe_key",
    });

  if (!upsertError) {
    return {
      ok: true,
      mode: "rich",
    } satisfies OutcomeWriteResult;
  }

  console.warn("ai_insight_outcomes upsert failed; trying insert:", upsertError);

  const { error: insertError } = await supabase.from("ai_insight_outcomes").insert(row);

  if (!insertError) {
    return {
      ok: true,
      mode: "rich",
    } satisfies OutcomeWriteResult;
  }

  console.warn("ai_insight_outcomes insert failed:", insertError);

  return {
    ok: false,
    mode: "skipped",
    error: insertError.message,
  } satisfies OutcomeWriteResult;
}

async function recordOperatorMemory(params: {
  supabase: Awaited<ReturnType<typeof getSupabaseRouteClient>>;
  item: AutoActionRow;
  executionResult: ExecutionResult;
}) {
  const { supabase, item, executionResult } = params;

  const problemType = inferProblemTypeFromAction(item);
  const actionType = slugify(item.action_type || "operator_action");
  const now = new Date().toISOString();

  const memoryPayload = {
    user_id: item.user_id,
    location_name: item.location_name || null,
    problem_type: problemType,
    action_type: actionType,
    action_title: normalizeText(item.title, "Operator action"),
    result_summary: executionResult.executionSummary,
    lesson: inferLessonFromExecution(item, executionResult),
    confidence: inferMemoryConfidence(item, executionResult),
    status: "active",
    source_action_id:
  item.id,
    source_outcome_id: null,
    evidence:
  buildProvisionalMemoryEvidence(
    {
      source:
        "auto_actions_execution",

      autoActionId:
        item.id,

      actionType:
        item.action_type,

      priorityScore:
        item.priority_score,

      reason:
        item.reason,

      recommendedPayload:
        item.recommended_payload,

      sourceSignal:
        item.source_signal,

      executionResult,

      executionMode:
        executionResult.executionMode ??
        getExecutionMode(
          item,
        ),

      downstreamRecords:
        executionResult.downstreamRecords ??
        [],

      recordedAt:
        now,
    },

    "Execution proves that the action occurred, not that it worked. This memory remains provisional until Decision Outcome Verification measures the real-world result.",
  ),

reuse_recommended:
  false,
    updated_at: now,
  };

  const { error: upsertError } = await supabase
    .from("operator_memory")
    .upsert(memoryPayload, {
      onConflict:
        "user_id,source_action_id",
    });

  if (!upsertError) {
    return {
      ok: true,
      mode: "upserted",
    } satisfies MemoryWriteResult;
  }

  console.warn("operator_memory upsert failed; trying plain insert:", upsertError);

  const { error: insertError } = await supabase.from("operator_memory").insert(memoryPayload);

  if (!insertError) {
    return {
      ok: true,
      mode: "inserted",
    } satisfies MemoryWriteResult;
  }

  console.warn("operator_memory insert failed:", insertError);

  return {
    ok: false,
    mode: "skipped",
    error: insertError.message,
  } satisfies MemoryWriteResult;
}

export async function GET() {
  await requireProForApi();

  try {
    const supabase = await getSupabaseRouteClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      return NextResponse.json(
        { error: `Authentication failed: ${authError.message}` },
        { status: 401 }
      );
    }

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("auto_actions")
      .select(
        "id, user_id, location_name, action_type, title, reason, recommended_payload, source_signal, status, execution_claim_token, execution_claimed_at, priority_score, created_at, updated_at"
      )
      .eq("user_id", user.id)
      .order("priority_score", { ascending: false })
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("auto-actions GET error:", error);

      return NextResponse.json(
        { error: `Failed to load auto actions: ${error.message}` },
        { status: 500 }
      );
    }

    const items = (data ?? []) as AutoActionRow[];

    const annotatedItems = await Promise.all(
      items.map(async (item) => {
        // Claim tokens are internal coordination secrets; never return them.
        const { execution_claim_token: _claimToken, ...safeItem } = item;

        if (item.status !== "pending" && item.status !== "approved") {
          return { ...safeItem, evidenceStatus: "historical" as const };
        }

        // Status may still be 'approved' after a crash or partial execution.
        // A durable claim takes precedence over evidence freshness.
        if (item.execution_claim_token) {
          return {
            ...safeItem,
            evidenceStatus: "reconciliation_required" as const,
          };
        }

        try {
          const verified = await verifyAutoActionEvidence({
            userId: user.id,
            locationName: item.location_name,
            createdAt: item.created_at,
            sourceSignal: item.source_signal,
          });

          return {
            ...safeItem,
            evidenceStatus: verified
              ? ("current" as const)
              : ("unverified" as const),
          };
        } catch (error) {
          console.error("Auto Action evidence check failed:", error);
          return { ...safeItem, evidenceStatus: "unverified" as const };
        }
      }),
    );

    return NextResponse.json({
      items: annotatedItems,
      generatedAt: new Date().toISOString(),
      ok: true,
    });
  } catch (error) {
    console.error("auto-actions GET unexpected error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `Unexpected error: ${error.message}`
            : "Unexpected error",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  await requireProForApi();

  try {
    const supabase = await getSupabaseRouteClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      return NextResponse.json(
        { error: `Authentication failed: ${authError.message}` },
        { status: 401 }
      );
    }

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      id?: string;
      status?: AutoActionStatus;
    };

    const id = typeof body.id === "string" ? body.id.trim() : "";
    const nextStatus = normalizeStatus(body.status);

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    if (!nextStatus) {
      return NextResponse.json({ error: "valid status is required" }, { status: 400 });
    }

    const { data: existing, error: existingError } = await supabase
      .from("auto_actions")
      .select(
        "id, user_id, location_name, action_type, title, reason, recommended_payload, source_signal, status, execution_claim_token, execution_claimed_at, priority_score, created_at, updated_at"
      )
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (existingError || !existing) {
      console.error("auto-actions PATCH existing error:", existingError);

      return NextResponse.json({ error: "Auto action not found" }, { status: 404 });
    }

    const currentItem = existing as AutoActionRow;

    if (!canTransitionAutoActionStatus(currentItem.status, nextStatus)) {
      return NextResponse.json(
        {
          error: `Cannot move auto action from ${currentItem.status} to ${nextStatus}`,
        },
        { status: 400 }
      );
    }

    if (
      (nextStatus === "approved" || nextStatus === "executed") &&
      currentItem.status !== nextStatus
    ) {
      const evidenceVerified = await verifyAutoActionEvidence({
        userId: user.id,
        locationName: currentItem.location_name,
        createdAt: currentItem.created_at,
        sourceSignal: currentItem.source_signal,
      });

      if (!evidenceVerified) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "This recommendation lacks current verified evidence for this restaurant. Generate a fresh recommendation before approving or executing.",
            code: "AUTO_ACTION_EVIDENCE_UNVERIFIED",
          },
          { status: 409 },
        );
      }
    }

    // A durable claim is never cleared automatically: failures require
    // reconciliation rather than risking duplicate side effects.
    if (currentItem.execution_claim_token && currentItem.status !== "executed") {
      return NextResponse.json(
        {
          ok: false,
          code: "AUTO_ACTION_EXECUTION_RECONCILIATION_REQUIRED",
          error: "An execution claim already exists. Manual reconciliation is required.",
        },
        { status: 409 },
      );
    }

    if (currentItem.status === nextStatus) {
      return NextResponse.json({
        item: {
          id: currentItem.id,
          user_id: currentItem.user_id,
          location_name: currentItem.location_name,
          action_type: currentItem.action_type,
          title: currentItem.title,
          reason: currentItem.reason,
          recommended_payload: currentItem.recommended_payload,
          source_signal: currentItem.source_signal,
          status: currentItem.status,
          priority_score: currentItem.priority_score,
          created_at: currentItem.created_at,
          updated_at: currentItem.updated_at,
        },
        executionResult: null,
        outcomeWrite: null,
        memoryWrite: null,
        savedAt: new Date().toISOString(),
        ok: true,
      });
    }

    const selectedFields =
      "id, user_id, location_name, action_type, title, reason, recommended_payload, source_signal, status, priority_score, created_at, updated_at";

    if (nextStatus !== "executed") {
      // Conditional mutation also prevents dismissal/approval racing an
      // execution claim after the initial row read.
      const { data, error } = await supabase
        .from("auto_actions")
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", user.id)
        .eq("status", currentItem.status)
        .is("execution_claim_token", null)
        .select(selectedFields)
        .maybeSingle();

      if (error) {
        console.error("auto-actions PATCH conditional update failed:", error);
        return NextResponse.json(
          { error: "Failed to update auto action" },
          { status: 500 },
        );
      }
      if (!data) {
        return NextResponse.json(
          { ok: false, code: "AUTO_ACTION_STATUS_CONFLICT", error: "Action changed during update. Refresh first." },
          { status: 409 },
        );
      }
      return NextResponse.json({
        item: data as AutoActionRow,
        executionResult: null,
        outcomeWrite: null,
        memoryWrite: null,
        savedAt: new Date().toISOString(),
        ok: true,
      });
    }

    // Only an approved, unclaimed action can acquire an execution claim.
    // PostgreSQL's conditional UPDATE makes simultaneous attempts single-winner.
    const claimToken = globalThis.crypto.randomUUID();
    const { data: claimed, error: claimError } = await supabase
      .from("auto_actions")
      .update({
        execution_claim_token: claimToken,
        execution_claimed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("status", "approved")
      .is("execution_claim_token", null)
      .select("id")
      .maybeSingle();

    if (claimError) {
      console.error("auto-actions PATCH execution claim failed:", claimError);
      return NextResponse.json(
        { error: "Could not claim auto action for execution" },
        { status: 500 },
      );
    }
    if (!claimed) {
      return NextResponse.json(
        { ok: false, code: "AUTO_ACTION_EXECUTION_ALREADY_CLAIMED", error: "This action was already claimed or changed." },
        { status: 409 },
      );
    }

    let executionResult: ExecutionResult;
    let outcomeWrite: OutcomeWriteResult;
    let memoryWrite: MemoryWriteResult;

    try {
      executionResult = await applyExecutionSideEffects({
        supabase,
        item: currentItem,
      });
      if (!executionResult.ok) {
        throw new Error("Execution did not confirm success");
      }

      outcomeWrite = await recordExecutionOutcome({
        supabase,
        item: currentItem,
        executionResult,
      });
      memoryWrite = await recordOperatorMemory({
        supabase,
        item: currentItem,
        executionResult,
      });
      if (!outcomeWrite.ok || !memoryWrite.ok) {
        throw new Error("Execution records could not be confirmed");
      }
    } catch (error) {
      // Do not release the claim: some external/database effects may have
      // succeeded before the failure. An operator must reconcile first.
      console.error("auto-actions execution requires reconciliation:", error);
      return NextResponse.json(
        {
          ok: false,
          code: "AUTO_ACTION_EXECUTION_RECONCILIATION_REQUIRED",
          error: "Execution is uncertain; manual reconciliation is required before retrying.",
        },
        { status: 500 },
      );
    }

    const { data, error } = await supabase
      .from("auto_actions")
      .update({ status: "executed", updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("status", "approved")
      .eq("execution_claim_token", claimToken)
      .select(selectedFields)
      .maybeSingle();

    if (error || !data) {
      console.error("auto-actions execution finalization failed:", error);
      return NextResponse.json(
        {
          ok: false,
          code: "AUTO_ACTION_EXECUTION_RECONCILIATION_REQUIRED",
          error: "Execution occurred but final status is unconfirmed. Manual reconciliation is required.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      item: data as AutoActionRow,
      executionResult,
      outcomeWrite,
      memoryWrite,
      savedAt: new Date().toISOString(),
      ok: true,
    });
  } catch (error) {
    console.error("auto-actions PATCH unexpected error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `Unexpected error: ${error.message}`
            : "Unexpected error",
      },
      { status: 500 }
    );
  }
}