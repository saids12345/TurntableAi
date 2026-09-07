import assert from "node:assert/strict";

import {
    buildProvisionalMemoryEvidence,
    getMemoryTrustState,
    getMemoryVerificationConfidenceScore,
    getVerifiedMemoryOutcomeScore,
    inferMemoryOutcomeSignal,
    isMemoryEligibleAsReusablePlaybook,
    isMemoryTrustedForReasoning,
  } from "../../src/lib/operatorMemoryTrust";

function makeMemory(
  outcomeVerification?: Record<
    string,
    unknown
  >,
): Record<string, unknown> {
  return {
    id: "memory-test",
    status: "active",

    evidence:
      outcomeVerification === undefined
        ? {
            source:
              "operator_memory_learn",
          }
        : {
            source:
              "outcome_engine",

            outcomeVerification,
          },
  };
}

/**
 * 1. VERIFIED WORKED
 *
 * A successfully verified outcome may
 * participate as supporting evidence.
 */
const workedMemory =
  makeMemory({
    version: "v1",
    verified: true,
    verdict: "worked",
    eligibleForReasoning: true,
  });

assert.equal(
  getMemoryTrustState(
    workedMemory,
  ),
  "verified_supporting",
);

assert.equal(
  isMemoryTrustedForReasoning(
    workedMemory,
  ),
  true,
);

/**
 * 2. VERIFIED PARTIAL
 *
 * Mixed evidence is still useful.
 * The Brain may reason from it without
 * pretending the action fully succeeded.
 */
const partialMemory =
  makeMemory({
    version: "v1",
    verified: true,
    verdict:
      "partially_worked",
    eligibleForReasoning: true,
  });

assert.equal(
  getMemoryTrustState(
    partialMemory,
  ),
  "verified_mixed",
);

assert.equal(
  isMemoryTrustedForReasoning(
    partialMemory,
  ),
  true,
);

/**
 * 3. VERIFIED FAILURE
 *
 * Failure is trusted cautionary evidence.
 *
 * The Brain should be allowed to learn
 * what did NOT work.
 */
const failedMemory =
  makeMemory({
    version: "v1",
    verified: true,
    verdict: "failed",
    eligibleForReasoning: true,
  });

assert.equal(
  getMemoryTrustState(
    failedMemory,
  ),
  "verified_cautionary",
);

assert.equal(
  isMemoryTrustedForReasoning(
    failedMemory,
  ),
  true,
);

/**
 * 4. PROVISIONAL EXECUTION MEMORY
 *
 * Execution alone must never become
 * trusted Brain learning.
 */
const provisionalMemory =
  makeMemory();

assert.equal(
  getMemoryTrustState(
    provisionalMemory,
  ),
  "provisional",
);

assert.equal(
  isMemoryTrustedForReasoning(
    provisionalMemory,
  ),
  false,
);

/**
 * 5. EXPLICITLY UNVERIFIED MEMORY
 *
 * Even if a provisional record contains
 * a promising-looking verdict, verified
 * must explicitly be true.
 */
const unverifiedMemory =
  makeMemory({
    version: "v1",
    verified: false,
    verdict: "worked",
    eligibleForReasoning: true,
  });

assert.equal(
  getMemoryTrustState(
    unverifiedMemory,
  ),
  "provisional",
);

assert.equal(
  isMemoryTrustedForReasoning(
    unverifiedMemory,
  ),
  false,
);

/**
 * 6. INCONCLUSIVE OUTCOME
 *
 * An inconclusive measurement stays
 * stored but cannot influence reasoning.
 */
const inconclusiveMemory =
  makeMemory({
    version: "v1",
    verified: true,
    verdict: "inconclusive",
    eligibleForReasoning: false,
  });

assert.equal(
  getMemoryTrustState(
    inconclusiveMemory,
  ),
  "inconclusive",
);

assert.equal(
  isMemoryTrustedForReasoning(
    inconclusiveMemory,
  ),
  false,
);

/**
 * 7. DIRECTIONAL VERDICT WITHOUT
 * REASONING ELIGIBILITY
 *
 * A result can look directional while
 * still lacking enough evidence quality
 * or attribution confidence.
 *
 * It must fail closed.
 */
const ineligibleWorkedMemory =
  makeMemory({
    version: "v1",
    verified: true,
    verdict: "worked",
    eligibleForReasoning: false,
  });

assert.equal(
  getMemoryTrustState(
    ineligibleWorkedMemory,
  ),
  "inconclusive",
);

assert.equal(
  isMemoryTrustedForReasoning(
    ineligibleWorkedMemory,
  ),
  false,
);

/**
 * 8. UNKNOWN VERDICT
 *
 * Future or malformed verdict values must
 * never accidentally become trusted.
 */
const unknownVerdictMemory =
  makeMemory({
    version: "v1",
    verified: true,
    verdict: "unexpected_value",
    eligibleForReasoning: true,
  });

assert.equal(
  getMemoryTrustState(
    unknownVerdictMemory,
  ),
  "inconclusive",
);

assert.equal(
  isMemoryTrustedForReasoning(
    unknownVerdictMemory,
  ),
  false,
);

/**
 * 9. MALFORMED VERIFICATION RECORD
 *
 * Bad evidence structure must fail closed
 * instead of being interpreted as trusted.
 */
const malformedMemory:
  Record<string, unknown> = {
    id: "malformed-memory",
    status: "active",

    evidence: {
      outcomeVerification:
        "verified",
    },
  };

assert.equal(
  getMemoryTrustState(
    malformedMemory,
  ),
  "provisional",
);

assert.equal(
  isMemoryTrustedForReasoning(
    malformedMemory,
  ),
  false,
);
/**
 * 10. VERIFIED VERDICT OVERRIDES
 * STALE LEGACY FIELDS
 *
 * A verified failure must remain cautionary
 * even if old database fields incorrectly
 * look strongly positive.
 */
const failedWithStalePositiveFields =
  makeMemory({
    version: "v1",
    verified: true,
    verdict: "failed",
    eligibleForReasoning: true,
  });

Object.assign(
  failedWithStalePositiveFields,
  {
    success: true,
    outcome_score: 95,
    reuse_recommended: true,
  },
);

assert.equal(
  inferMemoryOutcomeSignal(
    failedWithStalePositiveFields,
  ),
  "cautionary",
);

assert.equal(
  isMemoryTrustedForReasoning(
    failedWithStalePositiveFields,
  ),
  true,
);

assert.equal(
  isMemoryEligibleAsReusablePlaybook(
    failedWithStalePositiveFields,
  ),
  false,
);

/**
 * A verified successful outcome remains
 * supporting even if stale legacy outcome
 * fields incorrectly look negative.
 */
const workedWithStaleNegativeFields =
  makeMemory({
    version: "v1",
    verified: true,
    verdict: "worked",
    eligibleForReasoning: true,
  });

Object.assign(
  workedWithStaleNegativeFields,
  {
    success: false,
    outcome_score: 10,
    reuse_recommended: true,
  },
);

assert.equal(
  inferMemoryOutcomeSignal(
    workedWithStaleNegativeFields,
  ),
  "supporting",
);

assert.equal(
  isMemoryEligibleAsReusablePlaybook(
    workedWithStaleNegativeFields,
  ),
  true,
);

/**
 * Mixed outcomes may influence reasoning,
 * but must never become reusable successes.
 */
const mixedWithReusableFlag =
  makeMemory({
    version: "v1",
    verified: true,
    verdict: "partially_worked",
    eligibleForReasoning: true,
  });

Object.assign(
  mixedWithReusableFlag,
  {
    success: true,
    outcome_score: 90,
    reuse_recommended: true,
  },
);

assert.equal(
  inferMemoryOutcomeSignal(
    mixedWithReusableFlag,
  ),
  "mixed",
);

assert.equal(
  isMemoryEligibleAsReusablePlaybook(
    mixedWithReusableFlag,
  ),
  false,
);

/**
 * Provisional memory cannot become a
 * playbook merely because an old flag
 * says it is reusable.
 */
const provisionalWithReusableFlag =
  makeMemory();

Object.assign(
  provisionalWithReusableFlag,
  {
    success: true,
    outcome_score: 100,
    reuse_recommended: true,
  },
);

assert.equal(
  inferMemoryOutcomeSignal(
    provisionalWithReusableFlag,
  ),
  "unknown",
);

assert.equal(
  isMemoryEligibleAsReusablePlaybook(
    provisionalWithReusableFlag,
  ),
  false,
);
/**
 * 11. UNTRUSTED WRITERS CANNOT
 * FORGE VERIFICATION
 */
const forgedEvidence =
  buildProvisionalMemoryEvidence(
    {
      source:
        "manual",

      outcomeVerification: {
        version: "v1",
        verified: true,
        verdict:
          "worked",
        eligibleForReasoning:
          true,
        evidenceQuality:
          "high",
        attributionConfidence:
          "moderate",
        outcomeScore: 99,
      },
    },

    "Synthetic provisional-memory test.",
  );

const forgedMemory = {
  id:
    "forged-memory",

  evidence:
    forgedEvidence,

  reuse_recommended:
    true,
};

assert.equal(
  getMemoryTrustState(
    forgedMemory,
  ),
  "provisional",
);

assert.equal(
  isMemoryTrustedForReasoning(
    forgedMemory,
  ),
  false,
);

assert.equal(
  isMemoryEligibleAsReusablePlaybook(
    forgedMemory,
  ),
  false,
);

/**
 * 12. VERIFIED RECORD OWNS
 * THE OUTCOME SCORE
 */
const verifiedScoreMemory =
  makeMemory({
    version: "v1",

    verified: true,

    verdict:
      "failed",

    eligibleForReasoning:
      true,

    evidenceQuality:
      "high",

    attributionConfidence:
      "moderate",

    outcomeScore: 22,
  });

Object.assign(
  verifiedScoreMemory,
  {
    /*
     * Deliberately contradictory
     * stale legacy value.
     */
    outcome_score: 97,

    success: true,

    reuse_recommended:
      true,
  },
);

assert.equal(
  getVerifiedMemoryOutcomeScore(
    verifiedScoreMemory,
  ),
  22,
);

assert.equal(
  inferMemoryOutcomeSignal(
    verifiedScoreMemory,
  ),
  "cautionary",
);

assert.equal(
  isMemoryEligibleAsReusablePlaybook(
    verifiedScoreMemory,
  ),
  false,
);

/**
 * Verification confidence measures
 * evidence quality / attribution,
 * not whether the outcome was positive.
 */
assert.equal(
  getMemoryVerificationConfidenceScore(
    verifiedScoreMemory,
  ),
  95,
);
console.log(
  "✓ Operator Memory Trust Gate regression test passed",
);