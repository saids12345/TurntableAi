import assert from "node:assert/strict";

import {
  resolveRestaurantStateLocationNames,
} from "@/lib/restaurantState";

import {
  resolveAIKernelMode,
} from "@/lib/brain/brainInitializer";

import {
  createNetworkPlanningResult,
} from "@/lib/planningEngine";

import {
  analyzeNetworkCausality,
} from "@/lib/causalEngine";

import {
  predictNetworkFuture,
} from "@/lib/predictionEngine";

import {
  buildNetworkWorldModel,
} from "@/lib/worldModel";

assert.equal(
  resolveAIKernelMode(0),
  "network",
);

assert.equal(
  resolveAIKernelMode(1),
  "single_location",
);

assert.equal(
  resolveAIKernelMode(2),
  "network",
);

assert.deepEqual(
  resolveRestaurantStateLocationNames(
    [],
    null,
  ),
  [],
);

assert.deepEqual(
  resolveRestaurantStateLocationNames(
    [],
    "   ",
  ),
  [],
);

assert.deepEqual(
  resolveRestaurantStateLocationNames(
    [],
    "  Mira Mesa  ",
  ),
  ["Mira Mesa"],
);

assert.deepEqual(
  resolveRestaurantStateLocationNames(
    ["Downtown"],
    null,
  ),
  ["Downtown"],
);

const planning =
  createNetworkPlanningResult({
    contexts: [],
  });

assert.equal(
  planning.locationsPlanned,
  0,
);

assert.equal(
  planning.topMove,
  null,
);

assert.equal(
  planning.summary,
  "Planning is paused because no restaurant location could be identified from trusted data.",
);

const causal =
  analyzeNetworkCausality([]);

assert.equal(
  causal.mode,
  "network",
);

assert.equal(
  causal.topHypothesis,
  null,
);

assert.equal(
  causal.summary,
  "Causal analysis is paused because no restaurant location could be identified from trusted data.",
);

const prediction =
  predictNetworkFuture({
    contexts: [],
  });

assert.equal(
  prediction.mode,
  "network",
);

assert.equal(
  prediction.topPrediction,
  null,
);

assert.equal(
  prediction.summary,
  "Prediction is paused because no restaurant location could be identified from trusted data.",
);

const world =
  buildNetworkWorldModel([]);

assert.equal(
  world.mode,
  "network",
);

assert.equal(
  world.locationsModeled,
  0,
);

assert.equal(
  world.topSignal,
  null,
);

assert.equal(
  world.summary,
  "World Model is paused because no restaurant location could be identified from trusted data.",
);

console.log(
  "✓ Empty restaurant location regression test passed",
);
