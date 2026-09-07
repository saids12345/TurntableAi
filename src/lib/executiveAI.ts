import {
  getBestHistoricalMatch,
  type SimilarityContext,
  type SimilarityResult,
} from "./similarityEngine";

export type ExecutiveRiskLevel = "low" | "medium" | "high" | "critical";
export type ExecutiveDecisionMode = "single_location" | "network";

export type ExecutiveMove = {
  title?: string;
  reason?: string;
  expectedOutcome?: string;
  confidence?: number | null;
  priorityScore?: number | null;
  roiScore?: number | null;
  executionWindow?: string;
  successMetric?: string;
  locationName?: string | null;
};

export type ExecutiveCause = {
  cause?: string;
  explanation?: string;
  category?: string;
  severity?: string;
  confidenceScore?: number | null;
  evidence?: string[];
  recommendedActions?: string[];
  whatWouldChangeMyMind?: string[];
  locationName?: string | null;
};

export type ExecutivePrediction = {
  prediction?: string;
  riskLevel?: string;
  confidence?: number | null;
  expectedChange?: string;
  estimatedBusinessImpact?: string;
  ifIgnored?: string[];
  bestIntervention?: string[];
  locationName?: string | null;
};

export type ExecutiveWorldSignal = {
  label?: string;
  type?: string;
  riskLevel?: string;
  confidence?: number | null;
  summary?: string;
  operatorImplication?: string;
  recommendedAdjustment?: string;
  locationName?: string | null;
};

export type ExecutiveAIInput = {
  mode?: ExecutiveDecisionMode | string | null;

  planningSummary?: string | null;
  topMove?: ExecutiveMove | null;

  causalSummary?: string | null;
  topCause?: ExecutiveCause | null;

  predictionSummary?: string | null;
  topPrediction?: ExecutivePrediction | null;

  worldSummary?: string | null;
  topWorldSignal?: ExecutiveWorldSignal | null;

  /**
   * Optional live restaurant-state values used by the Similarity Engine.
   *
   * Existing callers do not have to provide this yet. Safe fallback values
   * are used until the real restaurant state is connected.
   */
  similarityContext?: Partial<SimilarityContext> | null;
};

export type ExecutiveAIResult = {
  ok: true;
  mode: ExecutiveDecisionMode;

  headline: string;
  recommendation: string;

  riskLevel: ExecutiveRiskLevel;
  confidence: number;

  whyNow: string[];
  doNext: string[];
  watchClosely: string[];

  successMetric: string;
  executiveSummary: string;

  /**
   * The strongest reusable historical memory found for the current
   * restaurant situation. This may be null while memory is still empty.
   */
  historicalMatch: SimilarityResult | null;
  historicalExperienceUsed: boolean;

  generatedAt: string;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function titleCase(value?: string | null) {
  if (!value) return "Unknown";

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeConfidence(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 55;
  }

  if (value <= 1) {
    return Math.round(value * 100);
  }

  return Math.round(value);
}

function normalizeRisk(
  ...values: Array<string | null | undefined>
): ExecutiveRiskLevel {
  const order: Record<ExecutiveRiskLevel, number> = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  };

  let strongest: ExecutiveRiskLevel = "low";

  for (const value of values) {
    const normalized = String(value || "").toLowerCase() as ExecutiveRiskLevel;

    if (normalized in order && order[normalized] > order[strongest]) {
      strongest = normalized;
    }
  }

  return strongest;
}

function compact(
  value?: string | null,
  fallback = "No signal available.",
) {
  const text = (value || "").replace(/\s+/g, " ").trim();
  return text || fallback;
}

function safeMetric(
  value: number | null | undefined,
  fallback: number,
) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function buildSimilarityContext(params: {
  input: ExecutiveAIInput;
  location: string;
}): SimilarityContext {
  const provided = params.input.similarityContext ?? {};

  return {
    locationName:
      provided.locationName?.trim() || params.location || "Unknown",

    // These fallback values are intentionally neutral.
    // They will be replaced by live restaurant-state values when the
    // Executive AI route begins passing similarityContext.
    operations: safeMetric(provided.operations, 50),
    profitability: safeMetric(provided.profitability, 50),
    demand: safeMetric(provided.demand, 50),
    staffing: safeMetric(provided.staffing, 50),
    marketing: safeMetric(provided.marketing, 50),
    service: safeMetric(provided.service, 50),
    refunds: safeMetric(provided.refunds, 0),
    rating: safeMetric(provided.rating, 5),
  };
}

function buildHistoricalReason(
  historicalMatch: SimilarityResult | null,
) {
  if (!historicalMatch) {
    return "No strong reusable historical match was found yet. The AI is relying on current restaurant signals while memory continues growing.";
  }

  const memory = historicalMatch.memory;

  return [
    `TurnTableAI found a prior experience with a similarity score of ${Math.round(
      historicalMatch.similarity,
    )}.`,
    `Historical action: ${memory.action}.`,
    `Historical outcome: ${memory.outcome}.`,
    `Lesson: ${memory.lesson}.`,
    `Previous success score: ${memory.successScore}/100.`,
  ].join(" ");
}

function buildHistoricalRecommendation(
  historicalMatch: SimilarityResult | null,
) {
  if (!historicalMatch) {
    return null;
  }

  const memory = historicalMatch.memory;

  return `Compare the current plan against the historical playbook "${memory.action}" before execution.`;
}

export function buildExecutiveAI(
  input: ExecutiveAIInput,
): ExecutiveAIResult {
  const mode: ExecutiveDecisionMode =
    input.mode === "single_location"
      ? "single_location"
      : "network";

  const topMove = input.topMove ?? null;
  const topCause = input.topCause ?? null;
  const topPrediction = input.topPrediction ?? null;
  const topWorldSignal = input.topWorldSignal ?? null;

  const riskLevel = normalizeRisk(
    topPrediction?.riskLevel,
    topCause?.severity,
    topWorldSignal?.riskLevel,
  );

  const location =
    topMove?.locationName ||
    topCause?.locationName ||
    topPrediction?.locationName ||
    topWorldSignal?.locationName ||
    (mode === "network"
      ? "the restaurant group"
      : "the restaurant");

  /*
   * Before forming the final executive recommendation, search reusable
   * Operator Memory for a similar situation.
   */
  const historicalMatch = getBestHistoricalMatch(
    buildSimilarityContext({
      input,
      location,
    }),
  );

  const historicalExperienceUsed = historicalMatch !== null;

  const baseConfidence =
    normalizeConfidence(topMove?.confidence) * 0.3 +
    normalizeConfidence(topCause?.confidenceScore) * 0.3 +
    normalizeConfidence(topPrediction?.confidence) * 0.25 +
    normalizeConfidence(topWorldSignal?.confidence) * 0.15;

  /*
   * Historical experience can provide a modest confidence increase,
   * but it never overrides current evidence.
   */
  const historicalConfidenceBoost = historicalMatch
    ? clamp(
        historicalMatch.similarity * 0.04 +
          historicalMatch.memory.successScore * 0.03,
        0,
        8,
      )
    : 0;

  const confidence = Math.round(
    clamp(
      baseConfidence + historicalConfidenceBoost,
      35,
      95,
    ),
  );

  const cause = compact(
    topCause?.cause,
    "The strongest cause is still being learned",
  );

  const prediction = compact(
    topPrediction?.prediction,
    "The future risk forecast is still being developed",
  );

  const worldSignal = compact(
    topWorldSignal?.summary,
    "External context is still being connected",
  );

  const headline =
    riskLevel === "critical"
      ? `Executive attention needed for ${location}.`
      : riskLevel === "high"
        ? `${location} has a high-priority operating risk.`
        : riskLevel === "medium"
          ? `${location} should be watched and corrected carefully.`
          : `${location} appears stable, but the AI should keep learning.`;

  const recommendation = topMove?.title
    ? `Prioritize "${topMove.title}" before launching any broader changes.`
    : "Prioritize the highest-confidence operator review before automating changes.";

  const historicalReason =
    buildHistoricalReason(historicalMatch);

  const historicalRecommendation =
    buildHistoricalRecommendation(historicalMatch);

  const whyNow = [
    cause,
    prediction,
    worldSignal,
    input.planningSummary ||
      "The Planning Engine has ranked the next-best action.",
    historicalReason,
  ].filter((item): item is string => Boolean(item));

  const doNext = [
    recommendation,

    historicalRecommendation,

    topMove?.executionWindow
      ? `Execute within: ${topMove.executionWindow}.`
      : "Execute as an operator-reviewed action.",

    topCause?.recommendedActions?.[0]
      ? topCause.recommendedActions[0]
      : "Confirm the likely root cause before scaling the playbook.",

    topPrediction?.bestIntervention?.[0]
      ? topPrediction.bestIntervention[0]
      : "Measure the result after execution.",

    topWorldSignal?.recommendedAdjustment
      ? topWorldSignal.recommendedAdjustment
      : "Use world context as an adjustment, not a replacement for operator judgment.",
  ].filter((item): item is string => Boolean(item));

  const watchClosely = [
    topPrediction?.expectedChange,
    topPrediction?.ifIgnored?.[0],
    topCause?.evidence?.[0],
    topWorldSignal?.operatorImplication,

    historicalMatch
      ? `Historical playbook outcome: ${historicalMatch.memory.outcome}`
      : null,
  ].filter((item): item is string => Boolean(item));

  const successMetric =
    topMove?.successMetric ||
    "Revenue, refunds, labor, margin, and rating improve or remain stable after the action.";

  const executiveSummary = [
    headline,
    recommendation,
    `The AI confidence is ${confidence}/100 with ${titleCase(
      riskLevel,
    )} risk.`,
    `Primary reasoning: ${cause}.`,
    historicalMatch
      ? `Historical experience was used: "${historicalMatch.memory.action}" previously scored ${historicalMatch.memory.successScore}/100.`
      : "No reusable historical case was strong enough to influence this decision yet.",
  ].join(" ");

  return {
    ok: true,
    mode,

    headline,
    recommendation,

    riskLevel,
    confidence,

    whyNow,
    doNext,
    watchClosely,

    successMetric,
    executiveSummary,

    historicalMatch,
    historicalExperienceUsed,

    generatedAt: new Date().toISOString(),
  };
}