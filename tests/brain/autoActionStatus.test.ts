import assert from "node:assert/strict";

import {
  canTransitionAutoActionStatus,
} from "@/lib/autoActionStatus";

assert.equal(
  canTransitionAutoActionStatus(
    "pending",
    "approved",
  ),
  true,
);

assert.equal(
  canTransitionAutoActionStatus(
    "pending",
    "dismissed",
  ),
  true,
);

assert.equal(
  canTransitionAutoActionStatus(
    "pending",
    "executed",
  ),
  false,
  "Pending Auto Actions must never bypass approval and execute directly.",
);

assert.equal(
  canTransitionAutoActionStatus(
    "approved",
    "executed",
  ),
  true,
);

assert.equal(
  canTransitionAutoActionStatus(
    "approved",
    "dismissed",
  ),
  true,
);

assert.equal(
  canTransitionAutoActionStatus(
    "executed",
    "approved",
  ),
  false,
);

assert.equal(
  canTransitionAutoActionStatus(
    "dismissed",
    "approved",
  ),
  false,
);

assert.equal(
  canTransitionAutoActionStatus(
    "executed",
    "executed",
  ),
  true,
);

console.log(
  "✓ Auto Action Status Transition regression test passed",
);