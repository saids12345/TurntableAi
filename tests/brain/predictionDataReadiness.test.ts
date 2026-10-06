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
  metrics: {
    sameSourcePerformanceSnapshotCount: 14,
  },
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

const tooShortFor24Hours =
  predictRestaurantFuture({
    context: {
      ...readyContext,
      metrics: {
        sameSourcePerformanceSnapshotCount: 2,
      },
    },
    horizon: "next_24_hours",
  });

assert.equal(
  tooShortFor24Hours.topPrediction,
  null,
);

const enoughFor24Hours =
  predictRestaurantFuture({
    context: {
      ...readyContext,
      metrics: {
        sameSourcePerformanceSnapshotCount: 3,
      },
    },
    horizon: "next_24_hours",
  });

assert.notEqual(
  enoughFor24Hours.topPrediction,
  null,
);

const tooShortFor7Days =
  predictRestaurantFuture({
    context: {
      ...readyContext,
      metrics: {
        sameSourcePerformanceSnapshotCount: 6,
      },
    },
    horizon: "next_7_days",
  });

assert.equal(
  tooShortFor7Days.topPrediction,
  null,
);

const enoughFor7Days =
  predictRestaurantFuture({
    context: {
      ...readyContext,
      metrics: {
        sameSourcePerformanceSnapshotCount: 7,
      },
    },
    horizon: "next_7_days",
  });

assert.notEqual(
  enoughFor7Days.topPrediction,
  null,
);

const tooShortFor14Days =
  predictRestaurantFuture({
    context: {
      ...readyContext,
      metrics: {
        sameSourcePerformanceSnapshotCount: 13,
      },
    },
    horizon: "next_14_days",
  });

assert.equal(
  tooShortFor14Days.topPrediction,
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
