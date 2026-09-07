import assert from "node:assert/strict";

import {
  arbitrateDecision,
} from "@/lib/brain/reasoning/decisionArbitrator";

import {
  critiqueFutureDecision,
} from "@/lib/brain/reasoning/selfCritique";

import {
  runDeliberationGate,
} from "@/lib/brain/reasoning/deliberationGate";

import type {
  FutureComparison,
  RankedFuture,
} from "@/lib/brain/reasoning/futureComparator";

function makeRankedFuture(
  params: {
    rank: number;
    score: number;
    strategyId: string;
    strategyTitle: string;
    confidence: number;
    evidenceCoverage: number;
    uncertainty: number;
    expectedRisk: number;
    worstCaseRisk: number;
    worstRevenue: number;
    worstGuest: number;
    worstOperations: number;
    unknowns?: string[];
    assumptions?: string[];
  },
): RankedFuture {
  return {
    rank:
      params.rank,

    score:
      params.score,

    status:
      params.rank === 1
        ? "preferred"
        : "competitive",

    future: {
      strategyId:
        params.strategyId,

      strategyTitle:
        params.strategyTitle,

      summary:
        `${params.strategyTitle} simulated future.`,

      confidence:
        params.confidence,

      expectedRevenueImpact:
        0.1,

      expectedGuestExperienceImpact:
        0.1,

      expectedOperationalImpact:
        0.1,

      expectedRisk:
        params.expectedRisk,

      evidenceCoverage:
        params.evidenceCoverage,

      uncertainty:
        params.uncertainty,

      unknowns:
        params.unknowns ?? [],

      assumptions:
        params.assumptions ?? [],

      worstCase: {
        name:
          "worst_case",

        probability:
          0.2,

        summary:
          `Worst case for ${params.strategyTitle}.`,

        impact: {
          revenue:
            params.worstRevenue,

          guestExperience:
            params.worstGuest,

          operations:
            params.worstOperations,
        },

        risk:
          params.worstCaseRisk,

        assumptions: [],
      },
    },

    breakdown: {
      expectedValue:
        0.5,

      confidenceAdjustedImpact:
        0.5,

      downsideProtection:
        1 -
        params.expectedRisk,

      robustness:
        0.5,

      impactBalance:
        0.5,

      evidenceQuality:
        params.evidenceCoverage,

      decisionModeFit:
        0.5,

      riskPenalty:
        0,

      scenarioPenalty:
        0,

      unknownPenalty:
        0,

      assumptionPenalty:
        0,

      total:
        params.score,
    },

    strengths: [],

    tradeoffs: [],
  };
}

function makeComparison(
  winner:
    RankedFuture,
  challenger:
    RankedFuture,
): FutureComparison {
  return {
    best:
      winner.future,

    alternatives: [
      challenger.future,
    ],

    reasoning: [],

    rankedFutures: [
      winner,
      challenger,
    ],

    bestScore:
      winner.score,

    scoreGap:
      winner.score -
      challenger.score,

    decisionConfidence:
      winner.future
        .confidence,

    tradeoffs: [],

    warnings: [],
  };
}

/*
 * ==========================================================
 * CASE 1
 *
 * Strong production winner.
 *
 * Self-Critique reaffirms it.
 * Deliberation is not required.
 * Arbitration must preserve it.
 * ==========================================================
 */

const strongWinner =
  makeRankedFuture({
    rank: 1,

    score: 80,

    strategyId:
      "strategy-strong",

    strategyTitle:
      "Strong Current Strategy",

    confidence:
      0.9,

    evidenceCoverage:
      0.9,

    uncertainty:
      0.1,

    expectedRisk:
      0.1,

    worstCaseRisk:
      0.2,

    worstRevenue:
      -0.1,

    worstGuest:
      -0.1,

    worstOperations:
      -0.1,

    unknowns: [],

    assumptions: [],
  });

const weakerChallenger =
  makeRankedFuture({
    rank: 2,

    score: 65,

    strategyId:
      "strategy-weaker",

    strategyTitle:
      "Weaker Challenger",

    confidence:
      0.7,

    evidenceCoverage:
      0.7,

    uncertainty:
      0.3,

    expectedRisk:
      0.3,

    worstCaseRisk:
      0.4,

    worstRevenue:
      -0.3,

    worstGuest:
      -0.3,

    worstOperations:
      -0.3,

    unknowns: [
      "unknown-a",
    ],

    assumptions: [
      "assumption-a",
    ],
  });

const strongComparison =
  makeComparison(
    strongWinner,
    weakerChallenger,
  );

const strongCritique =
  critiqueFutureDecision(
    strongComparison,
  );

const strongGate =
  runDeliberationGate(
    strongComparison,
    strongCritique,
  );

const strongWinnerBefore =
  strongComparison.best
    .strategyId;

const strongArbitration =
  arbitrateDecision(
    strongComparison,
    strongCritique,
    strongGate,
  );

assert.equal(
  strongCritique.verdict,
  "reaffirmed",
);

assert.equal(
  strongGate.verdict,
  "not_required",
);

assert.equal(
  strongArbitration.available,
  true,
);

assert.equal(
  strongArbitration.shadowMode,
  true,
);

assert.equal(
  strongArbitration.verdict,
  "production_winner_preserved",
);

assert.equal(
  strongArbitration
    .productionWinnerStrategyId,
  "strategy-strong",
);

assert.equal(
  strongArbitration
    .shadowSelectedStrategyId,
  "strategy-strong",
);

assert.equal(
  strongArbitration
    .changedFromProduction,
  false,
);

assert.equal(
  strongArbitration
    .revisionVerified,
  false,
);

assert.equal(
  strongArbitration
    .integrity.passed,
  true,
);

/*
 * Shadow arbitration must never mutate
 * FutureComparison.best.
 */
assert.equal(
  strongComparison.best
    .strategyId,
  strongWinnerBefore,
);

/*
 * ==========================================================
 * CASE 2
 *
 * Fragile comparator winner.
 *
 * Self-Critique recommends revision.
 * Deliberation verifies the challenger.
 * Arbitration may SHADOW-SELECT challenger,
 * but production winner must remain unchanged.
 * ==========================================================
 */

const fragileWinner =
  makeRankedFuture({
    rank: 1,

    score: 60,

    strategyId:
      "strategy-fragile",

    strategyTitle:
      "Fragile Winner",

    confidence:
      0.7,

    evidenceCoverage:
      0.6,

    uncertainty:
      0.5,

    expectedRisk:
      0.65,

    worstCaseRisk:
      0.8,

    worstRevenue:
      -0.6,

    worstGuest:
      -0.5,

    worstOperations:
      -0.5,

    unknowns: [
      "unknown-a",
      "unknown-b",
      "unknown-c",
    ],

    assumptions: [
      "assumption-a",
      "assumption-b",
      "assumption-c",
    ],
  });

const saferChallenger =
  makeRankedFuture({
    rank: 2,

    score: 59.5,

    strategyId:
      "strategy-safer",

    strategyTitle:
      "Safer Challenger",

    confidence:
      0.8,

    evidenceCoverage:
      0.8,

    uncertainty:
      0.2,

    expectedRisk:
      0.15,

    worstCaseRisk:
      0.2,

    worstRevenue:
      -0.1,

    worstGuest:
      -0.1,

    worstOperations:
      -0.1,

    unknowns: [],

    assumptions: [],
  });

const fragileComparison =
  makeComparison(
    fragileWinner,
    saferChallenger,
  );

const fragileCritique =
  critiqueFutureDecision(
    fragileComparison,
  );

const fragileGate =
  runDeliberationGate(
    fragileComparison,
    fragileCritique,
  );

assert.equal(
  fragileCritique.verdict,
  "revision_recommended",
);

assert.equal(
  fragileCritique
    .revisionCandidateStrategyId,
  "strategy-safer",
);

assert.equal(
  fragileGate.verdict,
  "challenger_verified",
);

assert.equal(
  fragileGate.revisionVerified,
  true,
);

const fragileWinnerBefore =
  fragileComparison.best
    .strategyId;

const fragileArbitration =
  arbitrateDecision(
    fragileComparison,
    fragileCritique,
    fragileGate,
  );

assert.equal(
  fragileArbitration.available,
  true,
);

assert.equal(
  fragileArbitration.shadowMode,
  true,
);

assert.equal(
  fragileArbitration.verdict,
  "challenger_shadow_selected",
);

assert.equal(
  fragileArbitration
    .productionWinnerStrategyId,
  "strategy-fragile",
);

assert.equal(
  fragileArbitration
    .shadowSelectedStrategyId,
  "strategy-safer",
);

assert.equal(
  fragileArbitration
    .changedFromProduction,
  true,
);

assert.equal(
  fragileArbitration
    .revisionVerified,
  true,
);

assert.equal(
  fragileArbitration
    .integrity.passed,
  true,
);

/*
 * THE CRITICAL SAFETY INVARIANT:
 *
 * The Brain may conclude in shadow mode that
 * the challenger deserves the decision,
 * but production selection remains untouched.
 */
assert.equal(
  fragileComparison.best
    .strategyId,
  fragileWinnerBefore,
);

assert.equal(
  fragileComparison.best
    .strategyId,
  "strategy-fragile",
);

/*
 * ==========================================================
 * CASE 3
 *
 * Cross-layer winner identity disagreement.
 *
 * Arbitration must fail closed.
 * ==========================================================
 */

const corruptedGate = {
  ...fragileGate,

  originalWinnerStrategyId:
    "strategy-wrong-winner",
};

const corruptedArbitration =
  arbitrateDecision(
    fragileComparison,
    fragileCritique,
    corruptedGate,
  );

assert.equal(
  corruptedArbitration.verdict,
  "integrity_failed",
);

assert.equal(
  corruptedArbitration
    .changedFromProduction,
  false,
);

assert.equal(
  corruptedArbitration
    .revisionVerified,
  false,
);

assert.equal(
  corruptedArbitration
    .shadowSelectedStrategyId,
  "strategy-fragile",
);

assert.equal(
  corruptedArbitration
    .integrity.passed,
  false,
);

assert.equal(
  fragileComparison.best
    .strategyId,
  "strategy-fragile",
);

/*
 * ==========================================================
 * CASE 4
 *
 * Missing comparison.
 *
 * Arbitration must fail closed because there
 * is no trustworthy production winner.
 * ==========================================================
 */

const missingComparisonArbitration =
  arbitrateDecision(
    null,
    fragileCritique,
    fragileGate,
  );

assert.equal(
  missingComparisonArbitration
    .available,
  false,
);

assert.equal(
  missingComparisonArbitration
    .verdict,
  "insufficient_evidence",
);

assert.equal(
  missingComparisonArbitration
    .changedFromProduction,
  false,
);

assert.equal(
  missingComparisonArbitration
    .revisionVerified,
  false,
);

assert.equal(
  missingComparisonArbitration
    .integrity.passed,
  false,
);

console.log(
  "✓ Brain Decision Arbitration regression test passed",
);

console.log({
  normalDecision: {
    verdict:
      strongArbitration.verdict,

    productionWinner:
      strongArbitration
        .productionWinnerStrategyId,

    shadowWinner:
      strongArbitration
        .shadowSelectedStrategyId,

    productionWinnerPreserved:
      strongComparison.best
        .strategyId ===
      "strategy-strong",
  },

  challengedDecision: {
    critiqueVerdict:
      fragileCritique.verdict,

    gateVerdict:
      fragileGate.verdict,

    arbitrationVerdict:
      fragileArbitration.verdict,

    productionWinner:
      fragileArbitration
        .productionWinnerStrategyId,

    shadowWinner:
      fragileArbitration
        .shadowSelectedStrategyId,

    changedInShadow:
      fragileArbitration
        .changedFromProduction,

    productionWinnerStillPreserved:
      fragileComparison.best
        .strategyId ===
      "strategy-fragile",
  },

  identityFailureFailsClosed:
    corruptedArbitration
      .verdict ===
    "integrity_failed",

  missingComparisonFailsClosed:
    missingComparisonArbitration
      .verdict ===
    "insufficient_evidence",
});