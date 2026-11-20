import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  reconcileStripeCheckoutTerminalEvidence,
  type StripeCheckoutTerminalEvidence,
} from "../../src/lib/stripeCheckoutAttempts";

const userId = "8d7a09d2-a3ee-4d36-9545-e39137a57155";
const attemptId = "9c4a3abd-3a50-4c40-b46f-14d4a13009b1";
const priceId = "price_test_verified";
const attempt = {
  attempt_id: attemptId,
  user_id: userId,
  price_id: priceId,
  status: "open",
  stripe_customer_id: "cus_123",
  stripe_session_id: "cs_123",
  checkout_url: "https://checkout.stripe.com/c/pay/cs_123",
  session_expires_at: null,
};
const completed: StripeCheckoutTerminalEvidence = {
  id: "cs_123",
  mode: "subscription",
  status: "complete",
  client_reference_id: userId,
  metadata: {
    supabase_user_id: userId,
    turntable_attempt_id: attemptId,
    turntable_price_id: priceId,
  },
  customer: "cus_123",
  subscription: "sub_123",
};

function mockAdmin(row: typeof attempt | null, lookupError: unknown = null) {
  const updates: Record<string, unknown>[] = [];
  const lookups: Record<string, string>[] = [];
  const client = {
    from(name: string) {
      assert.equal(name, "stripe_checkout_attempts");
      return {
        select(columns: string) {
          assert.match(columns, /attempt_id,user_id,price_id,status/);
          const where: Record<string, string> = {};
          const query = {
            eq(key: string, value: string) {
              where[key] = value;
              return query;
            },
            async maybeSingle() {
              lookups.push({ ...where });
              assert.equal(where.attempt_id, attemptId);
              assert.equal(where.user_id, userId);
              return { data: row, error: lookupError };
            },
          };
          return query;
        },
        update(payload: Record<string, unknown>) {
          updates.push(payload);
          const where: Record<string, string> = {};
          const query = {
            eq(key: string, value: string) {
              where[key] = value;
              return query;
            },
            select(field: string) {
              assert.equal(field, "attempt_id");
              assert.equal(where.attempt_id, attemptId);
              assert.equal(where.user_id, userId);
              assert.equal(where.status, "open");
              return {
                async maybeSingle() {
                  return { data: { attempt_id: attemptId }, error: null };
                },
              };
            },
          };
          return query;
        },
      };
    },
  };
  return { admin: client as unknown as SupabaseClient, updates, lookups };
}

async function run() {
  const success = mockAdmin(attempt);
  assert.equal(
    await reconcileStripeCheckoutTerminalEvidence(success.admin, userId, attemptId, completed),
    "updated",
  );
  assert.equal(success.updates.length, 1);
  assert.equal(success.updates[0].status, "completed");
  assert.equal(success.lookups.length, 1);

  const expired = mockAdmin(attempt);
  assert.equal(
    await reconcileStripeCheckoutTerminalEvidence(
      expired.admin, userId, attemptId,
      { ...completed, status: "expired", subscription: null },
    ),
    "updated",
  );
  assert.equal(expired.updates[0].status, "expired");

  const duplicate = mockAdmin({ ...attempt, status: "completed" });
  assert.equal(
    await reconcileStripeCheckoutTerminalEvidence(duplicate.admin, userId, attemptId, completed),
    "already_terminal",
  );
  assert.equal(duplicate.updates.length, 0);

  const blocked = mockAdmin({ ...attempt, status: "needs_review" });
  await assert.rejects(
    reconcileStripeCheckoutTerminalEvidence(blocked.admin, userId, attemptId, completed),
    /not open/,
  );
  assert.equal(blocked.updates.length, 0);

  const mismatchCases: StripeCheckoutTerminalEvidence[] = [
    { ...completed, id: "cs_different" },
    { ...completed, customer: "cus_different" },
    { ...completed, client_reference_id: "different_user" },
    { ...completed, mode: "payment" },
    { ...completed, status: "open" },
    { ...completed, subscription: null },
    { ...completed, metadata: { ...completed.metadata!, turntable_price_id: "price_wrong" } },
    { ...completed, metadata: { ...completed.metadata!, turntable_attempt_id: "wrong" } },
    { ...completed, metadata: { ...completed.metadata!, supabase_user_id: "wrong" } },
  ];
  for (const session of mismatchCases) {
    const mismatch = mockAdmin(attempt);
    await assert.rejects(
      reconcileStripeCheckoutTerminalEvidence(mismatch.admin, userId, attemptId, session),
      /did not match claim/,
    );
    assert.equal(mismatch.updates.length, 0);
  }

  const missing = mockAdmin(null);
  await assert.rejects(
    reconcileStripeCheckoutTerminalEvidence(missing.admin, userId, attemptId, completed),
    /could not be verified/,
  );
  assert.equal(missing.updates.length, 0);

  console.log("✓ Stripe Checkout terminal evidence regression test passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
