export type OperatorIntelligenceMode = "single_location" | "network";

export type OperatorJudgment =
  | "act_now"
  | "approval_required"
  | "monitor"
  | "collect_more_evidence";

export type OperatorRiskLevel = "low" | "medium" | "high" | "critical";

export type OperatorIntelligenceInput = {
  mode?: string | null;

  restaurantStates?: Array<{
    locationName?: string | null;
    overallScore?: number | null;
    level?: string | null;
    primaryRisk?: string | null;
    primaryOpportunity?: string | null;
    scores?: {
      demand?: number | null;
      operations?: number | null;
      staffing?: number | null;
      service?: number | null;
      marketing?: number | null;
      profitability?: number | null;
      reputation?: number | null;
      execution?: number | null;
    } | null;
    metrics?: {
      revenue?: number | null;
      revenueDeltaPct?: number | null;
      orders?: number | null;
      ordersDeltaPct?: number | null;
      refunds?: number | null;
      avgRating?: number | null;
      reviewIssueCount?: number | null;
      laborPct?: number | null;
      marginPct?: number | null;
      openAlerts?: number | null;
      pendingActions?: number | null;
      avgOutcomeScore?: number | null;
    } | null;
  }> | null;

  memory?: {
    loaded?: boolean;
    totalMemories?: number;
    reusablePlaybooks?: number;
    successfulStrategies?: number;
    averageOutcomeScore?: number | null;
    recentMemories?: Array<Record<string, unknown>>;
    error?: string | null;
  } | null;

  planning?: {
    summary?: string | null;
    topMove?: {
      title?: string | null;
      reason?: string | null;
      expectedOutcome?: string | null;
      confidence?: number | null;
      priorityScore?: number | null;
      roiScore?: number | null;
      executionWindow?: string | null;
      successMetric?: string | null;
      locationName?: string | null;
      checklist?: string[];
    } | null;
  } | null;

  causalAnalysis?: {
    summary?: string | null;
    topHypothesis?: {
      cause?: string | null;
      explanation?: string | null;
      category?: string | null;
      severity?: string | null;
      confidenceScore?: number | null;
      evidence?: string[];
      recommendedActions?: string[];
      whatWouldChangeMyMind?: string[];
      locationName?: string | null;
    } | null;
  } | null;

  prediction?: {
    summary?: string | null;
    topPrediction?: {
      prediction?: string | null;
      riskLevel?: string | null;
      confidence?: number | null;
      expectedChange?: string | null;
      estimatedBusinessImpact?: string | null;
      ifIgnored?: string[];
      bestIntervention?: string[];
      locationName?: string | null;
    } | null;
  } | null;

  worldModel?: {
    summary?: string | null;
    topSignal?: {
      signal?: {
        label?: string | null;
        type?: string | null;
        riskLevel?: string | null;
        confidence?: number | null;
        summary?: string | null;
        evidence?: string[];
        operatorImplication?: string | null;
        recommendedAdjustment?: string | null;
      } | null;
      locationName?: string | null;
    } | null;
  } | null;

  executiveAI?: {
    headline?: string | null;
    recommendation?: string | null;
    riskLevel?: string | null;
    confidence?: number | null;
    whyNow?: string[];
    doNext?: string[];
    watchClosely?: string[];
    successMetric?: string | null;
    executiveSummary?: string | null;
    historicalExperienceUsed?: boolean;
    historicalMatch?: {
      similarity?: number | null;
      memory?: {
        action?: string | null;
        outcome?: string | null;
        lesson?: string | null;
        successScore?: number | null;
        confidence?: number | null;
        locationName?: string | null;
      } | null;
    } | null;
  } | null;

  executionPlan?: {
    summary?: string | null;
    mode?: string | null;
    topTask?: {
      id?: string | null;
      title?: string | null;
      description?: string | null;
      priority?: number | null;
      mode?: string | null;
      estimatedImpact?: number | null;
      confidence?: number | null;
    } | null;
  } | null;
};

export type OperatorIntelligenceResult = {
  ok: true;
  mode: OperatorIntelligenceMode;

  judgment: OperatorJudgment;
  riskLevel: OperatorRiskLevel;
  confidence: number;

  headline: string;
  situation: string;
  rootCause: string;
  likelyFuture: string;

  firstMove: string;
  whyThisMove: string;
  executionMode: string;
  executionWindow: string;

  doNow: string[];
  doNotDo: string[];
  watchNext: string[];
  evidence: string[];

  successMetric: string;

  historicalExperience: {
    used: boolean;
    similarity: number | null;
    action: string | null;
    outcome: string | null;
    lesson: string | null;
    successScore: number | null;
  };

  dissent: {
    strongestAlternativeExplanation: string;
    whatWouldChangeTheDecision: string[];
  };

  locationFocus: string | null;
  generatedAt: string;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function safeNumber(
  value: number | null | undefined,
  fallback = 0,
) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function compact(
  value: string | null | undefined,
  fallback: string,
) {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  return text || fallback;
}

function titleCase(value: string | null | undefined) {
  if (!value) return "Unknown";

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function normalizeRisk(
  ...values: Array<string | null | undefined>
): OperatorRiskLevel {
  const order: Record<OperatorRiskLevel, number> = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  };

  let strongest: OperatorRiskLevel = "low";

  for (const value of values) {
    const normalized = String(value ?? "").toLowerCase();

    if (
      normalized === "low" ||
      normalized === "medium" ||
      normalized === "high" ||
      normalized === "critical"
    ) {
      if (order[normalized] > order[strongest]) {
        strongest = normalized;
      }
    }
  }

  return strongest;
}

function normalizeConfidence(
  value: number | null | undefined,
  fallback = 55,
) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return value <= 1
    ? Math.round(value * 100)
    : Math.round(value);
}

function findHighestRiskState(
  states: NonNullable<OperatorIntelligenceInput["restaurantStates"]>,
) {
  return [...states].sort((a, b) => {
    return safeNumber(a.overallScore, 100) - safeNumber(b.overallScore, 100);
  })[0] ?? null;
}

function determineJudgment(params: {
  riskLevel: OperatorRiskLevel;
  confidence: number;
  executionMode: string;
  memoryLoaded: boolean;
  reusablePlaybooks: number;
}): OperatorJudgment {
  const executionMode = params.executionMode.toLowerCase();

  if (
    executionMode === "automatic" &&
    params.confidence >= 90 &&
    params.riskLevel !== "critical"
  ) {
    return "act_now";
  }

  if (
    executionMode === "approval_required" ||
    params.riskLevel === "critical" ||
    params.riskLevel === "high"
  ) {
    return "approval_required";
  }

  if (
    params.confidence < 55 ||
    !params.memoryLoaded ||
    params.reusablePlaybooks === 0
  ) {
    return "collect_more_evidence";
  }

  return "monitor";
}

function buildDoNotDo(params: {
  topCauseCategory?: string | null;
  expectedChange?: string | null;
  worldAdjustment?: string | null;
  historicalExperienceUsed: boolean;
}) {
  const items = [
    "Do not launch broad changes before confirming the highest-confidence root cause.",
    "Do not automate a high-impact decision without a measurable rollback plan.",
  ];

  const category = String(params.topCauseCategory ?? "").toLowerCase();

  if (
    category.includes("profit") ||
    category.includes("margin") ||
    category.includes("operations")
  ) {
    items.push(
      "Do not use blanket discounting to solve an operational or profitability problem.",
    );
  }

  if (params.expectedChange) {
    items.push(
      "Do not ignore the forecasted downside while waiting for perfect certainty.",
    );
  }

  if (params.worldAdjustment) {
    items.push(
      "Do not treat external context as the sole cause without checking internal execution.",
    );
  }

  if (!params.historicalExperienceUsed) {
    items.push(
      "Do not claim a proven playbook until real outcome history supports it.",
    );
  }

  return Array.from(new Set(items)).slice(0, 5);
}

export function buildOperatorIntelligence(
  input: OperatorIntelligenceInput,
): OperatorIntelligenceResult {
  const mode: OperatorIntelligenceMode =
    input.mode === "single_location"
      ? "single_location"
      : "network";

  const states = Array.isArray(input.restaurantStates)
    ? input.restaurantStates
    : [];

  const highestRiskState = findHighestRiskState(states);

  const topMove = input.planning?.topMove ?? null;
  const topCause = input.causalAnalysis?.topHypothesis ?? null;
  const topPrediction = input.prediction?.topPrediction ?? null;
  const topWorldSignal =
    input.worldModel?.topSignal?.signal ?? null;
  const executiveAI = input.executiveAI ?? null;
  const executionPlan = input.executionPlan ?? null;

  const historicalMatch =
    executiveAI?.historicalMatch ?? null;
  const historicalMemory =
    historicalMatch?.memory ?? null;

  const locationFocus =
    topMove?.locationName ??
    topCause?.locationName ??
    topPrediction?.locationName ??
    input.worldModel?.topSignal?.locationName ??
    highestRiskState?.locationName ??
    null;

  const riskLevel = normalizeRisk(
    executiveAI?.riskLevel,
    topPrediction?.riskLevel,
    topCause?.severity,
    topWorldSignal?.riskLevel,
  );

  const confidenceInputs = [
    normalizeConfidence(executiveAI?.confidence),
    normalizeConfidence(topMove?.confidence),
    normalizeConfidence(topCause?.confidenceScore),
    normalizeConfidence(topPrediction?.confidence),
    normalizeConfidence(topWorldSignal?.confidence),
  ];

  const confidence = Math.round(
    clamp(
      confidenceInputs.reduce((sum, value) => sum + value, 0) /
        confidenceInputs.length,
      35,
      95,
    ),
  );

  const executionMode =
    executionPlan?.mode ??
    executionPlan?.topTask?.mode ??
    "monitor";

  const judgment = determineJudgment({
    riskLevel,
    confidence,
    executionMode,
    memoryLoaded: input.memory?.loaded === true,
    reusablePlaybooks: input.memory?.reusablePlaybooks ?? 0,
  });

  const firstMove = compact(
    executionPlan?.topTask?.title ??
      topMove?.title ??
      executiveAI?.recommendation,
    "Review the highest-risk restaurant issue with an operator.",
  );

  const situation = compact(
    highestRiskState?.primaryRisk ??
      input.planning?.summary ??
      executiveAI?.headline,
    "The restaurant requires continued monitoring while the AI gathers stronger evidence.",
  );

  const rootCause = compact(
    topCause?.cause ??
      topCause?.explanation ??
      input.causalAnalysis?.summary,
    "The root cause is not yet strong enough to state confidently.",
  );

  const likelyFuture = compact(
    topPrediction?.prediction ??
      topPrediction?.expectedChange ??
      input.prediction?.summary,
    "The near-term outcome remains uncertain until more operating data is measured.",
  );

  const whyThisMove = compact(
    topMove?.reason ??
      executiveAI?.executiveSummary ??
      topCause?.explanation,
    "This move currently has the strongest combined support from planning, causal, forecast, and execution signals.",
  );

  const executionWindow = compact(
    topMove?.executionWindow,
    judgment === "approval_required"
      ? "Request operator approval today."
      : judgment === "act_now"
        ? "Execute during the next safe operating window."
        : "Continue monitoring until the decision threshold is reached.",
  );

  const doNow = [
    firstMove,
    ...(executiveAI?.doNext ?? []),
    ...(topCause?.recommendedActions ?? []).slice(0, 2),
    ...(topPrediction?.bestIntervention ?? []).slice(0, 2),
    topWorldSignal?.recommendedAdjustment ?? null,
  ]
    .filter((item): item is string => Boolean(item))
    .filter((item, index, collection) => collection.indexOf(item) === index)
    .slice(0, 6);

  const watchNext = [
    ...(executiveAI?.watchClosely ?? []),
    topPrediction?.expectedChange ?? null,
    ...(topPrediction?.ifIgnored ?? []).slice(0, 2),
    topWorldSignal?.operatorImplication ?? null,
    highestRiskState?.metrics?.refunds !== null &&
    highestRiskState?.metrics?.refunds !== undefined
      ? `Refund count: ${highestRiskState.metrics.refunds}.`
      : null,
    highestRiskState?.metrics?.laborPct !== null &&
    highestRiskState?.metrics?.laborPct !== undefined
      ? `Labor percentage: ${highestRiskState.metrics.laborPct}%.`
      : null,
  ]
    .filter((item): item is string => Boolean(item))
    .filter((item, index, collection) => collection.indexOf(item) === index)
    .slice(0, 6);

  const evidence = [
    ...(topCause?.evidence ?? []),
    ...(topWorldSignal?.evidence ?? []),
    highestRiskState?.overallScore !== null &&
    highestRiskState?.overallScore !== undefined
      ? `${highestRiskState.locationName ?? "Restaurant"} operating score is ${highestRiskState.overallScore}/100.`
      : null,
    highestRiskState?.metrics?.avgOutcomeScore !== null &&
    highestRiskState?.metrics?.avgOutcomeScore !== undefined
      ? `Measured actions average ${highestRiskState.metrics.avgOutcomeScore}/100 outcome quality.`
      : null,
    input.memory?.loaded
      ? `Operator Memory contains ${input.memory.totalMemories ?? 0} memories and ${input.memory.reusablePlaybooks ?? 0} reusable playbooks.`
      : "Operator Memory was not available for this decision.",
  ]
    .filter((item): item is string => Boolean(item))
    .filter((item, index, collection) => collection.indexOf(item) === index)
    .slice(0, 8);

  const doNotDo = buildDoNotDo({
    topCauseCategory: topCause?.category,
    expectedChange: topPrediction?.expectedChange,
    worldAdjustment: topWorldSignal?.recommendedAdjustment,
    historicalExperienceUsed:
      executiveAI?.historicalExperienceUsed === true,
  });

  const successMetric = compact(
    topMove?.successMetric ??
      executiveAI?.successMetric,
    "Measure revenue, refunds, labor, margin, rating, and execution quality before and after the action.",
  );

  const strongestAlternativeExplanation = compact(
    topCause?.whatWouldChangeMyMind?.[0],
    "The leading explanation may be wrong if the affected metrics improve without the recommended intervention.",
  );

  const whatWouldChangeTheDecision = [
    ...(topCause?.whatWouldChangeMyMind ?? []),
    "A materially different revenue, refund, labor, or rating trend.",
    "A stronger historical playbook with better measured outcomes.",
    "New external evidence that changes the likely root cause.",
  ]
    .filter((item, index, collection) => collection.indexOf(item) === index)
    .slice(0, 5);

  const headline =
    judgment === "act_now"
      ? `TurnTableAI recommends acting now${locationFocus ? ` at ${locationFocus}` : ""}.`
      : judgment === "approval_required"
        ? `Operator approval is required${locationFocus ? ` for ${locationFocus}` : ""}.`
        : judgment === "collect_more_evidence"
          ? `The AI needs stronger evidence before committing${locationFocus ? ` at ${locationFocus}` : ""}.`
          : `Continue monitoring${locationFocus ? ` ${locationFocus}` : " the restaurant"}.`;

  return {
    ok: true,
    mode,

    judgment,
    riskLevel,
    confidence,

    headline,
    situation,
    rootCause,
    likelyFuture,

    firstMove,
    whyThisMove,
    executionMode: titleCase(executionMode),
    executionWindow,

    doNow,
    doNotDo,
    watchNext,
    evidence,

    successMetric,

    historicalExperience: {
      used: executiveAI?.historicalExperienceUsed === true,
      similarity:
        historicalMatch?.similarity !== null &&
        historicalMatch?.similarity !== undefined
          ? Math.round(historicalMatch.similarity)
          : null,
      action: historicalMemory?.action ?? null,
      outcome: historicalMemory?.outcome ?? null,
      lesson: historicalMemory?.lesson ?? null,
      successScore:
        historicalMemory?.successScore ?? null,
    },

    dissent: {
      strongestAlternativeExplanation,
      whatWouldChangeTheDecision,
    },

    locationFocus,
    generatedAt: new Date().toISOString(),
  };
}