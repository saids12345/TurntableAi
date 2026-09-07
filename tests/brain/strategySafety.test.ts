import assert from "node:assert/strict";

import type {
  BrainContext,
} from "@/lib/brain/brainContext";

import {
  createWorkingMemory,
} from "@/lib/brain/workingMemory";

import {
  generateStrategies,
} from "@/lib/brain/reasoning/strategyGenerator";

import type {
  HypothesisCategory,
} from "@/lib/brain/reasoning/hypothesisEngine";

import {
  evaluateDecision,
} from "@/lib/brain/reasoning/decisionFramework";

import {
  evaluateStrategies,
} from "@/lib/brain/reasoning/strategyEvaluator";

import {
  buildOperatorWorkflow,
  completeWorkflowStep,
  isWorkflowStepSafetyEligibleForAutonomy,
  pauseWorkflow,
  resumeWorkflow,
  startWorkflow,
} from "@/lib/operatorWorkflowEngine";

import {
    evaluateWorkflowAuthorityHandoff,
  } from "@/lib/brain/reasoning/workflowAuthorityHandoff";
  
  import type {
    DecisionAuthorityResult,
  } from "@/lib/brain/reasoning/decisionAuthority";

function createTestContext(
  category: HypothesisCategory,
): BrainContext {
  const now =
    new Date().toISOString();

  const primaryBelief = {
    id:
      `belief-${category}`,

    statement:
      `The primary restaurant condition is ${category}.`,

    confidence:
      0.82,

    evidence: [
      `evidence-${category}`,
    ],

    updatedAt:
      now,

    category,

    status:
      "active" as const,

    supportingEvidence: [
      `evidence-${category}`,
    ],

    contradictingEvidence:
      [],

    evidenceCoverage:
      0.9,

    evidenceReliability:
      0.9,

    contradictionRatio:
      0,

    assumptions:
      [],

    unknowns:
      [],

    whatWouldChangeMyMind:
      [],

    reasoning: [
      "Regression-test belief.",
    ],

    createdAt:
      now,
  };

  return {
    metadata: {
      runId:
        `strategy-safety-${category}`,

      status:
        "running",

      currentPhase:
        "reasoning",

      startedAt:
        now,

      completedAt:
        null,

      errors:
        [],
    },

    workingMemory:
      createWorkingMemory(),

    perception: {},

    knowledge: {},

    reasoning: {
      beliefs: {
        beliefs: [
          primaryBelief,
        ],

        primaryBelief,

        alternativeBeliefs:
          [],

        contestedBeliefs:
          [],

        overallConfidence:
          0.82,

        evidenceCoverage:
          0.9,

        uncertainty:
          0.18,

        generatedAt:
          now,
      },
    },

    action: {},

    learningState: {},
  };
}

function buildPrimaryWorkflow(
  category: HypothesisCategory,
) {
  const context =
    createTestContext(
      category,
    );

  const strategies =
    generateStrategies(
      context,
    );

  const expectedStrategyId =
    `strategy-primary-${category}`;

  const generatedStrategy =
    strategies.find(
      (strategy) =>
        strategy.id ===
        expectedStrategyId,
    );

  assert.ok(
    generatedStrategy,
    `Expected ${expectedStrategyId} to be generated.`,
  );

  const decisionEvaluation =
    evaluateDecision(
      context,
    );

  const rankedStrategies =
    evaluateStrategies(
      strategies,
      decisionEvaluation,
    );

  const evaluatedStrategy =
    rankedStrategies.find(
      (candidate) =>
        candidate.strategy.id ===
        expectedStrategyId,
    );

  assert.ok(
    evaluatedStrategy,
    `Expected ${expectedStrategyId} to survive strategy evaluation.`,
  );

  /*
   * Important propagation check:
   * evaluation must preserve the authored
   * strategy safety metadata.
   */
  assert.equal(
    evaluatedStrategy.strategy
      .financialExposure,
    generatedStrategy
      .financialExposure,
  );

  assert.equal(
    evaluatedStrategy.strategy
      .customerFacing,
    generatedStrategy
      .customerFacing,
  );

  assert.equal(
    evaluatedStrategy.strategy
      .legalOrComplianceImpact,
    generatedStrategy
      .legalOrComplianceImpact,
  );

  const workflow =
    buildOperatorWorkflow({
      actionId:
        `action-${category}`,

      cognition: {
        selectedStrategy:
          evaluatedStrategy,

        decisionEvaluation,
      },
    });

  assert.equal(
    workflow.metadata
      ?.cognitiveStrategyId,
    expectedStrategyId,
  );

  return {
    generatedStrategy,
    workflow,
  };
}

/*
 * CASE 1:
 * Growth is financially exposed and
 * underspecified on customer/compliance impact.
 *
 * It must remain conservative.
 */
const growth =
  buildPrimaryWorkflow(
    "growth",
  );

assert.equal(
  growth.generatedStrategy
    .financialExposure,
  "medium",
);

assert.equal(
  growth.generatedStrategy
    .customerFacing,
  "unknown",
);

assert.equal(
  growth.generatedStrategy
    .legalOrComplianceImpact,
  "unknown",
);

assert.deepEqual(
  growth.workflow
    .authoritySafety,
  {
    riskLevel:
      "medium",

    reversibility:
      "moderate",

    financialExposure:
      "medium",

    customerFacing:
      "unknown",

    legalOrComplianceImpact:
      "unknown",
  },
);

/*
 * CASE 2:
 * Staffing directly changes labor deployment.
 *
 * Its authored labor/compliance risk must
 * survive the full production path.
 */
const staffing =
  buildPrimaryWorkflow(
    "staffing",
  );

assert.equal(
  staffing.generatedStrategy
    .financialExposure,
  "medium",
);

assert.equal(
  staffing.generatedStrategy
    .customerFacing,
  false,
);

assert.equal(
  staffing.generatedStrategy
    .legalOrComplianceImpact,
  true,
);

assert.deepEqual(
  staffing.workflow
    .authoritySafety,
  {
    riskLevel:
      "high",

    reversibility:
      "moderate",

    financialExposure:
      "medium",

    customerFacing:
      false,

    legalOrComplianceImpact:
      true,
  },
);

/*
 * CASE 3:
 * Diagnostic uncertainty produces an
 * information-gathering strategy.
 *
 * Its explicitly safe metadata must also
 * survive the workflow handoff.
 */
const diagnostic =
  buildPrimaryWorkflow(
    "unknown",
  );

assert.equal(
  diagnostic.generatedStrategy
    .financialExposure,
  "none",
);

assert.equal(
  diagnostic.generatedStrategy
    .customerFacing,
  false,
);

assert.equal(
  diagnostic.generatedStrategy
    .legalOrComplianceImpact,
  false,
);

assert.deepEqual(
  diagnostic.workflow
    .authoritySafety,
  {
    riskLevel:
      "low",

    reversibility:
      "easy",

    financialExposure:
      "none",

    customerFacing:
      false,

    legalOrComplianceImpact:
      false,
  },
);

/*
 * Exhaustive category coverage:
 * every primary strategy category must preserve
 * its authored safety profile into the real workflow.
 */
const categorySafetyCases = [
  {
    category: "stability" as const,
    expected: {
      riskLevel: "low",
      reversibility: "easy",
      financialExposure: "none",
      customerFacing: false,
      legalOrComplianceImpact: false,
    },
  },

  {
    category: "demand" as const,
    expected: {
      riskLevel: "medium",
      reversibility: "moderate",
      financialExposure: "low",
      customerFacing: true,
      legalOrComplianceImpact: "unknown",
    },
  },

  {
    category: "service" as const,
    expected: {
      riskLevel: "high",
      reversibility: "moderate",
      financialExposure: "low",
      customerFacing: true,
      legalOrComplianceImpact: "unknown",
    },
  },

  {
    category: "staffing" as const,
    expected: {
      riskLevel: "high",
      reversibility: "moderate",
      financialExposure: "medium",
      customerFacing: false,
      legalOrComplianceImpact: true,
    },
  },

  {
    category: "profitability" as const,
    expected: {
      riskLevel: "high",
      reversibility: "moderate",
      financialExposure: "medium",
      customerFacing: "unknown",
      legalOrComplianceImpact: "unknown",
    },
  },

  {
    category: "reputation" as const,
    expected: {
      riskLevel: "high",
      reversibility: "moderate",
      financialExposure: "low",
      customerFacing: true,
      legalOrComplianceImpact: "unknown",
    },
  },

  {
    category: "execution" as const,
    expected: {
      riskLevel: "high",
      reversibility: "moderate",
      financialExposure: "medium",
      customerFacing: "unknown",
      legalOrComplianceImpact: "unknown",
    },
  },

  {
    category: "growth" as const,
    expected: {
      riskLevel: "medium",
      reversibility: "moderate",
      financialExposure: "medium",
      customerFacing: "unknown",
      legalOrComplianceImpact: "unknown",
    },
  },

  {
    category: "unknown" as const,
    expected: {
      riskLevel: "low",
      reversibility: "easy",
      financialExposure: "none",
      customerFacing: false,
      legalOrComplianceImpact: false,
    },
  },
];

for (
  const {
    category,
    expected,
  } of categorySafetyCases
) {
  const result =
    buildPrimaryWorkflow(
      category,
    );

  assert.deepEqual(
    result.workflow
      .authoritySafety,
    expected,
    `Safety propagation failed for ${category}.`,
  );
}

/*
 * Critical invariant:
 * workflow safety must equal the strategy
 * metadata that generated that workflow.
 */
for (
  const result of [
    growth,
    staffing,
    diagnostic,
  ]
) {
  assert.equal(
    result.workflow
      .authoritySafety
      .financialExposure,
    result.generatedStrategy
      .financialExposure,
  );

  assert.equal(
    result.workflow
      .authoritySafety
      .customerFacing,
    result.generatedStrategy
      .customerFacing,
  );

  assert.equal(
    result.workflow
      .authoritySafety
      .legalOrComplianceImpact,
    result.generatedStrategy
      .legalOrComplianceImpact,
  );
}

console.log(
  "✓ Brain Strategy Safety propagation regression test passed",
);

/*
 * CASE 4:
 * A real Growth workflow contains unresolved
 * customer/compliance safety dimensions.
 *
 * Even when Decision Authority verifies a
 * revision in shadow mode, Authority Policy
 * must fail closed.
 */
const growthAuthority: DecisionAuthorityResult = {
    available: true,
  
    shadowMode: true,
  
    productionAuthorityGranted:
      false,
  
    verdict:
      "revision_eligible",
  
    productionWinnerStrategyId:
      "strategy-current",
  
    shadowSelectedStrategyId:
      "strategy-primary-growth",
  
    changedFromProduction:
      true,
  
    revisionVerified:
      true,
  
    stabilityVerified:
      true,
  
    authorityEligibleInShadow:
      true,
  
    reason:
      null,
  
    integrity: {
      arbitrationPassed:
        true,
  
      arbitrationWinnerMatchesStability:
        true,
  
      arbitrationShadowMatchesStability:
        true,
  
      stabilityPassed:
        true,
  
      passed:
        true,
    },
  
    generatedAt:
      new Date().toISOString(),
  };
  
  const growthHandoff =
    evaluateWorkflowAuthorityHandoff(
      growthAuthority,
      growth.workflow,
    );
  
  assert.equal(
    growthHandoff.identityVerified,
    true,
  );
  
  assert.equal(
    growthHandoff.policy.verdict,
    "insufficient_evidence",
  );
  
  assert.equal(
    growthHandoff.policy
      .automationEligibleInShadow,
    false,
  );
  
  assert.equal(
    growthHandoff.policy
      .humanApprovalRequired,
    true,
  );
  
  assert.equal(
    growthHandoff.policy
      .productionAuthorityGranted,
    false,
  );

  /*
 * STEP-LEVEL SAFETY REGRESSION:
 *
 * Every Cognitive Brain workflow step must carry
 * an explicit safety contract.
 *
 * Cognitive workflows must never silently fall
 * back to the generic fallback_unknown contract.
 */
const stepSafetyResults =
categorySafetyCases.map(
  ({ category }) => ({
    category,
    ...buildPrimaryWorkflow(
      category,
    ),
  }),
);

for (
const {
  category,
  workflow,
} of stepSafetyResults
) {
assert.ok(
  workflow.steps.length > 0,
  `Expected ${category} workflow to contain steps.`,
);

for (
  const step of workflow.steps
) {
  assert.ok(
    step.safetyContract,
    `Missing safety contract for ${category} step "${step.title}".`,
  );

  assert.notEqual(
    step.safetyContract.source,
    "fallback_unknown",
    `Cognitive ${category} step "${step.title}" unexpectedly used fallback safety.`,
  );
}
}

/*
* Any step that actually changes restaurant
* operations must inherit the selected strategy's
* authored safety profile.
*
* It must also require rollback planning and
* explicit stop conditions before execution.
*/
const operationalPhases =
new Set([
  "test",
  "contain",
  "execute",
]);

let operationalStepCount = 0;

for (
const {
  category,
  workflow,
} of stepSafetyResults
) {
for (
  const step of workflow.steps
) {
  const phase =
    step.metadata?.phase;

  if (
    typeof phase !== "string" ||
    !operationalPhases.has(
      phase,
    )
  ) {
    continue;
  }

  operationalStepCount += 1;

  assert.deepEqual(
    step.safetyContract,
    {
      ...workflow.authoritySafety,

      rollbackRequirement:
        "required_before_execution",

      stopConditionsRequired:
        true,

      source:
        "strategy_inherited",
    },
    `Operational ${category} step "${step.title}" did not inherit strategy safety correctly.`,
  );
}
}

assert.ok(
operationalStepCount > 0,
"Expected at least one operational cognitive workflow step to be tested.",
);

/*
* Growth specifically produces a controlled
* operational test.
*/
const growthTestStep =
growth.workflow.steps.find(
  (step) =>
    step.metadata?.phase ===
    "test",
);

assert.ok(
growthTestStep,
"Expected Growth workflow to contain an operational test step.",
);

assert.deepEqual(
growthTestStep.safetyContract,
{
  ...growth.workflow
    .authoritySafety,

  rollbackRequirement:
    "required_before_execution",

  stopConditionsRequired:
    true,

  source:
    "strategy_inherited",
},
);

/*
* Diagnostic reasoning itself is intrinsically
* non-operational.
*/
const diagnosticQuestionStep =
diagnostic.workflow.steps.find(
  (step) =>
    step.metadata?.phase ===
    "question",
);

assert.ok(
diagnosticQuestionStep,
"Expected diagnostic workflow to contain a question step.",
);

assert.deepEqual(
diagnosticQuestionStep
  .safetyContract,
{
  riskLevel:
    "low",

  reversibility:
    "easy",

  financialExposure:
    "none",

  customerFacing:
    false,

  legalOrComplianceImpact:
    false,

  rollbackRequirement:
    "not_required",

  stopConditionsRequired:
    false,

  source:
    "intrinsic",
},
);

/*
* Persistent learning remains deliberately
* conservative until rollback/compliance
* semantics are explicitly proven.
*/
const diagnosticLearnStep =
diagnostic.workflow.steps.find(
  (step) =>
    step.metadata?.phase ===
    "learn",
);

assert.ok(
diagnosticLearnStep,
"Expected diagnostic workflow to contain a learning step.",
);

assert.equal(
  diagnosticLearnStep.executionMode,
  "manual",
  "Persistent learning must require a human-controlled manual lifecycle when safety remains uncertain.",
);

assert.deepEqual(
diagnosticLearnStep
  .safetyContract,
{
  riskLevel:
    "low",

  reversibility:
    "unknown",

  financialExposure:
    "none",

  customerFacing:
    false,

  legalOrComplianceImpact:
    "unknown",

  rollbackRequirement:
    "unknown",

  stopConditionsRequired:
    false,

  source:
    "intrinsic",
},
);

console.log(
"✓ Workflow Step Safety regression test passed",
);
/*
 * AUTONOMY SAFETY GATE REGRESSION:
 *
 * Safe intrinsic automatic cognition may cross
 * the workflow start boundary.
 *
 * Unknown or operationally consequential
 * automatic steps must fail closed.
 */
const safeAutomaticReassessStep =
  diagnostic.workflow.steps.find(
    (step) =>
      step.metadata?.phase ===
      "reassess",
  );

assert.ok(
  safeAutomaticReassessStep,
  "Expected diagnostic workflow to contain an automatic reassess step.",
);

assert.equal(
  safeAutomaticReassessStep
    .executionMode,
  "automatic",
);

assert.equal(
  isWorkflowStepSafetyEligibleForAutonomy(
    diagnosticLearnStep,
  ),
  false,
  "Persistent learning in its normal manual mode must not be autonomy-eligible.",
);



/*
 * Even if somebody later changes an operational
 * Growth test to automatic, its strategy-inherited
 * rollback and stop-condition requirements must
 * prevent autonomous execution.
 */
assert.equal(
  isWorkflowStepSafetyEligibleForAutonomy({
    ...growthTestStep,

    executionMode:
      "automatic",
  }),
  false,
  "An operational strategy-inherited step must not become autonomous merely by changing executionMode.",
);

/*
 * Prove a safe intrinsic automatic step can
 * actually enter running through startWorkflow().
 */
const safeAutomaticWorkflow = {
  ...diagnostic.workflow,

  status:
    "approved" as const,

  currentStepId:
    safeAutomaticReassessStep.id,

  steps:
    diagnostic.workflow.steps.map(
      (step) => {
        if (
          step.id ===
          safeAutomaticReassessStep.id
        ) {
          return {
            ...step,

            status:
              "ready" as const,

            dependsOn:
              [],
          };
        }

        if (
          step.order <
          safeAutomaticReassessStep.order
        ) {
          return {
            ...step,

            status:
              "completed" as const,
          };
        }

        return {
          ...step,

          status:
            "blocked" as const,
        };
      },
    ),
};

const safeStartedWorkflow =
  startWorkflow(
    safeAutomaticWorkflow,
  );

const startedSafeStep =
  safeStartedWorkflow.steps.find(
    (step) =>
      step.id ===
      safeAutomaticReassessStep.id,
  );

assert.ok(
  startedSafeStep,
);

assert.equal(
  startedSafeStep.status,
  "running",
  "A fully safe intrinsic automatic step should be allowed to start.",
);

/*
 * Prove an unsafe automatic step cannot start
 * even if its status is manually forced to ready.
 */
const unsafeAutomaticWorkflow = {
  ...diagnostic.workflow,

  status:
    "approved" as const,

  currentStepId:
    diagnosticLearnStep.id,

  steps:
    diagnostic.workflow.steps.map(
      (step) => {
        if (
          step.id ===
          diagnosticLearnStep.id
        ) {
          return {
  ...step,

  /*
   * Simulate somebody later changing this
   * conservative learning step back to automatic.
   * Its unknown safety dimensions must still
   * fail closed.
   */
  executionMode:
    "automatic" as const,

  status:
    "ready" as const,

  dependsOn:
    [],
};
        }

        return {
          ...step,

          status:
            "completed" as const,
        };
      },
    ),
};

const blockedUnsafeWorkflow =
  startWorkflow(
    unsafeAutomaticWorkflow,
  );

const blockedUnsafeStep =
  blockedUnsafeWorkflow.steps.find(
    (step) =>
      step.id ===
      diagnosticLearnStep.id,
  );

assert.ok(
  blockedUnsafeStep,
);

assert.equal(
  blockedUnsafeStep.status,
  "ready",
  "Unsafe automatic step must remain unstarted.",
);

assert.notEqual(
  blockedUnsafeStep.status,
  "running",
);

assert.equal(
  blockedUnsafeWorkflow.status,
  "approved",
  "Unsafe automatic step must not cause the workflow to enter running.",
);

console.log(
  "✓ Workflow Step Autonomy Gate regression test passed",
);
/*
 * MANUAL LEARNING COMPLETION REGRESSION:
 *
 * Persistent learning keeps its conservative
 * safety contract, but its normal manual mode
 * must still provide a legitimate path to finish
 * the workflow.
 */
const manualLearningWorkflow = {
  ...diagnostic.workflow,

  status:
    "approved" as const,

  currentStepId:
    diagnosticLearnStep.id,

  steps:
    diagnostic.workflow.steps.map(
      (step) => {
        if (
          step.id ===
          diagnosticLearnStep.id
        ) {
          return {
            ...step,

            executionMode:
              "manual" as const,

            status:
              "ready" as const,
          };
        }

        if (
          step.order <
          diagnosticLearnStep.order
        ) {
          return {
            ...step,

            status:
              "completed" as const,
          };
        }

        return step;
      },
    ),
};

const startedManualLearningWorkflow =
  startWorkflow(
    manualLearningWorkflow,
  );

const runningManualLearningStep =
  startedManualLearningWorkflow.steps.find(
    (step) =>
      step.id ===
      diagnosticLearnStep.id,
  );

assert.ok(
  runningManualLearningStep,
);

assert.equal(
  startedManualLearningWorkflow.status,
  "running",
  "A manual persistent-learning step should allow the workflow to enter running.",
);

assert.equal(
  runningManualLearningStep.status,
  "running",
  "A manual persistent-learning step should legitimately enter running.",
);

const completedManualLearning =
  completeWorkflowStep(
    startedManualLearningWorkflow,
    diagnosticLearnStep.id,
  );

assert.equal(
  completedManualLearning
    .workflowCompleted,
  true,
  "Completing the final manual learning step should complete the entire workflow.",
);

assert.equal(
  completedManualLearning
    .workflow.status,
  "completed",
);

assert.equal(
  completedManualLearning
    .workflow.currentStepId,
  null,
);

assert.equal(
  completedManualLearning
    .workflow.steps.find(
      (step) =>
        step.id ===
        diagnosticLearnStep.id,
    )?.status,
  "completed",
);

console.log(
  "✓ Manual Learning Completion regression test passed",
);
/*
 * WORKFLOW LIFECYCLE BOUNDARY REGRESSION:
 *
 * Completion and resume must not provide alternate
 * paths around approval, dependency, start, or
 * step-level autonomy safety gates.
 */

/*
 * A ready step cannot simply be declared complete,
 * even if somebody forces the workflow status to
 * running.
 */
const forcedRunningUnsafeWorkflow = {
  ...unsafeAutomaticWorkflow,
  status:
    "running" as const,
};

const rejectedReadyCompletion =
  completeWorkflowStep(
    forcedRunningUnsafeWorkflow,
    diagnosticLearnStep.id,
  );

assert.equal(
  rejectedReadyCompletion
    .workflowCompleted,
  false,
);

assert.equal(
  rejectedReadyCompletion
    .previousStep,
  null,
);

assert.equal(
  rejectedReadyCompletion.workflow
    .steps.find(
      (step) =>
        step.id ===
        diagnosticLearnStep.id,
    )?.status,
  "ready",
  "A ready step must not bypass startWorkflow() and become completed.",
);

/*
 * A blocked future step cannot be completed out
 * of sequence.
 */
const blockedDiagnosticStep =
  diagnostic.workflow.steps.find(
    (step) =>
      step.status ===
      "blocked",
  );

assert.ok(
  blockedDiagnosticStep,
  "Expected diagnostic workflow to contain a blocked future step.",
);

const rejectedBlockedCompletion =
  completeWorkflowStep(
    {
      ...diagnostic.workflow,
      status:
        "running" as const,
    },
    blockedDiagnosticStep.id,
  );

assert.equal(
  rejectedBlockedCompletion
    .previousStep,
  null,
);

assert.equal(
  rejectedBlockedCompletion.workflow
    .steps.find(
      (step) =>
        step.id ===
        blockedDiagnosticStep.id,
    )?.status,
  "blocked",
  "A blocked future step must not be completed out of sequence.",
);

/*
 * A legitimately running step still completes.
 */
const validCompletion =
  completeWorkflowStep(
    safeStartedWorkflow,
    safeAutomaticReassessStep.id,
  );

assert.equal(
  validCompletion.previousStep?.id,
  safeAutomaticReassessStep.id,
);

assert.equal(
  validCompletion.workflow.steps.find(
    (step) =>
      step.id ===
      safeAutomaticReassessStep.id,
  )?.status,
  "completed",
  "A legitimately running step should still complete normally.",
);

/*
 * Pausing a running workflow also prevents
 * completion until it is legitimately resumed.
 */
const pausedSafeWorkflow =
  pauseWorkflow(
    safeStartedWorkflow,
  );

const rejectedPausedCompletion =
  completeWorkflowStep(
    pausedSafeWorkflow,
    safeAutomaticReassessStep.id,
  );

assert.equal(
  rejectedPausedCompletion
    .previousStep,
  null,
);

assert.equal(
  rejectedPausedCompletion.workflow
    .status,
  "paused",
);

/*
 * A safe automatic current step may resume.
 */
const resumedSafeWorkflow =
  resumeWorkflow(
    pausedSafeWorkflow,
  );

assert.equal(
  resumedSafeWorkflow.status,
  "running",
  "A paused workflow with a safe automatic current step should resume.",
);

/*
 * An unsafe automatic current step must remain
 * paused even if resumeWorkflow() is called.
 */
const pausedUnsafeWorkflow =
  pauseWorkflow(
    unsafeAutomaticWorkflow,
  );

const blockedResume =
  resumeWorkflow(
    pausedUnsafeWorkflow,
  );

assert.equal(
  blockedResume.status,
  "paused",
  "An unsafe automatic step must not regain running status through resumeWorkflow().",
);

assert.equal(
  blockedResume.steps.find(
    (step) =>
      step.id ===
      diagnosticLearnStep.id,
  )?.status,
  "ready",
);

console.log(
  "✓ Workflow Lifecycle Safety regression test passed",
);
console.log({
  growth:
    growth.workflow
      .authoritySafety,

  staffing:
    staffing.workflow
      .authoritySafety,

  diagnostic:
    diagnostic.workflow
      .authoritySafety,
});