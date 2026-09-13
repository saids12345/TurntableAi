import assert from "node:assert/strict";

import {
  testDecisionStability,
} from "@/lib/brain/reasoning/decisionStability";

import type {
  SimulatedFuture,
  SimulatedScenario,
} from "@/lib/brain/reasoning/futureSimulator";

function scenario(
  name:
    "best_case" |
    "base_case" |
    "worst_case",
  risk: number,
  revenue: number,
  guestExperience: number,
  operations: number,
): SimulatedScenario {
  return {
    name,

    probability:
      name === "base_case"
        ? 0.6
        : 0.2,

    summary:
      `${name} scenario`,

    impact: {
      revenue,
      guestExperience,
      operations,
    },

    risk,

    assumptions: [],
  };
}

function future(
  overrides:
    Partial<SimulatedFuture> & {
      strategyId: string;
      strategyTitle: string;
    },
): SimulatedFuture {
  const bestCase =
    scenario(
      "best_case",
      0.1,
      0.25,
      0.2,
      0.2,
    );

  const baseCase =
    scenario(
      "base_case",
      0.2,
      0.15,
      0.12,
      0.12,
    );

  const worstCase =
    scenario(
      "worst_case",
      0.3,
      -0.1,
      -0.1,
      -0.1,
    );

  return {
    

    summary:
      `${overrides.strategyTitle} simulated future.`,

    confidence:
      0.8,

    expectedRevenueImpact:
      0.15,

    expectedGuestExperienceImpact:
      0.12,

    expectedOperationalImpact:
      0.12,

    expectedRisk:
      0.2,

    evidenceCoverage:
      0.8,

    uncertainty:
      0.2,

    decisionModeFit:
      0.8,

    bestCase,

    baseCase,

    worstCase,

    scenarios: [
      { ...bestCase, impact: { ...bestCase.impact } },
      { ...baseCase, impact: { ...baseCase.impact } },
      { ...worstCase, impact: { ...worstCase.impact } },
    ],

    assumptions: [],

    unknowns: [],

    ...overrides,
  };
}

/*
 * ==========================================================
 * CASE 1
 *
 * Clearly superior decision.
 *
 * Small adverse changes and small competitor improvements
 * should not knock it off the top.
 * ==========================================================
 */

const strongWinner =
  future({
    strategyId:
      "strategy-strong",

    strategyTitle:
      "Strong Strategy",

    confidence:
      0.95,

    expectedRevenueImpact:
      0.55,

    expectedGuestExperienceImpact:
      0.45,

    expectedOperationalImpact:
      0.4,

    expectedRisk:
      0.08,

    evidenceCoverage:
      0.95,

    uncertainty:
      0.05,

    decisionModeFit:
      0.95,

    worstCase:
      scenario(
        "worst_case",
        0.15,
        0.15,
        0.1,
        0.1,
      ),
  });

const weakCompetitor =
  future({
    strategyId:
      "strategy-weak",

    strategyTitle:
      "Weak Competitor",

    confidence:
      0.55,

    expectedRevenueImpact:
      0.04,

    expectedGuestExperienceImpact:
      0.03,

    expectedOperationalImpact:
      0.04,

    expectedRisk:
      0.45,

    evidenceCoverage:
      0.55,

    uncertainty:
      0.45,

    decisionModeFit:
      0.55,

    assumptions: [
      "assumption-a",
      "assumption-b",
    ],

    unknowns: [
      "unknown-a",
      "unknown-b",
    ],

    worstCase:
      scenario(
        "worst_case",
        0.65,
        -0.45,
        -0.4,
        -0.4,
      ),
  });

const strongInput = [
  strongWinner,
  weakCompetitor,
];

const strongBefore =
  JSON.stringify(
    strongInput,
  );

const strongResult =
  testDecisionStability(
    strongInput,
  );

assert.equal(
  strongResult.available,
  true,
);

assert.equal(
  strongResult.shadowMode,
  true,
);

assert.equal(
  strongResult.verdict,
  "stable",
);

assert.equal(
  strongResult.stabilityVerified,
  true,
);

assert.equal(
  strongResult
    .baselineShadowSelectedStrategyId,
  "strategy-strong",
);

assert.equal(
  strongResult
    .strongestCompetitorStrategyId,
  "strategy-weak",
);

assert.equal(
  strongResult
    .winnerAdverse
    .configuredCaseCount,
  7,
);

assert.equal(
  strongResult
    .winnerSupportive
    .configuredCaseCount,
  4,
);

assert.equal(
  strongResult
    .competitorPressure
    .configuredCaseCount,
  4,
);

assert.equal(
  strongResult
    .winnerSupportive
    .flipCount,
  0,
);

assert.equal(
  strongResult
    .competitorPressure
    .flipCount,
  0,
);

/*
 * Stability testing must not mutate
 * the original simulated futures.
 */
assert.equal(
  JSON.stringify(
    strongInput,
  ),
  strongBefore,
);

/*
 * ==========================================================
 * CASE 2
 *
 * Very close decision.
 *
 * The current winner has only a tiny advantage.
 * Small adverse changes or improvements to the competitor
 * should expose that the decision is not robust.
 * ==========================================================
 */

const narrowWinner =
  future({
    strategyId:
      "strategy-narrow",

    strategyTitle:
      "Narrow Winner",

    confidence:
      0.801,

    expectedRevenueImpact:
      0.151,

    expectedGuestExperienceImpact:
      0.121,

    expectedOperationalImpact:
      0.121,

    expectedRisk:
      0.2,

    evidenceCoverage:
      0.801,

    uncertainty:
      0.199,

    decisionModeFit:
      0.801,
  });

const closeCompetitor =
  future({
    strategyId:
      "strategy-close",

    strategyTitle:
      "Close Competitor",

    confidence:
      0.8,

    expectedRevenueImpact:
      0.15,

    expectedGuestExperienceImpact:
      0.12,

    expectedOperationalImpact:
      0.12,

    expectedRisk:
      0.2,

    evidenceCoverage:
      0.8,

    uncertainty:
      0.2,

    decisionModeFit:
      0.8,
  });

const fragileResult =
  testDecisionStability([
    narrowWinner,
    closeCompetitor,
  ]);

assert.equal(
  fragileResult.available,
  true,
);

assert.equal(
  fragileResult.shadowMode,
  true,
);

assert.equal(
  fragileResult.verdict,
  "fragile",
);

assert.equal(
  fragileResult.stabilityVerified,
  false,
);

assert.equal(
  fragileResult
    .baselineShadowSelectedStrategyId,
  "strategy-narrow",
);

assert.equal(
  fragileResult
    .strongestCompetitorStrategyId,
  "strategy-close",
);

assert.equal(
  fragileResult
    .winnerSupportive
    .flipCount,
  0,
);

assert.ok(
  fragileResult
    .winnerAdverse
    .flipCount > 0 ||
  fragileResult
    .competitorPressure
    .flipCount > 0,
);

/*
 * ==========================================================
 * CASE 3
 *
 * No simulated futures.
 *
 * Stability must fail closed.
 * ==========================================================
 */

const emptyResult =
  testDecisionStability(
    [],
  );

assert.equal(
  emptyResult.available,
  false,
);

assert.equal(
  emptyResult.verdict,
  "insufficient_evidence",
);

assert.equal(
  emptyResult.stabilityVerified,
  false,
);

console.log(
  "✓ Brain Decision Stability regression test passed",
);

console.log({
  strongDecision: {
    verdict:
      strongResult.verdict,

    verified:
      strongResult
        .stabilityVerified,

    adverseRetention:
      strongResult
        .winnerAdverse
        .retentionRate,

    supportiveRetention:
      strongResult
        .winnerSupportive
        .retentionRate,

    competitorRetention:
      strongResult
        .competitorPressure
        .retentionRate,
  },

  fragileDecision: {
    verdict:
      fragileResult.verdict,

    verified:
      fragileResult
        .stabilityVerified,

    adverseRetention:
      fragileResult
        .winnerAdverse
        .retentionRate,

    supportiveRetention:
      fragileResult
        .winnerSupportive
        .retentionRate,

    competitorRetention:
      fragileResult
        .competitorPressure
        .retentionRate,
  },

  emptyInputFailsClosed:
    emptyResult.verdict ===
    "insufficient_evidence",
});