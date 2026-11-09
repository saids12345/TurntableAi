import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  acquireStripeCheckoutAttempt,
  checkoutAttemptIdempotencyKey,
  markStripeCheckoutOpen,
  markStripeCheckoutNeedsReview,
  releaseVerifiedUnstartedCheckout,
} from "../../src/lib/stripeCheckoutAttempts";

const userId = "8d7a09d2-a3ee-4d36-9545-e39137a57155";
const attemptId = "9c4a3abd-3a50-4c40-b46f-14d4a13009b1";
const priceId = "price_verified";
const claimed = {
  attempt_id: attemptId,
  user_id: userId,
  price_id: priceId,
  status: "claimed",
  stripe_customer_id: null,
  stripe_session_id: null,
  checkout_url: null,
  session_expires_at: null,
};

function makeAdmin(
  insertResult: { data: unknown; error: { code: string } | null },
  existingResult: { data: unknown; error: unknown } = { data: claimed, error: null },
  updateResult: { data: unknown; error: unknown } = { data: { attempt_id: attemptId }, error: null },
) {
  const trace: string[] = [];
  const client = {
    from(name: string) {
      assert.equal(name, "stripe_checkout_attempts");
      return {
        insert(payload: Record<string, unknown>) {
          assert.equal(payload.user_id, userId);
          assert.equal(payload.price_id, priceId);
          assert.equal(payload.status, "claimed");
          trace.push("insert");
          return { select: () => ({ single: async () => insertResult }) };
        },
        select() {
          trace.push("lookup");
          return {
            eq(key: string, value: string) {
              assert.equal(key, "user_id");
              assert.equal(value, userId);
              return {
                in(field: string, statuses: string[]) {
                  assert.equal(field, "status");
                  assert.deepEqual(statuses, ["claimed", "open", "needs_review"]);
                  return { maybeSingle: async () => existingResult };
                },
              };
            },
          };
        },
        update(payload: Record<string, unknown>) {
          trace.push(`update:${payload.status}`);
          const scopes: Record<string, string> = {};
          const query = {
            eq(key: string, value: string) {
              scopes[key] = value;
              return query;
            },
            select(field: string) {
              assert.equal(field, "attempt_id");
              assert.equal(scopes.user_id, userId);
              assert.equal(scopes.attempt_id, attemptId);
              assert.ok(["claimed", "open"].includes(scopes.status));
              return { maybeSingle: async () => updateResult };
            },
          };
          return query;
        },
      };
    },
  };
  return { admin: client as unknown as SupabaseClient, trace };
}

async function run() {
  const initial = makeAdmin({ data: claimed, error: null });
  const first = await acquireStripeCheckoutAttempt(initial.admin, userId, priceId);
  assert.equal(first.kind, "acquired");
  assert.deepEqual(initial.trace, ["insert"]);

  const conflict = makeAdmin({ data: null, error: { code: "23505" } });
  const second = await acquireStripeCheckoutAttempt(conflict.admin, userId, priceId);
  assert.equal(second.kind, "existing");
  assert.deepEqual(conflict.trace, ["insert", "lookup"]);

  const differentPrice = makeAdmin(
    { data: null, error: { code: "23505" } },
    { data: { ...claimed, price_id: "price_old", status: "open" }, error: null },
  );
  const crossPrice = await acquireStripeCheckoutAttempt(differentPrice.admin, userId, priceId);
  assert.equal(crossPrice.kind, "existing");
  assert.equal(crossPrice.attempt.price_id, "price_old");

  await assert.rejects(
    acquireStripeCheckoutAttempt(
      makeAdmin({ data: null, error: { code: "500" } }).admin,
      userId,
      priceId,
    ),
    /Unable to safely acquire/,
  );
  await assert.rejects(
    acquireStripeCheckoutAttempt(
      makeAdmin({ data: null, error: { code: "23505" } }, { data: null, error: null }).admin,
      userId,
      priceId,
    ),
    /reconcile/,
  );

  assert.equal(
    checkoutAttemptIdempotencyKey(attemptId, "session"),
    `ttai_checkout_v1_session_${attemptId}`,
  );
  assert.equal(
    checkoutAttemptIdempotencyKey(attemptId, "customer"),
    `ttai_checkout_v1_customer_${attemptId}`,
  );
  assert.throws(() => checkoutAttemptIdempotencyKey("wrong", "session"));

  const transition = makeAdmin({ data: claimed, error: null });
  await markStripeCheckoutOpen(transition.admin, {
    userId,
    attemptId,
    stripeCustomerId: "cus_123",
    stripeSessionId: "cs_123",
    checkoutUrl: "https://checkout.stripe.com/s/123",
    expiresAt: null,
  });
  await markStripeCheckoutNeedsReview(transition.admin, userId, attemptId);
  await releaseVerifiedUnstartedCheckout(transition.admin, userId, attemptId);
  assert.deepEqual(transition.trace, ["update:open", "update:needs_review", "update:released"]);

  await assert.rejects(
    markStripeCheckoutNeedsReview(
      makeAdmin({ data: claimed, error: null }, undefined, { data: null, error: null }).admin,
      userId,
      attemptId,
    ),
    /Unable to safely transition/,
  );

  const sql = readFileSync("supabase/migrations/20261023070000_stripe_checkout_attempts.sql", "utf8");
  assert.match(sql, /CREATE UNIQUE INDEX stripe_checkout_one_unresolved_per_user/);
  assert.match(sql, /WHERE status IN \('claimed', 'open', 'needs_review'\)/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /GRANT SELECT, INSERT, UPDATE ON TABLE public\.stripe_checkout_attempts/);

  console.log("✓ Stripe Checkout durable claim helper regression test passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
