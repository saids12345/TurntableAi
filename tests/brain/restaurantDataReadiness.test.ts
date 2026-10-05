import assert from "node:assert/strict";

import {
  filterReadyRestaurantData,
  getRestaurantDataReadiness,
} from "@/lib/restaurantDataReadiness";

assert.equal(
  getRestaurantDataReadiness({
    hasLatestTrustedPerformance: false,
    hasPreviousTrustedPerformance: false,
    performanceMetricCount: 0,
    hasReviewEvidence: false,
  }).status,
  "insufficient",
);

assert.equal(
  getRestaurantDataReadiness({
    hasLatestTrustedPerformance: true,
    hasPreviousTrustedPerformance: false,
    performanceMetricCount: 3,
    hasReviewEvidence: false,
  }).status,
  "partial",
);

assert.equal(
  getRestaurantDataReadiness({
    hasLatestTrustedPerformance: false,
    hasPreviousTrustedPerformance: false,
    performanceMetricCount: 0,
    hasReviewEvidence: true,
  }).status,
  "partial",
);

assert.equal(
  getRestaurantDataReadiness({
    hasLatestTrustedPerformance: true,
    hasPreviousTrustedPerformance: true,
    performanceMetricCount: 3,
    hasReviewEvidence: false,
  }).status,
  "ready",
);

const cognitiveReady =
  filterReadyRestaurantData([
    {
      id: "ready",
      dataReadiness: {
        status: "ready" as const,
        reasons: [],
      },
    },
    {
      id: "partial",
      dataReadiness: {
        status: "partial" as const,
        reasons: [],
      },
    },
    {
      id: "insufficient",
     ataReadiness: {
        status: "insufficient" as const,
        reasons: [],
      },
    },
    {
      id: "missing-readiness",
    },
  ]);

assert.deepEqual(
  cognitiveReady.map(
    (item) => item.id,
  ),
  ["ready"],
);

console.log(
  "✓ Restaurant data readiness regression test passed",
);
