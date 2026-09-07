import type {
  ExecutiveAI,
  ExecutionPlan,
  WhyThisIsHappeningData,
  RecommendedActionData,
} from "@/components/brain/types";
function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function asString(
  value: unknown,
): string | null {
  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const normalized =
    value.trim();

  return normalized.length > 0
    ? normalized
    : null;
}

type OperatorIntelligence = {
  firstMove?: string | null;

  whyThisMove?: string | null;

  confidence?: number | null;

  riskLevel?: string | null;
};

type TopHypothesis = {
  cause?: string;

  explanation?: string;

  category?: string;

  severity?: string;

  confidenceScore?: number | null;

  evidence?: string[];

  recommendedActions?: string[];

  whatWouldChangeMyMind?: string[];
};

type CognitiveStrategy = {
  id?: string;

  title?: string;

  description?: string;

  expectedOutcome?: string;

  decisionMode?: string;

  kind?: string;

  risk?: string;

  urgency?: string;

  reversibility?: string;

  confidence?: number | null;
};

type CognitiveSelectedStrategy = {
  score?: number | null;

  status?: string;

  strategy?: CognitiveStrategy | null;
};

type CognitiveFuture = {
  strategyId?: string;

  strategyTitle?: string;

  summary?: string;

  confidence?: number | null;

  expectedRisk?: number | null;
};

type CognitiveRecommendationSource = {
  selectedStrategy?:
    | CognitiveSelectedStrategy
    | null;

  futureComparison?: {
    best?:
      | CognitiveFuture
      | null;

    bestScore?: number | null;

    decisionConfidence?: number | null;

    warnings?: string[];

    tradeoffs?: string[];
  } | null;

  decisionProvenance?:
  RecommendedActionData["decisionProvenance"];

  decisionEvaluation?: {
    confidence?: number | null;

    readinessScore?: number | null;

    decisionMode?: string;

    recommendation?: string;
  } | null;
};

function normalizePercentage(
  value:
    | number
    | null
    | undefined,
  fallback: number,
) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return fallback;
  }

  const normalized =
    value >= 0 &&
    value <= 1
      ? value * 100
      : value;

  return Math.min(
    100,
    Math.max(
      0,
      Math.round(normalized),
    ),
  );
}

function normalizeUrgency(
  value:
    | string
    | null
    | undefined,
): "high" | "medium" | "low" {
  const normalized =
    value
      ?.trim()
      .toLowerCase();

  if (
    normalized === "critical" ||
    normalized === "high"
  ) {
    return "high";
  }

  if (
    normalized === "medium" ||
    normalized === "moderate"
  ) {
    return "medium";
  }

  return "low";
}

function getActionLabel(
  decisionMode:
    | string
    | null
    | undefined,
  executionMode:
    | string
    | null
    | undefined,
) {
  switch (
    decisionMode
      ?.trim()
      .toLowerCase()
  ) {
    case "investigate":
      return "Review Evidence";

    case "test":
      return "Approve Test";

    case "contain":
      return "Approve Safeguard";

    case "monitor":
      return "View Monitoring Plan";

    case "act":
      return executionMode ===
        "automatic"
        ? "Execute Automatically"
        : "Approve Action";

    default:
      return executionMode ===
        "automatic"
        ? "Execute Automatically"
        : "Approve Action";
  }
}

export function buildRecommendedAction(
  executionPlan:
    | ExecutionPlan
    | null,

  operatorIntelligence:
    | OperatorIntelligence
    | null,

  executiveAI:
    | ExecutiveAI
    | null,

  cognition:
    | CognitiveRecommendationSource
    | null = null,
): RecommendedActionData {
  const selected =
    cognition
      ?.selectedStrategy ??
    null;

  const strategy =
    selected?.strategy ??
    null;

  const comparison =
    cognition
      ?.futureComparison ??
    null;

  const bestFuture =
    comparison?.best ??
    null;

    const decisionProvenance =
  cognition
    ?.decisionProvenance ??
  null;

  const decision =
    cognition
      ?.decisionEvaluation ??
    null;

  const decisionMode =
    strategy?.decisionMode ??
    decision?.decisionMode ??
    null;

  const confidence =
    normalizePercentage(
      comparison
        ?.decisionConfidence ??
        decision?.confidence ??
        strategy?.confidence ??
        bestFuture?.confidence ??
        executionPlan
          ?.topTask
          ?.confidence ??
        operatorIntelligence
          ?.confidence,
      50,
    );

  const impact =
    normalizePercentage(
      selected?.score ??
        comparison?.bestScore ??
        executionPlan
          ?.topTask
          ?.estimatedImpact,
      50,
    );

  return {
    /**
     * The Cognitive Brain is now the primary source.
     * Legacy engines remain as compatibility fallbacks.
     */
    title:
      strategy?.title ??
      bestFuture
        ?.strategyTitle ??
      executionPlan
        ?.topTask
        ?.title ??
      operatorIntelligence
        ?.firstMove ??
      "No recommendation available",

    summary:
      strategy
        ?.expectedOutcome ??
      bestFuture?.summary ??
      strategy?.description ??
      executionPlan?.summary ??
      operatorIntelligence
        ?.whyThisMove ??
      executiveAI
        ?.executiveSummary ??
      "The AI is still evaluating your restaurant.",

      decisionProvenance,

    confidence,

    impact,

    urgency:
      normalizeUrgency(
        strategy?.urgency ??
          strategy?.risk ??
          operatorIntelligence
            ?.riskLevel,
      ),

    progress: 0,

    actionLabel:
      getActionLabel(
        decisionMode,
        executionPlan?.mode,
      ),

    secondaryLabel:
      strategy
        ? "View Reasoning"
        : "View Details",

    onApprove: () =>
      console.log(
        "Approve cognitive action",
        {
          strategyId:
            strategy?.id,

          decisionMode,

          title:
            strategy?.title,
        },
      ),

    onViewDetails: () =>
      console.log(
        "View cognitive reasoning",
        {
          selectedStrategy:
            selected,

          futureComparison:
            comparison,

          decisionEvaluation:
            decision,
        },
      ),
  };
}

export function buildWhyThisIsHappening(
  summary:
    | string
    | null
    | undefined,

  hypothesis:
    | TopHypothesis
    | null,

  cognition?: unknown,
): WhyThisIsHappeningData {
  const cognitionRecord =
    isRecord(cognition)
      ? cognition
      : null;

  const selectedStrategyRecord =
    cognitionRecord &&
    isRecord(
      cognitionRecord.selectedStrategy,
    )
      ? cognitionRecord.selectedStrategy
      : null;

  const selectedStrategy =
    selectedStrategyRecord &&
    isRecord(
      selectedStrategyRecord.strategy,
    )
      ? selectedStrategyRecord.strategy
      : selectedStrategyRecord;

  const decisionEvaluation =
    cognitionRecord &&
    isRecord(
      cognitionRecord.decisionEvaluation,
    )
      ? cognitionRecord.decisionEvaluation
      : null;

  const decisionMode =
    (
      asString(
        selectedStrategy?.decisionMode,
      ) ??
      asString(
        decisionEvaluation?.decisionMode,
      ) ??
      "act"
    ).toLowerCase();

  const causalSummary =
    summary ??
    "The AI is still collecting evidence.";

  let heading =
    "The AI's strongest explanation";

  let primaryCauseLabel =
    "Primary Cause";

  let resolvedSummary =
    causalSummary;

  if (decisionMode === "investigate") {
    heading =
      "Leading explanations under investigation";

    primaryCauseLabel =
      "Leading causal candidate";

    resolvedSummary =
      `The Brain has not established a single cause yet. It is gathering evidence to distinguish between plausible explanations. ${causalSummary}`;
  } else if (
    decisionMode === "test"
  ) {
    heading =
      "Leading explanations under evaluation";

    primaryCauseLabel =
      "Leading causal candidate";

    resolvedSummary =
      `The Brain is testing competing explanations before treating any single cause as established. ${causalSummary}`;
  } else if (
    decisionMode === "contain"
  ) {
    heading =
      "Most likely driver of the current risk";

    primaryCauseLabel =
      "Leading risk driver";

    resolvedSummary =
      `The Brain sees enough risk to prioritize containment, while the exact causal explanation may continue to evolve. ${causalSummary}`;
  } else if (
    decisionMode === "monitor"
  ) {
    heading =
      "What the Brain is watching";

    primaryCauseLabel =
      "Leading monitored explanation";

    resolvedSummary =
      `The Brain is monitoring this explanation rather than treating it as a confirmed cause. ${causalSummary}`;
  }

  return {
    heading,

    primaryCauseLabel,

    summary:
      resolvedSummary,

    primaryCause:
      hypothesis?.cause ??
      "No primary cause identified",

    explanation:
      hypothesis
        ?.explanation ??
      "The AI does not yet have enough evidence to explain the current situation.",

    category:
      hypothesis?.category,

    severity:
      hypothesis?.severity,

    confidence:
      hypothesis
        ?.confidenceScore ??
      0,

    evidence:
      hypothesis?.evidence ??
      [],

    recommendedActions:
      hypothesis
        ?.recommendedActions ??
      [],

    whatWouldChangeMyMind:
      hypothesis
        ?.whatWouldChangeMyMind ??
      [],
  };
}