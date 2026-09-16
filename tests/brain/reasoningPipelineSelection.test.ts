import assert from "node:assert/strict";

import {
  resolveReasoningSelections,
} from "@/lib/brain/reasoning/reasoningPipeline";

const rankedStrategies = [
  {
    strategy: {
      id: "strategy-production",
    },
  },
  {
    strategy: {
      id: "strategy-shadow",
    },
  },
  {
    strategy: {
      id: "strategy-alternative",
    },
  },
];

/*
 * CASE 1:
 * Production and shadow disagree.
 *
 * Critical invariant:
 * the shadow recommendation must NOT replace
 * the production-safe selection.
 */
const disagreement =
  resolveReasoningSelections({
    rankedStrategies,
    productionWinnerStrategyId:
      "strategy-production",
    shadowSelectedStrategyId:
      "strategy-shadow",
    fallbackStrategyId:
      "strategy-production",
  });

assert.equal(
  disagreement.selected?.strategy.id,
  "strategy-production",
);

assert.equal(
  disagreement.shadowSelected?.strategy.id,
  "strategy-shadow",
);

assert.notEqual(
  disagreement.selected?.strategy.id,
  disagreement.shadowSelected?.strategy.id,
);

/*
 * CASE 2:
 * Production and shadow agree.
 */
const agreement =
  resolveReasoningSelections({
    rankedStrategies,
    productionWinnerStrategyId:
      "strategy-production",
    shadowSelectedStrategyId:
      "strategy-production",
    fallbackStrategyId:
      "strategy-alternative",
  });

assert.equal(
  agreement.selected?.strategy.id,
  "strategy-production",
);

assert.equal(
  agreement.shadowSelected?.strategy.id,
  "strategy-production",
);

/*
 * CASE 3:
 * No production authority identity is available.
 *
 * Preserve compatibility by using the comparator's
 * production-safe fallback winner.
 */
const fallback =
  resolveReasoningSelections({
    rankedStrategies,
    productionWinnerStrategyId:
      null,
    shadowSelectedStrategyId:
      null,
    fallbackStrategyId:
      "strategy-alternative",
  });

assert.equal(
  fallback.productionSelectedStrategyId,
  "strategy-alternative",
);

assert.equal(
  fallback.selected?.strategy.id,
  "strategy-alternative",
);

assert.equal(
  fallback.shadowSelected,
  undefined,
);

/*
 * CASE 4:
 * A shadow identity that does not exist in the
 * ranked strategy set must not affect production.
 */
const missingShadow =
  resolveReasoningSelections({
    rankedStrategies,
    productionWinnerStrategyId:
      "strategy-production",
    shadowSelectedStrategyId:
      "strategy-does-not-exist",
    fallbackStrategyId:
      "strategy-alternative",
  });

assert.equal(
  missingShadow.selected?.strategy.id,
  "strategy-production",
);

assert.equal(
  missingShadow.shadowSelected,
  undefined,
);

/*
 * CASE 5:
 * A non-null production identity that does not exist
 * must fail closed rather than silently substituting
 * the shadow recommendation.
 */
const missingProduction =
  resolveReasoningSelections({
    rankedStrategies,
    productionWinnerStrategyId:
      "strategy-does-not-exist",
    shadowSelectedStrategyId:
      "strategy-shadow",
    fallbackStrategyId:
      "strategy-alternative",
  });

assert.equal(
  missingProduction.selected,
  undefined,
);

assert.equal(
  missingProduction.shadowSelected?.strategy.id,
  "strategy-shadow",
);

console.log(
  "✓ Brain Reasoning Pipeline Selection regression test passed",
);

console.log({
  disagreement: {
    production:
      disagreement.selected?.strategy.id,
    shadow:
      disagreement.shadowSelected?.strategy.id,
    productionPreserved:
      disagreement.selected?.strategy.id ===
      "strategy-production",
  },

  agreement: {
    production:
      agreement.selected?.strategy.id,
    shadow:
      agreement.shadowSelected?.strategy.id,
  },

  fallback: {
    production:
      fallback.selected?.strategy.id,
    shadow: null,
  },

  missingShadowFailsClosed:
    missingShadow.shadowSelected ===
    undefined,

  missingProductionFailsClosed:
    missingProduction.selected ===
    undefined,
});