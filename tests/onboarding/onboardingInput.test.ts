import assert from "node:assert/strict";
import {
  parseRestaurantIdentity,
} from "../../src/lib/onboardingInput";

const valid = parseRestaurantIdentity({
  name: "  Sample Restaurant Group  ",
  expectedLocationCount: 5,
  primaryGoal: "operations",
});

assert.deepEqual(valid, {
  ok: true,
  value: {
    name: "Sample Restaurant Group",
    expectedLocationCount: 5,
    primaryGoal: "operations",
  },
});

const invalid: unknown[] = [
  null,
  {},
  [],
  {
    name: "",
    expectedLocationCount: 1,
    primaryGoal: "operations",
  },
  {
    name: "A".repeat(161),
    expectedLocationCount: 1,
    primaryGoal: "operations",
  },
  {
    name: "Restaurant",
    expectedLocationCount: 0,
    primaryGoal: "operations",
  },
  {
    name: "Restaurant",
    expectedLocationCount: 101,
    primaryGoal: "operations",
  },
  {
    name: "Restaurant",
    expectedLocationCount: 2.5,
    primaryGoal: "operations",
  },
  {
    name: "Restaurant",
    expectedLocationCount: 3,
    primaryGoal: "unknown",
  },
  {
    name: "Restaurant",
    expectedLocationCount: 3,
    primaryGoal: "growth",
    owner_user_id: "another-user",
  },
];

for (const input of invalid) {
  assert.equal(
    parseRestaurantIdentity(input).ok,
    false,
  );
}

console.log("PASS: Valid restaurant identity");
console.log("PASS: Name and location validation");
console.log("PASS: Invalid goals and unexpected fields rejected");
