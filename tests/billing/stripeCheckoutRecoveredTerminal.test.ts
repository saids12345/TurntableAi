import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  reconcileStripeCheckoutTerminalEvidence,
  type StripeCheckoutAttempt,
  type StripeCheckoutTerminalEvidence,
} from "../../src/lib/stripeCheckoutAttempts";

const userId = "8d7a09d2-a3ee-4d36-9545-e39137a57155";
const attemptId = "9c4a3abd-3a50-4c40-b46f-14d4a13009b1";
const priceId = "price_test_verified";
const pending: StripeCheckoutAttempt = {
  attempt_id: attemptId,
  user_id: userId,
  price_id: priceId,
  status: "claimed",
  stripe_customer_id: null,
  stripe_session_id: null,
  checkout_url: null,
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

function mockAdmin(row: typeof pending, opts: { updateError?: boolean; missingUpdate?: boolean } = {}) {
  const updates: Record<string, unknown>[] = [];
  const updateScopes: Record<string, unknown>[] = [];
  const client = {
    from(table: string) {
      assert.equal(table, "stripe_checkout_attempts");
      return {
        select(cols: string) {
          assert.match(cols, /attempt_id,user_id,price_id,status/);
          const scope: Record<string, string> = {};
          const q = {
            eq(field: string, value: string) { scope[field] = value; return q; },
            async maybeSingle() {
              assert.equal(scope.attempt_id, attemptId);
              assert.equal(scope.user_id, userId);
              return { data: row, error: null };
            },
          };
          return q;
        },
        update(payload: Record<string, unknown>) {
          updates.push(payload);
          const scope: Record<string, unknown> = {};
          const q = {
            eq(field: string, value: string) { scope[field] = value; return q; },
            is(field: string, value: null) { scope[field] = value; return q; },
            select(field: string) {
              assert.equal(field, "attempt_id");
              updateScopes.push(scope);
              return {
                async maybeSingle() {
                  if (opts.updateError) return { data: null, error: { code: "500" } };
                  if (opts.missingUpdate) return { data: null, error: null };
                  return { data: { attempt_id: attemptId }, error: null };
                },
              };
            },
          };
          return q;
        },
      };
    },
  };
  return { admin: client as unknown as SupabaseClient, updates, updateScopes };
}

async function run() {
  const afterFailedSave = mockAdmin(pending);
  assert.equal(
    await reconcileStripeCheckoutTerminalEvidence(afterFailedSave.admin, userId, attemptId, completed),
    "updated",
  );
  assert.equal(afterFailedSave.updates.length, 1);
  assert.equal(afterFailedSave.updates[0].status, "completed");
  assert.equal(afterFailedSave.updates[0].stripe_session_id, "cs_123");
  assert.equal(afterFailedSave.updates[0].stripe_customer_id, "cus_123");
  assert.deepEqual(afterFailedSave.updateScopes[0], {
    attempt_id: attemptId,
    user_id: userId,
    status: "claimed",
    stripe_session_id: null,
  });

  const uncertain = mockAdmin({ ...pending, status: "needs_review" });
  assert.equal(
    await reconcileStripeCheckoutTerminalEvidence(
      uncertain.admin, userId, attemptId, { ...completed, status: "expired", subscription: null },
    ),
    "updated",
  );
  assert.equal(uncertain.updates[0].status, "expired");

  // A claimed attempt with no terminal evidence must NEVER be released.
  const invalid: StripeCheckoutTerminalEvidence[] = [
    { ...completed, status: "open" },
    { ...completed, mode: "payment" },
    { ...completed, subscription: null },
    { ...completed, customer: null },
    { ...completed, id: "" },
    { ...completed, client_reference_id: "someone_else" },
    { ...completed, metadata: { ...completed.metadata!, supabase_user_id: "someone_else" } },
    { ...completed, metadata: { ...completed.metadata!, turntable_price_id: "wrong_price" } },
    { ...completed, metadata: { ...completed.metadata!, turntable_attempt_id: "wrong_attempt" } },
  ];
  for (const evidence of invalid) {
    const trial = mockAdmin(pending);
    await assert.rejects(
      reconcileStripeCheckoutTerminalEvidence(trial.admin, userId, attemptId, evidence),
    );
    assert.equal(trial.updates.length, 0);
  }

  const conflictingSession = mockAdmin({ ...pending, status: "needs_review", stripe_session_id: "cs_other" });
  await assert.rejects(
    reconcileStripeCheckoutTerminalEvidence(conflictingSession.admin, userId, attemptId, completed),
  );
  assert.equal(conflictingSession.updates.length, 0);

  for (const opts of [{ updateError: true }, { missingUpdate: true }]) {
    const failed = mockAdmin(pending, opts);
    await assert.rejects(
      reconcileStripeCheckoutTerminalEvidence(failed.admin, userId, attemptId, completed),
      /Unable to safely reconcile/,
    );
    assert.equal(failed.updates.length, 1);
  }

  // Idempotent recovery after a successful, fully persisted terminal write.
  const duplicate = mockAdmin({
    ...pending, status: "completed", stripe_session_id: "cs_123", stripe_customer_id: "cus_123",
  });
  assert.equal(
    await reconcileStripeCheckoutTerminalEvidence(duplicate.admin, userId, attemptId, completed),
    "already_terminal",
  );
  assert.equal(duplicate.updates.length, 0);

  console.log("✓ Recovered Stripe Checkout terminal claims regression test passed");
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
