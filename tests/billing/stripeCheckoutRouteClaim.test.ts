import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(
  "src/app/api/stripe/create-checkout-session/route.ts", "utf8",
);
const migration = readFileSync(
  "supabase/migrations/20261023070000_stripe_checkout_attempts.sql", "utf8",
);

assert.match(migration, /CREATE UNIQUE INDEX stripe_checkout_one_unresolved_per_user/);
assert.match(migration, /WHERE status IN \('claimed', 'open', 'needs_review'\)/);
assert.ok(!route.includes("Date.now()"), "timestamp keys do not deduplicate");
assert.ok(route.includes('checkoutAttemptIdempotencyKey(claimAttemptId, "customer")'));
assert.ok(route.includes('checkoutAttemptIdempotencyKey(claimAttemptId, "session")'));
assert.ok(route.includes('markVerifiedStripeCheckoutTerminal('));
assert.ok(route.includes('existingSession.status === "complete"'));
assert.ok(route.includes('existingSession.status === "expired"'));
assert.ok(route.includes('existingSession.client_reference_id !== user.id'));
assert.ok(route.includes('existingSession.metadata?.turntable_price_id !== priceId'));
assert.ok(route.includes('openCheckoutSessions.data.length > 0'));
assert.ok(route.includes('await markStripeCheckoutNeedsReview('));

const first = route.indexOf('await acquireStripeCheckoutAttempt(');
const customer = route.indexOf('stripe.customers.create(');
const checkout = route.indexOf('stripe.checkout.sessions.create(');
const persisted = route.indexOf('await markStripeCheckoutOpen(supabaseAdmin, {\n      userId: user.id,');
const reply = route.indexOf('return NextResponse.json({ ok: true, url: session.url }');
assert.ok(first >= 0 && first < customer && customer < checkout);
assert.ok(checkout < persisted && persisted < reply);
console.log("✓ Stripe Checkout route claim integration regression test passed");
