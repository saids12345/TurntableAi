import assert from "node:assert/strict";

import {
  getOutcomeMemorySourceActionId,
  getEffectiveOutcomeVerificationAgeHours,
  MIN_OUTCOME_VERIFICATION_AGE_HOURS,
  nearestOutcomeSnapshotBefore,
  nearestOutcomeSnapshotAfter,
  type OutcomeDelta,
  type OutcomeEvaluation,
} from "../../src/lib/outcomeEngine";

import {
  verifyDecisionOutcome,
} from "../../src/lib/brain/outcomeVerification/decisionOutcomeVerifier";

function makeEvaluation(params: {
  delta?: Partial<OutcomeDelta>;
  outcomeScore: number;
  success: boolean | null;
  measuredFields: number;
  status?: OutcomeEvaluation["status"];
}): OutcomeEvaluation {
  const delta: OutcomeDelta = {
    revenueDeltaPct: null,
    ordersDeltaPct: null,
    avgTicketDeltaPct: null,
    laborDeltaPct: null,
    marginDeltaPct: null,
    refundDeltaPct: null,
    ratingDelta: null,
    reviewIssueDelta: null,
    ...params.delta,
  };

  return {
    status:
      params.status ??
      (
        params.measuredFields >= 2
          ? "measured"
          : "partial"
      ),

    locationName:
      "Chula Vista",

    actionType:
      "operator_review",

    problemType:
      "growth",

    actionTitle:
      "Run a Controlled Growth Test",

    sourceActionId:
      "action-test-1",

    sourceOutcomeId:
      null,

    measuredAt:
      "2026-09-06T18:00:00.000Z",

    baseline: {
      revenue: 1000,
      orders: 100,
      avgTicket: 10,
      laborPct: 30,
      marginPct: 20,
      refunds: 10,
      avgRating: 4.2,
      reviewIssueCount: 5,
      capturedAt:
        "2026-09-05T18:00:00.000Z",
    },

    current: {
      revenue: 1080,
      orders: 105,
      avgTicket: 10.3,
      laborPct: 29,
      marginPct: 21,
      refunds: 9,
      avgRating: 4.3,
      reviewIssueCount: 4,
      capturedAt:
        "2026-09-06T18:00:00.000Z",
    },

    delta,

    outcomeScore:
      params.outcomeScore,

    success:
      params.success,

    lessonStrength:
      params.outcomeScore >= 75
        ? "strong"
        : params.outcomeScore >= 55
          ? "developing"
          : "weak",

    confidence:
      params.measuredFields >= 5
        ? "high"
        : params.measuredFields >= 2
          ? "medium"
          : "low",

    reuseRecommended:
      params.outcomeScore >= 65,

    summary:
      "Synthetic outcome evaluation.",

    lesson:
      "Synthetic test lesson.",

    evidence: {
      source:
        "outcome_engine",

      version:
        "v1",

      measuredFields:
        params.measuredFields,

      executedAt:
        "2026-09-06T12:00:00.000Z",

      sourceActionId:
        "action-test-1",
    },
  };
}

/**
 * 1. WORKED
 *
 * The intended metrics improve,
 * evidence is strong,
 * no material downside appears,
 * and attribution requirements are present.
 */
const worked =
  verifyDecisionOutcome({
    evaluation:
      makeEvaluation({
        outcomeScore: 82,
        success: true,
        measuredFields: 6,

        delta: {
          revenueDeltaPct: 8,
          marginDeltaPct: 1.2,
          ratingDelta: 0.1,
        },
      }),

    expectedOutcome:
      "Revenue grows profitably while margin and guest rating remain protected.",

    successMetric:
      "Revenue and margin improve without weakening guest rating.",

    failureConditions: [
      "Margin declines.",
      "Guest rating declines.",
    ],

    now:
      "2026-09-06T19:00:00.000Z",
  });

assert.equal(
  worked.verdict,
  "worked",
);

assert.equal(
  worked.verified,
  true,
);

assert.equal(
  worked.eligibleForReasoning,
  true,
);

assert.equal(
  worked.evidenceQuality,
  "high",
);

assert.equal(
  worked.attributionConfidence,
  "moderate",
);

assert.ok(
  worked.supportingSignals.length >
    0,
);

assert.equal(
  worked.conflictingSignals.length,
  0,
);

assert.equal(
  worked.sideEffects.length,
  0,
);

/**
 * 2. PARTIALLY WORKED
 *
 * Revenue improves, but margin moves
 * against the original success contract.
 */
const partial =
  verifyDecisionOutcome({
    evaluation:
      makeEvaluation({
        outcomeScore: 66,
        success: true,
        measuredFields: 4,

        delta: {
          revenueDeltaPct: 7,
          marginDeltaPct: -1,
        },
      }),

    expectedOutcome:
      "Increase revenue while protecting profitability.",

    successMetric:
      "Revenue improves without margin deterioration.",

    failureConditions: [
      "Margin declines.",
    ],

    now:
      "2026-09-06T19:00:00.000Z",
  });

assert.equal(
  partial.verdict,
  "partially_worked",
);

assert.equal(
  partial.verified,
  true,
);

assert.equal(
  partial.eligibleForReasoning,
  true,
);

assert.ok(
  partial.supportingSignals.length >
    0,
);

assert.ok(
  partial.conflictingSignals.length >
    0,
);

/**
 * 3. FAILED
 *
 * The exact target metrics move
 * materially against the intended result.
 */
const failed =
  verifyDecisionOutcome({
    evaluation:
      makeEvaluation({
        outcomeScore: 28,
        success: false,
        measuredFields: 5,

        delta: {
          revenueDeltaPct: -8,
          ordersDeltaPct: -6,
        },
      }),

    expectedOutcome:
      "Revenue and order demand improve.",

    successMetric:
      "Revenue and orders increase.",

    failureConditions: [
      "Revenue declines.",
      "Orders decline.",
    ],

    now:
      "2026-09-06T19:00:00.000Z",
  });

assert.equal(
  failed.verdict,
  "failed",
);

assert.equal(
  failed.verified,
  true,
);

assert.equal(
  failed.eligibleForReasoning,
  true,
);

assert.ok(
  failed.conflictingSignals.length >=
    2,
);

/**
 * Verified failure is still valid
 * reasoning evidence.
 *
 * The Brain should learn what NOT to repeat.
 */
assert.equal(
  failed.attributionConfidence,
  "moderate",
);

/**
 * 4. SIDE-EFFECT DOWNGRADE
 *
 * The intended revenue target succeeds,
 * but an unrelated guest-rating decline
 * prevents a clean "worked" verdict.
 */
const sideEffect =
  verifyDecisionOutcome({
    evaluation:
      makeEvaluation({
        outcomeScore: 72,
        success: true,
        measuredFields: 5,

        delta: {
          revenueDeltaPct: 8,
          ratingDelta: -0.2,
        },
      }),

    expectedOutcome:
      "Increase revenue.",

    successMetric:
      "Revenue improves.",

    failureConditions: [],

    now:
      "2026-09-06T19:00:00.000Z",
  });

assert.equal(
  sideEffect.verdict,
  "partially_worked",
);

assert.equal(
  sideEffect.verified,
  true,
);

assert.ok(
  sideEffect.sideEffects.length >
    0,
);

assert.ok(
  sideEffect.sideEffects.some(
    (item) =>
      item.includes(
        "rating",
      ),
  ),
);

/**
 * 5. INSUFFICIENT EVIDENCE
 *
 * A positive-looking number must NOT
 * become trusted learning when the
 * measurement coverage is too weak.
 */
const insufficient =
  verifyDecisionOutcome({
    evaluation:
      makeEvaluation({
        outcomeScore: 90,
        success: true,
        measuredFields: 1,

        delta: {
          revenueDeltaPct: 12,
        },
      }),

    expectedOutcome:
      "Increase revenue.",

    successMetric:
      "Revenue improves.",

    failureConditions: [],

    now:
      "2026-09-06T19:00:00.000Z",
  });

assert.equal(
  insufficient.verdict,
  "inconclusive",
);

assert.equal(
  insufficient.verified,
  false,
);

assert.equal(
  insufficient.eligibleForReasoning,
  false,
);

assert.equal(
  insufficient.evidenceQuality,
  "insufficient",
);

/**
 * 6. LOW EVIDENCE FAILS CLOSED
 *
 * Two measured fields are enough for a
 * directional verdict, but NOT enough
 * for trusted Brain reasoning.
 */
const lowEvidence =
  verifyDecisionOutcome({
    evaluation:
      makeEvaluation({
        outcomeScore: 76,
        success: true,
        measuredFields: 2,

        delta: {
          revenueDeltaPct: 6,
        },
      }),

    expectedOutcome:
      "Increase revenue.",

    successMetric:
      "Revenue improves.",

    failureConditions: [],

    now:
      "2026-09-06T19:00:00.000Z",
  });

assert.equal(
  lowEvidence.verdict,
  "worked",
);

assert.equal(
  lowEvidence.verified,
  true,
);

assert.equal(
  lowEvidence.evidenceQuality,
  "low",
);

assert.equal(
  lowEvidence.eligibleForReasoning,
  false,
);

/**
 * 7. MISSING ORIGINAL CONTRACT
 *
 * Even excellent performance must not
 * be attributed to a decision when the
 * Brain cannot recover what that decision
 * was actually supposed to accomplish.
 */
const missingContract =
  verifyDecisionOutcome({
    evaluation:
      makeEvaluation({
        outcomeScore: 95,
        success: true,
        measuredFields: 8,

        delta: {
          revenueDeltaPct: 15,
          ordersDeltaPct: 10,
          marginDeltaPct: 2,
        },
      }),

    expectedOutcome:
      null,

    successMetric:
      null,

    failureConditions: [],

    now:
      "2026-09-06T19:00:00.000Z",
  });

assert.equal(
  missingContract.verdict,
  "inconclusive",
);

assert.equal(
  missingContract.verified,
  false,
);

assert.equal(
  missingContract.eligibleForReasoning,
  false,
);

assert.equal(
  missingContract.targetMetrics.length,
  0,
);
/**
 * 8. EXACT ACTION MEMORY IDENTITY
 *
 * Outcome verification must preserve the
 * exact auto-action identity. Two actions
 * with otherwise identical context must
 * never collapse into the same identity.
 */
const actionAEvaluation =
  makeEvaluation({
    outcomeScore: 80,
    success: true,
    measuredFields: 5,
  });

actionAEvaluation.sourceActionId =
  "action-a";

const actionBEvaluation =
  makeEvaluation({
    outcomeScore: 80,
    success: true,
    measuredFields: 5,
  });

actionBEvaluation.sourceActionId =
  "action-b";

const actionAIdentity =
  getOutcomeMemorySourceActionId(
    actionAEvaluation,
  );

const actionBIdentity =
  getOutcomeMemorySourceActionId(
    actionBEvaluation,
  );

assert.equal(
  actionAIdentity,
  "action-a",
);

assert.equal(
  actionBIdentity,
  "action-b",
);

assert.notEqual(
  actionAIdentity,
  actionBIdentity,
);

/**
 * Missing identities fail closed.
 *
 * A verified outcome must never be allowed
 * to update memory without knowing exactly
 * which executed action produced it.
 */
const missingIdentityEvaluation =
  makeEvaluation({
    outcomeScore: 90,
    success: true,
    measuredFields: 6,
  });

missingIdentityEvaluation.sourceActionId =
  null;

assert.throws(
  () =>
    getOutcomeMemorySourceActionId(
      missingIdentityEvaluation,
    ),
  /requires a sourceActionId/,
);

const blankIdentityEvaluation =
  makeEvaluation({
    outcomeScore: 90,
    success: true,
    measuredFields: 6,
  });

blankIdentityEvaluation.sourceActionId =
  "   ";

assert.throws(
  () =>
    getOutcomeMemorySourceActionId(
      blankIdentityEvaluation,
    ),
  /requires a sourceActionId/,
);
/**
 * 9. OUTCOME OBSERVATION WINDOW SAFETY
 *
 * Verification must wait at least 24 hours,
 * require a genuine pre-execution baseline,
 * and require a mature post-execution snapshot.
 */
assert.equal(
  MIN_OUTCOME_VERIFICATION_AGE_HOURS,
  24,
);

const executedAt =
  "2026-09-05T12:00:00.000Z";

const verificationReadyAt =
  "2026-09-06T12:00:00.000Z";

const observationRows = [
  {
    id: "before-valid",
    location_name: "Chula Vista",
    revenue: 1000,
    orders: 100,
    avg_ticket: 10,
    labor_pct: 30,
    margin_pct: 20,
    refunds: 10,
    captured_at:
      "2026-09-05T11:00:00.000Z",
  },

  {
    id: "too-early-after",
    location_name: "Chula Vista",
    revenue: 1040,
    orders: 102,
    avg_ticket: 10.2,
    labor_pct: 29.8,
    margin_pct: 20.2,
    refunds: 10,
    captured_at:
      "2026-09-05T13:00:00.000Z",
  },

  {
    id: "mature-after",
    location_name: "Chula Vista",
    revenue: 1100,
    orders: 108,
    avg_ticket: 10.4,
    labor_pct: 29,
    margin_pct: 21,
    refunds: 9,
    captured_at:
      "2026-09-06T13:00:00.000Z",
  },
];

const trueBaseline =
  nearestOutcomeSnapshotBefore(
    observationRows,
    executedAt,
  );

assert.equal(
  trueBaseline?.id,
  "before-valid",
);

/**
 * A post-execution row must never become
 * the "before" baseline.
 */
const noBaselineRows =
  observationRows.filter(
    (row) =>
      row.id !==
      "before-valid",
  );

assert.equal(
  nearestOutcomeSnapshotBefore(
    noBaselineRows,
    executedAt,
  ),
  null,
);

/**
 * The row captured only one hour after
 * execution must be ignored.
 *
 * Selection begins at the 24-hour
 * verification maturity point.
 */
const matureSnapshot =
  nearestOutcomeSnapshotAfter(
    observationRows,
    verificationReadyAt,
  );

assert.equal(
  matureSnapshot?.id,
  "mature-after",
);

assert.notEqual(
  matureSnapshot?.id,
  "too-early-after",
);

/**
 * If there is no snapshot at or beyond
 * the maturity point, verification has
 * no valid post-action performance data.
 */
const immatureOnlyRows =
  observationRows.filter(
    (row) =>
      row.id !==
      "mature-after",
  );

assert.equal(
  nearestOutcomeSnapshotAfter(
    immatureOnlyRows,
    verificationReadyAt,
  ),
  null,
);
/**
 * 10. EFFECTIVE VERIFICATION AGE
 *
 * Callers may request a longer observation
 * window, but never a shorter one.
 */
assert.equal(
  getEffectiveOutcomeVerificationAgeHours(0),
  24,
);

assert.equal(
  getEffectiveOutcomeVerificationAgeHours(12),
  24,
);

assert.equal(
  getEffectiveOutcomeVerificationAgeHours(24),
  24,
);

assert.equal(
  getEffectiveOutcomeVerificationAgeHours(48),
  48,
);

assert.equal(
  getEffectiveOutcomeVerificationAgeHours(),
  24,
);
console.log(
  "✓ Decision Outcome Verification regression test passed",
);