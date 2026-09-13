import { NextResponse } from "next/server";
import { getSupabaseRouteClient } from "@/lib/supabaseRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MemoryConfidence = "low" | "medium" | "high";
type LessonStrength = "weak" | "developing" | "strong";
type LearningStatus = "success" | "partial" | "failed" | "monitoring";

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
  priority_score: number | null;
  created_at: string | null;
  updated_at: string | null;
};

type PerformanceSignalRow = {
  id: string;
  location_name: string | null;
  revenue: number | string | null;
  orders: number | string | null;
  avg_ticket: number | string | null;
  labor_pct: number | string | null;
  margin_pct: number | string | null;
  refunds: number | string | null;
  captured_at: string | null;
};

type ReviewRow = {
  id: string;
  location_name: string | null;
  rating: number | string | null;
  text?: string | null;
  update_time?: string | null;
};

type LearningResult = {
  actionId: string;
  locationName: string | null;
  actionType: string;
  actionTitle: string;
  problemType: string;
  status: LearningStatus;
  outcomeScore: number;
  confidence: MemoryConfidence;
  lessonStrength: LessonStrength;
  reuseRecommended: boolean;
  resultSummary: string;
  lesson: string;
  revenueBefore: number | null;
  revenueAfter: number | null;
  ratingBefore: number | null;
  ratingAfter: number | null;
  refundsBefore: number | null;
  refundsAfter: number | null;
  savedMemoryId?: string;
};

const AUTO_ACTION_SELECT =
  "id, user_id, location_name, action_type, title, reason, recommended_payload, source_signal, status, priority_score, created_at, updated_at";

const MEMORY_SELECT =
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

function daysAgoIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function pctChange(before: number | null, after: number | null) {
  if (before === null || after === null || before === 0) return null;
  return ((after - before) / before) * 100;
}

function normalizeLocationName(value: string | null | undefined) {
  return (value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getPayload(item: AutoActionRow) {
  return isRecord(item.recommended_payload) ? item.recommended_payload : null;
}

function getSignal(item: AutoActionRow) {
  return isRecord(item.source_signal) ? item.source_signal : null;
}

function inferProblemType(item: AutoActionRow) {
  const payload = getPayload(item);
  const signal = getSignal(item);
  const actionType = asString(item.action_type) ?? asString(payload?.type) ?? "operator_action";

  const text = [
    item.title,
    item.reason,
    asString(payload?.reason),
    asString(payload?.summary),
    asString(signal?.topIssue),
    asString(signal?.recommendedAction),
    asNumber(signal?.latestRefunds) !== null ? `refunds ${asNumber(signal?.latestRefunds)}` : null,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (text.includes("refund")) return "refund_pressure";
  if (text.includes("margin") || text.includes("labor") || text.includes("waste")) {
    return "margin_or_labor_pressure";
  }
  if (text.includes("review") || text.includes("rating") || text.includes("guest")) {
    return "guest_sentiment_risk";
  }
  if (text.includes("revenue") || text.includes("sales") || text.includes("traffic")) {
    return "traffic_or_revenue_decline";
  }
  if (text.includes("wait") || text.includes("slow") || text.includes("throughput")) {
    return "throughput_pressure";
  }

  return slugify(actionType);
}

function inferConfidence(params: {
  hasBeforeAfterRevenue: boolean;
  hasBeforeAfterRating: boolean;
  hasBeforeAfterRefunds: boolean;
  hasExecutedAction: boolean;
  hasPayload: boolean;
}): MemoryConfidence {
  let score = 0;
  if (params.hasBeforeAfterRevenue) score += 2;
  if (params.hasBeforeAfterRating) score += 2;
  if (params.hasBeforeAfterRefunds) score += 2;
  if (params.hasExecutedAction) score += 1;
  if (params.hasPayload) score += 1;

  if (score >= 5) return "high";
  if (score >= 2) return "medium";
  return "low";
}

function inferLessonStrength(outcomeScore: number, confidence: MemoryConfidence): LessonStrength {
  if (outcomeScore >= 72 && confidence !== "low") return "strong";
  if (outcomeScore >= 50 || confidence === "medium") return "developing";
  return "weak";
}

function inferLearningStatus(outcomeScore: number): LearningStatus {
  if (outcomeScore >= 70) return "success";
  if (outcomeScore >= 45) return "partial";
  if (outcomeScore < 45) return "failed";
  return "monitoring";
}

function buildResultSummary(params: {
  actionTitle: string;
  locationName: string | null;
  outcomeScore: number;
  revenueDeltaPct: number | null;
  ratingDelta: number | null;
  refundsDelta: number | null;
  status: LearningStatus;
}) {
  const location = params.locationName ? ` at ${params.locationName}` : "";
  const facts: string[] = [];

  if (params.revenueDeltaPct !== null) {
    facts.push(`revenue changed ${round(params.revenueDeltaPct, 1)}%`);
  }

  if (params.ratingDelta !== null) {
    facts.push(`rating changed ${round(params.ratingDelta, 2)}`);
  }

  if (params.refundsDelta !== null) {
    facts.push(`refunds changed ${round(params.refundsDelta, 0)}`);
  }

  const evidence = facts.length ? ` Evidence: ${facts.join(", ")}.` : "";

  return `${params.actionTitle}${location} is currently marked ${params.status} with outcome score ${params.outcomeScore}/100.${evidence}`;
}

function buildLesson(params: {
  problemType: string;
  actionType: string;
  locationName: string | null;
  status: LearningStatus;
  reuseRecommended: boolean;
  outcomeScore: number;
}) {
  const location = params.locationName ? ` at ${params.locationName}` : "";
  const problem = params.problemType.replace(/_/g, " ");
  const action = params.actionType.replace(/_/g, " ");

  if (params.status === "success") {
    return `When ${problem} appears${location}, ${action} is a strong candidate playbook. Reuse is recommended when similar signals appear. Outcome score: ${params.outcomeScore}/100.`;
  }

  if (params.status === "partial") {
    return `When ${problem} appears${location}, ${action} may help but should be paired with operator review. Reuse cautiously until more outcomes confirm the pattern. Outcome score: ${params.outcomeScore}/100.`;
  }

  if (params.status === "failed") {
    return `When ${problem} appears${location}, ${action} should not be reused automatically without reviewing the root cause. Outcome score: ${params.outcomeScore}/100.`;
  }

  return `When ${problem} appears${location}, ${action} is being monitored as a candidate operator move. Outcome score: ${params.outcomeScore}/100.`;
}

function scoreOutcome(params: {
  actionType: string;
  revenueBefore: number | null;
  revenueAfter: number | null;
  ratingBefore: number | null;
  ratingAfter: number | null;
  refundsBefore: number | null;
  refundsAfter: number | null;
  laborBefore: number | null;
  laborAfter: number | null;
  marginBefore: number | null;
  marginAfter: number | null;
}) {
  let score = 50;

  const revenueDelta = pctChange(params.revenueBefore, params.revenueAfter);
  const ratingDelta =
    params.ratingBefore !== null && params.ratingAfter !== null
      ? params.ratingAfter - params.ratingBefore
      : null;
  const refundsDelta =
    params.refundsBefore !== null && params.refundsAfter !== null
      ? params.refundsAfter - params.refundsBefore
      : null;
  const laborDelta =
    params.laborBefore !== null && params.laborAfter !== null
      ? params.laborAfter - params.laborBefore
      : null;
  const marginDelta =
    params.marginBefore !== null && params.marginAfter !== null
      ? params.marginAfter - params.marginBefore
      : null;

  if (revenueDelta !== null) score += clamp(revenueDelta * 1.6, -24, 28);
  if (ratingDelta !== null) score += clamp(ratingDelta * 18, -18, 18);
  if (refundsDelta !== null) score += clamp(-refundsDelta * 2.5, -20, 25);
  if (laborDelta !== null) score += clamp(-laborDelta * 1.5, -15, 15);
  if (marginDelta !== null) score += clamp(marginDelta * 1.8, -15, 18);

  if (params.actionType.includes("margin") && refundsDelta !== null && refundsDelta < 0) score += 8;
  if (params.actionType.includes("review") && ratingDelta !== null && ratingDelta > 0) score += 8;
  if (
    (params.actionType.includes("traffic") || params.actionType.includes("promo")) &&
    revenueDelta !== null &&
    revenueDelta > 0
  ) {
    score += 8;
  }

  return Math.round(clamp(score, 0, 100));
}

async function loadPerformanceWindow(params: {
  supabase: Awaited<ReturnType<typeof getSupabaseRouteClient>>;
  userId: string;
  locationName: string | null;
  actionUpdatedAt: string | null;
}) {
  const { supabase, userId, locationName, actionUpdatedAt } = params;
  if (!locationName) return { before: null, after: null };

  const normalizedLocation = normalizeLocationName(locationName);
  const anchor = actionUpdatedAt ? new Date(actionUpdatedAt) : new Date();

  const beforeIso = new Date(anchor.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const afterIso = new Date(anchor.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("performance_signal_history")
    .select("id, location_name, revenue, orders, avg_ticket, labor_pct, margin_pct, refunds, captured_at")
    .eq("user_id", userId)
    .gte("captured_at", beforeIso)
    .lte("captured_at", afterIso)
    .order("captured_at", { ascending: true });

  if (error) {
    console.warn("operator-memory/learn performance lookup failed:", error);
    return { before: null, after: null };
  }

  const rows = ((data ?? []) as PerformanceSignalRow[]).filter(
    (row) => normalizeLocationName(row.location_name) === normalizedLocation
  );

  if (!rows.length) return { before: null, after: null };

  const beforeRows = rows.filter((row) => {
    if (!row.captured_at) return false;
    return new Date(row.captured_at).getTime() <= anchor.getTime();
  });

  const afterRows = rows.filter((row) => {
    if (!row.captured_at) return false;
    return new Date(row.captured_at).getTime() >= anchor.getTime();
  });

  return {
    before: beforeRows.at(-1) ?? rows[0] ?? null,
    after: afterRows[0] ?? rows.at(-1) ?? null,
  };
}

async function loadRatingWindow(params: {
  supabase: Awaited<ReturnType<typeof getSupabaseRouteClient>>;
  userId: string;
  locationName: string | null;
  actionUpdatedAt: string | null;
}) {
  const { supabase, userId, locationName, actionUpdatedAt } = params;
  if (!locationName) return { before: null, after: null };

  const normalizedLocation = normalizeLocationName(locationName);
  const anchor = actionUpdatedAt ? new Date(actionUpdatedAt) : new Date();

  const beforeIso = new Date(anchor.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString();
  const afterIso = new Date(anchor.getTime() + 45 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("reviews")
    .select("id, location_name, rating, text, update_time")
    .eq("user_id", userId)
    .gte("update_time", beforeIso)
    .lte("update_time", afterIso)
    .order("update_time", { ascending: true });

  if (error) {
    console.warn("operator-memory/learn rating lookup failed:", error);
    return { before: null, after: null };
  }

  const rows = ((data ?? []) as ReviewRow[]).filter(
    (row) => normalizeLocationName(row.location_name) === normalizedLocation
  );

  const average = (items: ReviewRow[]) => {
    const ratings = items
      .map((row) => asNumber(row.rating))
      .filter((value): value is number => value !== null);

    if (!ratings.length) return null;
    return ratings.reduce((sum, value) => sum + value, 0) / ratings.length;
  };

  return {
    before: average(
      rows.filter((row) => row.update_time && new Date(row.update_time).getTime() <= anchor.getTime())
    ),
    after: average(
      rows.filter((row) => row.update_time && new Date(row.update_time).getTime() >= anchor.getTime())
    ),
  };
}

function isMissingColumnError(errorMessage: string) {
  const lower = errorMessage.toLowerCase();
  return lower.includes("column") || lower.includes("schema cache") || lower.includes("could not find");
}

async function saveLearningResult(params: {
  supabase: Awaited<
    ReturnType<
      typeof getSupabaseRouteClient
    >
  >;

  userId: string;

  result: LearningResult;
}) {
  const {
    supabase,
    userId,
    result,
  } = params;

  const now =
    new Date().toISOString();

  /*
   * Evidence created from measured real-world outcomes.
   *
   * This is merged with any execution-time evidence already
   * attached to the memory so Cognitive OS provenance survives.
   */
  const measuredEvidence:
    Record<string, unknown> = {
      source:
        "operator_memory_learn",
        outcomeVerification: {
  version: "v1",

  verified: false,

  verdict:
    "inconclusive",

  eligibleForReasoning:
    false,

  evidenceQuality:
    "insufficient",

  attributionConfidence:
    "insufficient",

  trustState:
    "provisional",

  explanation:
    "Post-execution learning is provisional until Decision Outcome Verification measures and verifies the real-world result.",
},

      actionId:
        result.actionId,

        measuredProblemType:
  result.problemType,

measuredActionType:
  result.actionType,

      learningStatus:
        result.status,

      outcomeScore:
        result.outcomeScore,

      revenueBefore:
        result.revenueBefore,

      revenueAfter:
        result.revenueAfter,

      ratingBefore:
        result.ratingBefore,

      ratingAfter:
        result.ratingAfter,

      refundsBefore:
        result.refundsBefore,

      refundsAfter:
        result.refundsAfter,

      reuseRecommended:
        result.reuseRecommended,

      learnedAt:
        now,
    };

  let existingId:
    string | undefined;

  let existingEvidence:
    Record<string, unknown> | null =
      null;

      let existingProblemType:
  string | null =
    null;

let existingActionType:
  string | null =
    null;

let existingLocationName:
  string | null =
    null;

  /*
 * First choice:
 * find the execution-origin memory for this exact auto action.
 *
 * This identity existed before source_action_id was introduced
 * and identifies the provenance-rich memory created at execution.
 */
const evidenceLookup =
await supabase
  .from("operator_memory")
  .select(
    "id, evidence, location_name, problem_type, action_type",
  )
  .eq(
    "user_id",
    userId,
  )
  .eq(
    "status",
    "active",
  )
  .contains(
    "evidence",
    {
      autoActionId:
        result.actionId,
    },
  )
  .limit(1);

if (!evidenceLookup.error) {
const evidenceRow =
  evidenceLookup.data?.[0];

existingId =
  evidenceRow?.id;

  existingLocationName =
  evidenceRow?.location_name ??
  null;

existingProblemType =
  evidenceRow?.problem_type ??
  null;

existingActionType =
  evidenceRow?.action_type ??
  null;

existingEvidence =
  isRecord(
    evidenceRow?.evidence,
  )
    ? evidenceRow.evidence
    : null;
} else if (
!isMissingColumnError(
  evidenceLookup.error.message,
)
) {
throw new Error(
  `Failed to check action evidence memory: ${evidenceLookup.error.message}`,
);
}

/*
* Second choice:
* use the explicit source_action_id identity used by newer memories.
*/
if (!existingId) {
const sourceActionLookup =
  await supabase
    .from("operator_memory")
    .select(
      "id, evidence",
    )
    .eq(
      "user_id",
      userId,
    )
    .eq(
      "source_action_id",
      result.actionId,
    )
    .eq(
      "status",
      "active",
    )
    .limit(1);

if (!sourceActionLookup.error) {
  const sourceActionRow =
    sourceActionLookup.data?.[0];

  existingId =
    sourceActionRow?.id;

  existingEvidence =
    isRecord(
      sourceActionRow?.evidence,
    )
      ? sourceActionRow.evidence
      : null;
} else if (
  !isMissingColumnError(
    sourceActionLookup
      .error.message,
  )
) {
  throw new Error(
    `Failed to check exact action memory: ${sourceActionLookup.error.message}`,
  );
}
}

  /*
   * Compatibility fallback for historical memories that were
   * created before source_action_id was populated.
   */
  if (!existingId) {
    let compatibilityQuery =
      supabase
        .from("operator_memory")
        .select(
          "id, evidence",
        )
        .eq(
          "user_id",
          userId,
        )
        .eq(
          "problem_type",
          result.problemType,
        )
        .eq(
          "action_type",
          result.actionType,
        )
        .eq(
          "status",
          "active",
        )
        .limit(1);

    compatibilityQuery =
      result.locationName ===
      null
        ? compatibilityQuery.is(
            "location_name",
            null,
          )
        : compatibilityQuery.eq(
            "location_name",
            result.locationName,
          );

    const compatibilityLookup =
      await compatibilityQuery;

    if (
      compatibilityLookup.error
    ) {
      throw new Error(
        `Failed to check existing memory: ${compatibilityLookup.error.message}`,
      );
    }

    const compatibilityRow =
      compatibilityLookup
        .data?.[0];

    existingId =
      compatibilityRow?.id;

    existingEvidence =
      isRecord(
        compatibilityRow
          ?.evidence,
      )
        ? compatibilityRow.evidence
        : null;
  }

  /*
   * Preserve execution-time provenance and add measured
   * outcome evidence on top of it.
   *
   * Existing fields such as:
   *   recommendedPayload.cognitiveProvenance
   *   sourceSignal
   *   executionResult
   *   autoActionId
   *
   * therefore survive measured learning.
   */
  const mergedEvidence:
  Record<string, unknown> = {
    

    ...(
      existingEvidence ??
      {}
    ),

    ...measuredEvidence,

      originSource:
        asString(
          existingEvidence
            ?.originSource,
        ) ??
        asString(
          existingEvidence
            ?.source,
        ) ??
        "operator_memory_learn",
    };

  const extendedRow = {
    user_id:
      userId,

      location_name:
      existingLocationName ??
      result.locationName,
    
    problem_type:
      existingProblemType ??
      result.problemType,
    
    action_type:
      existingActionType ??
      result.actionType,

    action_title:
      result.actionTitle,

    result_summary:
      result.resultSummary,

    lesson:
      result.lesson,

    confidence:
      result.confidence,

    status:
      "active",

    source_action_id:
      result.actionId,

    source_outcome_id:
      null,

    evidence:
      mergedEvidence,

    outcome_score:
      result.outcomeScore,

    success:
      result.status ===
      "success"
        ? true
        : result.status ===
            "failed"
          ? false
          : null,

    revenue_before:
      result.revenueBefore,

    revenue_after:
      result.revenueAfter,

    rating_before:
      result.ratingBefore,

    rating_after:
      result.ratingAfter,

    lesson_strength:
      result.lessonStrength,

    reuse_recommended:
      result.reuseRecommended,

    updated_at:
      now,
  };

  const baseRow = {
    user_id:
      extendedRow.user_id,

    location_name:
      extendedRow.location_name,

    problem_type:
      extendedRow.problem_type,

    action_type:
      extendedRow.action_type,

    action_title:
      extendedRow.action_title,

    result_summary:
      extendedRow.result_summary,

    lesson:
      extendedRow.lesson,

    confidence:
      extendedRow.confidence,

    status:
      extendedRow.status,

    source_action_id:
      extendedRow
        .source_action_id,

    source_outcome_id:
      extendedRow
        .source_outcome_id,

    evidence:
      extendedRow.evidence,

    updated_at:
      extendedRow.updated_at,
  };

  if (existingId) {
    const updated =
      await supabase
        .from(
          "operator_memory",
        )
        .update(
          extendedRow,
        )
        .eq(
          "id",
          existingId,
        )
        .select(
          MEMORY_SELECT,
        )
        .single();

    if (!updated.error) {
      return updated.data as {
        id: string;
      };
    }

    if (
      !isMissingColumnError(
        updated.error.message,
      )
    ) {
      throw new Error(
        `Failed to update learned memory: ${updated.error.message}`,
      );
    }

    const fallback =
      await supabase
        .from(
          "operator_memory",
        )
        .update(
          baseRow,
        )
        .eq(
          "id",
          existingId,
        )
        .select("id")
        .single();

    if (fallback.error) {
      throw new Error(
        `Failed to update learned memory: ${fallback.error.message}`,
      );
    }

    return fallback.data as {
      id: string;
    };
  }

  const inserted =
    await supabase
      .from(
        "operator_memory",
      )
      .insert(
        extendedRow,
      )
      .select(
        MEMORY_SELECT,
      )
      .single();

  if (!inserted.error) {
    return inserted.data as {
      id: string;
    };
  }

  if (
    !isMissingColumnError(
      inserted.error.message,
    )
  ) {
    throw new Error(
      `Failed to insert learned memory: ${inserted.error.message}`,
    );
  }

  const fallback =
    await supabase
      .from(
        "operator_memory",
      )
      .insert(
        baseRow,
      )
      .select("id")
      .single();

  if (fallback.error) {
    throw new Error(
      `Failed to insert learned memory: ${fallback.error.message}`,
    );
  }

  return fallback.data as {
    id: string;
  };
}

async function learnFromAction(params: {
  supabase: Awaited<ReturnType<typeof getSupabaseRouteClient>>;
  userId: string;
  action: AutoActionRow;
}) {
  const { supabase, userId, action } = params;

  const payload = getPayload(action);
  const signal = getSignal(action);

  const locationName =
    action.location_name ??
    asString(signal?.locationName) ??
    asString(signal?.location_name) ??
    asString(payload?.locationName) ??
    asString(payload?.location_name) ??
    null;

  const actionType = slugify(
    asString(action.action_type) ?? asString(payload?.type) ?? "operator_action"
  );

  const actionTitle =
    asString(action.title) ?? asString(payload?.title) ?? "Executed operator action";

  const problemType = inferProblemType(action);

  const performanceWindow = await loadPerformanceWindow({
    supabase,
    userId,
    locationName,
    actionUpdatedAt: action.updated_at,
  });

  const ratingWindow = await loadRatingWindow({
    supabase,
    userId,
    locationName,
    actionUpdatedAt: action.updated_at,
  });

  const revenueBefore =
    asNumber(performanceWindow.before?.revenue) ?? asNumber(signal?.previousRevenue) ?? null;

  const revenueAfter =
    asNumber(performanceWindow.after?.revenue) ?? asNumber(signal?.latestRevenue) ?? null;

  const refundsBefore =
    asNumber(performanceWindow.before?.refunds) ?? asNumber(signal?.previousRefunds) ?? null;

  const refundsAfter =
    asNumber(performanceWindow.after?.refunds) ?? asNumber(signal?.latestRefunds) ?? null;

  const laborBefore = asNumber(performanceWindow.before?.labor_pct);
  const laborAfter = asNumber(performanceWindow.after?.labor_pct);
  const marginBefore = asNumber(performanceWindow.before?.margin_pct);
  const marginAfter = asNumber(performanceWindow.after?.margin_pct);

  const ratingBefore = ratingWindow.before;
  const ratingAfter = ratingWindow.after ?? asNumber(signal?.avgRating) ?? null;

  const outcomeScore = scoreOutcome({
    actionType,
    revenueBefore,
    revenueAfter,
    ratingBefore,
    ratingAfter,
    refundsBefore,
    refundsAfter,
    laborBefore,
    laborAfter,
    marginBefore,
    marginAfter,
  });

  const confidence = inferConfidence({
    hasBeforeAfterRevenue: revenueBefore !== null && revenueAfter !== null,
    hasBeforeAfterRating: ratingBefore !== null && ratingAfter !== null,
    hasBeforeAfterRefunds: refundsBefore !== null && refundsAfter !== null,
    hasExecutedAction: action.status === "executed",
    hasPayload: payload !== null || signal !== null,
  });

  const status = inferLearningStatus(outcomeScore);
  const lessonStrength = inferLessonStrength(outcomeScore, confidence);
  const reuseRecommended = status === "success" || (status === "partial" && outcomeScore >= 60);

  const revenueDeltaPct = pctChange(revenueBefore, revenueAfter);
  const ratingDelta =
    ratingBefore !== null && ratingAfter !== null ? ratingAfter - ratingBefore : null;
  const refundsDelta =
    refundsBefore !== null && refundsAfter !== null ? refundsAfter - refundsBefore : null;

  const resultSummary = buildResultSummary({
    actionTitle,
    locationName,
    outcomeScore,
    revenueDeltaPct,
    ratingDelta,
    refundsDelta,
    status,
  });

  const lesson = buildLesson({
    problemType,
    actionType,
    locationName,
    status,
    reuseRecommended,
    outcomeScore,
  });

  const result: LearningResult = {
    actionId: action.id,
    locationName,
    actionType,
    actionTitle,
    problemType,
    status,
    outcomeScore,
    confidence,
    lessonStrength,
    reuseRecommended,
    resultSummary,
    lesson,
    revenueBefore,
    revenueAfter,
    ratingBefore,
    ratingAfter,
    refundsBefore,
    refundsAfter,
  };

  const saved = await saveLearningResult({ supabase, userId, result });

  return {
    ...result,
    savedMemoryId: saved.id,
  };
}

function summarizeLearning(results: LearningResult[]) {
  const averageOutcomeScore =
    results.length > 0
      ? Math.round(results.reduce((sum, item) => sum + item.outcomeScore, 0) / results.length)
      : null;

  const successCount = results.filter((item) => item.status === "success").length;
  const partialCount = results.filter((item) => item.status === "partial").length;
  const failedCount = results.filter((item) => item.status === "failed").length;
  const reusableCount = results.filter((item) => item.reuseRecommended).length;

  const playbookCounts = results.reduce<Record<string, number>>((counts, item) => {
    counts[item.actionType] = (counts[item.actionType] ?? 0) + 1;
    return counts;
  }, {});

  const topPlaybook =
    Object.entries(playbookCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return {
    learned: results.length,
    averageOutcomeScore,
    successCount,
    partialCount,
    failedCount,
    reusableCount,
    topPlaybook,
  };
}

async function runLearning(params: {
  supabase: Awaited<ReturnType<typeof getSupabaseRouteClient>>;
  userId: string;
  actionId?: string | null;
}) {
  const { supabase, userId, actionId } = params;

  let query = supabase
    .from("auto_actions")
    .select(AUTO_ACTION_SELECT)
    .eq("user_id", userId)
    .eq("status", "executed")
    .order("updated_at", { ascending: false })
    .limit(actionId ? 1 : 25);

  if (actionId) query = query.eq("id", actionId);
  else query = query.gte("updated_at", daysAgoIso(60));

  const { data, error } = await query;

  if (error) throw new Error(`Failed to load executed actions: ${error.message}`);

  const actions = (data ?? []) as AutoActionRow[];
  const results: LearningResult[] = [];

  for (const action of actions) {
    const learned = await learnFromAction({ supabase, userId, action });
    results.push(learned);
  }

  return results;
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

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const results = await runLearning({ supabase, userId: user.id });

    return NextResponse.json({
      ok: true,
      mode: "preview",
      learned: results.length,
      items: results,
      summary: summarizeLearning(results),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("operator-memory/learn GET unexpected error:", error);
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

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json().catch(() => ({}))) as {
      actionId?: string | null;
    };

    const results = await runLearning({
      supabase,
      userId: user.id,
      actionId:
        typeof body.actionId === "string" &&
        body.actionId.trim()
          ? body.actionId.trim()
          : null,
    });
    
    /*
     * Event-driven Cognitive refresh.
     *
     * Once a real outcome has been learned, immediately refresh the
     * Brain's active operating decisions.
     *
     * Learning remains the source of truth:
     * a refresh failure must NEVER undo or fail the saved outcome.
     */
    let decisionRefresh: {
      attempted: boolean;
      ok: boolean;
      reason: string;
      saved: number;
      error: string | null;
    } = {
      attempted: false,
      ok: false,
      reason: "no_learning_saved",
      saved: 0,
      error: null,
    };
    
    if (results.length > 0) {
      decisionRefresh = {
        attempted: true,
        ok: false,
        reason: "refresh_pending",
        saved: 0,
        error: null,
      };
    
      try {
        const refreshUrl =
          new URL(
            "/api/auto-actions/generate",
            request.url,
          );
    
        refreshUrl.searchParams.set(
          "force",
          "true",
        );
    
        /*
         * Server-side fetches do not automatically forward the
         * browser's authenticated Supabase session.
         *
         * Forward the current request cookie so the generation route
         * runs as the same authenticated restaurant owner.
         */
        const cookieHeader =
          request.headers.get(
            "cookie",
          );
    
        const refreshResponse =
          await fetch(
            refreshUrl,
            {
              method: "POST",
    
              headers: {
                "Content-Type":
                  "application/json",
    
                ...(cookieHeader
                  ? {
                      cookie:
                        cookieHeader,
                    }
                  : {}),
              },
    
              body:
                JSON.stringify({
                  force: true,
                }),
    
              cache:
                "no-store",
            },
          );
    
        const refreshBody =
          (await refreshResponse
            .json()
            .catch(() => null)) as
            | {
                ok?: unknown;
                skipped?: unknown;
                reason?: unknown;
                saved?: unknown;
                error?: unknown;
              }
            | null;
    
        if (
          !refreshResponse.ok ||
          refreshBody?.ok !== true
        ) {
          const refreshError =
            typeof refreshBody?.error ===
              "string"
              ? refreshBody.error
              : `Decision refresh failed with status ${refreshResponse.status}.`;
    
          console.warn(
            "operator-memory/learn decision refresh failed:",
            refreshError,
          );
    
          decisionRefresh = {
            attempted: true,
            ok: false,
            reason:
              "refresh_failed",
            saved: 0,
            error:
              refreshError,
          };
        } else {
          decisionRefresh = {
            attempted: true,
            ok: true,
    
            reason:
              typeof refreshBody.reason ===
                "string"
                ? refreshBody.reason
                : "generated",
    
            saved:
              typeof refreshBody.saved ===
                "number"
                ? refreshBody.saved
                : 0,
    
            error:
              null,
          };
        }
      } catch (refreshError) {
        const message =
          refreshError instanceof Error
            ? refreshError.message
            : "Unknown decision refresh error.";
    
        console.warn(
          "operator-memory/learn decision refresh unexpected error:",
          refreshError,
        );
    
        decisionRefresh = {
          attempted: true,
          ok: false,
          reason:
            "refresh_failed",
          saved: 0,
          error:
            message,
        };
      }
    }
    
    return NextResponse.json({
      ok: true,
      mode: "saved",
      learned: results.length,
      items: results,
      summary:
        summarizeLearning(
          results,
        ),
    
      /*
       * Expose refresh status so the UI and our diagnostics can tell
       * whether learning also refreshed the operating decisions.
       */
      decisionRefresh,
    
      generatedAt:
        new Date().toISOString(),
    });
  } catch (error) {
    console.error("operator-memory/learn POST unexpected error:", error);
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
