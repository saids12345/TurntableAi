import assert from "node:assert/strict";

import {
  predictNetworkFuture,
  predictRestaurantFuture,
} from "@/lib/predictionEngine";

const insufficient =
  predictRestaurantFuture({
    context: {
      locationName: "No Data Location",
      dataReadiness: {
        status: "insufficient",
        reasons: [],
      },
    },
  });

assert.equal(
  insufficient.topPrediction,
  null,
);

assert.equal(
  insufficient.predictions.length,
  0,
);

const partial =
  predictRestaurantFuture({
    context: {
      locationName: "Partial Location",
      dataReadiness: {
        status: "partial",
        reasons: [],
      },
    },
  });

assert.equal(
  partial.topPrediction,
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
  predictRestaurantFuture({
    context: readyContext,
  });

assert.notEqual(
  ready.topPrediction,
  null,
);

const network =
  predictNetworkFuture({
    contexts: [
      {
        locationName: "Weak Data Location",
        dataReadiness: {
          status: "insufficient",
          reasons: [],
        },
      },
      readyContext,
    ],
  });

assert.equal(
  network.predictions.length,
  1,
);

assert.equal(
  network.topPrediction?.locationName,
  "Ready Location",
);

console.log(
  "✓ Prediction data readiness regression test passed",
);
