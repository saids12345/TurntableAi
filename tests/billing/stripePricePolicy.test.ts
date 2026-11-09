import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  isExpectedTurnTableCheckoutPrice,
} from "../../src/lib/stripePricePolicy";

const valid = {
  id: "price_test_123",
  active: true,
  type: "recurring",
  currency: "usd",
  unit_amount: 10000,
  billing_scheme: "per_unit",
  recurring: {
    interval: "month",
    interval_count: 1,
  },
  livemode: true,
  product: {
    name: "TurnTableAI Pro",
    active: true,
  },
};

const verify = (
  price: typeof valid,
  live: boolean | null = true,
) =>
  isExpectedTurnTableCheckoutPrice(
    price,
    "price_test_123",
    live,
  );

assert.equal(verify(valid), true);

const invalid = [
  { ...valid, unit_amount: 9900 },
  { ...valid, currency: "eur" },
  { ...valid, active: false },
  { ...valid, billing_scheme: "tiered" },
  {
    ...valid,
    recurring: { interval: "year", interval_count: 1 },
  },
  {
    ...valid,
    recurring: { interval: "month", interval_count: 3 },
  },
  {
    ...valid,
    product: { name: "Other Product", active: true },
  },
  {
    ...valid,
    product: { name: "TurnTableAI Pro", active: false },
  },
  { ...valid, livemode: false },
];

for (const price of invalid) {
  assert.equal(
    verify(price),
    false,
    "Invalid Stripe pricing must fail closed",
  );
}

assert.equal(
  verify({ ...valid, livemode: false }, false),
  true,
);

assert.equal(
  isExpectedTurnTableCheckoutPrice(
    valid,
    "price_wrong",
    true,
  ),
  false,
);

const checkoutRoute = readFileSync(
  "src/app/api/stripe/create-checkout-session/route.ts",
  "utf8",
);

const verification = checkoutRoute.indexOf(
  "isExpectedTurnTableCheckoutPrice(",
);

for (const operation of [
  "stripe.customers.create(",
  "findReusableStripeCheckoutUrl({",
  "stripe.checkout.sessions.create(",
]) {
  const position = checkoutRoute.indexOf(operation);
  assert.ok(
    verification >= 0 && position > verification,
    `Price verification must precede ${operation}`,
  );
}

console.log(
  "✓ Stripe price verification regression test passed",
);
