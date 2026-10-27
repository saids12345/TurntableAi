import assert from "node:assert/strict";
import {
  mapConnectedGoogleReviewRows,
} from "@/lib/connectedGoogleReviewEvidence";

const locations = [
  { name: "locations/101", title: "Downtown Cafe" },
  { name: "locations/202", title: "Harbor Cafe" },
  { name: "locations/303", title: "Shared Name" },
  { name: "locations/404", title: "Shared Name" },
];

const reviews = [
  { id: "a", location_name: "locations/101" },
  { id: "b", location_name: "locations/202" },
  { id: "disconnected", location_name: "locations/999" },
  { id: "unverified-name", location_name: "Downtown Cafe" },
  { id: "duplicate-a", location_name: "locations/303" },
  { id: "duplicate-b", location_name: "locations/404" },
];

const result = mapConnectedGoogleReviewRows(
  locations,
  reviews,
);

assert.deepEqual(
  result.map((review) => [review.id, review.location_name]),
  [
    ["a", "Downtown Cafe"],
    ["b", "Harbor Cafe"],
  ],
);

assert.deepEqual(
  mapConnectedGoogleReviewRows([], reviews),
  [],
);

assert.equal(reviews[0].location_name, "locations/101");

console.log(
  "✓ Connected Google review identity regression test passed",
);

import { resolveUniqueConnectedGoogleLocation } from "@/lib/connectedGoogleReviewEvidence";

assert.equal(
  resolveUniqueConnectedGoogleLocation([{ name: "locations/1", title: "Test Cafe" }], "Test Cafe"),
  "locations/1",
);
assert.equal(
  resolveUniqueConnectedGoogleLocation([{ name: "locations/1", title: "Test Cafe" }], "locations/1"),
  "locations/1",
);
assert.equal(
  resolveUniqueConnectedGoogleLocation([
    { name: "locations/1", title: "Test Cafe" },
    { name: "locations/2", title: "Test Cafe" },
  ], "Test Cafe"),
  null,
  "Ambiguous owner-connected display titles must fail closed",
);
assert.equal(
  resolveUniqueConnectedGoogleLocation([{ name: "locations/1", title: "Other Cafe" }], "Test Cafe"),
  null,
  "Do not match an unconnected restaurant by name",
);
