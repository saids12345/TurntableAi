import type {
  FutureComparison,
  RankedFuture,
} from "./futureComparator";

export type SelfCritiqueVerdict =
  | "reaffirmed"
  | "revision_recommended"
  | "insufficient_comparison";

export interface SelfCritiqueDriver {
  label: string;

  contribution: number;

  detail: string;
}

export interface BrainSelfCritique {
  available: boolean;

  verdict: SelfCritiqueVerdict;

  winnerStrategyId:
    | string
    | null;

  winnerStrategyTitle:
    | string
    | null;

  challengerStrategyId:
    | string
    | null;

  challengerStrategyTitle:
    | string
    | null;

  winnerScore:
    | number
    | null;

  challengerScore:
    | number
    | null;

  scoreGap:
    | number
    | null;

  challengeScore: number;

  defenseScore: number;

  netChallenge: number;

  revisionCandidateStrategyId:
    | string
    | null;

  primaryChallenge:
    | SelfCritiqueDriver
    | null;

  secondaryChallenge:
    | SelfCritiqueDriver
    | null;

  primaryDefense:
    | SelfCritiqueDriver
    | null;

  concerns: string[];

  defenses: string[];

  summary: string;

  generatedAt: string;
}

function clamp(
  value: number,
  min = 0,
  max = 1,
) {
  return Math.min(
    max,
    Math.max(
      min,
      value,
    ),
  );
}

function round(
  value: number,
  digits = 2,
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
  return clamp(
    typeof value ===
      "number" &&
    Number.isFinite(value)
      ? value
      : fallback,
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

  const values = [
    impact.revenue,
    impact.guestExperience,
    impact.operations,
  ];

  const negative =
    values
      .filter(
        (value) =>
          value < 0,
      )
      .map(
        (value) =>
          Math.abs(value),
      );

  if (
    negative.length ===
    0
  ) {
    return 0;
  }

  return clamp(
    negative.reduce(
      (sum, value) =>
        sum + value,
      0,
    ) /
      negative.length,
  );
}

function sortDrivers(
  drivers:
    SelfCritiqueDriver[],
) {
  return drivers
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
}

/**
 * Shadow-mode adversarial review of the Brain's
 * current Future Comparator winner.
 *
 * IMPORTANT:
 * This function does NOT change the production winner.
 * It only determines whether the current decision appears
 * robust enough to reaffirm or fragile enough to deserve
 * another decision pass.
 */
export function critiqueFutureDecision(
  comparison:
    | FutureComparison
    | null
    | undefined,
): BrainSelfCritique {
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
    ranked[0] ?? null;

  const challenger =
    ranked[1] ?? null;

  if (
    !winner ||
    !challenger
  ) {
    return {
      available: false,

      verdict:
        "insufficient_comparison",

      winnerStrategyId:
        winner?.future
          .strategyId ??
        null,

      winnerStrategyTitle:
        winner?.future
          .strategyTitle ??
        null,

      challengerStrategyId:
        null,

      challengerStrategyTitle:
        null,

      winnerScore:
        winner?.score ??
        null,

      challengerScore:
        null,

      scoreGap:
        null,

      challengeScore: 0,

      defenseScore: 0,

      netChallenge: 0,

      revisionCandidateStrategyId:
        null,

      primaryChallenge:
        null,

      secondaryChallenge:
        null,

      primaryDefense:
        null,

      concerns: [],

      defenses: [],

      summary:
        "Self-critique requires at least two simulated futures.",

      generatedAt,
    };
  }

  const scoreGap =
    Math.max(
      0,
      winner.score -
        challenger.score,
    );

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
  
  const winnerUnknownCount =
    winner.future
      .unknowns?.length ??
    0;
  
  const challengerUnknownCount =
    challenger.future
      .unknowns?.length ??
    0;
  
  const winnerAssumptionCount =
    winner.future
      .assumptions?.length ??
    0;
  
  const challengerAssumptionCount =
    challenger.future
      .assumptions?.length ??
    0;
  
  const winnerWorstCaseRisk =
    getWorstCaseRisk(
      winner,
    );
  
  const challengerWorstCaseRisk =
    getWorstCaseRisk(
      challenger,
    );
  
  const winnerNegativeWorstCaseImpact =
    getNegativeWorstCaseImpact(
      winner,
    );
  
  const challengerNegativeWorstCaseImpact =
    getNegativeWorstCaseImpact(
      challenger,
    );
  
  /**
   * Self-Critique is intentionally comparative.
   *
   * The question is not simply:
   * "Does the winner have risk?"
   *
   * The stronger question is:
   * "Does the challenger materially outperform
   * the winner on an important dimension?"
   */
  const challengeDrivers:
    SelfCritiqueDriver[] = [
      {
        label:
          "Narrow winning margin",
  
        contribution:
          Math.max(
            0,
            10 -
              scoreGap *
                1.5,
          ),
  
        detail:
          `The winner leads by only ${round(
            scoreGap,
          )} comparator points.`,
      },
  
      {
        label:
          "Challenger confidence advantage",
  
        contribution:
          Math.max(
            0,
            challengerConfidence -
              winnerConfidence,
          ) *
          30,
  
        detail:
          "The challenger has higher simulated confidence.",
      },
  
      {
        label:
          "Challenger risk advantage",
  
        contribution:
          Math.max(
            0,
            winnerRisk -
              challengerRisk,
          ) *
          28,
  
        detail:
          `The challenger reduces expected risk by ${round(
            Math.max(
              0,
              winnerRisk -
                challengerRisk,
            ) * 100,
            1,
          )} percentage points.`,
      },
  
      {
        label:
          "Challenger worst-case risk advantage",
  
        contribution:
          Math.max(
            0,
            winnerWorstCaseRisk -
              challengerWorstCaseRisk,
          ) *
          24,
  
        detail:
          `The challenger reduces worst-case risk by ${round(
            Math.max(
              0,
              winnerWorstCaseRisk -
                challengerWorstCaseRisk,
            ) * 100,
            1,
          )} percentage points.`,
      },
  
      {
        label:
          "Challenger downside-impact advantage",
  
        contribution:
          Math.max(
            0,
            winnerNegativeWorstCaseImpact -
              challengerNegativeWorstCaseImpact,
          ) *
          20,
  
        detail:
          "The challenger produces a less damaging worst-case impact profile.",
      },
  
      {
        label:
          "Challenger evidence advantage",
  
        contribution:
          Math.max(
            0,
            challengerEvidence -
              winnerEvidence,
          ) *
          20,
  
        detail:
          "The challenger has stronger evidence coverage.",
      },
  
      {
        label:
          "Challenger uncertainty advantage",
  
        contribution:
          Math.max(
            0,
            winnerUncertainty -
              challengerUncertainty,
          ) *
          20,
  
        detail:
          "The challenger carries less unresolved uncertainty.",
      },
  
      {
        label:
          "Challenger unknown reduction",
  
        contribution:
          Math.max(
            0,
            winnerUnknownCount -
              challengerUnknownCount,
          ) *
          2.5,
  
        detail:
          "The challenger depends on fewer unresolved unknowns.",
      },
  
      {
        label:
          "Challenger assumption reduction",
  
        contribution:
          Math.max(
            0,
            winnerAssumptionCount -
              challengerAssumptionCount,
          ) *
          1.75,
  
        detail:
          "The challenger depends on fewer assumptions.",
      },
    ];
  
  const defenseDrivers:
    SelfCritiqueDriver[] = [
      {
        label:
          "Winning score margin",
  
        contribution:
          Math.min(
            18,
            scoreGap *
              1.8,
          ),
  
        detail:
          `The winner leads by ${round(
            scoreGap,
          )} comparator points.`,
      },
  
      {
        label:
          "Winner confidence advantage",
  
        contribution:
          Math.max(
            0,
            winnerConfidence -
              challengerConfidence,
          ) *
          30,
  
        detail:
          "The winner has higher simulated confidence.",
      },
  
      {
        label:
          "Winner risk advantage",
  
        contribution:
          Math.max(
            0,
            challengerRisk -
              winnerRisk,
          ) *
          28,
  
        detail:
          "The winner carries lower expected risk.",
      },
  
      {
        label:
          "Winner worst-case risk advantage",
  
        contribution:
          Math.max(
            0,
            challengerWorstCaseRisk -
              winnerWorstCaseRisk,
          ) *
          24,
  
        detail:
          "The winner carries lower worst-case risk.",
      },
  
      {
        label:
          "Winner downside-impact advantage",
  
        contribution:
          Math.max(
            0,
            challengerNegativeWorstCaseImpact -
              winnerNegativeWorstCaseImpact,
          ) *
          20,
  
        detail:
          "The winner has the stronger worst-case impact profile.",
      },
  
      {
        label:
          "Winner evidence advantage",
  
        contribution:
          Math.max(
            0,
            winnerEvidence -
              challengerEvidence,
          ) *
          20,
  
        detail:
          "The winner has stronger evidence coverage.",
      },
  
      {
        label:
          "Winner uncertainty advantage",
  
        contribution:
          Math.max(
            0,
            challengerUncertainty -
              winnerUncertainty,
          ) *
          20,
  
        detail:
          "The winner carries less unresolved uncertainty.",
      },
  
      {
        label:
          "Winner unknown reduction",
  
        contribution:
          Math.max(
            0,
            challengerUnknownCount -
              winnerUnknownCount,
          ) *
          2.5,
  
        detail:
          "The winner depends on fewer unresolved unknowns.",
      },
  
      {
        label:
          "Winner assumption reduction",
  
        contribution:
          Math.max(
            0,
            challengerAssumptionCount -
              winnerAssumptionCount,
          ) *
          1.75,
  
        detail:
          "The winner depends on fewer assumptions.",
      },
    ];

  const rankedChallenges =
    sortDrivers(
      challengeDrivers,
    );

  const rankedDefenses =
    sortDrivers(
      defenseDrivers,
    );

  const challengeScore =
    round(
      rankedChallenges.reduce(
        (sum, driver) =>
          sum +
          driver.contribution,
        0,
      ),
    );

  const defenseScore =
    round(
      rankedDefenses.reduce(
        (sum, driver) =>
          sum +
          driver.contribution,
        0,
      ),
    );

  const netChallenge =
    round(
      challengeScore -
        defenseScore,
    );

  /**
   * Conservative shadow-mode threshold.
   *
   * Self-Critique only recommends reconsideration when
   * concerns materially outweigh the defenses.
   *
   * It still does NOT change the winner.
   */
  const revisionRecommended =
    netChallenge >= 12;

  const verdict:
    SelfCritiqueVerdict =
    revisionRecommended
      ? "revision_recommended"
      : "reaffirmed";

  const winnerTitle =
    winner.future
      .strategyTitle ??
    winner.future
      .strategyId;

  const challengerTitle =
    challenger.future
      .strategyTitle ??
    challenger.future
      .strategyId;

  return {
    available: true,

    verdict,

    winnerStrategyId:
      winner.future
        .strategyId,

    winnerStrategyTitle:
      winnerTitle,

    challengerStrategyId:
      challenger.future
        .strategyId,

    challengerStrategyTitle:
      challengerTitle,

    winnerScore:
      winner.score,

    challengerScore:
      challenger.score,

    scoreGap:
      round(
        scoreGap,
      ),

    challengeScore,

    defenseScore,

    netChallenge,

    revisionCandidateStrategyId:
      revisionRecommended
        ? challenger.future
            .strategyId
        : null,

    primaryChallenge:
      rankedChallenges[0] ??
      null,

    secondaryChallenge:
      rankedChallenges[1] ??
      null,

    primaryDefense:
      rankedDefenses[0] ??
      null,

    concerns:
      rankedChallenges
        .slice(
          0,
          4,
        )
        .map(
          (driver) =>
            driver.detail,
        ),

    defenses:
      rankedDefenses
        .slice(
          0,
          3,
        )
        .map(
          (driver) =>
            driver.detail,
        ),

    summary:
      revisionRecommended
        ? `Self-Critique found the current winner "${winnerTitle}" fragile enough to challenge. "${challengerTitle}" should receive another decision pass before the Brain acts.`
        : `Self-Critique challenged "${winnerTitle}" and found the current decision strong enough to reaffirm.`,

    generatedAt,
  };
}