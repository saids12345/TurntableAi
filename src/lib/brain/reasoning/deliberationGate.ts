import type {
  FutureComparison,
  RankedFuture,
} from "./futureComparator";

import type {
  BrainSelfCritique,
} from "./selfCritique";

export type DeliberationGateVerdict =
  | "not_required"
  | "winner_verified"
  | "challenger_verified"
  | "insufficient_evidence"
  | "integrity_failed";

export interface DeliberationGateAdvantage {
  dimension: string;

  direction:
    | "winner"
    | "challenger";

  magnitude: number;

  detail: string;
}

export interface DeliberationGateResult {
  available: boolean;

  shadowMode: true;

  verdict:
    DeliberationGateVerdict;

  originalWinnerStrategyId:
    | string
    | null;

  originalWinnerStrategyTitle:
    | string
    | null;

  challengerStrategyId:
    | string
    | null;

  challengerStrategyTitle:
    | string
    | null;

  comparatorScoreGap:
    | number
    | null;

  selfCritiqueNetChallenge:
    number;

  materialChallengerAdvantages:
    DeliberationGateAdvantage[];

  materialWinnerAdvantages:
    DeliberationGateAdvantage[];

  revisionVerified: boolean;

  recommendedStrategyId:
    | string
    | null;

  summary: string;

  integrity: {
    winnerIdentityMatches: boolean;

    challengerIdentityMatches: boolean;

    rankedFuturesAvailable: boolean;

    passed: boolean;
  };

  generatedAt: string;
}

const MAX_COMPARATOR_GAP_FOR_REVISION =
  8;

const MATERIAL_CONFIDENCE_DELTA =
  0.05;

const MATERIAL_RISK_DELTA =
  0.1;

const MATERIAL_EVIDENCE_DELTA =
  0.1;

const MATERIAL_UNCERTAINTY_DELTA =
  0.1;

const MATERIAL_DOWNSIDE_DELTA =
  0.1;

const MIN_MATERIAL_ADVANTAGES =
  2;

function round(
  value: number,
  digits = 4,
) {
  const factor =
    10 ** digits;

  return (
    Math.round(
      value * factor,
    ) / factor
  );
}

function normalized(
  value:
    | number
    | null
    | undefined,
  fallback = 0.5,
) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return fallback;
  }

  return Math.min(
    1,
    Math.max(
      0,
      value,
    ),
  );
}

function getWorstCaseRisk(
  ranked:
    RankedFuture,
) {
  return normalized(
    ranked.future
      .worstCase?.risk,
    ranked.future
      .expectedRisk ??
      0.5,
  );
}

function getNegativeWorstCaseImpact(
  ranked:
    RankedFuture,
) {
  const impact =
    ranked.future
      .worstCase?.impact;

  if (!impact) {
    return 0;
  }

  const negativeMagnitudes = [
    impact.revenue,
    impact.guestExperience,
    impact.operations,
  ]
    .filter(
      (value) =>
        value < 0,
    )
    .map(
      (value) =>
        Math.abs(value),
    );

  if (
    negativeMagnitudes.length ===
    0
  ) {
    return 0;
  }

  return normalized(
    negativeMagnitudes.reduce(
      (sum, value) =>
        sum + value,
      0,
    ) /
      negativeMagnitudes.length,
    0,
  );
}

function buildAdvantages(
  winner:
    RankedFuture,
  challenger:
    RankedFuture,
) {
  const challengerAdvantages:
    DeliberationGateAdvantage[] = [];

  const winnerAdvantages:
    DeliberationGateAdvantage[] = [];

  const winnerConfidence =
    normalized(
      winner.future
        .confidence,
    );

  const challengerConfidence =
    normalized(
      challenger.future
        .confidence,
    );

  const confidenceDelta =
    challengerConfidence -
    winnerConfidence;

  if (
    confidenceDelta >=
    MATERIAL_CONFIDENCE_DELTA
  ) {
    challengerAdvantages.push({
      dimension:
        "confidence",

      direction:
        "challenger",

      magnitude:
        round(
          confidenceDelta,
        ),

      detail:
        `The challenger has ${round(
          confidenceDelta *
            100,
          1,
        )} percentage points more simulated confidence.`,
    });
  } else if (
    confidenceDelta <=
    -MATERIAL_CONFIDENCE_DELTA
  ) {
    winnerAdvantages.push({
      dimension:
        "confidence",

      direction:
        "winner",

      magnitude:
        round(
          Math.abs(
            confidenceDelta,
          ),
        ),

      detail:
        `The winner has ${round(
          Math.abs(
            confidenceDelta,
          ) * 100,
          1,
        )} percentage points more simulated confidence.`,
    });
  }

  const winnerRisk =
    normalized(
      winner.future
        .expectedRisk,
    );

  const challengerRisk =
    normalized(
      challenger.future
        .expectedRisk,
    );

  const riskAdvantage =
    winnerRisk -
    challengerRisk;

  if (
    riskAdvantage >=
    MATERIAL_RISK_DELTA
  ) {
    challengerAdvantages.push({
      dimension:
        "expected_risk",

      direction:
        "challenger",

      magnitude:
        round(
          riskAdvantage,
        ),

      detail:
        `The challenger reduces expected risk by ${round(
          riskAdvantage *
            100,
          1,
        )} percentage points.`,
    });
  } else if (
    riskAdvantage <=
    -MATERIAL_RISK_DELTA
  ) {
    winnerAdvantages.push({
      dimension:
        "expected_risk",

      direction:
        "winner",

      magnitude:
        round(
          Math.abs(
            riskAdvantage,
          ),
        ),

      detail:
        `The winner reduces expected risk by ${round(
          Math.abs(
            riskAdvantage,
          ) * 100,
          1,
        )} percentage points.`,
    });
  }

  const winnerWorstCaseRisk =
    getWorstCaseRisk(
      winner,
    );

  const challengerWorstCaseRisk =
    getWorstCaseRisk(
      challenger,
    );

  const worstCaseRiskAdvantage =
    winnerWorstCaseRisk -
    challengerWorstCaseRisk;

  if (
    worstCaseRiskAdvantage >=
    MATERIAL_RISK_DELTA
  ) {
    challengerAdvantages.push({
      dimension:
        "worst_case_risk",

      direction:
        "challenger",

      magnitude:
        round(
          worstCaseRiskAdvantage,
        ),

      detail:
        `The challenger reduces worst-case risk by ${round(
          worstCaseRiskAdvantage *
            100,
          1,
        )} percentage points.`,
    });
  } else if (
    worstCaseRiskAdvantage <=
    -MATERIAL_RISK_DELTA
  ) {
    winnerAdvantages.push({
      dimension:
        "worst_case_risk",

      direction:
        "winner",

      magnitude:
        round(
          Math.abs(
            worstCaseRiskAdvantage,
          ),
        ),

      detail:
        `The winner reduces worst-case risk by ${round(
          Math.abs(
            worstCaseRiskAdvantage,
          ) * 100,
          1,
        )} percentage points.`,
    });
  }

  const winnerEvidence =
    normalized(
      winner.future
        .evidenceCoverage,
      0.5,
    );

  const challengerEvidence =
    normalized(
      challenger.future
        .evidenceCoverage,
      0.5,
    );

  const evidenceDelta =
    challengerEvidence -
    winnerEvidence;

  if (
    evidenceDelta >=
    MATERIAL_EVIDENCE_DELTA
  ) {
    challengerAdvantages.push({
      dimension:
        "evidence",

      direction:
        "challenger",

      magnitude:
        round(
          evidenceDelta,
        ),

      detail:
        "The challenger has materially stronger evidence coverage.",
    });
  } else if (
    evidenceDelta <=
    -MATERIAL_EVIDENCE_DELTA
  ) {
    winnerAdvantages.push({
      dimension:
        "evidence",

      direction:
        "winner",

      magnitude:
        round(
          Math.abs(
            evidenceDelta,
          ),
        ),

      detail:
        "The winner has materially stronger evidence coverage.",
    });
  }

  const winnerUncertainty =
    normalized(
      winner.future
        .uncertainty,
      0.5,
    );

  const challengerUncertainty =
    normalized(
      challenger.future
        .uncertainty,
      0.5,
    );

  const uncertaintyAdvantage =
    winnerUncertainty -
    challengerUncertainty;

  if (
    uncertaintyAdvantage >=
    MATERIAL_UNCERTAINTY_DELTA
  ) {
    challengerAdvantages.push({
      dimension:
        "uncertainty",

      direction:
        "challenger",

      magnitude:
        round(
          uncertaintyAdvantage,
        ),

      detail:
        "The challenger carries materially less unresolved uncertainty.",
    });
  } else if (
    uncertaintyAdvantage <=
    -MATERIAL_UNCERTAINTY_DELTA
  ) {
    winnerAdvantages.push({
      dimension:
        "uncertainty",

      direction:
        "winner",

      magnitude:
        round(
          Math.abs(
            uncertaintyAdvantage,
          ),
        ),

      detail:
        "The winner carries materially less unresolved uncertainty.",
    });
  }

  const winnerDownside =
    getNegativeWorstCaseImpact(
      winner,
    );

  const challengerDownside =
    getNegativeWorstCaseImpact(
      challenger,
    );

  const downsideAdvantage =
    winnerDownside -
    challengerDownside;

  if (
    downsideAdvantage >=
    MATERIAL_DOWNSIDE_DELTA
  ) {
    challengerAdvantages.push({
      dimension:
        "worst_case_impact",

      direction:
        "challenger",

      magnitude:
        round(
          downsideAdvantage,
        ),

      detail:
        "The challenger has a materially less damaging worst-case impact profile.",
    });
  } else if (
    downsideAdvantage <=
    -MATERIAL_DOWNSIDE_DELTA
  ) {
    winnerAdvantages.push({
      dimension:
        "worst_case_impact",

      direction:
        "winner",

      magnitude:
        round(
          Math.abs(
            downsideAdvantage,
          ),
        ),

      detail:
        "The winner has a materially less damaging worst-case impact profile.",
    });
  }

  return {
    challengerAdvantages,

    winnerAdvantages,
  };
}

/**
 * Second-pass deliberation gate.
 *
 * This is intentionally SHADOW-ONLY.
 *
 * It may verify that the challenger deserves another
 * decision pass, but it does not mutate FutureComparison,
 * replace comparison.best, or change the production winner.
 */
export function runDeliberationGate(
  comparison:
    | FutureComparison
    | null
    | undefined,
  selfCritique:
    | BrainSelfCritique
    | null
    | undefined,
): DeliberationGateResult {
  const generatedAt =
    new Date().toISOString();

  const ranked =
    comparison
      ?.rankedFutures
      ?.slice()
      .sort(
        (a, b) =>
          a.rank - b.rank,
      ) ?? [];

  const winner =
    ranked[0] ??
    null;

  const critiqueChallengerId =
    selfCritique
      ?.revisionCandidateStrategyId ??
    selfCritique
      ?.challengerStrategyId ??
    null;

  const challenger =
    critiqueChallengerId
      ? ranked.find(
          (candidate) =>
            candidate.future
              .strategyId ===
            critiqueChallengerId,
        ) ?? null
      : null;

  const winnerIdentityMatches =
    Boolean(
      winner &&
      selfCritique
        ?.winnerStrategyId &&
      winner.future
        .strategyId ===
        selfCritique
          .winnerStrategyId,
    );

  const challengerIdentityMatches =
    Boolean(
      challenger &&
      critiqueChallengerId &&
      challenger.future
        .strategyId ===
        critiqueChallengerId,
    );

  const rankedFuturesAvailable =
    Boolean(
      winner &&
      ranked.length >= 2,
    );

  const integrityPassed =
    winnerIdentityMatches &&
    rankedFuturesAvailable &&
    (
      selfCritique
        ?.verdict !==
      "revision_recommended" ||
      challengerIdentityMatches
    );

  if (
    !winner ||
    !selfCritique
  ) {
    return {
      available: false,

      shadowMode: true,

      verdict:
        "insufficient_evidence",

      originalWinnerStrategyId:
        winner?.future
          .strategyId ??
        null,

      originalWinnerStrategyTitle:
        winner?.future
          .strategyTitle ??
        null,

      challengerStrategyId:
        null,

      challengerStrategyTitle:
        null,

      comparatorScoreGap:
        null,

      selfCritiqueNetChallenge:
        selfCritique
          ?.netChallenge ??
        0,

      materialChallengerAdvantages:
        [],

      materialWinnerAdvantages:
        [],

      revisionVerified:
        false,

      recommendedStrategyId:
        null,

      summary:
        "Second-pass deliberation requires both a Future Comparison and Self-Critique result.",

      integrity: {
        winnerIdentityMatches,

        challengerIdentityMatches,

        rankedFuturesAvailable,

        passed: false,
      },

      generatedAt,
    };
  }

  if (
    !integrityPassed
  ) {
    return {
      available: true,

      shadowMode: true,

      verdict:
        "integrity_failed",

      originalWinnerStrategyId:
        winner.future
          .strategyId,

      originalWinnerStrategyTitle:
        winner.future
          .strategyTitle ??
        winner.future
          .strategyId,

      challengerStrategyId:
        challenger?.future
          .strategyId ??
        critiqueChallengerId,

      challengerStrategyTitle:
        challenger?.future
          .strategyTitle ??
        null,

      comparatorScoreGap:
        null,

      selfCritiqueNetChallenge:
        selfCritique
          .netChallenge,

      materialChallengerAdvantages:
        [],

      materialWinnerAdvantages:
        [],

      revisionVerified:
        false,

      recommendedStrategyId:
        null,

      summary:
        "Second-pass deliberation failed identity or ranking integrity checks and therefore withheld a revision judgment.",

      integrity: {
        winnerIdentityMatches,

        challengerIdentityMatches,

        rankedFuturesAvailable,

        passed: false,
      },

      generatedAt,
    };
  }

  if (
    selfCritique.verdict !==
    "revision_recommended"
  ) {
    return {
      available: true,

      shadowMode: true,

      verdict:
        "not_required",

      originalWinnerStrategyId:
        winner.future
          .strategyId,

      originalWinnerStrategyTitle:
        winner.future
          .strategyTitle ??
        winner.future
          .strategyId,

      challengerStrategyId:
        selfCritique
          .challengerStrategyId,

      challengerStrategyTitle:
        selfCritique
          .challengerStrategyTitle,

      comparatorScoreGap:
        selfCritique
          .scoreGap,

      selfCritiqueNetChallenge:
        selfCritique
          .netChallenge,

      materialChallengerAdvantages:
        [],

      materialWinnerAdvantages:
        [],

      revisionVerified:
        false,

      recommendedStrategyId:
        winner.future
          .strategyId,

      summary:
        "Self-Critique did not request reconsideration, so the second-pass deliberation gate was not required.",

      integrity: {
        winnerIdentityMatches,

        challengerIdentityMatches,

        rankedFuturesAvailable,

        passed: true,
      },

      generatedAt,
    };
  }

  if (
    !challenger
  ) {
    return {
      available: true,

      shadowMode: true,

      verdict:
        "insufficient_evidence",

      originalWinnerStrategyId:
        winner.future
          .strategyId,

      originalWinnerStrategyTitle:
        winner.future
          .strategyTitle ??
        winner.future
          .strategyId,

      challengerStrategyId:
        critiqueChallengerId,

      challengerStrategyTitle:
        null,

      comparatorScoreGap:
        selfCritique
          .scoreGap,

      selfCritiqueNetChallenge:
        selfCritique
          .netChallenge,

      materialChallengerAdvantages:
        [],

      materialWinnerAdvantages:
        [],

      revisionVerified:
        false,

      recommendedStrategyId:
        winner.future
          .strategyId,

      summary:
        "Self-Critique requested reconsideration, but the proposed challenger could not be verified in the current ranked future set.",

      integrity: {
        winnerIdentityMatches,

        challengerIdentityMatches,

        rankedFuturesAvailable,

        passed: false,
      },

      generatedAt,
    };
  }

  const scoreGap =
    Math.max(
      0,
      winner.score -
        challenger.score,
    );

  const {
    challengerAdvantages,
    winnerAdvantages,
  } = buildAdvantages(
    winner,
    challenger,
  );

  /**
   * Revision verification requires ALL of:
   *
   * 1. Self-Critique already crossed its conservative threshold.
   * 2. The challenger remains reasonably close in the production
   *    Future Comparator.
   * 3. The challenger has at least two material advantages.
   * 4. Those material advantages outnumber the winner's.
   *
   * This is verification, not a new replacement scoring model.
   */
  const critiqueStrongEnough =
    selfCritique.netChallenge >=
    12;

  const comparatorCloseEnough =
    scoreGap <=
    MAX_COMPARATOR_GAP_FOR_REVISION;

  const challengerBreadthVerified =
    challengerAdvantages.length >=
    MIN_MATERIAL_ADVANTAGES;

  const challengerDominatesMaterially =
    challengerAdvantages.length >
    winnerAdvantages.length;

  const revisionVerified =
    critiqueStrongEnough &&
    comparatorCloseEnough &&
    challengerBreadthVerified &&
    challengerDominatesMaterially;

  const verdict:
    DeliberationGateVerdict =
    revisionVerified
      ? "challenger_verified"
      : "winner_verified";

  return {
    available: true,

    shadowMode: true,

    verdict,

    originalWinnerStrategyId:
      winner.future
        .strategyId,

    originalWinnerStrategyTitle:
      winner.future
        .strategyTitle ??
      winner.future
        .strategyId,

    challengerStrategyId:
      challenger.future
        .strategyId,

    challengerStrategyTitle:
      challenger.future
        .strategyTitle ??
      challenger.future
        .strategyId,

    comparatorScoreGap:
      round(
        scoreGap,
        2,
      ),

    selfCritiqueNetChallenge:
      selfCritique
        .netChallenge,

    materialChallengerAdvantages:
      challengerAdvantages,

    materialWinnerAdvantages:
      winnerAdvantages,

    revisionVerified,

    /**
     * Shadow recommendation only.
     *
     * The production FutureComparison remains untouched.
     */
    recommendedStrategyId:
      revisionVerified
        ? challenger.future
            .strategyId
        : winner.future
            .strategyId,

    summary:
      revisionVerified
        ? `Second-pass deliberation verified "${challenger.future.strategyTitle ?? challenger.future.strategyId}" as a credible revision candidate, but shadow mode preserved the production winner "${winner.future.strategyTitle ?? winner.future.strategyId}".`
        : `Second-pass deliberation challenged "${winner.future.strategyTitle ?? winner.future.strategyId}" but did not verify enough evidence to replace the production winner.`,

    integrity: {
      winnerIdentityMatches,

      challengerIdentityMatches,

      rankedFuturesAvailable,

      passed: true,
    },

    generatedAt,
  };
}