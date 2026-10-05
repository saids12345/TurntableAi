import assert from "node:assert/strict";

import {
  computeRestaurantStateFromMetrics,
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

const readyMetrics =
  baseMetrics();

readyMetrics.revenue = 1000;
readyMetrics.orders = 50;
readyMetrics.avgTicket = 20;

readyMetrics.latestPerformanceProvenance = {
  rowId: "latest",
  sourceSystem: "square",
  sourceRecordId: "square-latest",
  ingestedAt: "2026-10-05T12:00:00.000Z",
  capturedAt: "2026-10-05T11:00:00.000Z",
};

readyMetrics.previousPerformanceProvenance = {
  rowId: "previous",
  sourceSystem: "square",
  sourceRecordId: "square-previous",
  ingestedAt: "2026-10-04T12:00:00.000Z",
  capturedAt: "2026-10-04T11:00:00.000Z",
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

console.log(
  "✓ Restaurant state readiness regression test passed",
);
