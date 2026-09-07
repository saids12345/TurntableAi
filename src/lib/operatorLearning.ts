import { getSupabaseRouteClient } from "@/lib/supabaseRoute";
import {
  getMemoryTrustState,
  getMemoryVerificationConfidenceScore,
  getVerifiedMemoryOutcomeScore,
  isMemoryEligibleAsReusablePlaybook,
  isMemoryTrustedForReasoning,
} from "@/lib/operatorMemoryTrust";

export type MemoryConfidence = "low" | "medium" | "high";
export type LessonStrength = "weak" | "developing" | "strong";

export type OperatorLesson = {
  id: string;
  locationName: string | null;
  problemType: string;
  actionType: string;
  actionTitle: string;
  resultSummary: string;
  lesson: string;
  confidence: MemoryConfidence;
  outcomeScore: number | null;
  success: boolean | null;
  lessonStrength: LessonStrength | null;
  reuseRecommended: boolean | null;
  updatedAt: string | null;
};

export type OperatorLearningSummary = {
  totalLessons: number;
  reusableLessons: number;
  successfulLessons: number;
  averageOutcomeScore: number | null;
  topPlaybook: string | null;
  confidenceBoost: number;
};

export type RelevantLessonsResult = {
  lessons: OperatorLesson[];
  summary: OperatorLearningSummary;
  recommendationContext: string;
};

type OperatorMemoryRow = {
  id: string;
  location_name: string | null;
  problem_type: string;
  action_type: string;
  action_title: string;
  result_summary: string;
  lesson: string;
  confidence: MemoryConfidence | string | null;
  outcome_score?: number | null;
  success?: boolean | null;
  lesson_strength?: LessonStrength | string | null;
  reuse_recommended?: boolean | null;
  updated_at?: string | null;
  evidence?: Record<string, unknown> | null;
};

const SELECT_EXTENDED =
  "id, location_name, problem_type, action_type, action_title, result_summary, lesson, confidence, outcome_score, success, lesson_strength, reuse_recommended, evidence, updated_at";

const SELECT_BASE =
  "id, location_name, problem_type, action_type, action_title, result_summary, lesson, confidence, evidence, updated_at";

function isMissingColumnError(errorMessage: string) {
  const lower = errorMessage.toLowerCase();
  return (
    lower.includes("column") ||
    lower.includes("schema cache") ||
    lower.includes("could not find")
  );
}

function normalizeConfidence(value: unknown): MemoryConfidence {
  if (value === "high" || value === "medium" || value === "low") return value;
  return "medium";
}

function normalizeLessonStrength(value: unknown): LessonStrength | null {
  if (value === "strong" || value === "developing" || value === "weak") return value;
  return null;
}

function normalizeText(value: string | null | undefined) {
  return (value || "").toLowerCase().replace(/_/g, " ").trim();
}

function compactText(value: string, max = 220) {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function mapMemoryRow(
  row: OperatorMemoryRow,
): OperatorLesson {
  const memory =
    row as unknown as Record<
      string,
      unknown
    >;

  const trustState =
    getMemoryTrustState(
      memory,
    );

  const verificationConfidence =
    getMemoryVerificationConfidenceScore(
      memory,
    );

  return {
    id: row.id,

    locationName:
      row.location_name ??
      null,

    problemType:
      row.problem_type,

    actionType:
      row.action_type,

    actionTitle:
      row.action_title,

    resultSummary:
      row.result_summary,

    lesson:
      row.lesson,

    /*
     * Learning confidence now comes from
     * verification quality / attribution,
     * not stale execution-time confidence.
     */
    confidence:
      verificationConfidence >= 90
        ? "high"
        : verificationConfidence >= 70
          ? "medium"
          : "low",

    outcomeScore:
      getVerifiedMemoryOutcomeScore(
        memory,
      ),

    success:
      trustState ===
        "verified_supporting"
        ? true
        : trustState ===
            "verified_cautionary"
          ? false
          : null,

    lessonStrength:
      normalizeLessonStrength(
        row.lesson_strength,
      ),

    reuseRecommended:
      isMemoryEligibleAsReusablePlaybook(
        memory,
      ),

    updatedAt:
      row.updated_at ??
      null,
  };
}

function scoreLesson(params: {
  lesson: OperatorLesson;
  locationName?: string | null;
  problemType?: string | null;
  actionType?: string | null;
}) {
  const { lesson, locationName, problemType, actionType } = params;

  let score = 0;

  if (lesson.reuseRecommended === true) score += 35;
  if (lesson.success === true) score += 25;
  if (lesson.success === false) score -= 20;

  if (lesson.lessonStrength === "strong") score += 25;
  if (lesson.lessonStrength === "developing") score += 12;
  if (lesson.lessonStrength === "weak") score -= 5;

  if (lesson.confidence === "high") score += 18;
  if (lesson.confidence === "medium") score += 10;

  if (typeof lesson.outcomeScore === "number") {
    score += Math.round((lesson.outcomeScore - 50) / 2);
  }

  if (problemType && lesson.problemType === problemType) score += 35;
  if (actionType && lesson.actionType === actionType) score += 20;

  if (locationName && lesson.locationName === locationName) score += 15;
  if (!locationName && lesson.locationName === null) score += 5;

  return score;
}

function buildSummary(lessons: OperatorLesson[]): OperatorLearningSummary {
  const reusable =
  lessons.filter(
    (lesson) =>
      lesson.reuseRecommended ===
      true,
  );

const successful =
  lessons.filter(
    (lesson) =>
      lesson.success === true,
  );

const reusableLessons =
  reusable.length;

const successfulLessons =
  successful.length;

const scored =
  lessons.filter(
    (lesson) =>
      typeof lesson.outcomeScore ===
      "number",
  );

  const averageOutcomeScore = scored.length
    ? Math.round(
        scored.reduce((sum, lesson) => sum + (lesson.outcomeScore ?? 0), 0) / scored.length
      )
    : null;

  /*
 * A "top playbook" must come only from
 * verified reusable successes.
 *
 * Repeated failures are valuable evidence,
 * but they are not playbooks.
 */
const actionCounts =
  reusable.reduce<
    Record<string, number>
  >(
    (
      counts,
      lesson,
    ) => {
      counts[
        lesson.actionType
      ] =
        (
          counts[
            lesson.actionType
          ] ?? 0
        ) + 1;

      return counts;
    },
    {},
  );

  const topPlaybook =
    Object.entries(actionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  let confidenceBoost = 0;

if (reusableLessons > 0) {
  confidenceBoost += 0.05;
}

if (successfulLessons > 0) {
  confidenceBoost += 0.05;
}

/*
 * Negative or mixed evidence may increase
 * knowledge, but must not blindly increase
 * confidence in the next proposed action.
 */
if (
  successfulLessons > 0 &&
  (averageOutcomeScore ?? 0) >=
    70
) {
  confidenceBoost += 0.08;
}

if (
  reusableLessons > 0 &&
  (averageOutcomeScore ?? 0) >=
    85
) {
  confidenceBoost += 0.05;
}

  return {
    totalLessons: lessons.length,
    reusableLessons,
    successfulLessons,
    averageOutcomeScore,
    topPlaybook,
    confidenceBoost: Number(Math.min(confidenceBoost, 0.2).toFixed(2)),
  };
}

function buildRecommendationContext(lessons: OperatorLesson[], summary: OperatorLearningSummary) {
  if (!lessons.length) {
    return "No relevant operator memory found yet. Generate recommendations from current signals only.";
  }

  const lines = lessons.slice(0, 5).map((lesson, index) => {
    const location = lesson.locationName ? ` at ${lesson.locationName}` : "";
    const reuse = lesson.reuseRecommended ? "reuse recommended" : "reuse cautiously";
    const score = typeof lesson.outcomeScore === "number" ? `${lesson.outcomeScore}/100` : "unscored";

    return `${index + 1}. ${lesson.actionTitle}${location}: ${reuse}, outcome ${score}. Lesson: ${compactText(
      lesson.lesson,
      180
    )}`;
  });

  return [
    `Operator memory found ${summary.totalLessons} relevant lesson(s).`,
    summary.topPlaybook ? `Most repeated playbook: ${summary.topPlaybook}.` : null,
    summary.averageOutcomeScore !== null
      ? `Average outcome score: ${summary.averageOutcomeScore}/100.`
      : null,
    `Suggested confidence boost: ${Math.round(summary.confidenceBoost * 100)} percentage points.`,
    "Relevant lessons:",
    ...lines,
  ]
    .filter(Boolean)
    .join("\n");
}

export function inferProblemTypeFromSignals(params: {
  topIssue?: string | null;
  recommendedAction?: string | null;
  actionType?: string | null;
  reviewIssueCount?: number | null;
  avgRating?: number | null;
  salesDeltaPct?: number | null;
  latestRefunds?: number | null;
  latestLaborPct?: number | null;
  latestMarginPct?: number | null;
}) {
  const text = [params.topIssue, params.recommendedAction, params.actionType]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (text.includes("refund") || (params.latestRefunds ?? 0) >= 10) return "refund_pressure";
  if (text.includes("wait") || text.includes("slow") || text.includes("throughput")) {
    return "throughput_pressure";
  }
  if (
    text.includes("rating") ||
    text.includes("review") ||
    text.includes("guest") ||
    (params.avgRating !== null && params.avgRating !== undefined && params.avgRating < 4.2) ||
    (params.reviewIssueCount ?? 0) >= 2
  ) {
    return "guest_sentiment_risk";
  }
  if (
    text.includes("revenue") ||
    text.includes("sales") ||
    text.includes("traffic") ||
    (params.salesDeltaPct !== null && params.salesDeltaPct !== undefined && params.salesDeltaPct < -5)
  ) {
    return "traffic_or_revenue_decline";
  }
  if (
    text.includes("labor") ||
    text.includes("margin") ||
    (params.latestLaborPct ?? 0) >= 25 ||
    (params.latestMarginPct !== null && params.latestMarginPct !== undefined && params.latestMarginPct < 12)
  ) {
    return "margin_or_labor_pressure";
  }

  return "operator_signal";
}

export async function getRelevantLessons(params: {
  userId: string;
  locationName?: string | null;
  problemType?: string | null;
  actionType?: string | null;
  limit?: number;
}): Promise<RelevantLessonsResult> {
  const supabase = await getSupabaseRouteClient();
  const limit = params.limit ?? 8;

  const extended = await supabase
    .from("operator_memory")
    .select(SELECT_EXTENDED)
    .eq("user_id", params.userId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(100);

  let rows: OperatorMemoryRow[];

  if (!extended.error) {
    rows = (extended.data ?? []) as OperatorMemoryRow[];
  } else if (isMissingColumnError(extended.error.message)) {
    console.warn("operatorLearning extended select failed; falling back to base columns:", extended.error);

    const fallback = await supabase
      .from("operator_memory")
      .select(SELECT_BASE)
      .eq("user_id", params.userId)
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(100);

    if (fallback.error) {
      throw new Error(`Failed to load operator memory: ${fallback.error.message}`);
    }

    rows = (fallback.data ?? []) as OperatorMemoryRow[];
  } else {
    throw new Error(`Failed to load operator memory: ${extended.error.message}`);
  }

  const trustedRows =
  rows.filter(
    (row) =>
      isMemoryTrustedForReasoning(
        row as unknown as Record<
          string,
          unknown
        >,
      ),
  );

const lessons =
  trustedRows
  .map(mapMemoryRow)
    .map((lesson) => ({
      lesson,
      score: scoreLesson({
        lesson,
        locationName: params.locationName,
        problemType: params.problemType ?? undefined,
        actionType: params.actionType ?? undefined,
      }),
    }))
    .filter(({ lesson, score }) => {
      if (params.problemType && lesson.problemType === params.problemType) return true;
      if (params.actionType && lesson.actionType === params.actionType) return true;
      if (params.locationName && lesson.locationName === params.locationName) return true;
      return score > 20;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ lesson }) => lesson);

  const summary = buildSummary(lessons);

  return {
    lessons,
    summary,
    recommendationContext: buildRecommendationContext(lessons, summary),
  };
}

export async function getSuccessfulPlaybooks(params: {
  userId: string;
  problemType?: string | null;
  locationName?: string | null;
  limit?: number;
}) {
  const result = await getRelevantLessons({
    userId: params.userId,
    problemType: params.problemType,
    locationName: params.locationName,
    limit: params.limit ?? 10,
  });

  return result.lessons.filter(
  (lesson) =>
    lesson.reuseRecommended ===
    true,
);
}

export function applyConfidenceBoost(baseConfidence: number, summary: OperatorLearningSummary) {
  const safeBase = Math.min(0.99, Math.max(0.01, baseConfidence));
  return Number(Math.min(0.99, safeBase + summary.confidenceBoost).toFixed(2));
}
