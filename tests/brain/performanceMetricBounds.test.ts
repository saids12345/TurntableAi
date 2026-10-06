import assert from "node:assert/strict";

import {
  performanceSignalSchema,
} from "@/lib/performanceSignalIngestion";

import {
  asTrustedPerformanceMetric,
} from "@/lib/restaurantState";

const baseSignal = {
  userId:
    "00000000-0000-4000-8000-000000000001",
  sourceSystem:
    "square" as const,
  sourceRecordId:
    "metric-bounds-test",
  locationName:
    "Test Restaurant",
  revenue:
    100,
  orders:
    10,
  capturedAt:
    "2026-10-06T12:00:00-07:00",
};

assert.equal(
  performanceSignalSchema.safeParse({
    ...baseSignal,
    laborPct: -1,
  }).success,
  false,
);

assert.equal(
  performanceSignalSchema.safeParse({
    ...baseSignal,
    laborPct: 150,
  }).success,
  true,
);

assert.equal(
  performanceSignalSchema.safeParse({
    ...baseSignal,
    marginPct: -250,
  }).success,
  true,
);

assert.equal(
  performanceSignalSchema.safeParse({
    ...baseSignal,
    marginPct: 100,
  }).success,
  true,
);

assert.equal(
  performanceSignalSchema.safeParse({
    ...baseSignal,
    marginPct: 100.01,
  }).success,
  false,
);

assert.equal(
  asTrustedPerformanceMetric(-1, "revenue"),
  null,
);

assert.equal(
  asTrustedPerformanceMetric(-1, "orders"),
  null,
);

assert.equal(
  asTrustedPerformanceMetric(2.5, "orders"),
  null,
);

assert.equal(
  asTrustedPerformanceMetric(12, "orders"),
  12,
);

assert.equal(
  asTrustedPerformanceMetric(-1, "avgTicket"),
  null,
);

assert.equal(
  asTrustedPerformanceMetric(-1, "laborPct"),
  null,
);

assert.equal(
  asTrustedPerformanceMetric(150, "laborPct"),
  150,
);

assert.equal(
  asTrustedPerformanceMetric(-250, "marginPct"),
  -250,
);

assert.equal(
  asTrustedPerformanceMetric(100, "marginPct"),
  100,
);

assert.equal(
  asTrustedPerformanceMetric(100.01, "marginPct"),
  null,
);

assert.equal(
  asTrustedPerformanceMetric(-1, "refunds"),
  null,
);

console.log(
  "✓ Performance metric bounds regression test passed",
);
