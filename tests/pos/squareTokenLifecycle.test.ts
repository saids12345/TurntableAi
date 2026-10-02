import assert from "node:assert/strict";

import {
  shouldRefreshSquareAccessToken,
} from "@/lib/squareTokenLifecycle";

const now =
  Date.parse(
    "2026-10-02T12:00:00.000Z",
  );

assert.equal(
  shouldRefreshSquareAccessToken(
    "2026-10-02T12:10:00.000Z",
    now,
  ),
  false,
);

assert.equal(
  shouldRefreshSquareAccessToken(
    "2026-10-02T12:05:00.000Z",
    now,
  ),
  true,
);

assert.equal(
  shouldRefreshSquareAccessToken(
    "2026-10-02T11:59:00.000Z",
    now,
  ),
  true,
);

assert.equal(
  shouldRefreshSquareAccessToken(
    null,
    now,
  ),
  false,
);

assert.throws(
  () =>
    shouldRefreshSquareAccessToken(
      "not-a-date",
      now,
    ),
  /Invalid Square access token expiration timestamp/,
);

console.log(
  "✓ Square token lifecycle regression test passed",
);
