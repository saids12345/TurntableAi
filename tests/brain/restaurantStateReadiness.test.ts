import assert from "node:assert/strict";

import {
  computeRestaurantStateFromMetrics,
  toTrustedRestaurantStateView,
  type RestaurantStateMetricSnapshot,
} from "@/lib/restaurantState";

function baseMetrics():
  RestaurantStateMetricSnapshot {
  return {
    revenue: null,
    previousRevenue: null,
    revenueDeltaPct: null,
    orders: null,
    previousOrders: null,
    ordersDeltaPct: null,
    avgTicket: null,
    laborPct: null,
    marginPct: null,
    refunds: null,
    avgRating: null,
    reviewCount: 0,
    reviewIssueCount: 0,
    openAlerts: 0,
    pendingActions: 0,
    executedActions: 0,
    memoryLessons: 0,
    reusableLessons: 0,
    avgOutcomeScore: null,
    sameSourcePerformanceSnapshotCount: 0,
    latestPerformanceProvenance: null,
    previousPerformanceProvenance: null,
    capturedAt: null,
  };
}

const insufficient =
  computeRestaurantStateFromMetrics(
    "No Data Location",
    baseMetrics(),
  );

assert.equal(
  insufficient.dataReadiness.status,
  "insufficient",
);

const insufficientView =
  toTrustedRestaurantStateView(
    insufficient,
  );

assert.equal(
  insufficientView.overallScore,
  null,
);

assert.equal(
  insufficientView.level,
  null,
);

assert.equal(
  insufficientView.scores,
  null,
);

assert.equal(
  insufficientView.primaryRisk,
  null,
);

assert.equal(
  insufficientView.primaryOpportunity,
  null,
);

assert.deepEqual(
  insufficientView.diagnosis,
  insufficient.dataReadiness.reasons,
);

assert.equal(
  insufficientView.recommendedFocus.length,
  0,
);

const readyMetrics =
  baseMetrics();

const latestCapturedAt =
  new Date(
    Date.now() -
      6 *
        60 *
        60 *
        1000,
  ).toISOString();

const previousCapturedAt =
  new Date(
    Date.now() -
      30 *
        60 *
        60 *
        1000,
  ).toISOString();

readyMetrics.revenue = 1000;
readyMetrics.previousRevenue = 900;
readyMetrics.orders = 50;
readyMetrics.previousOrders = 45;
readyMetrics.avgTicket = 20;

readyMetrics.latestPerformanceProvenance = {
  rowId: "latest",
  sourceSystem: "square",
  sourceRecordId: "square-latest",
  ingestedAt: latestCapturedAt,
  capturedAt: latestCapturedAt,
};

readyMetrics.previousPerformanceProvenance = {
  rowId: "previous",
  sourceSystem: "square",
  sourceRecordId: "square-previous",
  ingestedAt: previousCapturedAt,
  capturedAt: previousCapturedAt,
};

const ready =
  computeRestaurantStateFromMetrics(
    "Ready Location",
    readyMetrics,
  );

assert.equal(
  ready.dataReadiness.status,
  "ready",
);

const readyView =
  toTrustedRestaurantStateView(
    ready,
  );

assert.equal(
  readyView.overallScore,
  ready.overallScore,
);

assert.equal(
  readyView.level,
  ready.level,
);

assert.deepEqual(
  readyView.scores,
  ready.scores,
);

assert.equal(
  readyView.primaryRisk,
  ready.primaryRisk,
);

assert.equal(
  readyView.primaryOpportunity,
  ready.primaryOpportunity,
);

console.log(
  "✓ Restaurant state readiness regression test passed",
);
