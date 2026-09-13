import assert from "node:assert/strict";

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
    rank: params.rank,

    score: params.score,

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
        name: "worst_case",

        probability: 0.2,

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
      expectedValue: 0.5,

      confidenceAdjustedImpact:
        0.5,

      downsideProtection:
        1 - params.expectedRisk,

      robustness:
        0.5,

      impactBalance:
        0.5,

      evidenceQuality:
        params.evidenceCoverage,

      decisionModeFit:
        0.5,

      riskPenalty: 0,

      scenarioPenalty: 0,

      unknownPenalty: 0,

      assumptionPenalty: 0,

      total:
        params.score,
    },

    strengths: [],

    tradeoffs: [],
  };
}

function makeComparison(
  winner: RankedFuture,
  challenger: RankedFuture,
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
      winner.future.confidence,

    tradeoffs: [],

    warnings: [],
  };
}

/*
 * ==========================================================
 * CASE 1:
 * Strong winner should survive Self-Critique.
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

    confidence: 0.9,

    evidenceCoverage: 0.9,

    uncertainty: 0.1,

    expectedRisk: 0.1,

    worstCaseRisk: 0.2,

    worstRevenue: -0.1,

    worstGuest: -0.1,

    worstOperations: -0.1,

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

    confidence: 0.7,

    evidenceCoverage: 0.7,

    uncertainty: 0.3,

    expectedRisk: 0.3,

    worstCaseRisk: 0.4,

    worstRevenue: -0.3,

    worstGuest: -0.3,

    worstOperations: -0.3,

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

const strongWinnerBefore =
  strongComparison.best.strategyId;

const strongCritique =
  critiqueFutureDecision(
    strongComparison,
  );

assert.equal(
  strongCritique.available,
  true,
);

assert.equal(
  strongCritique.verdict,
  "reaffirmed",
);

assert.equal(
  strongCritique.revisionCandidateStrategyId,
  null,
);

assert.equal(
  strongComparison.best.strategyId,
  strongWinnerBefore,
);

assert.equal(
  strongComparison.best.strategyId,
  "strategy-strong",
);

/*
 * ==========================================================
 * CASE 2:
 * Fragile winner should be challenged hard enough
 * to recommend another decision pass.
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

    confidence: 0.7,

    evidenceCoverage: 0.6,

    uncertainty: 0.5,

    expectedRisk: 0.65,

    worstCaseRisk: 0.8,

    worstRevenue: -0.6,

    worstGuest: -0.5,

    worstOperations: -0.5,

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

    confidence: 0.8,

    evidenceCoverage: 0.8,

    uncertainty: 0.2,

    expectedRisk: 0.15,

    worstCaseRisk: 0.2,

    worstRevenue: -0.1,

    worstGuest: -0.1,

    worstOperations: -0.1,

    unknowns: [],

    assumptions: [],
  });

const fragileComparison =
  makeComparison(
    fragileWinner,
    saferChallenger,
  );

const fragileWinnerBefore =
  fragileComparison.best.strategyId;

const fragileCritique =
  critiqueFutureDecision(
    fragileComparison,
  );

assert.equal(
  fragileCritique.available,
  true,
);

assert.equal(
  fragileCritique.verdict,
  "revision_recommended",
);

assert.equal(
  fragileCritique.revisionCandidateStrategyId,
  "strategy-safer",
);

assert.ok(
  fragileCritique.netChallenge >= 12,
);

assert.notEqual(
  fragileCritique.primaryChallenge,
  null,
);

/*
 * Critical shadow-mode invariant:
 *
 * Self-Critique may recommend reconsideration,
 * but it MUST NOT alter the Future Comparator winner.
 */
assert.equal(
  fragileComparison.best.strategyId,
  fragileWinnerBefore,
);

assert.equal(
  fragileComparison.best.strategyId,
  "strategy-fragile",
);

/*
 * ==========================================================
 * CASE 3:
 * Fail closed when there is no challenger.
 * ==========================================================
 */

const insufficientComparison = {
  ...strongComparison,

  rankedFutures: [
    strongWinner,
  ],

  alternatives: [],
} as FutureComparison;

const insufficientCritique =
  critiqueFutureDecision(
    insufficientComparison,
  );

assert.equal(
  insufficientCritique.available,
  false,
);

assert.equal(
  insufficientCritique.verdict,
  "insufficient_comparison",
);

assert.equal(
  insufficientCritique.revisionCandidateStrategyId,
  null,
);

console.log(
  "✓ Brain Self-Critique regression test passed",
);

console.log({
  strongDecision: {
    verdict:
      strongCritique.verdict,

    netChallenge:
      strongCritique.netChallenge,

    winnerPreserved:
      strongComparison.best.strategyId ===
      "strategy-strong",
  },

  fragileDecision: {
    verdict:
      fragileCritique.verdict,

    netChallenge:
      fragileCritique.netChallenge,

    revisionCandidate:
      fragileCritique
        .revisionCandidateStrategyId,

    winnerStillPreserved:
      fragileComparison.best.strategyId ===
      "strategy-fragile",
  },

  insufficientComparisonFailsClosed:
    insufficientCritique.available ===
    false,
});