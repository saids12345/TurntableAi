import assert from "node:assert/strict";

import {
  buildBeliefScopeKey,
  isBeliefSystem,
} from "../../src/lib/brain/beliefStateStore";

import type {
  BeliefSystem,
} from "../../src/lib/brain/reasoning/beliefSystem";

const networkScopeKey =
  buildBeliefScopeKey({
    mode: "network",
    locationName: null,
  });

assert.equal(
  networkScopeKey,
  "network",
);

const miraMesaScopeKey =
  buildBeliefScopeKey({
    mode: "single_location",
    locationName: "Mira Mesa",
  });

const normalizedMiraMesaScopeKey =
  buildBeliefScopeKey({
    mode: "single_location",
    locationName:
      "  mira---mesa  ",
  });

assert.equal(
  miraMesaScopeKey,
  "location:mira mesa",
);

assert.equal(
  normalizedMiraMesaScopeKey,
  miraMesaScopeKey,
);

assert.throws(
  () =>
    buildBeliefScopeKey({
      mode: "single_location",
      locationName: "   ",
    }),
  /location name is required/i,
);

const validBeliefSystem: BeliefSystem = {
  beliefs: [
    {
      id: "belief-demand",
      statement:
        "Demand pressure is the primary operating constraint.",
      confidence: 0.78,
      evidence: [
        "evidence-revenue",
        "evidence-orders",
      ],
      updatedAt:
        "2026-09-16T20:00:00.000Z",
    },
  ],

  primaryBelief: {
    id: "belief-demand",
    statement:
      "Demand pressure is the primary operating constraint.",
    confidence: 0.78,
    evidence: [
      "evidence-revenue",
      "evidence-orders",
    ],
    updatedAt:
      "2026-09-16T20:00:00.000Z",
  },

  overallConfidence: 0.78,
  evidenceCoverage: 0.7,
  uncertainty: 0.22,
};

assert.equal(
  isBeliefSystem(
    validBeliefSystem,
  ),
  true,
);

const malformedConfidence = {
  ...validBeliefSystem,

  beliefs: [
    {
      ...validBeliefSystem
        .beliefs[0],

      confidence: "high",
    },
  ],
};

assert.equal(
  isBeliefSystem(
    malformedConfidence,
  ),
  false,
);

const malformedEvidence = {
  beliefs: [
    {
      id: "belief-service",
      statement:
        "Service pressure is increasing.",
      confidence: 0.7,
      evidence: [
        "valid-evidence",
        123,
      ],
      updatedAt:
        "2026-09-16T20:00:00.000Z",
    },
  ],
};

assert.equal(
  isBeliefSystem(
    malformedEvidence,
  ),
  false,
);

const missingBeliefs = {
  overallConfidence: 0.8,
};

assert.equal(
  isBeliefSystem(
    missingBeliefs,
  ),
  false,
);

console.log(
  "✓ Brain Belief State Store regression test passed",
);

console.log({
  scopes: {
    network:
      networkScopeKey,

    location:
      miraMesaScopeKey,

    normalizationStable:
      normalizedMiraMesaScopeKey ===
      miraMesaScopeKey,
  },

  validation: {
    validBeliefSystemAccepted:
      true,

    malformedConfidenceRejected:
      true,

    malformedEvidenceRejected:
      true,

    missingBeliefsRejected:
      true,
  },
});