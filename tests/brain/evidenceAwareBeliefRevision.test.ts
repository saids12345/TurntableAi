import assert from "node:assert/strict";

import {
  createBeliefSystem,
} from "../../src/lib/brain/reasoning/beliefSystem";

import type {
  BeliefSystem,
} from "../../src/lib/brain/reasoning/beliefSystem";

import type {
  HypothesisResult,
} from "../../src/lib/brain/reasoning/hypothesisEngine";

function buildHypothesisResult(
  supportingEvidence: string[],
): HypothesisResult {
  return {
    evidence: [
      {
        id: "evidence-revenue",
        title: "Revenue pressure",
        value: "Revenue is below target.",
        confidence: 0.9,
      },

      {
        id: "evidence-orders",
        title: "Order pressure",
        value: "Order volume is below target.",
        confidence: 0.9,
      },

      {
        id: "evidence-traffic",
        title: "Traffic pressure",
        value: "Guest traffic is below target.",
        confidence: 0.9,
      },
    ],

    hypotheses: [
      {
        id: "demand-pressure",

        title:
          "Demand pressure is limiting performance.",

        description:
          "Current operating evidence suggests demand pressure is the primary constraint.",

        confidence: 0.74,

        supportingEvidence,

        contradictingEvidence: [],

        evidenceCoverage: 0.7,
      },
    ],
  };
}

/*
 * Run #1:
 * A brand-new belief is created.
 *
 * Creation is not a reconsideration and is not a revision.
 */
const initialSystem =
  createBeliefSystem(
    buildHypothesisResult([
      "evidence-revenue",
      "evidence-orders",
    ]),
  );

const initialBelief =
  initialSystem.beliefs[0];

assert.ok(
  initialBelief,
);

assert.equal(
  initialBelief.reconsiderationCount,
  0,
);

assert.equal(
  initialBelief.revisionCount,
  0,
);

/*
 * Run #2:
 * The exact same belief is evaluated again.
 *
 * This is a reconsideration, but nothing materially changed.
 */
const reconsideredSystem =
  createBeliefSystem(
    buildHypothesisResult([
      "evidence-revenue",
      "evidence-orders",
    ]),
    initialSystem,
  );

const reconsideredBelief =
  reconsideredSystem.beliefs[0];

assert.ok(
  reconsideredBelief,
);

assert.equal(
  reconsideredBelief.reconsiderationCount,
  1,
);

assert.equal(
  reconsideredBelief.revisionCount,
  0,
);

/*
 * Run #3:
 * The same evidence appears in a different order.
 *
 * Reordering evidence must not create a false revision.
 */
const reorderedSystem =
  createBeliefSystem(
    buildHypothesisResult([
      "evidence-orders",
      "evidence-revenue",
    ]),
    reconsideredSystem,
  );

const reorderedBelief =
  reorderedSystem.beliefs[0];

assert.ok(
  reorderedBelief,
);

assert.equal(
  reorderedBelief.reconsiderationCount,
  2,
);

assert.equal(
  reorderedBelief.revisionCount,
  0,
);

/*
 * Run #4:
 * One supporting evidence item actually changes.
 *
 * Confidence can remain similar, but the belief's evidence
 * basis changed, so this is a genuine revision.
 */
const revisedSystem =
  createBeliefSystem(
    buildHypothesisResult([
      "evidence-revenue",
      "evidence-traffic",
    ]),
    reorderedSystem,
  );

const revisedBelief =
  revisedSystem.beliefs[0];

assert.ok(
  revisedBelief,
);

assert.equal(
  revisedBelief.reconsiderationCount,
  3,
);

assert.equal(
  revisedBelief.revisionCount,
  1,
);

/*
 * Backward compatibility:
 *
 * Beliefs persisted before reconsiderationCount existed used
 * revisionCount for every rerun. Treat that old value as
 * reconsideration history rather than verified material
 * revision history.
 */
const legacySystem: BeliefSystem = {
  ...initialSystem,

  beliefs:
    initialSystem.beliefs.map(
      (belief) => ({
        ...belief,

        reconsiderationCount:
          undefined,

        revisionCount:
          4,
      }),
    ),
};

const legacyTransitionSystem =
  createBeliefSystem(
    buildHypothesisResult([
      "evidence-revenue",
      "evidence-orders",
    ]),
    legacySystem,
  );

const legacyTransitionBelief =
  legacyTransitionSystem
    .beliefs[0];

assert.ok(
  legacyTransitionBelief,
);

assert.equal(
  legacyTransitionBelief
    .reconsiderationCount,
  5,
);

assert.equal(
  legacyTransitionBelief
    .revisionCount,
  0,
);

console.log(
  "✓ Evidence-Aware Belief Revision regression test passed",
);

console.log({
  initial: {
    reconsiderations:
      initialBelief
        .reconsiderationCount,

    revisions:
      initialBelief
        .revisionCount,
  },

  unchangedRerun: {
    reconsiderations:
      reconsideredBelief
        .reconsiderationCount,

    revisions:
      reconsideredBelief
        .revisionCount,
  },

  reorderedEvidence: {
    reconsiderations:
      reorderedBelief
        .reconsiderationCount,

    revisions:
      reorderedBelief
        .revisionCount,
  },

  materiallyChangedEvidence: {
    reconsiderations:
      revisedBelief
        .reconsiderationCount,

    revisions:
      revisedBelief
        .revisionCount,
  },

  legacyTransition: {
    reconsiderations:
      legacyTransitionBelief
        .reconsiderationCount,

    revisions:
      legacyTransitionBelief
        .revisionCount,
  },
});
