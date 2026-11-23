import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  assessOnboardingStatus,
  type OnboardingStatus,
} from "../../src/lib/onboardingReadiness";

const base: OnboardingStatus = {
  restaurantName: "Example Cafe",
  expectedLocationCount: 3,
  savedLocationCount: 3,
  google: "present",
  square: "absent",
};

assert.deepEqual(assessOnboardingStatus(base), {
  restaurantSaved: true,
  locationsEntered: true,
  providerRecordPresent: true,
  providerStateUnavailable: false,
  trustedAiDataVerified: false,
});
assert.equal(assessOnboardingStatus({ ...base, savedLocationCount: 2 }).locationsEntered, false);
assert.equal(assessOnboardingStatus({ ...base, restaurantName: null }).locationsEntered, false);
assert.equal(assessOnboardingStatus({ ...base, google: "absent" }).providerRecordPresent, false);
assert.equal(assessOnboardingStatus({ ...base, square: "unavailable" }).providerStateUnavailable, true);
assert.equal(assessOnboardingStatus({
  ...base, google: "present", square: "present",
}).trustedAiDataVerified, false);

const client = readFileSync("src/app/onboarding/OnboardingStatusClient.tsx", "utf8");
const connections = readFileSync("src/app/onboarding/connections/page.tsx", "utf8");
const readiness = readFileSync("src/app/onboarding/readiness/page.tsx", "utf8");
const locations = readFileSync("src/app/onboarding/locations/LocationsClient.tsx", "utf8");

for (const page of [connections, readiness]) {
  assert.match(page, /getSupabaseServerClient/);
  assert.match(page, /supabase\.auth\.getUser\(\)/);
  assert.match(page, /redirect\("\/login\?/);
  assert.doesNotMatch(page, /getSupabaseAdmin/);
}

assert.match(client, /readJson\("\/api\/onboarding"/);
assert.match(client, /readJson\("\/api\/onboarding\/locations"/);
assert.match(client, /readJson\("\/api\/google\/connection"/);
assert.match(client, /readJson\("\/api\/square\/status"/);
assert.doesNotMatch(client, /\/api\/onboarding\/discovery/);
assert.doesNotMatch(client, /stored_connected_account_snapshots/);
assert.match(client, /credentials: "same-origin"/);
assert.match(client, /Status unavailable/);
assert.match(client, /AI data readiness — Not verified/);
assert.match(client, /Square Sandbox records are excluded/);
assert.match(locations, /href="\/onboarding\/connections"/);
assert.doesNotMatch(client, /fetch\(\s*["']\/api\/.*?["']\s*,\s*\{\s*method:\s*["'](?:POST|PATCH|DELETE)/);
assert.doesNotMatch(client, /\.rpc\(|getSupabaseAdmin|stripe_checkout_attempts/);
console.log("PASS: Connections/Readiness read-only Production candidate contract");
