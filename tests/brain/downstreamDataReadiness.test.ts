import assert from "node:assert/strict";

import {
  buildExecutiveAI,
} from "@/lib/executiveAI";

import {
  buildExecutionPlan,
} from "@/lib/executionEngine";

import {
  buildExecutiveDecision,
} from "@/lib/brain/executiveDecisionEngine";

import {
  buildOperatorIntelligence,
} from "@/lib/operatorIntelligence";

import {
  buildOperatorWorkflow,
} from "@/lib/operatorWorkflowEngine";

const executiveAI =
  buildExecutiveAI({
    mode: "single_location",

    planningSummary:
      "Planning is paused until trusted data is ready.",

    topMove:
      null,

    causalSummary:
      "Causal analysis is paused until trusted data is ready.",

    topCause:
      null,

    predictionSummary:
      "Prediction is paused until trusted data is ready.",

    topPrediction:
      null,

    worldSummary:
      "World Model adjustments are paused until trusted data is ready.",

    topWorldSignal:
      null,
  });

assert.equal(
  executiveAI.decisionStatus,
  "insufficient_data",
);

const executionPlan =
  buildExecutionPlan({
    executiveAI,
  });

assert.equal(
  executionPlan.mode,
  "monitor",
);

assert.equal(
  executionPlan.topTask.confidence,
  0,
);

const executiveDecision =
  buildExecutiveDecision({
    mode:
      "single_location",

    executionPlan,

    operatorMemory: [],

    restaurantStates: [],
  });

assert.equal(
  executiveDecision.review
    .recommendationStatus,
  "insufficient_evidence",
);

const operatorIntelligence =
  buildOperatorIntelligence({
    mode:
      "single_location",

    restaurantStates: [
      {
        locationName:
          "Synthetic Weak State",

        overallScore:
          99,

        level:
          "healthy",

        primaryRisk:
          "Fake Risk",

        primaryOpportunity:
          "Fake Opportunity",
      },
    ],

    memory: {
      loaded: true,
      totalMemories: 99,
      reusablePlaybooks: 99,
      successfulStrategies: 99,
      averageOutcomeScore: 99,
      recentMemories: [],
      error: null,
    },

    executiveAI,

    executionPlan,
  });

assert.equal(
  operatorIntelligence.judgment,
  "collect_more_evidence",
);

assert.equal(
  operatorIntelligence.confidence,
  0,
);

assert.equal(
  operatorIntelligence
    .historicalExperience.used,
  false,
);

assert.equal(
  operatorIntelligence.locationFocus,
  null,
);

assert.equal(
  operatorIntelligence.performanceProvenance,
  null,
);

const workflow =
  buildOperatorWorkflow({
    cognition: {
      selectedStrategy: {
        strategy: {
          id:
            "must-not-bypass-readiness",

          title:
            "Unsafe Cognitive Action",

          description:
            "This strategy must not become executable.",

          decisionMode:
            "act",
        },
      },
    },

    operatorIntelligence,

    executionPlan,

    executiveAI,
  });

assert.equal(
  workflow.status,
  "paused",
);

assert.equal(
  workflow.executionMode,
  "monitor",
);

assert.equal(
  workflow.confidence,
  0,
);

assert.equal(
  workflow.autoExecutable,
  false,
);

assert.equal(
  workflow.steps.length,
  0,
);

assert.equal(
  workflow.metadata
    ?.dataReadinessBlocked,
  true,
);

console.log(
  "✓ Downstream data readiness regression test passed",
);
