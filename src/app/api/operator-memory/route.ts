import {
  buildProvisionalMemoryEvidence,
  getMemoryTrustState,
  getVerifiedMemoryOutcomeScore,
  isMemoryEligibleAsReusablePlaybook,
  isMemoryTrustedForReasoning,
} from "@/lib/operatorMemoryTrust";
import { NextResponse } from "next/server";
import { getSupabaseRouteClient } from "@/lib/supabaseRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MemoryConfidence = "low" | "medium" | "high";
type MemoryStatus = "active" | "archived";
type LessonStrength = "weak" | "developing" | "strong";

type OperatorMemoryRow = {
  id: string;
  user_id: string;
  location_name: string | null;
  problem_type: string;
  action_type: string;
  action_title: string;
  result_summary: string;
  lesson: string;
  confidence: MemoryConfidence;
  status: MemoryStatus;
  source_action_id: string | null;
  source_outcome_id: string | null;
  evidence: Record<string, unknown> | null;
  outcome_score?: number | null;
  success?: boolean | null;
  revenue_before?: number | null;
  revenue_after?: number | null;
  rating_before?: number | null;
  rating_after?: number | null;
  lesson_strength?: LessonStrength | null;
  reuse_recommended?: boolean | null;
  created_at: string;
  updated_at: string;
};

type CreateMemoryBody = {
  locationName?: string | null;
  problemType?: string;
  actionType?: string;
  actionTitle?: string;
  resultSummary?: string;
  lesson?: string;
  confidence?: MemoryConfidence;
  sourceActionId?: string | null;
  sourceOutcomeId?: string | null;
  evidence?: Record<string, unknown> | null;
  outcomeScore?: number | null;
  success?: boolean | null;
  revenueBefore?: number | null;
  revenueAfter?: number | null;
  ratingBefore?: number | null;
  ratingAfter?: number | null;
  lessonStrength?: LessonStrength | null;
  reuseRecommended?: boolean | null;
};

type OutcomeRow = {
  id: string;
  user_id: string;
  generated_at: string | null;
  insight_title?: string | null;
  insight_type?: string | null;
  action_status?: string | null;
  action_note?: string | null;
  insight_payload?: Record<string, unknown> | null;
  signal_snapshot?: Record<string, unknown> | null;
  performance_snapshot?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type MemorySaveRow = {
  user_id: string;
  location_name: string | null;
  problem_type: string;
  action_type: string;
  action_title: string;
  result_summary: string;
  lesson: string;
  confidence: MemoryConfidence;
  status: MemoryStatus;
  source_action_id: string | null;
  source_outcome_id: string | null;
  evidence: Record<string, unknown>;
  outcome_score: number | null;
  success: boolean | null;
  revenue_before: number | null;
  revenue_after: number | null;
  rating_before: number | null;
  rating_after: number | null;
  lesson_strength: LessonStrength;
  reuse_recommended: boolean;
  updated_at: string;
};

const OPERATOR_MEMORY_SELECT_BASE =
  "id, user_id, location_name, problem_type, action_type, action_title, result_summary, lesson, confidence, status, source_action_id, source_outcome_id, evidence, created_at, updated_at";

const OPERATOR_MEMORY_SELECT_EXTENDED =
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

function asBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return null;
}

function normalizeConfidence(value: unknown): MemoryConfidence {
  if (value === "high" || value === "medium" || value === "low") return value;
  return "medium";
}

function normalizeLessonStrength(value: unknown): LessonStrength {
  if (value === "strong" || value === "developing" || value === "weak") return value;
  return "developing";
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function inferProblemTypeFromOutcome(outcome: OutcomeRow) {
  const payload = isRecord(outcome.insight_payload) ? outcome.insight_payload : null;
  const signal = isRecord(outcome.signal_snapshot) ? outcome.signal_snapshot : null;
  const performance = isRecord(outcome.performance_snapshot) ? outcome.performance_snapshot : null;

  const type =
    asString(payload?.action_type) ??
    asString(payload?.type) ??
    asString(outcome.insight_type) ??
    "operator_signal";

  const summary = [
    asString(payload?.summary),
    asString(payload?.reason),
    asString(payload?.executionSummary),
    asString(signal?.topIssue),
    asString(signal?.top_issue),
    asNumber(performance?.refunds) !== null ? `refunds ${asNumber(performance?.refunds)}` : null,
    asString(outcome.action_note),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (summary.includes("refund")) return "refund_pressure";
  if (summary.includes("wait") || summary.includes("slow") || summary.includes("throughput")) {
    return "throughput_pressure";
  }
  if (summary.includes("rating") || summary.includes("review") || summary.includes("guest")) {
    return "guest_sentiment_risk";
  }
  if (summary.includes("revenue") || summary.includes("sales") || summary.includes("traffic")) {
    return "traffic_or_revenue_decline";
  }
  if (summary.includes("labor") || summary.includes("margin")) {
    return "margin_or_labor_pressure";
  }

  return slugify(type || "operator_signal");
}

function inferLocationName(outcome: OutcomeRow) {
  const payload = isRecord(outcome.insight_payload) ? outcome.insight_payload : null;
  const signal = isRecord(outcome.signal_snapshot) ? outcome.signal_snapshot : null;
  const performance = isRecord(outcome.performance_snapshot) ? outcome.performance_snapshot : null;

  return (
    asString(signal?.locationName) ??
    asString(signal?.location_name) ??
    asString(performance?.locationName) ??
    asString(performance?.location_name) ??
    asString(payload?.locationName) ??
    asString(payload?.location_name) ??
    null
  );
}

function inferActionType(outcome: OutcomeRow) {
  const payload = isRecord(outcome.insight_payload) ? outcome.insight_payload : null;

  return slugify(
    asString(payload?.action_type) ??
      asString(payload?.type) ??
      asString(outcome.insight_type) ??
      "operator_action"
  );
}

function inferActionTitle(outcome: OutcomeRow) {
  const payload = isRecord(outcome.insight_payload) ? outcome.insight_payload : null;

  return (
    asString(outcome.insight_title) ??
    asString(payload?.title) ??
    asString(payload?.summary) ??
    "Executed operator action"
  );
}

function inferResultSummary(outcome: OutcomeRow) {
  const payload = isRecord(outcome.insight_payload) ? outcome.insight_payload : null;

  return (
    asString(outcome.action_note) ??
    asString(payload?.summary) ??
    asString(payload?.executionSummary) ??
    asString(payload?.expectedImpact) ??
    "Outcome was recorded for future operator decisions."
  );
}

function inferMetricSnapshot(outcome: OutcomeRow) {
  const signal = isRecord(outcome.signal_snapshot) ? outcome.signal_snapshot : null;
  const performance = isRecord(outcome.performance_snapshot) ? outcome.performance_snapshot : null;
  const payload = isRecord(outcome.insight_payload) ? outcome.insight_payload : null;
  const expectedMetrics = payload && isRecord(payload.expectedMetrics) ? payload.expectedMetrics : null;

  const revenueBefore =
    asNumber(performance?.previousRevenue) ??
    asNumber(performance?.previous_revenue) ??
    asNumber(payload?.previousRevenue) ??
    null;

  const revenueAfter =
    asNumber(performance?.revenue) ??
    asNumber(performance?.latestRevenue) ??
    asNumber(performance?.latest_revenue) ??
    asNumber(payload?.latestRevenue) ??
    null;

  const ratingBefore =
    asNumber(signal?.previousAvgRating) ??
    asNumber(signal?.previous_avg_rating) ??
    null;

  const ratingAfter =
    asNumber(signal?.avgRating) ??
    asNumber(signal?.avg_rating) ??
    null;

  const expectedRevenueRecovery = asNumber(expectedMetrics?.revenueRecoveryPct);
  const workflowItemsCreated = asNumber(payload?.workflowItemsCreated);

  return {
    revenueBefore,
    revenueAfter,
    ratingBefore,
    ratingAfter,
    expectedRevenueRecovery,
    workflowItemsCreated,
    refunds: asNumber(performance?.refunds),
    reviewIssueCount: asNumber(signal?.reviewIssueCount) ?? asNumber(signal?.review_issue_count),
  };
}

function inferOutcomeScore(outcome: OutcomeRow) {
  const metrics = inferMetricSnapshot(outcome);
  let score = 50;

  if (metrics.revenueBefore !== null && metrics.revenueAfter !== null && metrics.revenueBefore > 0) {
    const revenueDeltaPct =
      ((metrics.revenueAfter - metrics.revenueBefore) / metrics.revenueBefore) * 100;
    score += clamp(revenueDeltaPct * 2, -25, 30);
  }

  if (metrics.ratingBefore !== null && metrics.ratingAfter !== null) {
    score += clamp((metrics.ratingAfter - metrics.ratingBefore) * 20, -20, 20);
  }

  if (metrics.expectedRevenueRecovery !== null) {
    score += clamp(metrics.expectedRevenueRecovery, 0, 15);
  }

  if (metrics.workflowItemsCreated !== null && metrics.workflowItemsCreated > 0) {
    score += clamp(metrics.workflowItemsCreated * 3, 3, 15);
  }

  if (outcome.action_status === "acted") score += 8;
  if (outcome.action_status === "dismissed") score -= 15;

  return Math.round(clamp(score, 0, 100));
}

function inferSuccess(outcome: OutcomeRow) {
  const score = inferOutcomeScore(outcome);
  if (outcome.action_status === "dismissed") return false;
  if (score >= 65) return true;
  if (score <= 35) return false;
  return null;
}

function inferLessonStrength(outcome: OutcomeRow): LessonStrength {
  const score = inferOutcomeScore(outcome);
  const confidence = inferConfidence(outcome);

  if (score >= 70 && confidence === "high") return "strong";
  if (score >= 55 || confidence === "medium") return "developing";
  return "weak";
}

function inferReuseRecommended(outcome: OutcomeRow) {
  const score = inferOutcomeScore(outcome);
  const lessonStrength = inferLessonStrength(outcome);
  const success = inferSuccess(outcome);

  if (success === false) return false;
  if (score >= 60) return true;
  return lessonStrength === "strong";
}

function inferLesson(outcome: OutcomeRow) {
  const problemType = inferProblemTypeFromOutcome(outcome);
  const actionType = inferActionType(outcome);
  const locationName = inferLocationName(outcome);
  const outcomeScore = inferOutcomeScore(outcome);
  const reuse = inferReuseRecommended(outcome);

  const suffix = reuse
    ? ` This playbook should be considered again when similar conditions appear. Outcome score: ${outcomeScore}/100.`
    : ` This playbook should be reviewed before reuse. Outcome score: ${outcomeScore}/100.`;

  if (problemType === "refund_pressure") {
    return `When refund pressure appears${locationName ? ` at ${locationName}` : ""}, prioritize operational leakage review before broad discounting.${suffix}`;
  }

  if (problemType === "throughput_pressure") {
    return `When service speed or throughput pressure appears${locationName ? ` at ${locationName}` : ""}, prioritize bottleneck review and shift execution before launching growth campaigns.${suffix}`;
  }

  if (problemType === "guest_sentiment_risk") {
    return `When review or guest sentiment risk appears${locationName ? ` at ${locationName}` : ""}, prioritize service recovery and reply workflows quickly.${suffix}`;
  }

  if (problemType === "traffic_or_revenue_decline") {
    return `When traffic or revenue softens${locationName ? ` at ${locationName}` : ""}, consider recovery offers only after checking reputation and operational stability.${suffix}`;
  }

  if (problemType === "margin_or_labor_pressure") {
    return `When margin or labor pressure appears${locationName ? ` at ${locationName}` : ""}, tighten execution and staffing review before adding new demand.${suffix}`;
  }

  return `When ${problemType.replace(/_/g, " ")} appears, ${actionType.replace(
    /_/g,
    " "
  )} should be considered as a candidate operator move.${suffix}`;
}

function inferConfidence(outcome: OutcomeRow): MemoryConfidence {
  const signal = isRecord(outcome.signal_snapshot) ? outcome.signal_snapshot : null;
  const performance = isRecord(outcome.performance_snapshot) ? outcome.performance_snapshot : null;

  let score = 0;
  if (signal) score += 1;
  if (performance) score += 1;
  if (asNumber(signal?.avgRating) !== null) score += 1;
  if (asNumber(signal?.reviewIssueCount) !== null) score += 1;
  if (asNumber(performance?.revenue) !== null) score += 1;
  if (outcome.action_status === "acted") score += 1;

  if (score >= 4) return "high";
  if (score >= 2) return "medium";
  return "low";
}

function buildMemoryKey(params: {
  locationName: string | null;
  problemType: string;
  actionType: string;
}) {
  return [
    normalizeText(params.locationName, "global"),
    params.problemType,
    params.actionType,
  ]
    .map(slugify)
    .join(":");
}

function stripLearningColumns(row: MemorySaveRow) {
  const {
    outcome_score,
    success,
    revenue_before,
    revenue_after,
    rating_before,
    rating_after,
    lesson_strength,
    reuse_recommended,
    ...baseRow
  } = row;

  return baseRow;
}

function isMissingColumnError(errorMessage: string) {
  const lower = errorMessage.toLowerCase();
  return (
    lower.includes("column") ||
    lower.includes("schema cache") ||
    lower.includes("could not find")
  );
}

async function buildMemoryFromRecentOutcomes(params: {
  supabase: Awaited<ReturnType<typeof getSupabaseRouteClient>>;
  userId: string;
}) {
  const { supabase, userId } = params;

  const { data: outcomes, error } = await supabase
    .from("ai_insight_outcomes")
    .select(
      "id, user_id, generated_at, insight_title, insight_type, action_status, action_note, insight_payload, signal_snapshot, performance_snapshot, created_at, updated_at"
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(25);

  if (error) {
    throw new Error(`Failed to load outcomes: ${error.message}`);
  }

  return ((outcomes ?? []) as OutcomeRow[]).map((outcome) => {
    const locationName = inferLocationName(outcome);
    const problemType = inferProblemTypeFromOutcome(outcome);
    const actionType = inferActionType(outcome);
    const metrics = inferMetricSnapshot(outcome);
    const outcomeScore = inferOutcomeScore(outcome);
    const success = inferSuccess(outcome);
    const lessonStrength = inferLessonStrength(outcome);
    const reuseRecommended = inferReuseRecommended(outcome);

    return {
      user_id: userId,
      location_name: locationName,
      problem_type: problemType,
      action_type: actionType,
      action_title: inferActionTitle(outcome),
      result_summary: inferResultSummary(outcome),
      lesson: inferLesson(outcome),
      confidence: inferConfidence(outcome),
      status: "active" as MemoryStatus,
      source_action_id: null,
      source_outcome_id: outcome.id,
      evidence: {
        memoryKey: buildMemoryKey({
          locationName,
          problemType,
          actionType,
        }),
        source: "ai_insight_outcomes",
        generatedAt: outcome.generated_at,
        signalSnapshot: outcome.signal_snapshot ?? null,
        performanceSnapshot: outcome.performance_snapshot ?? null,
        insightPayload: outcome.insight_payload ?? null,
        metrics,
        outcomeScore,
        success,
        lessonStrength,
        reuseRecommended,
      },
      outcome_score: outcomeScore,
      success,
      revenue_before: metrics.revenueBefore,
      revenue_after: metrics.revenueAfter,
      rating_before: metrics.ratingBefore,
      rating_after: metrics.ratingAfter,
      lesson_strength: lessonStrength,
      reuse_recommended: reuseRecommended,
      updated_at: new Date().toISOString(),
    } satisfies MemorySaveRow;
  });
}

async function selectOperatorMemory(params: {
  supabase: Awaited<ReturnType<typeof getSupabaseRouteClient>>;
  userId: string;
}) {
  const { supabase, userId } = params;

  const extended = await supabase
    .from("operator_memory")
    .select(OPERATOR_MEMORY_SELECT_EXTENDED)
    .eq("user_id", userId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(50);

  if (!extended.error) return extended;

  if (!isMissingColumnError(extended.error.message)) return extended;

  console.warn("operator-memory GET extended select failed; falling back to base columns:", extended.error);

  return supabase
    .from("operator_memory")
    .select(OPERATOR_MEMORY_SELECT_BASE)
    .eq("user_id", userId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(50);
}

async function saveMemoryRows(params: {
  supabase: Awaited<ReturnType<typeof getSupabaseRouteClient>>;
  rows: MemorySaveRow[];
}) {
  const { supabase, rows } = params;
  const saved: OperatorMemoryRow[] = [];

  for (const row of rows) {
    let query = supabase
      .from("operator_memory")
      .select("id")
      .eq("user_id", row.user_id)
      .eq("problem_type", row.problem_type)
      .eq("action_type", row.action_type)
      .eq("status", "active")
      .limit(1);

    query =
      row.location_name === null
        ? query.is("location_name", null)
        : query.eq("location_name", row.location_name);

    const { data: existingRows, error: lookupError } = await query;

    if (lookupError) {
      throw new Error(`Failed to check existing operator memory: ${lookupError.message}`);
    }

    const existingId = existingRows?.[0]?.id;

    if (existingId) {
      const updatePayload = {
        action_title: row.action_title,
        result_summary: row.result_summary,
        lesson: row.lesson,
        confidence: row.confidence,
        source_action_id: row.source_action_id,
        source_outcome_id: row.source_outcome_id,
        evidence: row.evidence,
        outcome_score: row.outcome_score,
        success: row.success,
        revenue_before: row.revenue_before,
        revenue_after: row.revenue_after,
        rating_before: row.rating_before,
        rating_after: row.rating_after,
        lesson_strength: row.lesson_strength,
        reuse_recommended: row.reuse_recommended,
        updated_at: row.updated_at,
      };

      const { data, error } = await supabase
        .from("operator_memory")
        .update(updatePayload)
        .eq("id", existingId)
        .select(OPERATOR_MEMORY_SELECT_EXTENDED)
        .single();

      if (!error && data) {
        saved.push(data as OperatorMemoryRow);
        continue;
      }

      if (error && !isMissingColumnError(error.message)) {
        throw new Error(`Failed to update operator memory: ${error.message}`);
      }

      console.warn("operator-memory extended update failed; falling back to base columns:", error);

      const { data: fallbackData, error: fallbackError } = await supabase
        .from("operator_memory")
        .update(stripLearningColumns(row))
        .eq("id", existingId)
        .select(OPERATOR_MEMORY_SELECT_BASE)
        .single();

      if (fallbackError) {
        throw new Error(`Failed to update operator memory: ${fallbackError.message}`);
      }

      if (fallbackData) saved.push(fallbackData as OperatorMemoryRow);
      continue;
    }

    const { data, error } = await supabase
      .from("operator_memory")
      .insert(row)
      .select(OPERATOR_MEMORY_SELECT_EXTENDED)
      .single();

    if (!error && data) {
      saved.push(data as OperatorMemoryRow);
      continue;
    }

    if (error && !isMissingColumnError(error.message)) {
      throw new Error(`Failed to insert operator memory: ${error.message}`);
    }

    console.warn("operator-memory extended insert failed; falling back to base columns:", error);

    const { data: fallbackData, error: fallbackError } = await supabase
      .from("operator_memory")
      .insert(stripLearningColumns(row))
      .select(OPERATOR_MEMORY_SELECT_BASE)
      .single();

    if (fallbackError) {
      throw new Error(`Failed to insert operator memory: ${fallbackError.message}`);
    }

    if (fallbackData) saved.push(fallbackData as OperatorMemoryRow);
  }

  return saved;
}

function summarizeOperatorMemory(
  items: OperatorMemoryRow[],
) {
  const active =
    items.filter(
      (item) =>
        item.status ===
        "active",
    );

  const trusted =
    active.filter(
      (item) =>
        isMemoryTrustedForReasoning(
          item,
        ),
    );

  const verifiedScores =
    trusted
      .map((item) =>
        getVerifiedMemoryOutcomeScore(
          item,
        ),
      )
      .filter(
        (
          score,
        ): score is number =>
          score !== null,
      );

  const successful =
    trusted.filter(
      (item) =>
        getMemoryTrustState(
          item,
        ) ===
        "verified_supporting",
    ).length;

  const reusable =
    trusted.filter(
      (item) =>
        isMemoryEligibleAsReusablePlaybook(
          item,
        ),
    ).length;

  const strongLessons =
    trusted.filter(
      (item) =>
        item.lesson_strength ===
        "strong",
    ).length;

  const averageOutcomeScore =
    verifiedScores.length > 0
      ? Math.round(
          verifiedScores.reduce(
            (
              sum,
              score,
            ) =>
              sum +
              score,
            0,
          ) /
            verifiedScores.length,
        )
      : null;

  const actionTypeCounts =
    trusted.reduce<
      Record<string, number>
    >(
      (
        counts,
        item,
      ) => {
        counts[
          item.action_type
        ] =
          (
            counts[
              item.action_type
            ] ?? 0
          ) + 1;

        return counts;
      },
      {},
    );

  const mostRepeatedActionType =
    Object.entries(
      actionTypeCounts,
    ).sort(
      (a, b) =>
        b[1] - a[1],
    )[0]?.[0] ??
    null;

  return {
    totalLessons:
      active.length,

    trustedLessons:
      trusted.length,

    scoredLessons:
      verifiedScores.length,

    successfulLessons:
      successful,

    reusableLessons:
      reusable,

    strongLessons,

    averageOutcomeScore,

    mostRepeatedActionType,
  };
}

export async function GET() {
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

    const { data, error } = await selectOperatorMemory({
      supabase,
      userId: user.id,
    });

    if (error) {
      console.error("operator-memory GET error:", error);
      return NextResponse.json(
        {
          error:
            "Failed to load operator memory. Confirm the operator_memory table exists in Supabase.",
          details: error.message,
        },
        { status: 500 }
      );
    }

    const items = (data ?? []) as OperatorMemoryRow[];

    return NextResponse.json({
      ok: true,
      items,
      summary: summarizeOperatorMemory(items),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("operator-memory GET unexpected error:", error);
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

export async function POST(request: Request) {
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

    const body = (await request.json().catch(() => ({}))) as CreateMemoryBody & {
      mode?: "manual" | "from_outcomes";
    };

    let rowsToSave: MemorySaveRow[];

    if (body.mode === "from_outcomes") {
      rowsToSave = await buildMemoryFromRecentOutcomes({
        supabase,
        userId: user.id,
      });
    } else {
      const problemType = slugify(normalizeText(body.problemType, "operator_signal"));
      const actionType = slugify(normalizeText(body.actionType, "operator_action"));
      const locationName =
        typeof body.locationName === "string" && body.locationName.trim()
          ? body.locationName.trim()
          : null;

      const outcomeScore = body.outcomeScore ?? null;
      const success = asBoolean(body.success);
      const lessonStrength = normalizeLessonStrength(body.lessonStrength);
      const reuseRecommended =
        typeof body.reuseRecommended === "boolean"
          ? body.reuseRecommended
          : success === false
            ? false
            : (outcomeScore ?? 0) >= 60;

      rowsToSave = [
        {
          user_id: user.id,
          location_name: locationName,
          problem_type: problemType,
          action_type: actionType,
          action_title: normalizeText(body.actionTitle, "Operator action"),
          result_summary: normalizeText(
            body.resultSummary,
            "Result recorded for future operator decisions."
          ),
          lesson: normalizeText(
            body.lesson,
            `When ${problemType.replace(/_/g, " ")} appears, consider ${actionType.replace(
              /_/g,
              " "
            )} as a candidate operator move.`
          ),
          confidence: normalizeConfidence(body.confidence),
          status: "active",
          source_action_id:
  typeof body.sourceActionId === "string" &&
  body.sourceActionId.trim()
    ? body.sourceActionId.trim()
    : null,
          source_outcome_id:
            typeof body.sourceOutcomeId === "string" && body.sourceOutcomeId.trim()
              ? body.sourceOutcomeId.trim()
              : null,
          evidence: isRecord(body.evidence)
            ? {
                ...body.evidence,
                outcomeScore,
                success,
                lessonStrength,
                reuseRecommended,
              }
            : {
                memoryKey: buildMemoryKey({
                  locationName,
                  problemType,
                  actionType,
                }),
                source: "manual",
                outcomeScore,
                success,
                lessonStrength,
                reuseRecommended,
              },
          outcome_score: outcomeScore,
          success,
          revenue_before: body.revenueBefore ?? null,
          revenue_after: body.revenueAfter ?? null,
          rating_before: body.ratingBefore ?? null,
          rating_after: body.ratingAfter ?? null,
          lesson_strength: lessonStrength,
          reuse_recommended: reuseRecommended,
          updated_at: new Date().toISOString(),
        },
      ];
    }

    /*
 * This API may record observations,
 * imported outcomes, or human-entered memory,
 * but it is NOT allowed to manufacture
 * trusted Decision Outcome Verification.
 */
rowsToSave =
  rowsToSave.map(
    (row) => ({
      ...row,

      evidence:
        buildProvisionalMemoryEvidence(
          row.evidence,

          "Operator Memory API writes are provisional until Decision Outcome Verification verifies the exact executed action.",
        ),

      /*
       * A provisional memory cannot become
       * an executable reusable playbook.
       */
      reuse_recommended:
        false,
    }),
  );

    if (!rowsToSave.length) {
      return NextResponse.json({
        ok: true,
        saved: 0,
        items: [],
        message: "No operator memory was created because no outcomes were available.",
      });
    }

    const savedRows = await saveMemoryRows({
      supabase,
      rows: rowsToSave,
    });

    return NextResponse.json({
      ok: true,
      saved: savedRows.length,
      items: savedRows,
      summary: summarizeOperatorMemory(savedRows),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("operator-memory POST unexpected error:", error);
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
