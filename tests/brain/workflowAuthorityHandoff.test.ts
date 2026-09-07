import assert from "node:assert/strict";

import {
  evaluateWorkflowAuthorityHandoff,
} from "@/lib/brain/reasoning/workflowAuthorityHandoff";

import type {
  DecisionAuthorityResult,
} from "@/lib/brain/reasoning/decisionAuthority";

import type {
  OperatorWorkflow,
} from "@/lib/operatorWorkflowEngine";

function authority(
  overrides:
    Partial<DecisionAuthorityResult> = {},
): DecisionAuthorityResult {
  return {
    available: true,

    shadowMode: true,

    productionAuthorityGranted:
      false,

    verdict:
      "revision_eligible",

    productionWinnerStrategyId:
      "strategy-current",

    shadowSelectedStrategyId:
      "strategy-challenger",

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

    ...overrides,
  };
}

function workflow(
  strategyId:
    string | null,
): OperatorWorkflow {
  return {
    metadata: {
      cognitiveStrategyId:
        strategyId,
    },

    authoritySafety: {
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
  } as unknown as OperatorWorkflow;
}

/*
 * CASE 1:
 * Exact strategy identity match.
 *
 * Workflow safety data may participate.
 */
const matching =
  evaluateWorkflowAuthorityHandoff(
    authority(),
    workflow(
      "strategy-challenger",
    ),
  );

assert.equal(
  matching.available,
  true,
);

assert.equal(
  matching.identityVerified,
  true,
);

assert.equal(
  matching.workflowStrategyId,
  "strategy-challenger",
);

assert.equal(
  matching.authorityStrategyId,
  "strategy-challenger",
);

assert.equal(
  matching.policy.verdict,
  "shadow_automation_eligible",
);

assert.equal(
  matching.policy
    .automationEligibleInShadow,
  true,
);

/*
 * Production authority must STILL remain off.
 */
assert.equal(
  matching.policy
    .productionAuthorityGranted,
  false,
);

/*
 * CASE 2:
 * Workflow belongs to a different strategy.
 *
 * Its safety profile must be rejected.
 */
const mismatch =
  evaluateWorkflowAuthorityHandoff(
    authority(),
    workflow(
      "strategy-current",
    ),
  );

assert.equal(
  mismatch.available,
  true,
);

assert.equal(
  mismatch.identityVerified,
  false,
);

assert.equal(
  mismatch.workflowStrategyId,
  "strategy-current",
);

assert.equal(
  mismatch.authorityStrategyId,
  "strategy-challenger",
);

assert.equal(
  mismatch.policy.verdict,
  "insufficient_evidence",
);

assert.equal(
  mismatch.policy
    .automationEligibleInShadow,
  false,
);

assert.equal(
  mismatch.policy
    .humanApprovalRequired,
  true,
);

assert.equal(
  mismatch.policy
    .productionAuthorityGranted,
  false,
);

/*
 * CASE 3:
 * Workflow has no cognitive strategy ID.
 *
 * Must fail closed.
 */
const missingWorkflowIdentity =
  evaluateWorkflowAuthorityHandoff(
    authority(),
    workflow(null),
  );

assert.equal(
  missingWorkflowIdentity
    .identityVerified,
  false,
);

assert.equal(
  missingWorkflowIdentity
    .workflowStrategyId,
  null,
);

assert.equal(
  missingWorkflowIdentity
    .policy.verdict,
  "insufficient_evidence",
);

assert.equal(
  missingWorkflowIdentity
    .policy
    .automationEligibleInShadow,
  false,
);

/*
 * CASE 4:
 * Missing workflow must fail closed.
 */
const missingWorkflow =
  evaluateWorkflowAuthorityHandoff(
    authority(),
    null,
  );

assert.equal(
  missingWorkflow.available,
  false,
);

assert.equal(
  missingWorkflow
    .identityVerified,
  false,
);

assert.equal(
  missingWorkflow
    .policy.verdict,
  "insufficient_evidence",
);

assert.equal(
  missingWorkflow
    .policy
    .productionAuthorityGranted,
  false,
);

/*
 * CASE 5:
 * Missing Decision Authority must fail closed.
 */
const missingAuthority =
  evaluateWorkflowAuthorityHandoff(
    null,
    workflow(
      "strategy-challenger",
    ),
  );

assert.equal(
  missingAuthority.available,
  false,
);

assert.equal(
  missingAuthority
    .identityVerified,
  false,
);

assert.equal(
  missingAuthority
    .policy.verdict,
  "insufficient_evidence",
);

assert.equal(
  missingAuthority
    .policy
    .productionAuthorityGranted,
  false,
);

/*
 * Critical invariant:
 * identity failure can never grant
 * shadow automation or production authority.
 */
for (
  const result of [
    mismatch,
    missingWorkflowIdentity,
    missingWorkflow,
    missingAuthority,
  ]
) {
  assert.equal(
    result.policy
      .automationEligibleInShadow,
    false,
  );

  assert.equal(
    result.policy
      .productionAuthorityGranted,
    false,
  );
}

console.log(
  "✓ Brain Workflow Authority Handoff regression test passed",
);

console.log({
  matchingIdentity: {
    verified:
      matching.identityVerified,

    verdict:
      matching.policy.verdict,

    productionAuthorityStillBlocked:
      !matching.policy
        .productionAuthorityGranted,
  },

  mismatchedIdentityFailsClosed: {
    verified:
      mismatch.identityVerified,

    verdict:
      mismatch.policy.verdict,

    automationBlocked:
      !mismatch.policy
        .automationEligibleInShadow,
  },

  missingIdentityFailsClosed:
    missingWorkflowIdentity
      .policy.verdict ===
    "insufficient_evidence",

  missingWorkflowFailsClosed:
    missingWorkflow
      .policy.verdict ===
    "insufficient_evidence",

  missingAuthorityFailsClosed:
    missingAuthority
      .policy.verdict ===
    "insufficient_evidence",
});