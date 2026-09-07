import type {
  StrategyCandidate,
  StrategyDecisionMode,
  StrategyKind,
  StrategyRisk,
  StrategyReversibility,
  StrategyUrgency,
} from "./strategyGenerator";

import type {
  DecisionEvaluation,
  DecisionMode,
} from "./decisionFramework";

export type StrategyEvaluationStatus =
  | "preferred"
  | "viable"
  | "caution"
  | "avoid";

export interface StrategyScoreBreakdown {
  basePriority: number;

  objectiveAlignment: number;

  missionAlignment: number;

  principleAlignment: number;

  beliefSupport: number;

  decisionModeFit: number;

  expectedImpact: number;

  reversibility: number;

  urgency: number;

  evidenceReadiness: number;

  riskPenalty: number;

  uncertaintyPenalty: number;

  blockingPenalty: number;

  prematureActionPenalty: number;

  assumptionPenalty: number;

  total: number;
}

export interface EvaluatedStrategy {
  /**
   * Existing compatibility fields.
   */
  strategy: StrategyCandidate;

  evaluation: DecisionEvaluation;

  score: number;

  /**
   * Rich strategy-specific evaluation.
   */
  rank?: number;

  status?: StrategyEvaluationStatus;

  breakdown?: StrategyScoreBreakdown;

  strengths?: string[];

  concerns?: string[];

  reasoning?: string[];
}

const DECISION_MODE_COMPATIBILITY: Record<
  DecisionMode,
  Record<
    StrategyDecisionMode,
    number
  >
> = {
  act: {
    act: 1,
    test: 0.7,
    investigate: 0.4,
    contain: 0.86,
    monitor: 0.3,
  },

  test: {
    act: 0.45,
    test: 1,
    investigate: 0.82,
    contain: 0.78,
    monitor: 0.55,
  },

  investigate: {
    act: 0.2,
    test: 0.82,
    investigate: 1,
    contain: 0.7,
    monitor: 0.65,
  },

  monitor: {
    act: 0.22,
    test: 0.62,
    investigate: 0.58,
    contain: 0.45,
    monitor: 1,
  },
};

const STRATEGY_IMPACT: Record<
  StrategyKind,
  number
> = {
  corrective_action:
    0.9,

  controlled_experiment:
    0.78,

  information_gathering:
    0.62,

  risk_containment:
    0.72,

  growth:
    0.88,

  maintain_monitor:
    0.5,
};

const RISK_LEVELS: Record<
  StrategyRisk,
  number
> = {
  low:
    0.2,

  medium:
    0.55,

  high:
    1,
};

const REVERSIBILITY_LEVELS: Record<
  StrategyReversibility,
  number
> = {
  low:
    0.25,

  medium:
    0.65,

  high:
    1,
};

const URGENCY_LEVELS: Record<
  StrategyUrgency,
  number
> = {
  low:
    0.3,

  medium:
    0.58,

  high:
    0.84,

  critical:
    1,
};

function clamp(
  value: number,
  minimum = 0,
  maximum = 1,
) {
  return Math.min(
    maximum,
    Math.max(
      minimum,
      value,
    ),
  );
}

function round(
  value: number,
  decimals = 2,
) {
  const multiplier =
    10 ** decimals;

  return (
    Math.round(
      value * multiplier,
    ) / multiplier
  );
}

function uniqueStrings(
  values: string[],
) {
  return Array.from(
    new Set(
      values,
    ),
  );
}

function getDecisionModeFit(
  strategyMode:
    | StrategyDecisionMode
    | undefined,
  decisionMode:
    | DecisionMode
    | undefined,
) {
  if (
    !strategyMode ||
    !decisionMode
  ) {
    return 0.5;
  }

  return (
    DECISION_MODE_COMPATIBILITY[
      decisionMode
    ][strategyMode]
  );
}

function getExpectedImpact(
  strategy: StrategyCandidate,
) {
  const baseImpact =
    strategy.kind
      ? STRATEGY_IMPACT[
          strategy.kind
        ]
      : 0.55;

  const outcomeBonus =
    strategy.expectedOutcome
      ?.trim()
      ? 0.05
      : 0;

  const metricsBonus =
    strategy.successMetrics &&
    strategy.successMetrics.length >
      0
      ? Math.min(
          0.08,
          strategy.successMetrics
            .length * 0.02,
        )
      : 0;

  return clamp(
    baseImpact +
      outcomeBonus +
      metricsBonus,
  );
}

function getEvidenceReadiness(
  strategy: StrategyCandidate,
  evaluation: DecisionEvaluation,
) {
  const evidenceCoverage =
    clamp(
      evaluation
        .evidenceCoverage ??
      0.5,
    );

  const requiredEvidenceCount =
    strategy.requiredEvidence
      ?.length ?? 0;

  const evidenceRequirementPenalty =
    clamp(
      requiredEvidenceCount /
        8,
      0,
      0.55,
    );

  return clamp(
    evidenceCoverage *
      0.75 +
      (
        1 -
        evidenceRequirementPenalty
      ) *
        0.25,
  );
}

function getBeliefSupport(
  strategy: StrategyCandidate,
  evaluation: DecisionEvaluation,
) {
  const decisionBeliefConfidence =
    clamp(
      evaluation
        .beliefConfidence ??
      evaluation.confidence,
    );

  const strategyConfidence =
    clamp(
      strategy.confidence ??
      decisionBeliefConfidence,
    );

  const targetsPrimaryBelief =
    Boolean(
      strategy.relatedBeliefId &&
      evaluation.primaryBeliefId &&
      strategy.relatedBeliefId ===
        evaluation.primaryBeliefId,
    );

  return clamp(
    strategyConfidence *
      0.55 +
      decisionBeliefConfidence *
        0.45 +
      (
        targetsPrimaryBelief
          ? 0.05
          : 0
      ),
  );
}

function getRiskPenalty(
  strategy: StrategyCandidate,
  evaluation: DecisionEvaluation,
) {
  const riskLevel =
    strategy.risk
      ? RISK_LEVELS[
          strategy.risk
        ]
      : 0.55;

  const uncertainty =
    clamp(
      evaluation.uncertainty ??
      0.5,
    );

  const reversibility =
    strategy.reversibility
      ? REVERSIBILITY_LEVELS[
          strategy.reversibility
        ]
      : 0.5;

  const reversibilityProtection =
    reversibility * 0.35;

  return Math.max(
    0,
    riskLevel *
      (
        0.65 +
        uncertainty * 0.65
      ) *
      14 -
      reversibilityProtection *
        6,
  );
}

function getUncertaintyPenalty(
  strategy: StrategyCandidate,
  evaluation: DecisionEvaluation,
) {
  const uncertainty =
    clamp(
      evaluation.uncertainty ??
      0.5,
    );

  const multiplier =
    strategy.decisionMode ===
      "act"
      ? 13
      : strategy.decisionMode ===
          "test"
        ? 5
        : strategy.decisionMode ===
            "contain"
          ? 3
          : strategy.decisionMode ===
              "monitor"
            ? 2
            : 1;

  return (
    uncertainty *
    multiplier
  );
}

function getBlockingPenalty(
  strategy: StrategyCandidate,
  evaluation: DecisionEvaluation,
) {
  const blockingCount =
    evaluation.blockingReasons
      ?.length ??
    evaluation
      .unresolvedQuestions ??
    0;

  if (
    blockingCount === 0
  ) {
    return 0;
  }

  const modeMultiplier =
    strategy.decisionMode ===
      "act"
      ? 4.5
      : strategy.decisionMode ===
          "test"
        ? 1.5
        : strategy.decisionMode ===
            "contain"
          ? 1
          : 0.35;

  return Math.min(
    20,
    blockingCount *
      modeMultiplier,
  );
}

function getPrematureActionPenalty(
  strategy: StrategyCandidate,
  evaluation: DecisionEvaluation,
) {
  const strategyMode =
    strategy.decisionMode;

  const decisionMode =
    evaluation.decisionMode;

  if (
    !strategyMode ||
    !decisionMode
  ) {
    return 0;
  }

  if (
    strategyMode === "act"
  ) {
    if (
      decisionMode ===
      "investigate"
    ) {
      return 26;
    }

    if (
      decisionMode === "test"
    ) {
      return 15;
    }

    if (
      decisionMode ===
      "monitor"
    ) {
      return 19;
    }
  }

  if (
    strategyMode === "monitor" &&
    decisionMode === "act"
  ) {
    return 14;
  }

  if (
    strategyMode ===
      "investigate" &&
    decisionMode === "act"
  ) {
    return 9;
  }

  if (
    strategy.kind === "growth" &&
    evaluation.recommendation ===
      "reject"
  ) {
    return 24;
  }

  if (
    strategy.kind === "growth" &&
    evaluation.recommendation ===
      "review"
  ) {
    return 8;
  }

  return 0;
}

function getAssumptionPenalty(
  strategy: StrategyCandidate,
) {
  const assumptionCount =
    strategy.assumptions
      ?.length ?? 0;

  return Math.min(
    7,
    assumptionCount *
      1.25,
  );
}

function determineStatus(
  score: number,
): StrategyEvaluationStatus {
  if (score >= 75) {
    return "preferred";
  }

  if (score >= 55) {
    return "viable";
  }

  if (score >= 35) {
    return "caution";
  }

  return "avoid";
}

function buildStrengths(
  strategy: StrategyCandidate,
  evaluation: DecisionEvaluation,
  values: {
    beliefSupport: number;

    decisionModeFit: number;

    reversibility: number;

    evidenceReadiness: number;

    expectedImpact: number;
  },
) {
  const strengths: string[] =
    [];

  if (
    values.decisionModeFit >=
    0.85
  ) {
    strengths.push(
      `Strategy mode "${strategy.decisionMode ?? "unspecified"}" fits the Brain's recommended mode "${evaluation.decisionMode ?? "unspecified"}".`,
    );
  }

  if (
    values.beliefSupport >=
    0.72
  ) {
    strengths.push(
      "The strategy is well supported by the current belief state.",
    );
  }

  if (
    values.reversibility >=
    0.8
  ) {
    strengths.push(
      "The strategy is highly reversible if the diagnosis changes.",
    );
  }

  if (
    values.evidenceReadiness >=
    0.7
  ) {
    strengths.push(
      "Current evidence coverage is sufficient to support this strategy.",
    );
  }

  if (
    values.expectedImpact >=
    0.8
  ) {
    strengths.push(
      "The strategy has a clearly defined and potentially meaningful outcome.",
    );
  }

  if (
    strategy.successMetrics &&
    strategy.successMetrics.length >
      0
  ) {
    strengths.push(
      "The strategy includes measurable success criteria.",
    );
  }

  return uniqueStrings(
    strengths,
  );
}

function buildConcerns(
  strategy: StrategyCandidate,
  evaluation: DecisionEvaluation,
  values: {
    riskPenalty: number;

    uncertaintyPenalty: number;

    blockingPenalty: number;

    prematureActionPenalty: number;

    evidenceReadiness: number;
  },
) {
  const concerns: string[] =
    [];

  if (
    values.riskPenalty >= 8
  ) {
    concerns.push(
      "The strategy carries meaningful risk under current uncertainty.",
    );
  }

  if (
    values.uncertaintyPenalty >=
    7
  ) {
    concerns.push(
      "Current uncertainty weakens the case for committing to this strategy.",
    );
  }

  if (
    values.blockingPenalty > 0
  ) {
    concerns.push(
      "Unresolved executive questions may need to be addressed first.",
    );
  }

  if (
    values.prematureActionPenalty >
    0
  ) {
    concerns.push(
      `The strategy may be premature because the Brain currently recommends "${evaluation.decisionMode ?? "further review"}".`,
    );
  }

  if (
    values.evidenceReadiness <
    0.45
  ) {
    concerns.push(
      "Additional evidence is needed before this strategy can be evaluated confidently.",
    );
  }

  if (
    strategy.requiredEvidence &&
    strategy.requiredEvidence.length >
      3
  ) {
    concerns.push(
      `${strategy.requiredEvidence.length} important evidence requirements remain unresolved.`,
    );
  }

  if (
    strategy.assumptions &&
    strategy.assumptions.length >
      2
  ) {
    concerns.push(
      "The strategy depends on several assumptions that may require validation.",
    );
  }

  return uniqueStrings(
    concerns,
  );
}

function evaluateStrategy(
  strategy: StrategyCandidate,
  evaluation: DecisionEvaluation,
): EvaluatedStrategy {
  const basePriority =
    clamp(
      strategy.priority /
        100,
    );

  const objectiveAlignment =
    clamp(
      evaluation
        .objectiveAlignment ??
      0.5,
    );

  const missionAlignment =
    clamp(
      evaluation
        .missionAlignment,
    );

  const principleAlignment =
    clamp(
      evaluation
        .principleAlignment,
    );

  const beliefSupport =
    getBeliefSupport(
      strategy,
      evaluation,
    );

  const decisionModeFit =
    getDecisionModeFit(
      strategy.decisionMode,
      evaluation.decisionMode,
    );

  const expectedImpact =
    getExpectedImpact(
      strategy,
    );

  const reversibility =
    strategy.reversibility
      ? REVERSIBILITY_LEVELS[
          strategy.reversibility
        ]
      : 0.5;

  const urgency =
    strategy.urgency
      ? URGENCY_LEVELS[
          strategy.urgency
        ]
      : 0.5;

  const evidenceReadiness =
    getEvidenceReadiness(
      strategy,
      evaluation,
    );

  const riskPenalty =
    getRiskPenalty(
      strategy,
      evaluation,
    );

  const uncertaintyPenalty =
    getUncertaintyPenalty(
      strategy,
      evaluation,
    );

  const blockingPenalty =
    getBlockingPenalty(
      strategy,
      evaluation,
    );

  const prematureActionPenalty =
    getPrematureActionPenalty(
      strategy,
      evaluation,
    );

  const assumptionPenalty =
    getAssumptionPenalty(
      strategy,
    );

  const positiveScore =
    basePriority * 16 +
    objectiveAlignment * 10 +
    missionAlignment * 8 +
    principleAlignment * 8 +
    beliefSupport * 15 +
    decisionModeFit * 15 +
    expectedImpact * 10 +
    reversibility * 6 +
    urgency * 4 +
    evidenceReadiness * 8;

  const penaltyScore =
    riskPenalty +
    uncertaintyPenalty +
    blockingPenalty +
    prematureActionPenalty +
    assumptionPenalty;

  const score =
    round(
      Math.min(
        100,
        Math.max(
          0,
          positiveScore -
            penaltyScore,
        ),
      ),
    );

  const breakdown: StrategyScoreBreakdown =
    {
      basePriority:
        round(
          basePriority * 16,
        ),

      objectiveAlignment:
        round(
          objectiveAlignment *
            10,
        ),

      missionAlignment:
        round(
          missionAlignment * 8,
        ),

      principleAlignment:
        round(
          principleAlignment *
            8,
        ),

      beliefSupport:
        round(
          beliefSupport * 15,
        ),

      decisionModeFit:
        round(
          decisionModeFit * 15,
        ),

      expectedImpact:
        round(
          expectedImpact * 10,
        ),

      reversibility:
        round(
          reversibility * 6,
        ),

      urgency:
        round(
          urgency * 4,
        ),

      evidenceReadiness:
        round(
          evidenceReadiness * 8,
        ),

      riskPenalty:
        round(
          riskPenalty,
        ),

      uncertaintyPenalty:
        round(
          uncertaintyPenalty,
        ),

      blockingPenalty:
        round(
          blockingPenalty,
        ),

      prematureActionPenalty:
        round(
          prematureActionPenalty,
        ),

      assumptionPenalty:
        round(
          assumptionPenalty,
        ),

      total:
        score,
    };

  const strengths =
    buildStrengths(
      strategy,
      evaluation,
      {
        beliefSupport,

        decisionModeFit,

        reversibility,

        evidenceReadiness,

        expectedImpact,
      },
    );

  const concerns =
    buildConcerns(
      strategy,
      evaluation,
      {
        riskPenalty,

        uncertaintyPenalty,

        blockingPenalty,

        prematureActionPenalty,

        evidenceReadiness,
      },
    );

  const reasoning = [
    `Base strategy priority contributed ${breakdown.basePriority} points.`,

    `Decision-mode compatibility contributed ${breakdown.decisionModeFit} points.`,

    `Belief support contributed ${breakdown.beliefSupport} points.`,

    `Evidence readiness contributed ${breakdown.evidenceReadiness} points.`,

    `Total penalties removed ${round(
      penaltyScore,
    )} points.`,
  ];

  return {
    strategy,

    evaluation,

    score,

    status:
      determineStatus(
        score,
      ),

    breakdown,

    strengths,

    concerns,

    reasoning,
  };
}

export function evaluateStrategies(
  strategies: StrategyCandidate[],
  evaluation: DecisionEvaluation,
): EvaluatedStrategy[] {
  return strategies
    .map(
      (strategy) =>
        evaluateStrategy(
          strategy,
          evaluation,
        ),
    )
    .sort(
      (left, right) =>
        right.score -
        left.score,
    )
    .map(
      (
        evaluatedStrategy,
        index,
      ) => ({
        ...evaluatedStrategy,

        rank:
          index + 1,
      }),
    );
}