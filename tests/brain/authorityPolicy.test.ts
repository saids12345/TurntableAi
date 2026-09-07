import assert from "node:assert/strict";

import {
  evaluateAuthorityPolicy,
  type AuthorityPolicyContext,
} from "@/lib/brain/reasoning/authorityPolicy";

import type {
  DecisionAuthorityResult,
} from "@/lib/brain/reasoning/decisionAuthority";

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

const safeContext:
  AuthorityPolicyContext = {
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
  };

/*
 * CASE 1:
 * No revision exists.
 */

const preserved =
  evaluateAuthorityPolicy(
    authority({
      verdict:
        "production_winner_preserved",

      shadowSelectedStrategyId:
        "strategy-current",

      changedFromProduction:
        false,

      revisionVerified:
        false,

      authorityEligibleInShadow:
        false,
    }),

    safeContext,
  );

assert.equal(
  preserved.verdict,
  "production_winner_preserved",
);

assert.equal(
  preserved.productionAuthorityGranted,
  false,
);

assert.equal(
  preserved.automationEligibleInShadow,
  false,
);

/*
 * CASE 2:
 * Revision has not passed Decision Authority.
 */

const blocked =
  evaluateAuthorityPolicy(
    authority({
      verdict:
        "revision_blocked_unstable",

      authorityEligibleInShadow:
        false,

      stabilityVerified:
        false,
    }),

    safeContext,
  );

assert.equal(
  blocked.verdict,
  "blocked",
);

assert.equal(
  blocked.automationEligibleInShadow,
  false,
);

assert.equal(
  blocked.productionAuthorityGranted,
  false,
);

/*
 * CASE 3:
 * Unknown policy dimensions must fail closed.
 */

const unknownRisk =
  evaluateAuthorityPolicy(
    authority(),

    {
      riskLevel:
        "low",

      reversibility:
        "easy",

      financialExposure:
        "unknown",

      customerFacing:
        "unknown",

      legalOrComplianceImpact:
        "unknown",
    },
  );

assert.equal(
  unknownRisk.verdict,
  "insufficient_evidence",
);

assert.equal(
  unknownRisk.humanApprovalRequired,
  true,
);

assert.equal(
  unknownRisk.automationEligibleInShadow,
  false,
);

assert.equal(
  unknownRisk.integrity.passed,
  false,
);

assert.ok(
  unknownRisk.blockers.includes(
    "Financial exposure is unknown.",
  ),
);

assert.ok(
  unknownRisk.blockers.includes(
    "Customer-facing impact is unknown.",
  ),
);

assert.ok(
  unknownRisk.blockers.includes(
    "Legal or compliance impact is unknown.",
  ),
);

/*
 * CASE 4:
 * A completely known low-risk revision
 * can qualify for shadow automation.
 *
 * Production authority STILL remains off.
 */

const shadowEligible =
  evaluateAuthorityPolicy(
    authority(),
    safeContext,
  );

assert.equal(
  shadowEligible.verdict,
  "shadow_automation_eligible",
);

assert.equal(
  shadowEligible.authorityEligibleInShadow,
  true,
);

assert.equal(
  shadowEligible.automationEligibleInShadow,
  true,
);

assert.equal(
  shadowEligible.humanApprovalRequired,
  false,
);

assert.equal(
  shadowEligible.productionAuthorityGranted,
  false,
);

/*
 * CASE 5:
 * Material operational risk requires a human.
 */

const humanRequired =
  evaluateAuthorityPolicy(
    authority(),

    {
      riskLevel:
        "high",

      reversibility:
        "moderate",

      financialExposure:
        "medium",

      customerFacing:
        true,

      legalOrComplianceImpact:
        false,
    },
  );

assert.equal(
  humanRequired.verdict,
  "human_approval_required",
);

assert.equal(
  humanRequired.humanApprovalRequired,
  true,
);

assert.equal(
  humanRequired.automationEligibleInShadow,
  false,
);

assert.equal(
  humanRequired.productionAuthorityGranted,
  false,
);

assert.ok(
  humanRequired.blockers.length >=
    1,
);

/*
 * CASE 6:
 * Upstream integrity failure must fail closed.
 */

const integrityFailure =
  evaluateAuthorityPolicy(
    authority({
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
          false,
      },
    }),

    safeContext,
  );

assert.equal(
  integrityFailure.verdict,
  "integrity_failed",
);

assert.equal(
  integrityFailure.automationEligibleInShadow,
  false,
);

assert.equal(
  integrityFailure.productionAuthorityGranted,
  false,
);

/*
 * CASE 7:
 * Missing authority evidence must fail closed.
 */

const missingAuthority =
  evaluateAuthorityPolicy(
    null,
    safeContext,
  );

assert.equal(
  missingAuthority.verdict,
  "insufficient_evidence",
);

assert.equal(
  missingAuthority.available,
  false,
);

assert.equal(
  missingAuthority.productionAuthorityGranted,
  false,
);

/*
 * Critical invariant across every policy path:
 * policy can classify readiness,
 * but cannot execute or grant production authority.
 */
for (
  const result of [
    preserved,
    blocked,
    unknownRisk,
    shadowEligible,
    humanRequired,
    integrityFailure,
    missingAuthority,
  ]
) {
  assert.equal(
    result.productionAuthorityGranted,
    false,
  );

  assert.equal(
    result.shadowMode,
    true,
  );
}

console.log(
  "✓ Brain Authority Policy regression test passed",
);

console.log({
  preservedDecision:
    preserved.verdict,

  blockedRevision:
    blocked.verdict,

  unknownDataFailsClosed: {
    verdict:
      unknownRisk.verdict,

    humanApprovalRequired:
      unknownRisk.humanApprovalRequired,
  },

  safeRevision: {
    verdict:
      shadowEligible.verdict,

    shadowAutomationEligible:
      shadowEligible.automationEligibleInShadow,

    productionAuthorityStillBlocked:
      !shadowEligible.productionAuthorityGranted,
  },

  riskyRevision: {
    verdict:
      humanRequired.verdict,

    humanApprovalRequired:
      humanRequired.humanApprovalRequired,
  },

  integrityFailureFailsClosed:
    integrityFailure.verdict ===
    "integrity_failed",

  missingAuthorityFailsClosed:
    missingAuthority.verdict ===
    "insufficient_evidence",
});