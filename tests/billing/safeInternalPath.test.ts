import assert from "node:assert/strict";

import {
  sanitizeInternalPath,
} from "../../src/lib/safeInternalPath";

assert.equal(
  sanitizeInternalPath("/brain"),
  "/brain",
);

assert.equal(
  sanitizeInternalPath(
    "/command-center?location=1",
  ),
  "/command-center?location=1",
);

assert.equal(
  sanitizeInternalPath(
    "https://evil.example",
  ),
  "/",
);

assert.equal(
  sanitizeInternalPath(
    "//evil.example",
  ),
  "/",
);

assert.equal(
  sanitizeInternalPath(
    "/\\evil.example",
  ),
  "/",
);

assert.equal(
  sanitizeInternalPath(
    undefined,
  ),
  "/",
);

assert.equal(
  sanitizeInternalPath(
    "//evil.example",
    "/billing",
  ),
  "/billing",
);

console.log(
  "✓ Safe internal path regression test passed",
);
