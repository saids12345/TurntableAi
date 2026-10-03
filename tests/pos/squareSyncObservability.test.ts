import assert from "node:assert/strict";

import {
  shouldMarkSquareConnectionSynced,
} from "@/lib/squareDailySync";

assert.equal(
  shouldMarkSquareConnectionSynced({
    syncedRows: 1,
    failureCountBefore: 0,
    failureCountAfter: 0,
  }),
  true,
);

assert.equal(
  shouldMarkSquareConnectionSynced({
    syncedRows: 3,
    failureCountBefore: 2,
    failureCountAfter: 2,
  }),
  true,
);

assert.equal(
  shouldMarkSquareConnectionSynced({
    syncedRows: 0,
    failureCountBefore: 0,
    failureCountAfter: 0,
  }),
  false,
);

assert.equal(
  shouldMarkSquareConnectionSynced({
    syncedRows: 1,
    failureCountBefore: 0,
    failureCountAfter: 1,
  }),
  false,
);

assert.equal(
  shouldMarkSquareConnectionSynced({
    syncedRows: 1,
    failureCountBefore: 2,
    failureCountAfter: 3,
  }),
  false,
);

console.log(
  "✓ Square sync observability regression test passed",
);
