import assert from "node:assert/strict";

import {
  buildDecisionChangeProvenance,
  buildProductionDecisionProvenance,
  synchronizeDecisionTransition,
} from "@/lib/brain/decisionProvenance";

import type {
  FutureComparison,
} from "@/lib/brain/reasoning/futureComparator";

const comparison = {
  best: {
    strategyId:
      "strategy-primary-growth",
    strategyTitle:
      "Run a Controlled Growth Test",
    summary:
      "Test controlled growth.",
    confidence: 0.75,
    expectedRevenueImpact: 0.2,
    expectedGuestExperienceImpact: 0.1,
    expectedOperationalImpact: 0.1,
    expectedRisk: 0.2,
  },

  alternatives: [
    {
      strategyId:
        "strategy-maintain-monitor",
      strategyTitle:
        "Maintain Operations and Monitor",
      summary:
        "Maintain current operations.",
      confidence: 0.7,
      expectedRevenueImpact: 0.1,
      expectedGuestExperienceImpact: 0.1,
      expectedOperationalImpact: 0.1,
      expectedRisk: 0.2,
    },
  ],

  reasoning: [],

  rankedFutures: [
    {
      rank: 1,
      score: 67.55,
      status: "preferred",

      future: {
        strategyId:
          "strategy-primary-growth",
        strategyTitle:
          "Run a Controlled Growth Test",
        summary:
          "Test controlled growth.",
        confidence: 0.75,
        expectedRevenueImpact: 0.2,
        expectedGuestExperienceImpact: 0.1,
        expectedOperationalImpact: 0.1,
        expectedRisk: 0.2,
      },

      breakdown: {
        expectedValue: 0.3,
        confidenceAdjustedImpact: 0.6,
        downsideProtection: 0.5,
        robustness: 0.5,
        impactBalance: 0.5,
        evidenceQuality: 0.5,
        decisionModeFit: 0.56,
        riskPenalty: 2,
        scenarioPenalty: 1,
        unknownPenalty: 1,
        assumptionPenalty: 1,
        total: 67.55,
      },

      strengths: [],
      tradeoffs: [],
    },

    {
      rank: 2,
      score: 63.25,
      status: "competitive",

      future: {
        strategyId:
          "strategy-maintain-monitor",
        strategyTitle:
          "Maintain Operations and Monitor",
        summary:
          "Maintain current operations.",
        confidence: 0.7,
        expectedRevenueImpact: 0.1,
        expectedGuestExperienceImpact: 0.1,
        expectedOperationalImpact: 0.1,
        expectedRisk: 0.2,
      },

      breakdown: {
        expectedValue: 0.3,
        confidenceAdjustedImpact: 0.5,
        downsideProtection: 0.5,
        robustness: 0.5,
        impactBalance: 0.5,
        evidenceQuality: 0.5,
        decisionModeFit: 0.5,
        riskPenalty: 2,
        scenarioPenalty: 1,
        unknownPenalty: 1,
        assumptionPenalty: 1,
        total: 63.25,
      },

      strengths: [],
      tradeoffs: [],
    },
  ],
} as FutureComparison;

const normal =
  buildProductionDecisionProvenance(
    comparison,
  );

const forced =
  buildProductionDecisionProvenance(
    comparison,
    true,
  );

/*
 * Normal provenance must verify.
 */
assert.equal(
  normal.available,
  true,
);

assert.equal(
  normal.verified,
  true,
);

assert.equal(
  normal.integrity.passed,
  true,
);

assert.equal(
  normal.winningMargin,
  4.3,
);

assert.equal(
  normal.winner.title,
  "Run a Controlled Growth Test",
);

assert.notEqual(
  normal.summary,
  null,
);

assert.notEqual(
  normal.primaryDriver,
  null,
);

/*
 * Forced failure must fail closed.
 */
assert.equal(
  forced.available,
  true,
);

assert.equal(
  forced.verified,
  false,
);

assert.equal(
  forced.integrity.passed,
  false,
);

assert.equal(
  forced.summary,
  null,
);

assert.equal(
  forced.primaryDriver,
  null,
);

assert.equal(
  forced.secondaryDriver,
  null,
);

assert.equal(
  forced.countervailingDriver,
  null,
);

/*
 * Most important isolation checks:
 *
 * Forcing provenance failure must NOT
 * alter the Brain decision itself.
 */
assert.deepEqual(
  forced.winner,
  normal.winner,
);

assert.deepEqual(
  forced.runnerUp,
  normal.runnerUp,
);

assert.equal(
  forced.winningMargin,
  normal.winningMargin,
);

assert.equal(
  forced.integrity.explainedMargin,
  normal.integrity.explainedMargin,
);

assert.equal(
  forced.integrity.observedMargin,
  normal.integrity.observedMargin,
);

assert.equal(
  forced.integrity.residual,
  normal.integrity.residual,
);

console.log(
  "✓ Decision provenance regression test passed",
);

console.log({
    winner:
      normal.winner.title,
    winningMargin:
      normal.winningMargin,
    normalVerified:
      normal.verified,
    forcedVerified:
      forced.verified,
  });
 /*
 * Decision Memory:
 * verified change-of-mind attribution.
 */
const verifiedChange =
buildDecisionChangeProvenance(
  comparison,
  "strategy-maintain-monitor",
);

assert.notEqual(
verifiedChange,
null,
);

assert.equal(
verifiedChange?.verified,
true,
);

assert.equal(
verifiedChange?.winner.strategyId,
"strategy-primary-growth",
);

assert.equal(
verifiedChange?.runnerUp?.strategyId,
"strategy-maintain-monitor",
);

assert.equal(
verifiedChange?.winningMargin,
4.3,
);

assert.notEqual(
verifiedChange?.summary,
null,
);

/*
* Fail closed when the previous strategy
* is not part of the current simulation set.
*/
const notComparableChange =
buildDecisionChangeProvenance(
  comparison,
  "strategy-not-in-current-futures",
);

assert.equal(
notComparableChange,
null,
);

/*
* No change-of-mind explanation is needed
* when the previous strategy is still the winner.
*/
const reaffirmedDecision =
buildDecisionChangeProvenance(
  comparison,
  "strategy-primary-growth",
);

assert.equal(
reaffirmedDecision,
null,
);

console.log(
"✓ Decision Memory change-of-mind regression test passed",
);

console.log({
changeWinner:
  verifiedChange?.winner.title,
previousStrategy:
  verifiedChange?.runnerUp?.title,
verified:
  verifiedChange?.verified,
winningMargin:
  verifiedChange?.winningMargin,
notComparableFailsClosed:
  notComparableChange === null,
reaffirmedNeedsNoExplanation:
  reaffirmedDecision === null,
});
/*
 * Decision Memory synchronization:
 * persisted history may only accompany
 * the exact live Brain strategy it belongs to.
 */
const transition = {
  type: "changed_mind",
  changedMind: true,
  currentStrategyId:
    "strategy-primary-growth",
};

const matchingTransition =
  synchronizeDecisionTransition(
    transition,
    "strategy-primary-growth",
  );

assert.strictEqual(
  matchingTransition,
  transition,
);

const mismatchedTransition =
  synchronizeDecisionTransition(
    transition,
    "strategy-maintain-monitor",
  );

assert.equal(
  mismatchedTransition,
  null,
);

const missingLiveStrategy =
  synchronizeDecisionTransition(
    transition,
    null,
  );

assert.equal(
  missingLiveStrategy,
  null,
);

const missingTransitionStrategy =
  synchronizeDecisionTransition(
    {
      type: "changed_mind",
      changedMind: true,
    },
    "strategy-primary-growth",
  );

assert.equal(
  missingTransitionStrategy,
  null,
);

console.log(
  "✓ Decision Memory synchronization regression test passed",
);

console.log({
  matchingStrategyAllowed:
    matchingTransition === transition,
  mismatchedStrategyRejected:
    mismatchedTransition === null,
  missingLiveStrategyFailsClosed:
    missingLiveStrategy === null,
  missingTransitionStrategyFailsClosed:
    missingTransitionStrategy === null,
});