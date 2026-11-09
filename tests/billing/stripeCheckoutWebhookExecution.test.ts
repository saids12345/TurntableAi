import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as ts from "typescript";

// Execute the ACTUAL handler and helper TypeScript, transpiled in memory.
// Every import is strictly mocked. There is no real network-capable Stripe or
// Supabase client, process environment, or unrestricted require in the sandbox.
function loadLocalModule(path: string, imports: Record<string, unknown>) {
  const source = readFileSync(path, "utf8");
  const compiled = ts.transpileModule(source, {
    fileName: path,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports: Record<string, any> = {};
  const module = { exports };
  const environment = {
    module, exports, Buffer, Request,
    console: { log() {}, error() {} },
    process: { env: { STRIPE_WEBHOOK_SECRET: "whsec_in_memory_only" } },
    require(id: string) {
      if (!Object.prototype.hasOwnProperty.call(imports, id)) {
        throw new Error(`Unexpected or unsafe webhook dependency: ${id}`);
      }
      return imports[id];
    },
  };
  runInNewContext(compiled, environment, { filename: path, timeout: 5000 });
  return module.exports;
}

const helper = loadLocalModule("src/lib/stripeCheckoutAttempts.ts", {});
assert.equal(typeof helper.reconcileStripeCheckoutTerminalEvidence, "function");

const userId = "user_mock_a";
const attemptId = "attempt_mock_a";
const priceId = "price_mock_a";
const customerId = "cus_mock_a";
const sessionId = "cs_mock_a";
const subscriptionId = "sub_mock_a";

function session(status: "complete" | "expired" | "open", claimed = true) {
  return {
    id: sessionId,
    mode: "subscription",
    status,
    client_reference_id: userId,
    metadata: {
      supabase_user_id: userId,
      turntable_price_id: priceId,
      ...(claimed ? { turntable_attempt_id: attemptId } : {}),
    },
    customer: customerId,
    subscription: status === "complete" ? subscriptionId : null,
  };
}

function setup(initialStatus: "open" | "claimed" | "needs_review" = "open", legacy = false) {
  const record: any = {
    attempt_id: attemptId, user_id: userId, price_id: priceId,
    status: initialStatus,
    stripe_customer_id: initialStatus === "open" ? customerId : null,
    stripe_session_id: initialStatus === "open" ? sessionId : null,
    checkout_url: initialStatus === "open" ? "https://example.invalid/checkout" : null,
    session_expires_at: null,
  };
  const events = new Set<string>();
  const profileWrites: any[] = [];
  const trialWrites: any[] = [];
  const sessions = new Map<string, any>();
  const subscriptions = new Map<string, any>();
  let claimReads = 0;
  let sessionRetrievals = 0;
  let failClaimWrite = false;
  sessions.set(sessionId, session("complete", !legacy));
  subscriptions.set(subscriptionId, {
    id: subscriptionId, customer: customerId, status: "trialing",
    trial_start: 1760000000, trial_end: 1761000000,
    items: { data: [] },
  });

  function attemptQuery(kind: "read" | "write", patch?: Record<string, unknown>) {
    const filters: Record<string, unknown> = {};
    const query: any = {
      eq(k: string, v: unknown) { filters[k] = v; return query; },
      is(k: string, v: unknown) { filters[k] = v; return query; },
      select(_fields: string) { return query; },
      async maybeSingle() {
        if (kind === "read") {
          claimReads += 1;
          const matches = filters.attempt_id === record.attempt_id && filters.user_id === record.user_id;
          return { data: matches ? { ...record } : null, error: null };
        }
        if (failClaimWrite) return { data: null, error: { message: "simulated DB failure" } };
        const matches = Object.entries(filters).every(([key, value]) => record[key] === value);
        if (!matches) return { data: null, error: null };
        Object.assign(record, patch);
        return { data: { attempt_id: record.attempt_id }, error: null };
      },
    };
    return query;
  }

  const admin = {
    from(name: string): any {
      if (name === "stripe_checkout_attempts") {
        return {
          select(_fields: string) { return attemptQuery("read"); },
          update(patch: Record<string, unknown>) { return attemptQuery("write", patch); },
        };
      }
      if (name === "stripe_webhook_events") {
        return {
          select(_fields: string) {
            return { eq(_key: string, value: string) {
              return { maybeSingle: async () => ({ data: events.has(value) ? { event_id: value } : null, error: null }) };
            } };
          },
          async insert(event: any) {
            events.add(event.event_id);
            return { error: null };
          },
        };
      }
      if (name === "profiles") {
        return {
          async upsert(p: any) { profileWrites.push(p); return { error: null }; },
          update(p: any) {
            return { eq(_key: string, _val: string) {
              return { async is(_field: string, _value: null) {
                trialWrites.push(p); return { error: null };
              } };
            } };
          },
        };
      }
      throw new Error(`Unexpected table ${name}`);
    },
  };
  const stripeMock = {
    webhooks: {
      constructEvent(buffer: Buffer, signature: string, secret: string) {
        if (signature !== "sig_in_memory_only" || secret !== "whsec_in_memory_only") {
          throw new Error("Invalid simulated signature");
        }
        return JSON.parse(buffer.toString("utf8"));
      },
    },
    checkout: { sessions: { async retrieve(id: string) {
      sessionRetrievals++;
      if (!sessions.has(id)) throw new Error("Session not found in test store");
      return sessions.get(id);
    } } },
    subscriptions: { async retrieve(id: string) {
      if (!subscriptions.has(id)) throw new Error("Subscription not found in test store");
      return subscriptions.get(id);
    } },
  };
  const route = loadLocalModule("src/app/api/stripe/webhook/route.ts", {
    "next/server": { NextResponse: { json(body: unknown, opts?: { status?: number }) {
      return { body, status: opts?.status ?? 200 };
    } } },
    "@/lib/stripe": { stripe: stripeMock },
    "@/lib/supabaseAdmin": { getSupabaseAdmin: () => admin },
    "@/lib/plans": { isAllowedStripeStatus: (status: string) => status === "trialing" || status === "active" },
    "@/lib/stripeCheckoutAttempts": {
      reconcileStripeCheckoutTerminalEvidence: helper.reconcileStripeCheckoutTerminalEvidence,
    },
  });
  assert.equal(typeof route.POST, "function");
  async function deliver(type: string, eventId: string, signature = "sig_in_memory_only") {
    const payload = {
      id: eventId,
      type,
      data: { object: { id: sessionId } },
    };
    return route.POST(new Request("http://localhost/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": signature },
      body: JSON.stringify(payload),
    }));
  }
  return {
    record, events, profileWrites, trialWrites, sessions, subscriptions, deliver,
    get claimReads() { return claimReads; },
    get sessionRetrievals() { return sessionRetrievals; },
    set failClaimWrite(value: boolean) { failClaimWrite = value; },
  };
}

async function run() {
  // Completed checkout syncs profile and trial BEFORE resolving claim + ack.
  const completed = setup();
  const result = await completed.deliver("checkout.session.completed", "evt_complete");
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(completed.record.status, "completed");
  assert.equal(completed.profileWrites.length, 1);
  assert.equal(completed.profileWrites[0].stripe_subscription_id, subscriptionId);
  assert.equal(completed.trialWrites.length, 1);
  assert.equal(completed.events.has("evt_complete"), true);
  const retrievals = completed.sessionRetrievals;
  const duplicate = await completed.deliver("checkout.session.completed", "evt_complete");
  assert.equal(duplicate.status, 200);
  assert.equal(duplicate.body.deduped, true);
  assert.equal(completed.sessionRetrievals, retrievals);

  // Expiration only resolves the claim; never grants subscription access.
  const expired = setup();
  expired.sessions.set(sessionId, session("expired"));
  const expiredResult = await expired.deliver("checkout.session.expired", "evt_expired");
  assert.equal(expiredResult.status, 200, JSON.stringify(expiredResult.body));
  assert.equal(expired.record.status, "expired");
  assert.equal(expired.profileWrites.length, 0);

  // A terminal Stripe session recovers claims interrupted before the server
  // persisted a session ID, even in the needs_review state.
  for (const pendingStatus of ["claimed", "needs_review"] as const) {
    const pending = setup(pendingStatus);
    const pendingResult = await pending.deliver("checkout.session.completed", `evt_${pendingStatus}`);
    assert.equal(pendingResult.status, 200, JSON.stringify(pendingResult.body));
    assert.equal(pending.record.status, "completed");
    assert.equal(pending.record.stripe_session_id, sessionId);
    assert.equal(pending.record.stripe_customer_id, customerId);
  }

  // A mismatching price must fail and remain unacknowledged; retry after
  // restoring verified Stripe evidence must succeed.
  const mismatch = setup();
  mismatch.sessions.set(sessionId, { ...session("complete"), metadata: {
    ...session("complete").metadata, turntable_price_id: "price_other",
  } });
  const mismatchResult = await mismatch.deliver("checkout.session.completed", "evt_mismatch");
  assert.equal(mismatchResult.status, 500);
  assert.equal(mismatch.record.status, "open");
  assert.equal(mismatch.events.has("evt_mismatch"), false);
  mismatch.sessions.set(sessionId, session("complete"));
  assert.equal((await mismatch.deliver("checkout.session.completed", "evt_mismatch")).status, 200);
  assert.equal(mismatch.record.status, "completed");

  // An incorrect event snapshot cannot bypass Stripe's live terminal state.
  const notTerminal = setup();
  notTerminal.sessions.set(sessionId, session("open"));
  const wrongStatus = await notTerminal.deliver("checkout.session.completed", "evt_not_terminal");
  assert.equal(wrongStatus.status, 500);
  assert.equal(notTerminal.events.size, 0);
  assert.equal(notTerminal.record.status, "open");

  // Transient database failure should fail the event, then safely retry.
  const retry = setup();
  retry.failClaimWrite = true;
  assert.equal((await retry.deliver("checkout.session.completed", "evt_retry")).status, 500);
  assert.equal(retry.events.has("evt_retry"), false);
  retry.failClaimWrite = false;
  assert.equal((await retry.deliver("checkout.session.completed", "evt_retry")).status, 200);
  assert.equal(retry.record.status, "completed");

  // Pre-claim legacy Checkout must remain compatible.
  const legacy = setup("open", true);
  const legacyResult = await legacy.deliver("checkout.session.completed", "evt_legacy");
  assert.equal(legacyResult.status, 200, JSON.stringify(legacyResult.body));
  assert.equal(legacy.claimReads, 0);
  assert.equal(legacy.profileWrites.length, 1);
  assert.equal(legacy.record.status, "open");

  // Invalid signatures cannot change any persisted state.
  const invalid = setup();
  const bad = await invalid.deliver("checkout.session.completed", "evt_bad", "invalid_signature");
  assert.equal(bad.status, 400);
  assert.equal(invalid.events.size, 0);
  assert.equal(invalid.profileWrites.length, 0);
  console.log("✓ Stripe webhook actual-handler execution regression test passed (mock Stripe/Supabase)");
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
