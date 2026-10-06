import assert from "node:assert/strict";

import {
  filterReadyRestaurantData,
  getRestaurantDataReadiness,
} from "@/lib/restaurantDataReadiness";

const NOW =
  "2026-10-05T18:00:00.000Z";

function readinessInput(
  overrides: Partial<
    Parameters<
      typeof getRestaurantDataReadiness
    >[0]
  > = {},
) {
  return {
    hasLatestTrustedPerformance: true,
    hasPreviousTrustedPerformance: true,
    performanceMetricCount: 3,
    comparablePerformanceMetricCount: 2,
    sameTrustedPerformanceSource: true,
    latestPerformanceCapturedAt:
      "2026-10-05T11:00:00.000Z",
    previousPerformanceCapturedAt:
      "2026-10-04T11:00:00.000Z",
    hasReviewEvidence: false,
    now: NOW,
    ...overrides,
  };
}

assert.equal(
  getRestaurantDataReadiness(
    readinessInput({
      hasLatestTrustedPerformance: false,
      hasPreviousTrustedPerformance: false,
      performanceMetricCount: 0,
      comparablePerformanceMetricCount: 0,
      latestPerformanceCapturedAt: null,
      previousPerformanceCapturedAt: null,
    }),
  ).status,
  "insufficient",
);

assert.equal(
  getRestaurantDataReadiness(
    readinessInput({
      hasPreviousTrustedPerformance: false,
      comparablePerformanceMetricCount: 0,
      previousPerformanceCapturedAt: null,
    }),
  ).status,
  "partial",
);

assert.equal(
  getRestaurantDataReadiness(
    readinessInput({
      comparablePerformanceMetricCount: 1,
    }),
  ).status,
  "partial",
);

assert.equal(
  getRestaurantDataReadiness(
    readinessInput({
      sameTrustedPerformanceSource: false,
    }),
  ).status,
  "partial",
);

assert.equal(
  getRestaurantDataReadiness(
    readinessInput({
      latestPerformanceCapturedAt:
        "2026-10-01T11:00:00.000Z",
      previousPerformanceCapturedAt:
        "2026-09-30T11:00:00.000Z",
    }),
  ).status,
  "partial",
);

assert.equal(
  getRestaurantDataReadiness(
    readinessInput({
      previousPerformanceCapturedAt:
        "2026-09-30T11:00:00.000Z",
    }),
  ).status,
  "partial",
);

assert.equal(
  getRestaurantDataReadiness(
    readinessInput(),
  ).status,
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
      dataReadiness: {
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
  "✓ Restaurant data readiness quality regression test passed",
);
