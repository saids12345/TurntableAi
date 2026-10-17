import assert from "node:assert/strict";
import {
  verifySquarePerformanceRow,
  type SquareProductionConnectionEvidence,
} from "../../src/lib/verifiedSquarePerformance";

const connections: SquareProductionConnectionEvidence[] = [
  {
    userId: "owner-1",
    merchantId: "merchant-1",
    locations: [
      { providerLocationId: "location-1", name: "Test Cafe", status: "ACTIVE" },
      { providerLocationId: "location-2", name: "Second Cafe", status: null },
      { providerLocationId: "location-3", name: "Inactive Cafe", status: "INACTIVE" },
    ],
  },
];

const row = {
  location_name: "Test Cafe",
  source_system: "square",
  source_record_id: "square:daily:production:merchant-1:location-1:2026-10-13",
};

const check = (
  candidate: typeof row,
  owner = "owner-1",
  connected = connections,
) => verifySquarePerformanceRow(candidate, owner, connected);

const valid = check(row);
assert.ok(valid);
assert.equal(valid.locationName, "Test Cafe");
assert.equal(valid.sourceDay, "2026-10-13");
assert.equal(valid.connectionKey, JSON.stringify(["merchant-1", "location-1"]));

assert.equal(check(row, "another-owner"), null);
assert.equal(check(row, "owner-1", []), null);
assert.equal(check({ ...row, source_system: "toast" }), null);
assert.equal(check({ ...row, source_record_id: null as unknown as string }), null);
assert.equal(check({ ...row, location_name: "Second Cafe" }), null);
assert.equal(check({ ...row, location_name: "" }), null);
assert.equal(check({ ...row, source_record_id: "square:daily:sandbox:merchant-1:location-1:2026-10-13" }), null);
assert.equal(check({ ...row, source_record_id: "square:daily:production:merchant-2:location-1:2026-10-13" }), null);
assert.equal(check({ ...row, source_record_id: "square:daily:production:merchant-1:location-2:2026-10-13" }), null);
assert.equal(check({ ...row, source_record_id: "square:daily:production:merchant-1:location-1:2026-02-30" }), null);
assert.equal(check({ ...row, source_record_id: "square:daily:production:merchant-1:location-1:not-a-date" }), null);
assert.equal(check({ ...row, source_record_id: "square:daily:production:merchant-1:location-1:2026-10-13:extra" }), null);

assert.equal(check({
  ...row,
  location_name: "Inactive Cafe",
  source_record_id: "square:daily:production:merchant-1:location-3:2026-10-13",
}), null);

const second = check({
  ...row,
  location_name: "Second Cafe",
  source_record_id: "square:daily:production:merchant-1:location-2:2026-10-13",
});
assert.ok(second);
assert.notEqual(second.connectionKey, valid.connectionKey);

const sameNameTwoLocations: SquareProductionConnectionEvidence[] = [
  { userId: "owner-1", merchantId: "merchant-1", locations: [
    { providerLocationId: "location-1", name: "Test Cafe", status: "ACTIVE" },
    { providerLocationId: "location-4", name: "Test Cafe", status: "ACTIVE" },
  ] },
];
const otherSameName = check({
  ...row,
  source_record_id: "square:daily:production:merchant-1:location-4:2026-10-13",
}, "owner-1", sameNameTwoLocations);
assert.ok(otherSameName);
assert.notEqual(otherSameName.connectionKey, valid.connectionKey);

assert.equal(check(row, "owner-1", [connections[0], connections[0]]), null);

console.log("✓ Square production source identity regression test passed");
