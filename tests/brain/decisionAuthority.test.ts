import assert from "node:assert/strict";

import {
  evaluateDecisionAuthority,
} from "@/lib/brain/reasoning/decisionAuthority";

import type {
  DecisionArbitrationResult,
} from "@/lib/brain/reasoning/decisionArbitrator";

import type {
  DecisionStabilityResult,
  DecisionStabilityGroupSummary,
} from "@/lib/brain/reasoning/decisionStability";

function group(
  retentionRate: number,
): DecisionStabilityGroupSummary {
  return {
    configuredCaseCount: 4,
    executedCaseCount: 4,
    stableCaseCount:
      Math.round(
        retentionRate * 4,
      ),
    flipCount:
      4 -
      Math.round(
        retentionRate * 4,
      ),
    retentionRate,
  };
}

function arbitration(
  overrides:
    Partial<DecisionArbitrationResult> = {},
): DecisionArbitrationResult {
  return {
    available: true,

    shadowMode: true,

    verdict:
      "production_winner_preserved",

    productionWinnerStrategyId:
      "strategy-current",

    productionWinnerStrategyTitle:
      "Current Strategy",

    shadowSelectedStrategyId:
      "strategy-current",

    shadowSelectedStrategyTitle:
      "Current Strategy",

    changedFromProduction:
      false,

    selfCritiqueVerdict:
      "reaffirmed",

    deliberationGateVerdict:
      "not_required",

    revisionVerified:
      false,

    reason:
      null,

    supportingSignals: [],

    integrity: {
      rankedWinnerMatchesComparator:
        true,

      critiqueWinnerMatchesProduction:
        true,

      gateWinnerMatchesProduction:
        true,

      shadowSelectionExistsInRankedFutures:
        true,

      productionWinnerPreserved:
        true,

      passed:
        true,
    },

    generatedAt:
      new Date().toISOString(),

    ...overrides,
  };
}

function stability(
  overrides:
    Partial<DecisionStabilityResult> = {},
): DecisionStabilityResult {
  return {
    available: true,

    shadowMode: true,

    verdict:
      "stable",

    stabilityVerified:
      true,

    baselineProductionWinnerStrategyId:
      "strategy-current",

    baselineShadowSelectedStrategyId:
      "strategy-current",

    baselineShadowSelectedStrategyTitle:
      "Current Strategy",

    strongestCompetitorStrategyId:
      "strategy-challenger",

    strongestCompetitorStrategyTitle:
      "Challenger Strategy",

    totalConfiguredCases:
      15,

    executedCaseCount:
      15,

    stableCaseCount:
      15,

    flipCount:
      0,

    integrityFailureCount:
      0,

    retentionRate:
      1,

    winnerAdverse:
      group(1),

    winnerSupportive:
      group(1),

    competitorPressure:
      group(1),

    cases: [],

    summary:
      null,

    generatedAt:
      new Date().toISOString(),

    ...overrides,
  };
}

/*
 * CASE 1:
 * No revision is proposed.
 * Production winner must remain preserved.
 */

const preserved =
  evaluateDecisionAuthority(
    arbitration(),
    stability(),
  );

assert.equal(
  preserved.verdict,
  "production_winner_preserved",
);

assert.equal(
  preserved.productionAuthorityGranted,
  false,
);

assert.equal(
  preserved.authorityEligibleInShadow,
  false,
);

assert.equal(
  preserved.integrity.passed,
  true,
);

/*
 * CASE 2:
 * Challenger passed arbitration,
 * but stability failed.
 * Authority must remain blocked.
 */

const unstableRevision =
  evaluateDecisionAuthority(
    arbitration({
      verdict:
        "challenger_shadow_selected",

      shadowSelectedStrategyId:
        "strategy-challenger",

      shadowSelectedStrategyTitle:
        "Challenger Strategy",

      changedFromProduction:
        true,

      revisionVerified:
        true,

      selfCritiqueVerdict:
        "revision_recommended",

      deliberationGateVerdict:
        "challenger_verified",
    }),

    stability({
      verdict:
        "fragile",

      stabilityVerified:
        false,

      baselineShadowSelectedStrategyId:
        "strategy-challenger",

      baselineShadowSelectedStrategyTitle:
        "Challenger Strategy",

      stableCaseCount:
        5,

      flipCount:
        10,

      retentionRate:
        0.3333,

      winnerAdverse:
        group(0.25),

      winnerSupportive:
        group(1),

      competitorPressure:
        group(0.25),
    }),
  );

assert.equal(
  unstableRevision.verdict,
  "revision_blocked_unstable",
);

assert.equal(
  unstableRevision.revisionVerified,
  true,
);

assert.equal(
  unstableRevision.stabilityVerified,
  false,
);

assert.equal(
  unstableRevision.authorityEligibleInShadow,
  false,
);

assert.equal(
  unstableRevision.productionAuthorityGranted,
  false,
);

/*
 * CASE 3:
 * Challenger passed arbitration AND stability.
 *
 * It becomes eligible in shadow mode,
 * but still receives no production authority.
 */

const eligibleRevision =
  evaluateDecisionAuthority(
    arbitration({
      verdict:
        "challenger_shadow_selected",

      shadowSelectedStrategyId:
        "strategy-challenger",

      shadowSelectedStrategyTitle:
        "Challenger Strategy",

      changedFromProduction:
        true,

      revisionVerified:
        true,

      selfCritiqueVerdict:
        "revision_recommended",

      deliberationGateVerdict:
        "challenger_verified",
    }),

    stability({
      verdict:
        "stable",

      stabilityVerified:
        true,

      baselineShadowSelectedStrategyId:
        "strategy-challenger",

      baselineShadowSelectedStrategyTitle:
        "Challenger Strategy",
    }),
  );

assert.equal(
  eligibleRevision.verdict,
  "revision_eligible",
);

assert.equal(
  eligibleRevision.revisionVerified,
  true,
);

assert.equal(
  eligibleRevision.stabilityVerified,
  true,
);

assert.equal(
  eligibleRevision.authorityEligibleInShadow,
  true,
);

/*
 * Critical safety invariant:
 * even an eligible revision cannot yet act in production.
 */
assert.equal(
  eligibleRevision.productionAuthorityGranted,
  false,
);

assert.equal(
  eligibleRevision.shadowMode,
  true,
);

/*
 * CASE 4:
 * Arbitration and Stability disagree about
 * the production winner.
 * Must fail closed.
 */

const integrityFailure =
  evaluateDecisionAuthority(
    arbitration(),

    stability({
      baselineProductionWinnerStrategyId:
        "strategy-different",
    }),
  );

assert.equal(
  integrityFailure.verdict,
  "integrity_failed",
);

assert.equal(
  integrityFailure.authorityEligibleInShadow,
  false,
);

assert.equal(
  integrityFailure.productionAuthorityGranted,
  false,
);

assert.equal(
  integrityFailure.integrity.passed,
  false,
);

/*
 * CASE 5:
 * Missing evidence must fail closed.
 */

const missingEvidence =
  evaluateDecisionAuthority(
    null,
    null,
  );

assert.equal(
  missingEvidence.verdict,
  "insufficient_evidence",
);

assert.equal(
  missingEvidence.available,
  false,
);

assert.equal(
  missingEvidence.authorityEligibleInShadow,
  false,
);

assert.equal(
  missingEvidence.productionAuthorityGranted,
  false,
);

console.log(
  "✓ Brain Decision Authority regression test passed",
);

console.log({
  preservedDecision: {
    verdict:
      preserved.verdict,
    authorityGranted:
      preserved.productionAuthorityGranted,
  },

  unstableRevision: {
    verdict:
      unstableRevision.verdict,
    revisionVerified:
      unstableRevision.revisionVerified,
    stabilityVerified:
      unstableRevision.stabilityVerified,
  },

  eligibleRevision: {
    verdict:
      eligibleRevision.verdict,
    shadowEligible:
      eligibleRevision.authorityEligibleInShadow,
    productionAuthorityStillBlocked:
      !eligibleRevision.productionAuthorityGranted,
  },

  integrityFailureFailsClosed:
    integrityFailure.verdict ===
    "integrity_failed",

  missingEvidenceFailsClosed:
    missingEvidence.verdict ===
    "insufficient_evidence",
});