import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  resolveStripeCheckoutPriceExpectation,
  isExpectedTurnTableCheckoutPrice,
} from "../../src/lib/stripePricePolicy";

const stagingSupabase = "https://sdlskzyizslisraurxzf.supabase.co";
const base = {
  vercelEnv: undefined,
  nodeEnv: "development",
  supabaseUrl: stagingSupabase,
  siteUrl: "http://localhost:3000",
  stripeSecretKey: "sk_test_fake_for_static_test_only",
};

assert.deepEqual(resolveStripeCheckoutPriceExpectation(base), {
  expectedLiveMode: false,
  expectedProductName: "TurnTableAI Pro — Staging",
});
assert.deepEqual(
  resolveStripeCheckoutPriceExpectation({ ...base, siteUrl: undefined }),
  { expectedLiveMode: false, expectedProductName: "TurnTableAI Pro — Staging" },
);

for (const config of [
  { ...base, stripeSecretKey: undefined },
  { ...base, stripeSecretKey: "sk_live_DO_NOT_USE" },
  { ...base, nodeEnv: "production" },
  { ...base, vercelEnv: "preview" },
  { ...base, siteUrl: "http://127.0.0.1:3000" },
  { ...base, siteUrl: "https://turntableai.net" },
]) {
  assert.equal(resolveStripeCheckoutPriceExpectation(config), null);
}

assert.deepEqual(
  resolveStripeCheckoutPriceExpectation({
    vercelEnv: "production",
    siteUrl: "https://turntableai-staging.vercel.app",
    stripeSecretKey: "sk_test_fake",
  }),
  { expectedLiveMode: false, expectedProductName: "TurnTableAI Pro — Staging" },
);
assert.equal(
  resolveStripeCheckoutPriceExpectation({
    vercelEnv: "production",
    siteUrl: "https://turntableai-staging.vercel.app",
    stripeSecretKey: "sk_live_DO_NOT_USE",
  }),
  null,
);
assert.deepEqual(
  resolveStripeCheckoutPriceExpectation({
    vercelEnv: "production",
    siteUrl: "https://turntableai.net",
    stripeSecretKey: "sk_live_example",
  }),
  { expectedLiveMode: true, expectedProductName: "TurnTableAI Pro" },
);

// Staging database can never silently fall through to Production pricing.
for (const config of [
  { ...base, vercelEnv: "production" },
  { ...base, vercelEnv: "preview" },
  { ...base, siteUrl: "https://turntableai.net" },
  { ...base, vercelEnv: "production", nodeEnv: "production", siteUrl: "https://turntableai.net" },
]) {
  assert.equal(resolveStripeCheckoutPriceExpectation(config), null);
}
assert.deepEqual(
  resolveStripeCheckoutPriceExpectation({
    ...base,
    vercelEnv: "production",
    nodeEnv: "production",
    siteUrl: "https://turntableai-staging.vercel.app",
  }),
  { expectedLiveMode: false, expectedProductName: "TurnTableAI Pro — Staging" },
);
assert.equal(
  resolveStripeCheckoutPriceExpectation({
    ...base,
    vercelEnv: "production",
    nodeEnv: "production",
    siteUrl: "https://turntableai-staging.vercel.app",
    supabaseUrl: "https://ctzldglriecdroyxkxox.supabase.co",
  }),
  null,
);

const price = {
  id: "price_example",
  active: true,
  type: "recurring",
  currency: "usd",
  unit_amount: 10000,
  billing_scheme: "per_unit",
  recurring: { interval: "month", interval_count: 1 },
  livemode: false,
  product: { name: "TurnTableAI Pro — Staging", active: true },
};
assert.equal(
  isExpectedTurnTableCheckoutPrice(price, "price_example", false, "TurnTableAI Pro — Staging"),
  true,
);
assert.equal(
  isExpectedTurnTableCheckoutPrice({ ...price, livemode: true }, "price_example", false, "TurnTableAI Pro — Staging"),
  false,
);
assert.equal(
  isExpectedTurnTableCheckoutPrice({ ...price, product: { name: "TurnTableAI Pro", active: true } }, "price_example", false, "TurnTableAI Pro — Staging"),
  false,
);

const route = readFileSync("src/app/api/stripe/create-checkout-session/route.ts", "utf8");
assert.match(route, /nodeEnv: process\.env\.NODE_ENV/);
assert.match(route, /supabaseUrl: process\.env\.NEXT_PUBLIC_SUPABASE_URL/);
assert.ok(route.indexOf("resolveStripeCheckoutPriceExpectation({") < route.indexOf("stripe.prices.retrieve("));
console.log("PASS: Local Stripe Staging checkout is test-only and Production remains isolated");
