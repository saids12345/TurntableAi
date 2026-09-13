import {
  FUTURE_COMPARATOR_SCORE_WEIGHTS,
  type FutureComparison,
  type RankedFuture,
} from "@/lib/brain/reasoning/futureComparator";

export type DecisionProvenanceDriverKey =
  | "confidenceAdjustedImpact"
  | "confidence"
  | "evidenceQuality"
  | "decisionModeFit"
  | "robustness"
  | "impactBalance"
  | "downsideProtection"
  | "riskPenalty"
  | "scenarioPenalty"
  | "unknownPenalty"
  | "assumptionPenalty";

export type DecisionProvenanceDriver = {
  key: DecisionProvenanceDriverKey;
  label: string;
  contribution: number;
  percentOfWinningMargin: number | null;
};

export type ProductionDecisionProvenance = {
  available: boolean;
  verified: boolean;

  winner: {
    strategyId: string | null;
    title: string | null;
    score: number | null;
  };

  runnerUp: {
    strategyId: string | null;
    title: string | null;
    score: number | null;
  } | null;

  winningMargin: number | null;

  primaryDriver:
    DecisionProvenanceDriver | null;

  secondaryDriver:
    DecisionProvenanceDriver | null;

  countervailingDriver:
    DecisionProvenanceDriver | null;

  summary: string | null;

  integrity: {
    explainedMargin: number | null;
    observedMargin: number | null;
    residual: number | null;
    tolerance: number;
    passed: boolean | null;
  };
};

const PROVENANCE_LABELS: Record<
  DecisionProvenanceDriverKey,
  string
> = {
  confidenceAdjustedImpact:
    "Confidence-adjusted impact",
  confidence:
    "Confidence",
  evidenceQuality:
    "Evidence quality",
  decisionModeFit:
    "Decision-mode fit",
  robustness:
    "Robustness",
  impactBalance:
    "Impact balance",
  downsideProtection:
    "Downside protection",
  riskPenalty:
    "Risk penalty",
  scenarioPenalty:
    "Scenario penalty",
  unknownPenalty:
    "Unknown penalty",
  assumptionPenalty:
    "Assumption penalty",
};

function round(
  value: number,
  places = 6,
): number {
  const multiplier =
    10 ** places;

  return (
    Math.round(
      value * multiplier,
    ) / multiplier
  );
}

function weightedDifference(
  winnerValue: number,
  runnerUpValue: number,
  weight: number,
): number {
  return round(
    (
      winnerValue -
      runnerUpValue
    ) * weight,
  );
} 

const PROVENANCE_INTEGRITY_TOLERANCE =
  0.02;

  export function buildProductionDecisionProvenance(
    comparison:
      | FutureComparison
      | null
      | undefined,
    forceIntegrityFailure = false,
  ): ProductionDecisionProvenance {
  const ranked =
    comparison?.rankedFutures
      ?.slice()
      .sort(
        (a, b) =>
          a.rank - b.rank,
      ) ?? [];

  const winner =
    ranked[0] ?? null;

  const runnerUp =
    ranked[1] ?? null;

  if (!winner || !runnerUp) {
    return {
      available: false,
      verified: false,

      winner: {
        strategyId:
          winner?.future
            .strategyId ?? null,
        title:
          winner?.future
            .strategyTitle ?? null,
        score:
          winner?.score ?? null,
      },

      runnerUp: null,
      winningMargin: null,

      primaryDriver: null,
      secondaryDriver: null,
      countervailingDriver: null,

      summary: null,

      integrity: {
        explainedMargin: null,
        observedMargin: null,
        residual: null,
        tolerance:
          PROVENANCE_INTEGRITY_TOLERANCE,
        passed: null,
      },
    };
  }

  const winnerBreakdown =
    winner.breakdown;

  const runnerUpBreakdown =
    runnerUp.breakdown;

  const observedMargin =
    round(
      winner.score -
        runnerUp.score,
      2,
    );

  const contributions: Array<{
    key: DecisionProvenanceDriverKey;
    contribution: number;
  }> = [
    {
      key:
        "confidenceAdjustedImpact",
      contribution:
        weightedDifference(
          winnerBreakdown
            .confidenceAdjustedImpact,
          runnerUpBreakdown
            .confidenceAdjustedImpact,
          FUTURE_COMPARATOR_SCORE_WEIGHTS
            .confidenceAdjustedImpact,
        ),
    },
    {
      key: "confidence",
      contribution:
        weightedDifference(
          winner.future.confidence,
          runnerUp.future.confidence,
          FUTURE_COMPARATOR_SCORE_WEIGHTS
            .confidence,
        ),
    },
    {
      key: "evidenceQuality",
      contribution:
        weightedDifference(
          winnerBreakdown
            .evidenceQuality,
          runnerUpBreakdown
            .evidenceQuality,
          FUTURE_COMPARATOR_SCORE_WEIGHTS
            .evidenceQuality,
        ),
    },
    {
      key: "decisionModeFit",
      contribution:
        weightedDifference(
          winnerBreakdown
            .decisionModeFit,
          runnerUpBreakdown
            .decisionModeFit,
          FUTURE_COMPARATOR_SCORE_WEIGHTS
            .decisionModeFit,
        ),
    },
    {
      key: "robustness",
      contribution:
        weightedDifference(
          winnerBreakdown.robustness,
          runnerUpBreakdown.robustness,
          FUTURE_COMPARATOR_SCORE_WEIGHTS
            .robustness,
        ),
    },
    {
      key: "impactBalance",
      contribution:
        weightedDifference(
          winnerBreakdown
            .impactBalance,
          runnerUpBreakdown
            .impactBalance,
          FUTURE_COMPARATOR_SCORE_WEIGHTS
            .impactBalance,
        ),
    },
    {
      key: "downsideProtection",
      contribution:
        weightedDifference(
          winnerBreakdown
            .downsideProtection,
          runnerUpBreakdown
            .downsideProtection,
          FUTURE_COMPARATOR_SCORE_WEIGHTS
            .downsideProtection,
        ),
    },
    {
      key: "riskPenalty",
      contribution:
        weightedDifference(
          winnerBreakdown
            .riskPenalty,
          runnerUpBreakdown
            .riskPenalty,
          FUTURE_COMPARATOR_SCORE_WEIGHTS
            .riskPenalty,
        ),
    },
    {
      key: "scenarioPenalty",
      contribution:
        weightedDifference(
          winnerBreakdown
            .scenarioPenalty,
          runnerUpBreakdown
            .scenarioPenalty,
          FUTURE_COMPARATOR_SCORE_WEIGHTS
            .scenarioPenalty,
        ),
    },
    {
      key: "unknownPenalty",
      contribution:
        weightedDifference(
          winnerBreakdown
            .unknownPenalty,
          runnerUpBreakdown
            .unknownPenalty,
          FUTURE_COMPARATOR_SCORE_WEIGHTS
            .unknownPenalty,
        ),
    },
    {
      key: "assumptionPenalty",
      contribution:
        weightedDifference(
          winnerBreakdown
            .assumptionPenalty,
          runnerUpBreakdown
            .assumptionPenalty,
          FUTURE_COMPARATOR_SCORE_WEIGHTS
            .assumptionPenalty,
        ),
    },
  ];

  const explainedMargin =
    round(
      contributions.reduce(
        (
          total,
          item,
        ) =>
          total +
          item.contribution,
        0,
      ),
    );

  const residual =
    round(
      observedMargin -
        explainedMargin,
    );

    const integrityPassed =
    !forceIntegrityFailure &&
    Math.abs(residual) <=
      PROVENANCE_INTEGRITY_TOLERANCE;

  const drivers =
    contributions.map(
      ({
        key,
        contribution,
      }): DecisionProvenanceDriver => ({
        key,
        label:
          PROVENANCE_LABELS[key],
        contribution,
        percentOfWinningMargin:
          Math.abs(
            observedMargin,
          ) < 0.000001
            ? null
            : round(
                (
                  contribution /
                  observedMargin
                ) * 100,
                2,
              ),
      }),
    );

  const supporting =
    drivers
      .filter(
        (driver) =>
          driver.contribution >
          0.000001,
      )
      .sort(
        (a, b) =>
          b.contribution -
          a.contribution,
      );

  const countervailing =
    drivers
      .filter(
        (driver) =>
          driver.contribution <
          -0.000001,
      )
      .sort(
        (a, b) =>
          a.contribution -
          b.contribution,
      );

  const primaryDriver =
    integrityPassed
      ? supporting[0] ?? null
      : null;

  const secondaryDriver =
    integrityPassed
      ? supporting[1] ?? null
      : null;

  const countervailingDriver =
    integrityPassed
      ? countervailing[0] ?? null
      : null;

  return {
    available: true,
    verified:
      integrityPassed,

    winner: {
      strategyId:
        winner.future.strategyId,
      title:
        winner.future
          .strategyTitle ??
        winner.future.strategyId,
      score:
        winner.score,
    },

    runnerUp: {
      strategyId:
        runnerUp.future.strategyId,
      title:
        runnerUp.future
          .strategyTitle ??
        runnerUp.future.strategyId,
      score:
        runnerUp.score,
    },

    winningMargin:
      observedMargin,

    primaryDriver,
    secondaryDriver,
    countervailingDriver,

    summary:
      integrityPassed
        ? `"${winner.future.strategyTitle ?? winner.future.strategyId}" beat "${runnerUp.future.strategyTitle ?? runnerUp.future.strategyId}" by ${observedMargin} comparator points.`
        : null,

    integrity: {
      explainedMargin,
      observedMargin,
      residual,
      tolerance:
        PROVENANCE_INTEGRITY_TOLERANCE,
      passed:
        integrityPassed,
    },
  };
}

export function buildDecisionChangeProvenance(
  comparison:
    | FutureComparison
    | null
    | undefined,
  previousStrategyId:
    | string
    | null
    | undefined,
): ProductionDecisionProvenance | null {
  if (
    !comparison?.rankedFutures ||
    !previousStrategyId
  ) {
    return null;
  }

  const ranked =
    comparison.rankedFutures
      .slice()
      .sort(
        (a, b) =>
          a.rank - b.rank,
      );

  const winner =
    ranked[0] ?? null;

  const previousStrategy =
    ranked.find(
      (candidate) =>
        candidate.future
          .strategyId ===
        previousStrategyId,
    ) ?? null;

  if (
    !winner ||
    !previousStrategy ||
    winner.future.strategyId ===
      previousStrategyId
  ) {
    return null;
  }

  return buildProductionDecisionProvenance({
    ...comparison,

    rankedFutures: [
      {
        ...winner,
        rank: 1,
      },

      {
        ...previousStrategy,
        rank: 2,
      },
    ],
  });
}
/**
 * Fail-closed synchronization for persisted Decision Memory.
 *
 * A transition may only accompany the live recommendation
 * when the transition explicitly belongs to that same strategy.
 *
 * This prevents stale or counterfactual Decision Memory from
 * being displayed beside a different Brain recommendation.
 */
export function synchronizeDecisionTransition<
  T extends object,
>(
  transition:
    | T
    | null
    | undefined,
  liveStrategyId:
    | string
    | null
    | undefined,
): T | null {
  if (
    !transition ||
    !liveStrategyId
  ) {
    return null;
  }

  const currentStrategyId =
    "currentStrategyId" in transition
      ? (
          transition as {
            currentStrategyId?: unknown;
          }
        ).currentStrategyId
      : null;

  if (
    typeof currentStrategyId !==
    "string"
  ) {
    return null;
  }

  return currentStrategyId ===
    liveStrategyId
    ? transition
    : null;
}