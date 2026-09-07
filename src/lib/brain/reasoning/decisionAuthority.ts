import type {
  DecisionArbitrationResult,
} from "./decisionArbitrator";

import type {
  DecisionStabilityResult,
} from "./decisionStability";

export type DecisionAuthorityVerdict =
  | "production_winner_preserved"
  | "revision_eligible"
  | "revision_blocked_unstable"
  | "insufficient_evidence"
  | "integrity_failed";

export interface DecisionAuthorityResult {
  available: boolean;

  /**
   * IMPORTANT:
   *
   * This gate is still observational.
   * It does NOT grant real production authority.
   */
  shadowMode: true;

  productionAuthorityGranted: false;

  verdict:
    DecisionAuthorityVerdict;

  productionWinnerStrategyId:
    string | null;

  shadowSelectedStrategyId:
    string | null;

  changedFromProduction:
    boolean;

  revisionVerified:
    boolean;

  stabilityVerified:
    boolean;

  authorityEligibleInShadow:
    boolean;

  reason:
    string | null;

  integrity: {
    arbitrationPassed:
      boolean;

    arbitrationWinnerMatchesStability:
      boolean;

    arbitrationShadowMatchesStability:
      boolean;

    stabilityPassed:
      boolean;

    passed:
      boolean;
  };

  generatedAt: string;
}

export function evaluateDecisionAuthority(
  arbitration:
    | DecisionArbitrationResult
    | null
    | undefined,
  stability:
    | DecisionStabilityResult
    | null
    | undefined,
): DecisionAuthorityResult {
  const generatedAt =
    new Date().toISOString();

  const productionWinnerStrategyId =
    arbitration
      ?.productionWinnerStrategyId ??
    null;

  const shadowSelectedStrategyId =
    arbitration
      ?.shadowSelectedStrategyId ??
    null;

  if (
    !arbitration ||
    !stability ||
    !arbitration.available ||
    !stability.available
  ) {
    return {
      available: false,

      shadowMode: true,

      productionAuthorityGranted:
        false,

      verdict:
        "insufficient_evidence",

      productionWinnerStrategyId,

      shadowSelectedStrategyId,

      changedFromProduction:
        false,

      revisionVerified:
        false,

      stabilityVerified:
        false,

      authorityEligibleInShadow:
        false,

      reason:
        "Decision Authority requires valid arbitration and stability results.",

      integrity: {
        arbitrationPassed:
          false,

        arbitrationWinnerMatchesStability:
          false,

        arbitrationShadowMatchesStability:
          false,

        stabilityPassed:
          false,

        passed:
          false,
      },

      generatedAt,
    };
  }

  const arbitrationPassed =
    arbitration.integrity.passed;

  const stabilityPassed =
    stability.integrityFailureCount ===
      0;

  const arbitrationWinnerMatchesStability =
    arbitration
      .productionWinnerStrategyId ===
    stability
      .baselineProductionWinnerStrategyId;

  const arbitrationShadowMatchesStability =
    arbitration
      .shadowSelectedStrategyId ===
    stability
      .baselineShadowSelectedStrategyId;

  const integrityPassed =
    arbitrationPassed &&
    stabilityPassed &&
    arbitrationWinnerMatchesStability &&
    arbitrationShadowMatchesStability;

  if (!integrityPassed) {
    return {
      available: true,

      shadowMode: true,

      productionAuthorityGranted:
        false,

      verdict:
        "integrity_failed",

      productionWinnerStrategyId,

      shadowSelectedStrategyId,

      changedFromProduction:
        false,

      revisionVerified:
        false,

      stabilityVerified:
        false,

      authorityEligibleInShadow:
        false,

      reason:
        "Decision Authority detected inconsistent decision state and failed closed.",

      integrity: {
        arbitrationPassed,

        arbitrationWinnerMatchesStability,

        arbitrationShadowMatchesStability,

        stabilityPassed,

        passed:
          false,
      },

      generatedAt,
    };
  }

  /*
   * No revision is being proposed.
   *
   * The existing production winner remains untouched.
   */
  if (
    !arbitration
      .changedFromProduction
  ) {
    return {
      available: true,

      shadowMode: true,

      productionAuthorityGranted:
        false,

      verdict:
        "production_winner_preserved",

      productionWinnerStrategyId,

      shadowSelectedStrategyId,

      changedFromProduction:
        false,

      revisionVerified:
        false,

      stabilityVerified:
        stability
          .stabilityVerified,

      authorityEligibleInShadow:
        false,

      reason:
        "No verified revision displaced the production winner.",

      integrity: {
        arbitrationPassed,

        arbitrationWinnerMatchesStability,

        arbitrationShadowMatchesStability,

        stabilityPassed,

        passed:
          true,
      },

      generatedAt,
    };
  }

  const revisionVerified =
    arbitration.verdict ===
      "challenger_shadow_selected" &&
    arbitration
      .revisionVerified ===
      true;

  const stabilityVerified =
    stability.verdict ===
      "stable" &&
    stability
      .stabilityVerified ===
      true;

  /*
   * A changed recommendation becomes eligible
   * only if:
   *
   * 1. Arbitration verified the challenger.
   * 2. Stability testing verified the new choice.
   * 3. Cross-layer identity checks passed.
   *
   * Even then this remains shadow-only.
   */
  const authorityEligibleInShadow =
    revisionVerified &&
    stabilityVerified;

  if (
    !authorityEligibleInShadow
  ) {
    return {
      available: true,

      shadowMode: true,

      productionAuthorityGranted:
        false,

      verdict:
        "revision_blocked_unstable",

      productionWinnerStrategyId,

      shadowSelectedStrategyId,

      changedFromProduction:
        true,

      revisionVerified,

      stabilityVerified,

      authorityEligibleInShadow:
        false,

      reason:
        revisionVerified
          ? "The challenger passed revision verification but did not pass Decision Stability, so authority remains blocked."
          : "The proposed revision did not complete the full verification chain, so authority remains blocked.",

      integrity: {
        arbitrationPassed,

        arbitrationWinnerMatchesStability,

        arbitrationShadowMatchesStability,

        stabilityPassed,

        passed:
          true,
      },

      generatedAt,
    };
  }

  return {
    available: true,

    shadowMode: true,

    productionAuthorityGranted:
      false,

    verdict:
      "revision_eligible",

    productionWinnerStrategyId,

    shadowSelectedStrategyId,

    changedFromProduction:
      true,

    revisionVerified:
      true,

    stabilityVerified:
      true,

    authorityEligibleInShadow:
      true,

    reason:
      "The revised strategy passed arbitration, stability, and integrity checks and is eligible for authority in shadow mode only.",

    integrity: {
      arbitrationPassed,

      arbitrationWinnerMatchesStability,

      arbitrationShadowMatchesStability,

      stabilityPassed,

      passed:
        true,
    },

    generatedAt,
  };
}