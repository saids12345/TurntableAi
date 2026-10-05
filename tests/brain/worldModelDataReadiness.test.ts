import assert from "node:assert/strict";

import {
  buildNetworkWorldModel,
  buildWorldModel,
} from "@/lib/worldModel";

const insufficient =
  buildWorldModel({
    locationName: "No Data Location",
    dataReadiness: {
      status: "insufficient",
      reasons: [],
    },
    now: "2026-10-05T12:00:00.000Z",
  });

assert.equal(
  insufficient.signals.length,
  0,
);

assert.equal(
  insufficient.demandModifierPct,
  0,
);

assert.equal(
  insufficient.laborModifierPct,
  0,
);

assert.equal(
  insufficient.marginRiskModifierPct,
  0,
);

const partial =
  buildWorldModel({
    locationName: "Partial Location",
    dataReadiness: {
      status: "partial",
      reasons: [],
    },
    now: "2026-10-05T12:00:00.000Z",
  });

assert.equal(
  partial.signals.length,
  0,
);

const readyContext = {
  locationName: "Ready Location",
  dataReadiness: {
    status: "ready" as const,
    reasons: [],
  },
  now: "2026-10-05T12:00:00.000Z",
  revenue: 1000,
  orders: 50,
  demandScore: 80,
  operationsScore: 80,
  staffingScore: 80,
  serviceScore: 80,
  profitabilityScore: 80,
  reputationScore: 80,
};

const ready =
  buildWorldModel(
    readyContext,
  );

assert.ok(
  ready.signals.length > 0,
);

const network =
  buildNetworkWorldModel([
    {
      locationName: "Weak Data Location",
      dataReadiness: {
        status: "insufficient",
        reasons: [],
      },
      now: "2026-10-05T12:00:00.000Z",
    },
    readyContext,
  ]);

assert.notEqual(
  network.topSignal,
  null,
);

assert.equal(
  network.topSignal?.locationName,
  "Ready Location",
);

console.log(
  "✓ World Model data readiness regression test passed",
);
