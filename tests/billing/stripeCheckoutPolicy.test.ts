import assert from "node:assert/strict";

import {
  findReusableStripeCheckoutUrl,
  shouldBlockNewStripeCheckout,
} from "../../src/lib/stripeCheckoutPolicy";

for (const status of [
  "trialing",
  "active",
  "past_due",
  "unpaid",
  "paused",
  "incomplete",
]) {
  assert.equal(
    shouldBlockNewStripeCheckout(status),
    true,
    `${status} should block a new subscription checkout`,
  );
}

for (const status of [
  null,
  "",
  "canceled",
  "incomplete_expired",
]) {
  assert.equal(
    shouldBlockNewStripeCheckout(status),
    false,
    `${String(status)} should allow a new subscription checkout`,
  );
}

assert.equal(
  shouldBlockNewStripeCheckout(
    "future_unknown_status",
  ),
  true,
  "Unknown non-empty Stripe statuses should fail closed",
);



assert.equal(
  findReusableStripeCheckoutUrl({
    sessions: [
      {
        mode:
          "subscription",
        client_reference_id:
          "user-1",
        metadata: {
          supabase_user_id:
            "user-1",
          turntable_price_id:
            "price-1",
        },
        success_url:
          "https://turntableai.net/billing?success=1&next=%2Fbrain",
        cancel_url:
          "https://turntableai.net/billing?canceled=1&next=%2Fbrain",
        url:
          "https://checkout.stripe.com/reuse",
      },
    ],
    userId:
      "user-1",
    priceId:
      "price-1",
    successUrl:
      "https://turntableai.net/billing?success=1&next=%2Fbrain",
    cancelUrl:
      "https://turntableai.net/billing?canceled=1&next=%2Fbrain",
  }),
  "https://checkout.stripe.com/reuse",
);

assert.equal(
  findReusableStripeCheckoutUrl({
    sessions: [
      {
        mode:
          "subscription",
        client_reference_id:
          "user-1",
        metadata: {
          supabase_user_id:
            "user-1",
          turntable_price_id:
            "old-price",
        },
        success_url:
          "https://turntableai.net/billing?success=1&next=%2Fbrain",
        cancel_url:
          "https://turntableai.net/billing?canceled=1&next=%2Fbrain",
        url:
          "https://checkout.stripe.com/old",
      },
    ],
    userId:
      "user-1",
    priceId:
      "price-1",
    successUrl:
      "https://turntableai.net/billing?success=1&next=%2Fbrain",
    cancelUrl:
      "https://turntableai.net/billing?canceled=1&next=%2Fbrain",
  }),
  null,
);

assert.equal(
  findReusableStripeCheckoutUrl({
    sessions: [
      {
        mode:
          "subscription",
        client_reference_id:
          "user-1",
        metadata: {
          supabase_user_id:
            "user-1",
          turntable_price_id:
            "price-1",
        },
        success_url:
          "https://turntableai.net/billing?success=1&next=%2Fbrain",
        cancel_url:
          "https://turntableai.net/billing?canceled=1&next=%2Fbrain",
        url:
          "https://checkout.stripe.com/wrong-next",
      },
    ],
    userId:
      "user-1",
    priceId:
      "price-1",
    successUrl:
      "https://turntableai.net/billing?success=1&next=%2Fcommand-center",
    cancelUrl:
      "https://turntableai.net/billing?canceled=1&next=%2Fcommand-center",
  }),
  null,
);

console.log(
  "✓ Stripe checkout policy regression test passed",
);
