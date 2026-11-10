import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  resolveStripeCheckoutPriceExpectation,
  isExpectedTurnTableCheckoutPrice,
} from "../../src/lib/stripePricePolicy";

const staging = resolveStripeCheckoutPriceExpectation({
  vercelEnv: "production",
  siteUrl: "https://turntableai-staging.vercel.app",
  stripeSecretKey: "sk_test_example",
});

assert.deepEqual(staging, {
  expectedLiveMode: false,
  expectedProductName: "TurnTableAI Pro — Staging",
});

for (const wrong of [
  {
    vercelEnv: "production",
    siteUrl: "https://turntableai-staging.vercel.app",
    stripeSecretKey: "sk_live_example",
  },
  {
    vercelEnv: "preview",
    siteUrl: "https://turntableai-staging.vercel.app",
    stripeSecretKey: "sk_test_example",
  },
]) {
  assert.equal(resolveStripeCheckoutPriceExpectation(wrong), null);
}

assert.deepEqual(
  resolveStripeCheckoutPriceExpectation({
    vercelEnv: "production",
    siteUrl: "https://turntableai.net",
    stripeSecretKey: "sk_live_example",
  }),
  {
    expectedLiveMode: true,
    expectedProductName: "TurnTableAI Pro",
  },
);

const price = {
  id: "price_staging",
  active: true,
  type: "recurring",
  currency: "usd",
  unit_amount: 10000,
  billing_scheme: "per_unit",
  recurring: { interval: "month", interval_count: 1 },
  livemode: false,
  product: {
    name: "TurnTableAI Pro — Staging",
    active: true,
  },
};

assert.equal(
  isExpectedTurnTableCheckoutPrice(
    price, "price_staging", false, "TurnTableAI Pro — Staging"
  ),
  true,
);

assert.equal(
  isExpectedTurnTableCheckoutPrice(
    price, "price_staging", true, "TurnTableAI Pro — Staging"
  ),
  false,
);

assert.equal(
  isExpectedTurnTableCheckoutPrice(
    price, "price_staging", false, "TurnTableAI Pro"
  ),
  false,
);

assert.equal(
  isExpectedTurnTableCheckoutPrice(
    { ...price, unit_amount: 9900 },
    "price_staging", false, "TurnTableAI Pro — Staging"
  ),
  false,
);

const route = readFileSync(
  "src/app/api/stripe/create-checkout-session/route.ts",
  "utf8",
);

assert.match(route, /resolveStripeCheckoutPriceExpectation/);
assert.match(route, /priceExpectation.expectedLiveMode/);
assert.match(route, /priceExpectation.expectedProductName/);

console.log("✓ Staging Stripe pricing regression test passed");
