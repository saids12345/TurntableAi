import type {
  SimulatedFuture,
} from "./futureSimulator";

export type FutureEvaluationStatus =
  | "preferred"
  | "competitive"
  | "caution"
  | "avoid";

export interface FutureScoreBreakdown {
  /**
   * Normalized values used during comparison.
   */
  expectedValue: number;

  confidenceAdjustedImpact: number;

  downsideProtection: number;

  robustness: number;

  impactBalance: number;

  evidenceQuality: number;

  decisionModeFit: number;

  /**
   * Point deductions applied to the final score.
   */
  riskPenalty: number;

  scenarioPenalty: number;

  unknownPenalty: number;

  assumptionPenalty: number;

  /**
   * Final risk-adjusted score from 0 to 100.
   */
  total: number;
}

/**
 * Single source of truth for the Future Comparator
 * scoring equation.
 *
 * The Evaluation Harness imports these exact weights
 * so attribution cannot silently drift away from the
 * production decision mathematics.
 */
export const FUTURE_COMPARATOR_SCORE_WEIGHTS = {
  confidenceAdjustedImpact:
    32,

  confidence:
    10,

  evidenceQuality:
    8,

  decisionModeFit:
    10,

  robustness:
    10,

  impactBalance:
    5,

  downsideProtection:
    10,

  riskPenalty:
    -1,

  scenarioPenalty:
    -1,

  unknownPenalty:
    -1,

  assumptionPenalty:
    -1,
} as const;

export interface RankedFuture {
  future: SimulatedFuture;

  rank: number;

  score: number;

  status: FutureEvaluationStatus;

  breakdown: FutureScoreBreakdown;

  strengths: string[];

  tradeoffs: string[];
}

export interface FutureComparison {
  /**
   * Existing compatibility fields.
   */
  best: SimulatedFuture;

  alternatives: SimulatedFuture[];

  reasoning: string[];

  /**
   * Rich comparison state.
   */
  rankedFutures?: RankedFuture[];

  bestScore?: number;

  scoreGap?: number;

  decisionConfidence?: number;

  tradeoffs?: string[];

  warnings?: string[];

  generatedAt?: string;
}

interface ImpactVector {
  revenue: number;

  guestExperience: number;

  operations: number;
}

const IMPACT_WEIGHTS = {
  revenue: 0.36,

  guestExperience: 0.32,

  operations: 0.32,
} as const;

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

function clampScore(
  value: number,
) {
  return Math.min(
    100,
    Math.max(
      0,
      value,
    ),
  );
}

function round(
  value: number,
  decimals = 4,
) {
  const multiplier =
    10 ** decimals;

  return (
    Math.round(
      value * multiplier,
    ) / multiplier
  );
}

function average(
  values: number[],
  fallback = 0,
) {
  if (values.length === 0) {
    return fallback;
  }

  return (
    values.reduce(
      (total, value) =>
        total + value,
      0,
    ) / values.length
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

function getExpectedImpact(
  future: SimulatedFuture,
): ImpactVector {
  return {
    revenue:
      future.expectedRevenueImpact,

    guestExperience:
      future
        .expectedGuestExperienceImpact,

    operations:
      future
        .expectedOperationalImpact,
  };
}

function compositeImpact(
  impact: ImpactVector,
) {
  return (
    impact.revenue *
      IMPACT_WEIGHTS.revenue +
    impact.guestExperience *
      IMPACT_WEIGHTS
        .guestExperience +
    impact.operations *
      IMPACT_WEIGHTS.operations
  );
}

function getBestCaseImpact(
  future: SimulatedFuture,
) {
  const impact =
    future.bestCase?.impact;

  if (!impact) {
    return compositeImpact(
      getExpectedImpact(
        future,
      ),
    );
  }

  return compositeImpact({
    revenue:
      impact.revenue,

    guestExperience:
      impact.guestExperience,

    operations:
      impact.operations,
  });
}

function getWorstCaseImpact(
  future: SimulatedFuture,
) {
  const impact =
    future.worstCase?.impact;

  if (!impact) {
    return compositeImpact(
      getExpectedImpact(
        future,
      ),
    );
  }

  return compositeImpact({
    revenue:
      impact.revenue,

    guestExperience:
      impact.guestExperience,

    operations:
      impact.operations,
  });
}

function getImpactBalance(
  future: SimulatedFuture,
) {
  const impact =
    getExpectedImpact(
      future,
    );

  const values = [
    impact.revenue,
    impact.guestExperience,
    impact.operations,
  ];

  const highest =
    Math.max(
      ...values,
    );

  const lowest =
    Math.min(
      ...values,
    );

  /**
   * Because impact values range from -1 to 1,
   * the maximum possible spread is 2.
   */
  return clamp(
    1 -
      (
        highest -
        lowest
      ) /
        2,
  );
}

function getScenarioSpread(
  future: SimulatedFuture,
) {
  const bestCase =
    getBestCaseImpact(
      future,
    );

  const worstCase =
    getWorstCaseImpact(
      future,
    );

  return clamp(
    Math.abs(
      bestCase -
        worstCase,
    ) / 2,
  );
}

function getDownsideProtection(
  future: SimulatedFuture,
) {
  const worstCaseImpact =
    getWorstCaseImpact(
      future,
    );

  const worstCaseRisk =
    clamp(
      future.worstCase?.risk ??
        future.expectedRisk,
    );

  const downsideSeverity =
    clamp(
      Math.max(
        0,
        -worstCaseImpact,
      ),
    );

  return clamp(
    1 -
      downsideSeverity *
        0.65 -
      worstCaseRisk *
        0.35,
  );
}

function getScenarioPenalty(
  future: SimulatedFuture,
) {
  const worstCaseProbability =
    clamp(
      future.worstCase
        ?.probability ??
        0.25,
    );

  const worstCaseRisk =
    clamp(
      future.worstCase?.risk ??
        future.expectedRisk,
    );

  return (
    worstCaseProbability *
    worstCaseRisk *
    12
  );
}

function getUnknownPenalty(
  future: SimulatedFuture,
) {
  const unknownCount =
    future.unknowns?.length ??
    0;

  return Math.min(
    8,
    unknownCount * 0.8,
  );
}

function getAssumptionPenalty(
  future: SimulatedFuture,
) {
  const assumptionCount =
    future.assumptions
      ?.length ?? 0;

  return Math.min(
    5,
    assumptionCount * 0.5,
  );
}

function determineStatus(
  score: number,
): FutureEvaluationStatus {
  if (score >= 72) {
    return "preferred";
  }

  if (score >= 58) {
    return "competitive";
  }

  if (score >= 42) {
    return "caution";
  }

  return "avoid";
}

function describeExpectedValue(
  value: number,
) {
  if (value >= 0.35) {
    return "strong positive expected value";
  }

  if (value >= 0.17) {
    return "moderate positive expected value";
  }

  if (value >= 0.05) {
    return "slight positive expected value";
  }

  if (value <= -0.35) {
    return "severe negative expected value";
  }

  if (value <= -0.17) {
    return "moderate negative expected value";
  }

  if (value <= -0.05) {
    return "slight negative expected value";
  }

  return "limited expected material change";
}

function getFutureLabel(
  future: SimulatedFuture,
) {
  return (
    future.strategyTitle ??
    future.strategyId
  );
}

function buildStrengths(
  future: SimulatedFuture,
  values: {
    expectedValue: number;

    confidence: number;

    downsideProtection: number;

    robustness: number;

    impactBalance: number;

    evidenceQuality: number;

    decisionModeFit: number;
  },
) {
  const strengths: string[] =
    [];

  if (
    values.expectedValue >=
    0.16
  ) {
    strengths.push(
      "The future has meaningful positive expected value.",
    );
  }

  if (
    values.confidence >=
    0.72
  ) {
    strengths.push(
      "The simulation has relatively strong confidence.",
    );
  }

  if (
    values.downsideProtection >=
    0.68
  ) {
    strengths.push(
      "Worst-case downside appears reasonably contained.",
    );
  }

  if (
    values.robustness >=
    0.68
  ) {
    strengths.push(
      "The projected outcome remains comparatively stable across scenarios.",
    );
  }

  if (
    values.impactBalance >=
    0.72
  ) {
    strengths.push(
      "Revenue, guest, and operational impacts are relatively balanced.",
    );
  }

  if (
    values.evidenceQuality >=
    0.68
  ) {
    strengths.push(
      "The future is supported by comparatively strong evidence coverage.",
    );
  }

  if (
    values.decisionModeFit >=
    0.82
  ) {
    strengths.push(
      "The strategy closely matches the Brain’s recommended decision posture.",
    );
  }

  if (
    future.successMetrics &&
    future.successMetrics.length >
      0
  ) {
    strengths.push(
      "The future includes measurable success criteria.",
    );
  }

  return uniqueStrings(
    strengths,
  );
}

function buildTradeoffs(
  future: SimulatedFuture,
  values: {
    expectedValue: number;

    expectedRisk: number;

    scenarioSpread: number;

    impactBalance: number;

    evidenceQuality: number;

    decisionModeFit: number;

    worstCaseImpact: number;
  },
) {
  const tradeoffs: string[] =
    [];

  if (
    values.expectedValue <
    0.05
  ) {
    tradeoffs.push(
      "The future offers limited direct near-term upside.",
    );
  }

  if (
    values.expectedRisk >=
    0.45
  ) {
    tradeoffs.push(
      "Probability-weighted risk remains material.",
    );
  }

  if (
    values.scenarioSpread >=
    0.42
  ) {
    tradeoffs.push(
      "The difference between best and worst cases is wide, reducing predictability.",
    );
  }

  if (
    values.worstCaseImpact <=
    -0.15
  ) {
    tradeoffs.push(
      "The worst-case scenario includes meaningful operating downside.",
    );
  }

  if (
    values.impactBalance <
    0.55
  ) {
    tradeoffs.push(
      "Improvement in one area may come at the expense of another.",
    );
  }

  if (
    values.evidenceQuality <
    0.5
  ) {
    tradeoffs.push(
      "Evidence coverage is not yet strong enough for a highly reliable projection.",
    );
  }

  if (
    values.decisionModeFit <
    0.65
  ) {
    tradeoffs.push(
      "The strategy does not fully match the Brain’s current decision posture.",
    );
  }

  const unknownCount =
    future.unknowns?.length ??
    0;

  if (
    unknownCount >= 4
  ) {
    tradeoffs.push(
      `${unknownCount} important unknowns remain unresolved.`,
    );
  }

  return uniqueStrings(
    tradeoffs,
  );
}

function evaluateFuture(
  future: SimulatedFuture,
): Omit<
  RankedFuture,
  "rank"
> {
  const expectedImpact =
    getExpectedImpact(
      future,
    );

  const expectedValue =
    round(
      compositeImpact(
        expectedImpact,
      ),
    );

  const confidence =
    clamp(
      future.confidence,
    );

  const evidenceQuality =
    clamp(
      future.evidenceCoverage ??
        0.5,
    );

  const decisionModeFit =
    clamp(
      future.decisionModeFit ??
        0.5,
    );

  const expectedRisk =
    clamp(
      future.expectedRisk,
    );

  const scenarioSpread =
    getScenarioSpread(
      future,
    );

  const robustness =
    clamp(
      1 -
        scenarioSpread,
    );

  const impactBalance =
    getImpactBalance(
      future,
    );

  const downsideProtection =
    getDownsideProtection(
      future,
    );

  const worstCaseImpact =
    getWorstCaseImpact(
      future,
    );

  const confidenceAdjustedImpact =
    round(
      expectedValue *
        (
          0.55 +
          confidence * 0.45
        ),
    );

  const riskPenalty =
    expectedRisk * 18;

  const scenarioPenalty =
    getScenarioPenalty(
      future,
    );

  const unknownPenalty =
    getUnknownPenalty(
      future,
    );

  const assumptionPenalty =
    getAssumptionPenalty(
      future,
    );

  /**
   * Each normalized quality value is centered around 0.5.
   * A value above 0.5 contributes positively; a value below
   * 0.5 lowers the final score.
   */
  const rawScore =
  50 +
  confidenceAdjustedImpact *
    FUTURE_COMPARATOR_SCORE_WEIGHTS
      .confidenceAdjustedImpact +
  (
    confidence -
    0.5
  ) *
    FUTURE_COMPARATOR_SCORE_WEIGHTS
      .confidence +
  (
    evidenceQuality -
    0.5
  ) *
    FUTURE_COMPARATOR_SCORE_WEIGHTS
      .evidenceQuality +
  (
    decisionModeFit -
    0.5
  ) *
    FUTURE_COMPARATOR_SCORE_WEIGHTS
      .decisionModeFit +
  (
    robustness -
    0.5
  ) *
    FUTURE_COMPARATOR_SCORE_WEIGHTS
      .robustness +
  (
    impactBalance -
    0.5
  ) *
    FUTURE_COMPARATOR_SCORE_WEIGHTS
      .impactBalance +
  (
    downsideProtection -
    0.5
  ) *
    FUTURE_COMPARATOR_SCORE_WEIGHTS
      .downsideProtection +
  riskPenalty *
    FUTURE_COMPARATOR_SCORE_WEIGHTS
      .riskPenalty +
  scenarioPenalty *
    FUTURE_COMPARATOR_SCORE_WEIGHTS
      .scenarioPenalty +
  unknownPenalty *
    FUTURE_COMPARATOR_SCORE_WEIGHTS
      .unknownPenalty +
  assumptionPenalty *
    FUTURE_COMPARATOR_SCORE_WEIGHTS
      .assumptionPenalty;

  const score =
    round(
      clampScore(
        rawScore,
      ),
      2,
    );

  const breakdown: FutureScoreBreakdown =
    {
      expectedValue,

      confidenceAdjustedImpact,

      downsideProtection:
        round(
          downsideProtection,
        ),

      robustness:
        round(
          robustness,
        ),

      impactBalance:
        round(
          impactBalance,
        ),

      evidenceQuality:
        round(
          evidenceQuality,
        ),

      decisionModeFit:
        round(
          decisionModeFit,
        ),

      riskPenalty:
        round(
          riskPenalty,
          2,
        ),

      scenarioPenalty:
        round(
          scenarioPenalty,
          2,
        ),

      unknownPenalty:
        round(
          unknownPenalty,
          2,
        ),

      assumptionPenalty:
        round(
          assumptionPenalty,
          2,
        ),

      total:
        score,
    };

  const strengths =
    buildStrengths(
      future,
      {
        expectedValue,

        confidence,

        downsideProtection,

        robustness,

        impactBalance,

        evidenceQuality,

        decisionModeFit,
      },
    );

  const tradeoffs =
    buildTradeoffs(
      future,
      {
        expectedValue,

        expectedRisk,

        scenarioSpread,

        impactBalance,

        evidenceQuality,

        decisionModeFit,

        worstCaseImpact,
      },
    );

  return {
    future,

    score,

    status:
      determineStatus(
        score,
      ),

    breakdown,

    strengths,

    tradeoffs,
  };
}

function calculateDecisionConfidence(
  rankedFutures: RankedFuture[],
) {
  const best =
    rankedFutures[0];

  if (!best) {
    return 0;
  }

  const second =
    rankedFutures[1];

  const scoreGap =
    second
      ? clamp(
          (
            best.score -
            second.score
          ) / 20,
        )
      : 0.8;

  const bestConfidence =
    clamp(
      best.future.confidence,
    );

  const evidenceQuality =
    best.breakdown
      .evidenceQuality;

  const robustness =
    best.breakdown.robustness;

  const downsideProtection =
    best.breakdown
      .downsideProtection;

  return round(
    clamp(
      bestConfidence *
        0.32 +
      evidenceQuality *
        0.2 +
      robustness *
        0.18 +
      downsideProtection *
        0.15 +
      scoreGap *
        0.15,
    ),
  );
}

function futureDominates(
  preferred: SimulatedFuture,
  alternative: SimulatedFuture,
) {
  const noWorseImpact =
    preferred
      .expectedRevenueImpact >=
      alternative
        .expectedRevenueImpact &&
    preferred
      .expectedGuestExperienceImpact >=
      alternative
        .expectedGuestExperienceImpact &&
    preferred
      .expectedOperationalImpact >=
      alternative
        .expectedOperationalImpact;

  const noWorseRisk =
    preferred.expectedRisk <=
    alternative.expectedRisk;

  const materiallyBetter =
    preferred
      .expectedRevenueImpact >
      alternative
        .expectedRevenueImpact ||
    preferred
      .expectedGuestExperienceImpact >
      alternative
        .expectedGuestExperienceImpact ||
    preferred
      .expectedOperationalImpact >
      alternative
        .expectedOperationalImpact ||
    preferred.expectedRisk <
      alternative.expectedRisk;

  return (
    noWorseImpact &&
    noWorseRisk &&
    materiallyBetter
  );
}

function buildWarnings(
  rankedFutures: RankedFuture[],
  scoreGap: number,
) {
  const warnings: string[] =
    [];

  const best =
    rankedFutures[0];

  if (!best) {
    return warnings;
  }

  if (
    rankedFutures.length > 1 &&
    scoreGap < 5
  ) {
    warnings.push(
      "The two strongest futures are close; the selection is not decisive.",
    );
  }

  if (
    best.future.expectedRisk >=
    0.5
  ) {
    warnings.push(
      "The preferred future still carries high probability-weighted risk.",
    );
  }

  if (
    best.breakdown
      .evidenceQuality <
    0.4
  ) {
    warnings.push(
      "The preferred future is based on limited evidence coverage.",
    );
  }

  if (
    best.breakdown
      .downsideProtection <
    0.45
  ) {
    warnings.push(
      "Worst-case downside protection is weak.",
    );
  }

  if (
    best.score < 42
  ) {
    warnings.push(
      "None of the simulated futures currently provides a strong risk-adjusted outcome.",
    );
  }

  return uniqueStrings(
    warnings,
  );
}

export function compareFutures(
  futures: SimulatedFuture[],
): FutureComparison {
  if (
    futures.length === 0
  ) {
    throw new Error(
      "Future comparison requires at least one simulated future.",
    );
  }

  const rankedFutures =
    futures
      .map(
        (future) =>
          evaluateFuture(
            future,
          ),
      )
      .sort(
        (
          left,
          right,
        ) => {
          const scoreDifference =
            right.score -
            left.score;

          if (
            Math.abs(
              scoreDifference,
            ) >= 0.01
          ) {
            return scoreDifference;
          }

          const riskDifference =
            left.future
              .expectedRisk -
            right.future
              .expectedRisk;

          if (
            Math.abs(
              riskDifference,
            ) >= 0.001
          ) {
            return riskDifference;
          }

          return (
            right.future.confidence -
            left.future.confidence
          );
        },
      )
      .map(
        (
          rankedFuture,
          index,
        ) => ({
          ...rankedFuture,

          rank:
            index + 1,
        }),
      );

  const preferred =
    rankedFutures[0];

  const second =
    rankedFutures[1];

  const scoreGap =
    round(
      second
        ? preferred.score -
            second.score
        : preferred.score,
      2,
    );

  const decisionConfidence =
    calculateDecisionConfidence(
      rankedFutures,
    );

  const dominanceCount =
    rankedFutures
      .slice(
        1,
      )
      .filter(
        (alternative) =>
          futureDominates(
            preferred.future,
            alternative.future,
          ),
      )
      .length;

  const warnings =
    buildWarnings(
      rankedFutures,
      scoreGap,
    );

  const reasoning: string[] =
    [
      `Compared ${rankedFutures.length} simulated future${
        rankedFutures.length === 1
          ? ""
          : "s"
      } using expected value, confidence, downside protection, robustness, evidence quality, decision-mode fit, and risk.`,

      `Selected "${getFutureLabel(
        preferred.future,
      )}" with a risk-adjusted score of ${preferred.score}/100.`,

      `The preferred future has ${describeExpectedValue(
        preferred.breakdown
          .expectedValue,
      )}, ${Math.round(
        preferred.future
          .confidence * 100,
      )}% simulation confidence, and ${Math.round(
        preferred.future
          .expectedRisk * 100,
      )}% probability-weighted risk.`,
    ];

  if (second) {
    reasoning.push(
      `It leads the next-best future by ${scoreGap} points.`,
    );
  }

  if (
    dominanceCount > 0
  ) {
    reasoning.push(
      `The selected future strictly dominates ${dominanceCount} alternative${
        dominanceCount === 1
          ? ""
          : "s"
      } across expected impacts and risk.`,
    );
  }

  if (
    preferred.tradeoffs.length >
    0
  ) {
    reasoning.push(
      `Primary tradeoff: ${preferred.tradeoffs[0]}`,
    );
  }

  if (
    warnings.length > 0
  ) {
    reasoning.push(
      `Comparison warning: ${warnings[0]}`,
    );
  }

  return {
    best:
      preferred.future,

    alternatives:
      rankedFutures
        .slice(
          1,
        )
        .map(
          (rankedFuture) =>
            rankedFuture.future,
        ),

    reasoning,

    rankedFutures,

    bestScore:
      preferred.score,

    scoreGap,

    decisionConfidence,

    tradeoffs:
      preferred.tradeoffs,

    warnings,

    generatedAt:
      new Date().toISOString(),
  };
}