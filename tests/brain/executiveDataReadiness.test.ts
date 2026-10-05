import assert from "node:assert/strict";

import {
  buildExecutiveAI,
} from "@/lib/executiveAI";

import {
  buildExecutionPlan,
} from "@/lib/executionEngine";

const insufficient =
  buildExecutiveAI({
    mode: "single_location",
    planningSummary:
      "Planning is paused until trusted data is ready.",
    topMove: null,
    causalSummary:
      "Causal analysis is paused until trusted data is ready.",
    topCause: null,
    predictionSummary:
      "Prediction is paused until trusted data is ready.",
    topPrediction: null,
    worldSummary:
      "World Model adjustments are paused until trusted data is ready.",
    topWorldSignal: null,
  });

assert.equal(
  insufficient.decisionStatus,
  "insufficient_data",
);

assert.equal(
  insufficient.confidence,
  0,
);

assert.equal(
  insufficient.historicalExperienceUsed,
  false,
);

assert.equal(
  insufficient.performanceProvenance,
  null,
);

const blockedExecution =
  buildExecutionPlan({
    executiveAI:
      insufficient,
  });

assert.equal(
  blockedExecution.mode,
  "monitor",
);

assert.equal(
  blockedExecution.topTask.mode,
  "monitor",
);

assert.equal(
  blockedExecution.topTask.priority,
  0,
);

assert.equal(
  blockedExecution.topTask.confidence,
  0,
);

const actionable =
  buildExecutiveAI({
    mode: "single_location",
    topMove: {
      title:
        "Monitor current state",
      confidence: 0.8,
      priorityScore: 40,
      locationName:
        "Ready Location",
      successMetric:
        "Core metrics remain stable.",
    },
  });

assert.equal(
  actionable.decisionStatus,
  "actionable",
);

assert.ok(
  actionable.confidence > 0,
);

console.log(
  "✓ Executive data readiness regression test passed",
);
