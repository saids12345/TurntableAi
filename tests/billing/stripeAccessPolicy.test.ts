import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { hasProAccess, isAllowedStripeStatus } from "../../src/lib/plans";

for (const status of ["trialing", "active"]) {
  assert.equal(isAllowedStripeStatus(status), true);
  assert.equal(hasProAccess({ isPro: false, plan: "free", stripeSubscriptionStatus: status }), true);
}

for (const status of ["past_due", "unpaid", "canceled", "incomplete", "incomplete_expired", "paused", "unknown"]) {
  assert.equal(isAllowedStripeStatus(status), false);
  assert.equal(hasProAccess({ isPro: true, plan: "pro", stripeSubscriptionStatus: status }), false);
}

const webhook = readFileSync("src/app/api/stripe/webhook/route.ts", "utf8");
assert.ok(webhook.includes('import { isAllowedStripeStatus } from "@/lib/plans";'));
assert.ok(webhook.includes('return typeof status === "string" && isAllowedStripeStatus(status);'));
console.log("PASS: shared Stripe access policy regression test");
