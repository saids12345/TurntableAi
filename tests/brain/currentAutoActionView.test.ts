import assert from "node:assert/strict";
import {
  selectCurrentAutoActions,
} from "@/lib/currentAutoActionView";

const actions = [
  { id: "verified-pending", status: "pending", evidenceStatus: "current" },
  { id: "verified-approved", status: "approved", evidenceStatus: "current" },
  { id: "stale", status: "pending", evidenceStatus: "unverified" },
  { id: "legacy", status: "approved" },
  { id: "executed", status: "executed", evidenceStatus: "historical" },
  { id: "dismissed", status: "dismissed", evidenceStatus: "historical" },
  { id: "invalid", status: "executed", evidenceStatus: "current" },
];

assert.deepEqual(
  selectCurrentAutoActions(actions).map((action) => action.id),
  ["verified-pending", "verified-approved"],
);

assert.equal(actions.length, 7, "Historical records must remain untouched");

console.log("✓ Current Auto Action View regression test passed");
