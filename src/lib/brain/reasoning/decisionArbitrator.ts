import type {
  FutureComparison,
  RankedFuture,
} from "./futureComparator";

import type {
  BrainSelfCritique,
} from "./selfCritique";

import type {
  DeliberationGateResult,
} from "./deliberationGate";

export type DecisionArbitrationVerdict =
  | "production_winner_preserved"
  | "challenger_shadow_selected"
  | "insufficient_evidence"
  | "integrity_failed";

export interface DecisionArbitrationResult {
  available: boolean;

  /**
   * IMPORTANT:
   * Arbitration is observational only for now.
   * It does not change FutureComparison.best.
   */
  shadowMode: true;

  verdict:
    DecisionArbitrationVerdict;

  productionWinnerStrategyId:
    | string
    | null;

  productionWinnerStrategyTitle:
    | string
    | null;

  shadowSelectedStrategyId:
    | string
    | null;

  shadowSelectedStrategyTitle:
    | string
    | null;

  changedFromProduction: boolean;

  selfCritiqueVerdict:
    | BrainSelfCritique["verdict"]
    | null;

  deliberationGateVerdict:
    | DeliberationGateResult["verdict"]
    | null;

  revisionVerified: boolean;

  reason:
    | string
    | null;

  supportingSignals: string[];

  integrity: {
    rankedWinnerMatchesComparator: boolean;

    critiqueWinnerMatchesProduction: boolean;

    gateWinnerMatchesProduction: boolean;

    shadowSelectionExistsInRankedFutures: boolean;

    productionWinnerPreserved: boolean;

    passed: boolean;
  };

  generatedAt: string;
}

function findRankedFuture(
  rankedFutures:
    RankedFuture[],
  strategyId:
    | string
    | null
    | undefined,
) {
  if (!strategyId) {
    return null;
  }

  return (
    rankedFutures.find(
      (candidate) =>
        candidate.future
          .strategyId ===
        strategyId,
    ) ?? null
  );
}

/**
 * Final shadow arbitration layer.
 *
 * Production flow remains:
 *
 * Future Comparator
 *      ↓
 * Self-Critique
 *      ↓
 * Second-Pass Deliberation
 *      ↓
 * Decision Arbitration
 *
 * Decision Arbitration may identify a different
 * shadow winner, but it MUST NOT mutate the
 * production FutureComparison.
 */
export function arbitrateDecision(
  comparison:
    | FutureComparison
    | null
    | undefined,
  selfCritique:
    | BrainSelfCritique
    | null
    | undefined,
  deliberationGate:
    | DeliberationGateResult
    | null
    | undefined,
): DecisionArbitrationResult {
  const generatedAt =
    new Date().toISOString();

  const rankedFutures =
    comparison
      ?.rankedFutures
      ?.slice()
      .sort(
        (a, b) =>
          a.rank - b.rank,
      ) ?? [];

  const rankedWinner =
    rankedFutures[0] ??
    null;

  const comparatorWinner =
    comparison?.best ??
    null;

  const productionWinnerStrategyId =
    comparatorWinner
      ?.strategyId ??
    null;

  const productionWinnerStrategyTitle =
    comparatorWinner
      ?.strategyTitle ??
    comparatorWinner
      ?.strategyId ??
    null;

  /*
   * Without a valid production winner there is
   * nothing safe to arbitrate.
   */
  if (
    !comparison ||
    !rankedWinner ||
    !productionWinnerStrategyId
  ) {
    return {
      available: false,

      shadowMode: true,

      verdict:
        "insufficient_evidence",

      productionWinnerStrategyId,

      productionWinnerStrategyTitle,

      shadowSelectedStrategyId:
        productionWinnerStrategyId,

      shadowSelectedStrategyTitle:
        productionWinnerStrategyTitle,

      changedFromProduction:
        false,

      selfCritiqueVerdict:
        selfCritique
          ?.verdict ??
        null,

      deliberationGateVerdict:
        deliberationGate
          ?.verdict ??
        null,

      revisionVerified:
        false,

      reason:
        "Decision Arbitration requires a valid production Future Comparator winner.",

      supportingSignals: [],

      integrity: {
        rankedWinnerMatchesComparator:
          false,

        critiqueWinnerMatchesProduction:
          false,

        gateWinnerMatchesProduction:
          false,

        shadowSelectionExistsInRankedFutures:
          false,

        productionWinnerPreserved:
          true,

        passed:
          false,
      },

      generatedAt,
    };
  }

  const rankedWinnerMatchesComparator =
    rankedWinner.future
      .strategyId ===
    productionWinnerStrategyId;

  const critiqueWinnerMatchesProduction =
    !selfCritique?.winnerStrategyId ||
    selfCritique
      .winnerStrategyId ===
    productionWinnerStrategyId;

  const gateWinnerMatchesProduction =
    !deliberationGate
      ?.originalWinnerStrategyId ||
    deliberationGate
      .originalWinnerStrategyId ===
    productionWinnerStrategyId;

  /*
   * Fail closed if any cognitive layer disagrees
   * about which strategy was the original winner.
   */
  const identityIntegrityPassed =
    rankedWinnerMatchesComparator &&
    critiqueWinnerMatchesProduction &&
    gateWinnerMatchesProduction;

  if (!identityIntegrityPassed) {
    return {
      available: true,

      shadowMode: true,

      verdict:
        "integrity_failed",

      productionWinnerStrategyId,

      productionWinnerStrategyTitle,

      shadowSelectedStrategyId:
        productionWinnerStrategyId,

      shadowSelectedStrategyTitle:
        productionWinnerStrategyTitle,

      changedFromProduction:
        false,

      selfCritiqueVerdict:
        selfCritique
          ?.verdict ??
        null,

      deliberationGateVerdict:
        deliberationGate
          ?.verdict ??
        null,

      revisionVerified:
        false,

      reason:
        "Decision Arbitration detected disagreement about the production winner and therefore preserved the original recommendation.",

      supportingSignals: [],

      integrity: {
        rankedWinnerMatchesComparator,

        critiqueWinnerMatchesProduction,

        gateWinnerMatchesProduction,

        shadowSelectionExistsInRankedFutures:
          true,

        productionWinnerPreserved:
          true,

        passed:
          false,
      },

      generatedAt,
    };
  }

  /*
   * A challenger is eligible for shadow selection
   * only when BOTH independent safeguards agree:
   *
   * 1. Self-Critique recommends revision.
   * 2. Second-Pass Deliberation verifies it.
   */
  const challengerVerified =
    selfCritique?.verdict ===
      "revision_recommended" &&
    deliberationGate?.verdict ===
      "challenger_verified" &&
    deliberationGate
      .revisionVerified ===
      true;

  const proposedShadowStrategyId =
    challengerVerified
      ? deliberationGate
          ?.recommendedStrategyId ??
        null
      : productionWinnerStrategyId;

  const proposedShadowFuture =
    findRankedFuture(
      rankedFutures,
      proposedShadowStrategyId,
    );

  /*
   * A shadow challenger must still exist in the
   * exact current ranked-future set.
   *
   * Otherwise fail closed to the production winner.
   */
  const shadowSelectionExistsInRankedFutures =
    Boolean(
      proposedShadowFuture,
    );

  if (
    challengerVerified &&
    !proposedShadowFuture
  ) {
    return {
      available: true,

      shadowMode: true,

      verdict:
        "integrity_failed",

      productionWinnerStrategyId,

      productionWinnerStrategyTitle,

      shadowSelectedStrategyId:
        productionWinnerStrategyId,

      shadowSelectedStrategyTitle:
        productionWinnerStrategyTitle,

      changedFromProduction:
        false,

      selfCritiqueVerdict:
        selfCritique
          ?.verdict ??
        null,

      deliberationGateVerdict:
        deliberationGate
          ?.verdict ??
        null,

      revisionVerified:
        false,

      reason:
        "The verified challenger was not present in the current ranked future set, so Decision Arbitration preserved the production winner.",

      supportingSignals: [],

      integrity: {
        rankedWinnerMatchesComparator,

        critiqueWinnerMatchesProduction,

        gateWinnerMatchesProduction,

        shadowSelectionExistsInRankedFutures:
          false,

        productionWinnerPreserved:
          true,

        passed:
          false,
      },

      generatedAt,
    };
  }

  const changedFromProduction =
    Boolean(
      challengerVerified &&
      proposedShadowStrategyId &&
      proposedShadowStrategyId !==
        productionWinnerStrategyId,
    );

  const shadowSelectedStrategyId =
    changedFromProduction
      ? proposedShadowStrategyId
      : productionWinnerStrategyId;

  const shadowSelectedFuture =
    findRankedFuture(
      rankedFutures,
      shadowSelectedStrategyId,
    );

  const shadowSelectedStrategyTitle =
    shadowSelectedFuture
      ?.future
      .strategyTitle ??
    shadowSelectedFuture
      ?.future
      .strategyId ??
    productionWinnerStrategyTitle;

  const supportingSignals:
    string[] = [];

  if (
    selfCritique?.verdict ===
    "revision_recommended"
  ) {
    supportingSignals.push(
      `Self-Critique recommended reconsideration with net challenge ${selfCritique.netChallenge}.`,
    );
  }

  if (
    deliberationGate?.revisionVerified
  ) {
    supportingSignals.push(
      `Second-pass deliberation verified ${deliberationGate.materialChallengerAdvantages.length} material challenger advantage(s).`,
    );
  }

  if (
    typeof deliberationGate
      ?.comparatorScoreGap ===
      "number"
  ) {
    supportingSignals.push(
      `The production comparator gap was ${deliberationGate.comparatorScoreGap} points.`,
    );
  }

  if (!changedFromProduction) {
    supportingSignals.push(
      "No independently verified revision displaced the production winner.",
    );
  }

  /*
   * CRITICAL SHADOW-MODE INVARIANT:
   *
   * We only READ comparison.best.
   * We never mutate it.
   */
  const productionWinnerPreserved =
    comparison.best
      .strategyId ===
    productionWinnerStrategyId;

  const integrityPassed =
    rankedWinnerMatchesComparator &&
    critiqueWinnerMatchesProduction &&
    gateWinnerMatchesProduction &&
    shadowSelectionExistsInRankedFutures &&
    productionWinnerPreserved;

  if (!integrityPassed) {
    return {
      available: true,

      shadowMode: true,

      verdict:
        "integrity_failed",

      productionWinnerStrategyId,

      productionWinnerStrategyTitle,

      shadowSelectedStrategyId:
        productionWinnerStrategyId,

      shadowSelectedStrategyTitle:
        productionWinnerStrategyTitle,

      changedFromProduction:
        false,

      selfCritiqueVerdict:
        selfCritique
          ?.verdict ??
        null,

      deliberationGateVerdict:
        deliberationGate
          ?.verdict ??
        null,

      revisionVerified:
        false,

      reason:
        "Decision Arbitration failed its final integrity check and preserved the production winner.",

      supportingSignals: [],

      integrity: {
        rankedWinnerMatchesComparator,

        critiqueWinnerMatchesProduction,

        gateWinnerMatchesProduction,

        shadowSelectionExistsInRankedFutures,

        productionWinnerPreserved,

        passed:
          false,
      },

      generatedAt,
    };
  }

  return {
    available: true,

    shadowMode: true,

    verdict:
      changedFromProduction
        ? "challenger_shadow_selected"
        : "production_winner_preserved",

    productionWinnerStrategyId,

    productionWinnerStrategyTitle,

    shadowSelectedStrategyId,

    shadowSelectedStrategyTitle,

    changedFromProduction,

    selfCritiqueVerdict:
      selfCritique
        ?.verdict ??
      null,

    deliberationGateVerdict:
      deliberationGate
        ?.verdict ??
      null,

    revisionVerified:
      changedFromProduction,

    reason:
      changedFromProduction
        ? `Decision Arbitration verified "${shadowSelectedStrategyTitle}" as the Brain's shadow final choice after Self-Critique and second-pass deliberation, while preserving "${productionWinnerStrategyTitle}" as the production winner.`
        : `Decision Arbitration preserved "${productionWinnerStrategyTitle}" because no challenger completed the full revision-verification chain.`,

    supportingSignals,

    integrity: {
      rankedWinnerMatchesComparator,

      critiqueWinnerMatchesProduction,

      gateWinnerMatchesProduction,

      shadowSelectionExistsInRankedFutures,

      productionWinnerPreserved,

      passed:
        true,
    },

    generatedAt,
  };
}