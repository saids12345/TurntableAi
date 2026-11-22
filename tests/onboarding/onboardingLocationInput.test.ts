import assert from "node:assert/strict";
import {
  isLocationId,
  parseLocationDetails,
} from "../../src/lib/onboardingLocationInput";

const valid = parseLocationDetails({
  name: "  Downtown Café  ",
  city: "  San Diego ",
  region: " CA ",
  countryCode: "us",
});

assert.deepEqual(valid, {
  ok: true,
  value: {
    name: "Downtown Café",
    city: "San Diego",
    region: "CA",
    countryCode: "US",
  },
});

const optional = parseLocationDetails({
  name: "Airport",
});
assert.deepEqual(optional, {
  ok: true,
  value: {
    name: "Airport",
    city: null,
    region: null,
    countryCode: null,
  },
});

for (const invalid of [
  null,
  [],
  {},
  { name: "" },
  { name: "A".repeat(161) },
  { name: "Restaurant\nInjected" },
  { name: "Cafe", city: 7 },
  { name: "Cafe", region: "A".repeat(121) },
  { name: "Cafe", countryCode: "USA" },
  { name: "Cafe", countryCode: "1a" },
  { name: "Cafe", group_id: "foreign" },
  { name: "Cafe", id: "foreign" },
]) {
  assert.equal(parseLocationDetails(invalid).ok, false);
}

assert.ok(isLocationId("11111111-1111-4111-8111-111111111111"));
assert.equal(isLocationId("not-an-id"), false);
assert.equal(isLocationId(null), false);

console.log("PASS: Location fields normalize safely");
console.log("PASS: Invalid and forged location fields rejected");
console.log("PASS: Location IDs validated");
