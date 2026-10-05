import assert from "node:assert/strict";

import {
  createPlanningResult,
} from "@/lib/planningEngine";

const insufficient =
  createPlanningResult({
    context: {
      locationName: "No Data Location",
      dataReadiness: {
        status: "insufficient",
        reasons: [
          "No trusted performance data.",
        ],
      },
    },
  });

assert.equal(
  insufficient.topMove,
  null,
);

assert.equal(
  insufficient.moves.length,
  0,
);

const partial =
  createPlanningResult({
    context: {
      locationName: "Partial Location",
      dataReadiness: {
        status: "partial",
        reasons: [
          "Another trusted snapshot is required.",
        ],
      },
    },
  });

assert.equal(
  partial.topMove,
  null,
);

assert.equal(
  partial.moves.length,
  0,
);

const ready =
  createPlanningResult({
    context: {
      locationName: "Ready Location",
      dataReadiness: {
        status: "ready",
        reasons: [],
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
    },
  });

assert.notEqual(
  ready.topMove,
  null,
);

assert.ok(
  ready.moves.length > 0,
);

console.log(
  "✓ Planning data readiness regression test passed",
);
