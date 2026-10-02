import assert from "node:assert/strict";

import {
  getRecentCompletedLocalDates,
} from "@/lib/squareDailyPerformance";

assert.deepEqual(
  getRecentCompletedLocalDates(
    "America/Los_Angeles",
    3,
    new Date(
      "2026-10-02T05:00:00.000Z",
    ),
  ),
  [
    "2026-09-30",
    "2026-09-29",
    "2026-09-28",
  ],
);

assert.throws(
  () =>
    getRecentCompletedLocalDates(
      "America/Los_Angeles",
      0,
    ),
  /between 1 and 7/,
);

console.log(
  "✓ Square completed local dates regression test passed",
);
