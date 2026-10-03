import assert from "node:assert/strict";

import {
  getSquareCronHttpStatus,
} from "@/lib/squareCronStatus";

assert.equal(
  getSquareCronHttpStatus(0),
  200,
);

assert.equal(
  getSquareCronHttpStatus(1),
  500,
);

assert.equal(
  getSquareCronHttpStatus(4),
  500,
);

console.log(
  "✓ Square cron failure status regression test passed",
);
