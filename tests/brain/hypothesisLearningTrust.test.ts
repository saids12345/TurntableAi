import assert from "node:assert/strict";

import type {
  BrainContext,
} from "@/lib/brain/brainContext";

import {
  buildHypotheses,
} from "@/lib/brain/reasoning/hypothesisEngine";

function createContext(
  memories: Record<
    string,
    unknown
  >[],
): BrainContext {
  return {
    metadata: {
      runId:
        "hypothesis-learning-trust-test",
      status:
        "running",
      currentPhase:
        "reasoning",
      startedAt:
        "2026-09-14T00:00:00.000Z",
      completedAt:
        null,
      errors: [],
    },

    workingMemory:
      {} as BrainContext["workingMemory"],

    perception: {},

    knowledge: {
      knowledgeModel:
        undefined,

      operatorMemory: {
        recentMemories:
          memories,
      },
    },

    reasoning: {},

    action: {},

    learningState: {},
  };
}

function createMemory(params: {
  id: string;

  verified: boolean;

  verdict:
    | "worked"
    | "partially_worked"
    | "failed"
    | "inconclusive";

  eligibleForReasoning: boolean;

  evidenceQuality:
    | "high"
    | "medium"
    | "low"
    | "insufficient";

  attributionConfidence:
    | "moderate"
    | "weak"
    | "insufficient";
}) {
  return {
    id:
      params.id,

    source_action_id:
      `action-${params.id}`,

    location_name:
      "Test Restaurant",

    problem_type:
      "growth",

    action_type:
      "controlled_growth_test",

    action_title:
      "Run a Controlled Growth Test",

    /*
     * Deliberately high legacy confidence.
     *
     * A provisional memory must still be rejected,
     * and a verified memory's reasoning weight must
     * come from verification quality instead.
     */
    confidence:
      0.99,

    outcome_score:
      85,

    result_summary:
      "Revenue increased while the restaurant maintained available operating capacity.",

    lesson:
      "Controlled growth performed well when sufficient capacity was available.",

    evidence: {
      outcomeVerification: {
        version:
          "v1",

        verified:
          params.verified,

        verdict:
          params.verdict,

        eligibleForReasoning:
          params
            .eligibleForReasoning,

        evidenceQuality:
          params
            .evidenceQuality,

        attributionConfidence:
          params
            .attributionConfidence,

        outcomeScore:
          85,
      },
    },

    created_at:
      "2026-09-12T00:00:00.000Z",

    updated_at:
      "2026-09-14T00:00:00.000Z",
  };
}

function getLearnedOutcomeEvidence(
  context: BrainContext,
) {
  return buildHypotheses(
    context,
  ).evidence.filter(
    (item) =>
      item.source ===
        "operator_memory" &&
      item.path?.includes(
        "knowledge.operatorMemory.recentMemories",
      ),
  );
}

function getGrowthHypothesis(
  context: BrainContext,
) {
  return buildHypotheses(
    context,
  ).hypotheses.find(
    (hypothesis) =>
      hypothesis.category ===
      "growth",
  );
}

/*
 * CASE 1:
 * Provisional memory must not enter the
 * learned-outcome reasoning lane.
 *
 * Even though it carries:
 * - confidence = 0.99
 * - outcome_score = 85
 * - positive result text
 *
 * none of that is allowed to bypass
 * Decision Outcome Verification.
 */
const provisionalMemory =
  createMemory({
    id:
      "provisional",

    verified:
      false,

    verdict:
      "inconclusive",

    eligibleForReasoning:
      false,

    evidenceQuality:
      "insufficient",

    attributionConfidence:
      "insufficient",
  });

const provisionalContext =
  createContext([
    provisionalMemory,
  ]);

const provisionalEvidence =
  getLearnedOutcomeEvidence(
    provisionalContext,
  );

assert.equal(
  provisionalEvidence.length,
  0,
);

/*
 * CASE 2:
 * A verified supporting memory is allowed
 * into future hypothesis reasoning.
 */
const verifiedHighMemory =
  createMemory({
    id:
      "verified-high",

    verified:
      true,

    verdict:
      "worked",

    eligibleForReasoning:
      true,

    evidenceQuality:
      "high",

    attributionConfidence:
      "moderate",
  });

const verifiedHighContext =
  createContext([
    verifiedHighMemory,
  ]);

const verifiedHighEvidence =
  getLearnedOutcomeEvidence(
    verifiedHighContext,
  );

assert.ok(
  verifiedHighEvidence.length >
    0,
);

const verifiedOutcomeScoreEvidence =
  verifiedHighEvidence.find(
    (item) =>
      item.path?.endsWith(
        ".outcome_score",
      ),
  );

assert.ok(
  verifiedOutcomeScoreEvidence,
);

/*
 * High evidence quality = 100
 * Moderate attribution = 90
 *
 * Canonical verification confidence:
 * (100 + 90) / 2 = 95
 *
 * Hypothesis evidence stores confidence
 * on a 0-1 scale.
 */
assert.equal(
  verifiedOutcomeScoreEvidence
    .confidence,
  0.95,
);

const highGrowthHypothesis =
  getGrowthHypothesis(
    verifiedHighContext,
  );

assert.ok(
  highGrowthHypothesis,
);

assert.ok(
  verifiedHighEvidence.some(
    (item) =>
      highGrowthHypothesis
        .supportingEvidence.includes(
          item.id,
        ),
  ),
);

/*
 * CASE 3:
 * A lower-quality verified outcome may
 * still participate in reasoning, but it
 * must receive less cognitive weight.
 */
const verifiedLowMemory =
  createMemory({
    id:
      "verified-low",

    verified:
      true,

    verdict:
      "worked",

    eligibleForReasoning:
      true,

    evidenceQuality:
      "low",

    attributionConfidence:
      "weak",
  });

const verifiedLowContext =
  createContext([
    verifiedLowMemory,
  ]);

const verifiedLowEvidence =
  getLearnedOutcomeEvidence(
    verifiedLowContext,
  );

assert.ok(
  verifiedLowEvidence.length >
    0,
);

const lowOutcomeScoreEvidence =
  verifiedLowEvidence.find(
    (item) =>
      item.path?.endsWith(
        ".outcome_score",
      ),
  );

assert.ok(
  lowOutcomeScoreEvidence,
);

/*
 * Low evidence quality = 50
 * Weak attribution = 55
 *
 * Math.round(
 *   (50 + 55) / 2
 * ) = 53
 */
assert.equal(
  lowOutcomeScoreEvidence
    .confidence,
  0.53,
);

assert.ok(
  verifiedOutcomeScoreEvidence
    .confidence >
    lowOutcomeScoreEvidence
      .confidence,
);

const lowGrowthHypothesis =
  getGrowthHypothesis(
    verifiedLowContext,
  );

assert.ok(
  lowGrowthHypothesis,
);

assert.ok(
  (
    highGrowthHypothesis.score ??
    0
  ) >
    (
      lowGrowthHypothesis.score ??
      0
    ),
);

/*
 * CASE 4:
 * Verified failure remains useful evidence.
 *
 * It must enter reasoning as cautionary /
 * negative evidence instead of being erased.
 */
const verifiedFailureMemory =
  createMemory({
    id:
      "verified-failure",

    verified:
      true,

    verdict:
      "failed",

    eligibleForReasoning:
      true,

    evidenceQuality:
      "high",

    attributionConfidence:
      "moderate",
  });

const failureContext =
  createContext([
    verifiedFailureMemory,
  ]);

const failureEvidence =
  getLearnedOutcomeEvidence(
    failureContext,
  );

assert.ok(
  failureEvidence.length >
    0,
);

assert.ok(
  failureEvidence.every(
    (item) =>
      item.direction ===
      "negative",
  ),
);

console.log(
  "✓ Brain Hypothesis Learning Trust regression test passed",
);

console.log({
  provisionalRejected:
    provisionalEvidence.length ===
    0,

  verifiedAccepted:
    verifiedHighEvidence.length >
    0,

  verificationConfidence: {
    high:
      verifiedOutcomeScoreEvidence
        .confidence,

    low:
      lowOutcomeScoreEvidence
        .confidence,

    higherQualityGetsMoreWeight:
      verifiedOutcomeScoreEvidence
        .confidence >
      lowOutcomeScoreEvidence
        .confidence,
  },

  hypothesisLearning: {
    highGrowthScore:
      highGrowthHypothesis.score,

    lowGrowthScore:
      lowGrowthHypothesis.score,

    higherQualityProducesStrongerReasoning:
      (
        highGrowthHypothesis.score ??
        0
      ) >
      (
        lowGrowthHypothesis.score ??
        0
      ),
  },

  verifiedFailureRetained:
    failureEvidence.length >
      0 &&
    failureEvidence.every(
      (item) =>
        item.direction ===
        "negative",
    ),
});