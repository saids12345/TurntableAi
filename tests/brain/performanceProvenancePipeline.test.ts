import assert from "node:assert/strict";

import {
  buildExecutiveAI,
} from "@/lib/executiveAI";

import {
  buildExecutionPlan,
} from "@/lib/executionEngine";

import {
  buildOperatorIntelligence,
} from "@/lib/operatorIntelligence";

import {
  buildOperatorWorkflow,
} from "@/lib/operatorWorkflowEngine";

import {
  approveTask,
  startTask,
  completeTask,
  measureTask,
  learnTask,
} from "@/lib/operatorTaskEngine";

/*
 * Exact trusted performance rows that should survive
 * the intelligence -> workflow -> task pipeline.
 */
const performanceProvenance = {
  latest: {
    rowId: "perf-row-latest-1",
    sourceSystem: "toast",
    sourceRecordId: "toast-record-latest-1",
    ingestedAt: "2026-09-30T07:00:00.000Z",
    capturedAt: "2026-09-30T06:55:00.000Z",
  },

  previous: {
    rowId: "perf-row-previous-1",
    sourceSystem: "toast",
    sourceRecordId: "toast-record-previous-1",
    ingestedAt: "2026-09-29T07:00:00.000Z",
    capturedAt: "2026-09-29T06:55:00.000Z",
  },
};

/*
 * Executive AI must preserve the same trusted rows.
 */
const executiveAI =
  buildExecutiveAI({
    mode: "single_location",

    topMove: {
      title:
        "Run a controlled margin test",

      confidence: 82,

      locationName:
        "Test Location",

      successMetric:
        "Margin improves while revenue remains stable.",

      performanceProvenance,
    },
  });

assert.deepEqual(
  executiveAI.performanceProvenance,
  performanceProvenance,
);

assert.equal(
  executiveAI.performanceProvenance
    ?.latest?.rowId,
  "perf-row-latest-1",
);

/*
 * Execution Engine must preserve Executive AI provenance
 * in both the plan and its generated top task.
 */
const executiveExecutionPlan =
  buildExecutionPlan({
    executiveAI,
  });

assert.deepEqual(
  executiveExecutionPlan.performanceProvenance,
  performanceProvenance,
);

assert.deepEqual(
  executiveExecutionPlan.topTask
    .performanceProvenance,
  performanceProvenance,
);

/*
 * Start at Operator Intelligence.
 *
 * Planning is deliberately the source of the provenance
 * because it is the first provenance source in the current
 * Operator Intelligence priority order.
 */
const intelligence =
  buildOperatorIntelligence({
    mode: "single_location",

    restaurantStates: [
      {
        locationName: "Test Location",
        overallScore: 70,
        level: "watch",
        primaryRisk: "Margin pressure",
        primaryOpportunity: "Controlled margin recovery",
      },
    ],

    memory: {
      loaded: true,
      totalMemories: 2,
      reusablePlaybooks: 1,
      successfulStrategies: 1,
      averageOutcomeScore: 80,
      recentMemories: [],
    },

    planning: {
      summary:
        "A controlled margin test is the strongest next move.",

      topMove: {
        title:
          "Run a controlled margin test",

        reason:
          "Current performance evidence supports a reversible test.",

        expectedOutcome:
          "Margin improves without harming guest experience.",

        confidence: 82,
        priorityScore: 80,
        roiScore: 75,

        executionWindow:
          "Within the next 7 days.",

        successMetric:
          "Margin improves while revenue remains stable.",

        locationName:
          "Test Location",

        checklist: [
          "Capture baseline",
          "Run controlled test",
          "Measure outcome",
        ],

        performanceProvenance,
      },
    },

    executionPlan: {
      summary:
        "Execute a controlled, measurable margin test.",

      mode:
        "approval_required",

      topTask: {
        id: "task-margin-test",
        title:
          "Run a controlled margin test",
        description:
          "Execute the smallest reversible version of the test.",
        priority: 80,
        mode:
          "approval_required",
        estimatedImpact: 70,
        confidence: 82,
      },
    },
  });

/*
 * Operator Intelligence must preserve the exact rows.
 */
assert.deepEqual(
  intelligence.performanceProvenance,
  performanceProvenance,
);

assert.equal(
  intelligence.performanceProvenance
    ?.latest?.rowId,
  "perf-row-latest-1",
);

assert.equal(
  intelligence.performanceProvenance
    ?.previous?.rowId,
  "perf-row-previous-1",
);

/*
 * Legacy workflow path.
 */
const legacyWorkflow =
  buildOperatorWorkflow({
    operatorIntelligence:
      intelligence,

    executionPlan: {
      summary:
        "Execute a controlled, measurable margin test.",

      mode:
        "approval_required",

      topTask: {
        id: "task-margin-test",
        title:
          "Run a controlled margin test",
        description:
          "Execute the smallest reversible version of the test.",
        priority: 80,
        mode:
          "approval_required",
        estimatedImpact: 70,
        confidence: 82,
        locationName:
          "Test Location",
      },
    },
  });

assert.deepEqual(
  legacyWorkflow.source
    .performanceProvenance,
  performanceProvenance,
);

assert.ok(
  legacyWorkflow.steps.length > 0,
);

for (
  const step of
    legacyWorkflow.steps
) {
  assert.ok(
    step.task,
    `Legacy workflow step "${step.title}" must contain a task.`,
  );

  assert.deepEqual(
    step.task.metadata
      ?.performanceProvenance,
    performanceProvenance,
  );

  /*
   * The provenance merge must not destroy
   * existing task metadata.
   */
  assert.equal(
    step.task.metadata
      ?.generatedBy,
    "TurnTableAI",
  );
}

/*
 * Cognitive workflow path.
 */
const cognitiveWorkflow =
  buildOperatorWorkflow({
    cognition: {
      selectedStrategy: {
        rank: 1,
        score: 82,
        status: "preferred",

        strategy: {
          id:
            "strategy-controlled-margin-test",

          title:
            "Run a controlled margin test",

          description:
            "Run a small reversible margin test and measure the result.",

          expectedOutcome:
            "Margin improves without unacceptable downside.",

          decisionMode:
            "test",

          kind:
            "experiment",

          risk:
            "low",

          urgency:
            "medium",

          reversibility:
            "high",

          financialExposure:
            "low",

          customerFacing:
            false,

          legalOrComplianceImpact:
            false,

          confidence:
            0.82,

          successMetrics: [
            "Margin improves while revenue remains stable.",
          ],
        },
      },
    },

    operatorIntelligence:
      intelligence,

    executionPlan: {
      summary:
        "Execute a controlled, measurable margin test.",

      mode:
        "approval_required",

      topTask: {
        id: "task-margin-test",
        title:
          "Run a controlled margin test",
        description:
          "Execute the smallest reversible version of the test.",
        priority: 80,
        mode:
          "approval_required",
        estimatedImpact: 70,
        confidence: 82,
        locationName:
          "Test Location",
      },
    },
  });

assert.deepEqual(
  cognitiveWorkflow.source
    .performanceProvenance,
  performanceProvenance,
);

assert.ok(
  cognitiveWorkflow.steps.length > 0,
);

for (
  const step of
    cognitiveWorkflow.steps
) {
  assert.ok(
    step.task,
    `Cognitive workflow step "${step.title}" must contain a task.`,
  );

  assert.deepEqual(
    step.task.metadata
      ?.performanceProvenance,
    performanceProvenance,
  );

  assert.equal(
    step.task.metadata
      ?.generatedBy,
    "TurnTableAI",
  );
}

/*
 * Task lifecycle transitions must also preserve
 * the same performance provenance.
 */
const originalTask =
  cognitiveWorkflow.steps[0]
    ?.task;

assert.ok(
  originalTask,
);

const approvedTask =
  approveTask(originalTask);

const runningTask =
  startTask(approvedTask);

const completedTask =
  completeTask(runningTask);

const measuredTask =
  measureTask(completedTask);

const learnedTask =
  learnTask(measuredTask);

for (
  const task of [
    originalTask,
    approvedTask,
    runningTask,
    completedTask,
    measuredTask,
    learnedTask,
  ]
) {
  assert.deepEqual(
    task.metadata
      ?.performanceProvenance,
    performanceProvenance,
  );

  assert.equal(
    task.metadata
      ?.generatedBy,
    "TurnTableAI",
  );
}

console.log(
  "✓ Performance provenance pipeline regression test passed",
);

console.log({
  latestRowId:
    intelligence.performanceProvenance
      ?.latest?.rowId,

  previousRowId:
    intelligence.performanceProvenance
      ?.previous?.rowId,

  legacyWorkflowSteps:
    legacyWorkflow.steps.length,

  cognitiveWorkflowSteps:
    cognitiveWorkflow.steps.length,

  taskLifecyclePreserved:
    true,
});
