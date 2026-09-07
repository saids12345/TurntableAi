import assert from "node:assert/strict";

import {
  runDeliberationGate,
} from "@/lib/brain/reasoning/deliberationGate";

import {
  critiqueFutureDecision,
} from "@/lib/brain/reasoning/selfCritique";

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
 * CASE 1:
 * Self-Critique reaffirms the winner.
 *
 * The Deliberation Gate should therefore be
 * NOT REQUIRED.
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

assert.equal(
  strongCritique.verdict,
  "reaffirmed",
);

const strongWinnerBefore =
  strongComparison.best
    .strategyId;

const notRequiredGate =
  runDeliberationGate(
    strongComparison,
    strongCritique,
  );

assert.equal(
  notRequiredGate.available,
  true,
);

assert.equal(
  notRequiredGate.shadowMode,
  true,
);

assert.equal(
  notRequiredGate.verdict,
  "not_required",
);

assert.equal(
  notRequiredGate.revisionVerified,
  false,
);

assert.equal(
  notRequiredGate.recommendedStrategyId,
  "strategy-strong",
);

assert.equal(
  notRequiredGate.integrity.passed,
  true,
);

/*
 * Shadow-mode invariant:
 * running the gate cannot alter the production winner.
 */
assert.equal(
  strongComparison.best
    .strategyId,
  strongWinnerBefore,
);

/*
 * ==========================================================
 * CASE 2:
 * Self-Critique identifies a fragile winner.
 *
 * The challenger is close in comparator score and
 * materially superior across multiple risk/evidence
 * dimensions.
 *
 * The gate should VERIFY THE CHALLENGER,
 * but production comparison.best must remain untouched.
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

assert.equal(
  fragileCritique.verdict,
  "revision_recommended",
);

assert.equal(
  fragileCritique
    .revisionCandidateStrategyId,
  "strategy-safer",
);

const fragileWinnerBefore =
  fragileComparison.best
    .strategyId;

const challengerGate =
  runDeliberationGate(
    fragileComparison,
    fragileCritique,
  );

assert.equal(
  challengerGate.available,
  true,
);

assert.equal(
  challengerGate.shadowMode,
  true,
);

assert.equal(
  challengerGate.verdict,
  "challenger_verified",
);

assert.equal(
  challengerGate.revisionVerified,
  true,
);

assert.equal(
  challengerGate.recommendedStrategyId,
  "strategy-safer",
);

assert.equal(
  challengerGate.originalWinnerStrategyId,
  "strategy-fragile",
);

assert.equal(
  challengerGate.challengerStrategyId,
  "strategy-safer",
);

assert.equal(
  challengerGate.integrity.passed,
  true,
);

assert.ok(
  challengerGate
    .materialChallengerAdvantages
    .length >= 2,
);

assert.ok(
  challengerGate
    .materialChallengerAdvantages
    .length >
  challengerGate
    .materialWinnerAdvantages
    .length,
);

/*
 * Most important safety invariant:
 *
 * Even when the second pass verifies the challenger,
 * shadow mode MUST NOT change the production winner.
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
 * CASE 3:
 * Identity integrity failure must fail closed.
 *
 * We deliberately corrupt the Self-Critique winner identity.
 * The gate must refuse to verify a revision.
 * ==========================================================
 */

const corruptedCritique = {
  ...fragileCritique,

  winnerStrategyId:
    "strategy-wrong-winner",
};

const integrityGate =
  runDeliberationGate(
    fragileComparison,
    corruptedCritique,
  );

assert.equal(
  integrityGate.verdict,
  "integrity_failed",
);

assert.equal(
  integrityGate.revisionVerified,
  false,
);

assert.equal(
  integrityGate.recommendedStrategyId,
  null,
);

assert.equal(
  integrityGate.integrity.passed,
  false,
);

assert.equal(
  fragileComparison.best
    .strategyId,
  "strategy-fragile",
);

/*
 * ==========================================================
 * CASE 4:
 * Missing comparison must fail closed.
 * ==========================================================
 */

const missingComparisonGate =
  runDeliberationGate(
    null,
    fragileCritique,
  );

assert.equal(
  missingComparisonGate.available,
  false,
);

assert.equal(
  missingComparisonGate.verdict,
  "insufficient_evidence",
);

assert.equal(
  missingComparisonGate.revisionVerified,
  false,
);

assert.equal(
  missingComparisonGate.recommendedStrategyId,
  null,
);

console.log(
  "✓ Brain Second-Pass Deliberation Gate regression test passed",
);

console.log({
  notRequiredDecision: {
    verdict:
      notRequiredGate.verdict,

    productionWinnerPreserved:
      strongComparison.best
        .strategyId ===
      "strategy-strong",
  },

  challengedDecision: {
    selfCritiqueVerdict:
      fragileCritique.verdict,

    gateVerdict:
      challengerGate.verdict,

    revisionVerified:
      challengerGate
        .revisionVerified,

    shadowRecommendation:
      challengerGate
        .recommendedStrategyId,

    productionWinnerStillPreserved:
      fragileComparison.best
        .strategyId ===
      "strategy-fragile",

    challengerAdvantages:
      challengerGate
        .materialChallengerAdvantages
        .length,
  },

  integrityFailureFailsClosed:
    integrityGate.verdict ===
    "integrity_failed",

  missingComparisonFailsClosed:
    missingComparisonGate.verdict ===
    "insufficient_evidence",
});