import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { formatBillingDate } from "../../src/lib/billingDate";

const expiration = "2026-11-24T03:01:43Z";

assert.equal(
  formatBillingDate(expiration, "UTC"),
  "Nov 24, 2026, 3:01 AM UTC",
);

assert.equal(
  formatBillingDate(expiration, "America/Los_Angeles"),
  "Nov 23, 2026, 7:01 PM PST",
);

assert.equal(
  formatBillingDate("2026-07-24T03:01:43Z", "America/Los_Angeles"),
  "Jul 23, 2026, 8:01 PM PDT",
);

assert.equal(formatBillingDate(null, "UTC"), "—");
assert.equal(formatBillingDate("invalid", "UTC"), "—");
assert.equal(formatBillingDate(expiration, "Invalid/Zone"), "—");

const client = readFileSync(
  "src/app/billing/BillingClient.tsx", "utf8",
);

assert.match(client, /setBillingTimeZone\(detected\)/);
assert.match(
  client,
  /formatBillingDate\(currentPeriodEnd, billingTimeZone\)/,
);
assert.match(
  client,
  /formatBillingDate\(cancelAt, billingTimeZone\)/,
);

console.log("✓ Billing date time zone regression test passed");
