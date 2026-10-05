import assert from "node:assert/strict";

import {
  analyzeNetworkCausality,
  analyzeSingleRestaurantCausality,
} from "@/lib/causalEngine";

const insufficient =
  analyzeSingleRestaurantCausality({
    locationName: "No Data Location",
    dataReadiness: {
      status: "insufficient",
      reasons: [],
    },
  });

assert.equal(
  insufficient.topHypothesis,
  null,
);

assert.equal(
  insufficient.hypotheses.length,
  0,
);

const partial =
  analyzeSingleRestaurantCausality({
    locationName: "Partial Location",
    dataReadiness: {
      status: "partial",
      reasons: [],
    },
  });

assert.equal(
  partial.topHypothesis,
  null,
);

const readyContext = {
  locationName: "Ready Location",
  dataReadiness: {
    status: "ready" as const,
    reasons: [],
  },
  overallScore: 80,
  scores: {
    demand: 80,
    operations: 80,
    staffing: 80,
    service: 80,
    marketing: 80,
    profitability: 80,
    reputation: 80,
    execution: 80,
  },
};

const ready =
  analyzeSingleRestaurantCausality(
    readyContext,
  );

assert.notEqual(
  ready.topHypothesis,
  null,
);

const network =
  analyzeNetworkCausality([
    {
      locationName: "Weak Data Location",
      dataReadiness: {
        status: "insufficient",
        reasons: [],
      },
    },
    readyContext,
  ]);

assert.ok(
  network.hypotheses.length > 0,
);

assert.equal(
  network.topHypothesis?.locationName,
  "Ready Location",
);

console.log(
  "✓ Causal data readiness regression test passed",
);
