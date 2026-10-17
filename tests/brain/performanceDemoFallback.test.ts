import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  "src/app/(pro)/sales/page.tsx",
  "utf8",
);

for (const forbidden of [
  "SEED_LOCATIONS",
  "SEED_ALERTS",
  "SEED_ACTIONS",
  "buildFallbackAlerts",
  "buildFallbackActions",
  "Using fallback performance data",
]) {
  assert.equal(
    source.includes(forbidden),
    false,
    `Unsupported fallback remains: ${forbidden}`,
  );
}

assert.ok(source.includes("boardLocations.length === 0"));
assert.ok(source.includes("setLiveAlerts(mappedAlerts)"));
assert.ok(source.includes("setLiveActions(mappedActions)"));
assert.ok(source.includes("No financial figures are being shown."));

console.log(
  "✓ Performance demo fallback regression test passed",
);
