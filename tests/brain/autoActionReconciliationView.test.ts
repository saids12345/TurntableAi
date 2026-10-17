import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { selectCurrentAutoActions } from "@/lib/currentAutoActionView";

const classified = [
  { id: "live", status: "pending", evidenceStatus: "current" },
  { id: "claimed", status: "approved", evidenceStatus: "reconciliation_required" },
  { id: "unverified", status: "approved", evidenceStatus: "unverified" },
  { id: "historical", status: "executed", evidenceStatus: "historical" },
];

assert.deepEqual(
  selectCurrentAutoActions(classified).map((row) => row.id),
  ["live", "claimed"],
  "Claimed actions must remain visible; unverified and historical actions are excluded",
);

const page = readFileSync("src/app/(pro)/command-center/page.tsx", "utf8");
assert.match(page, /useState<AutoActionFilter>\("all"\)/,
  "Reconciliation must be visible with the default filter");
assert.match(page, /reconciliationRequiredCount > 0/,
  "Show a persistent reconciliation warning even if another filter is selected");
assert.match(page, /item\.evidenceStatus !== "reconciliation_required" && item\.status === "approved" && \(\s*<button/,
  "Claimed actions must never offer an Execute button");
assert.match(page, /item\.evidenceStatus !== "reconciliation_required" &&\s*item\.status !== "dismissed"/,
  "Claimed actions must never offer a Dismiss button");
assert.match(page, /Needs reconciliation/,
  "Do not label a claimed action only as Approved");

console.log("✓ Auto Action reconciliation visibility regression test passed");
