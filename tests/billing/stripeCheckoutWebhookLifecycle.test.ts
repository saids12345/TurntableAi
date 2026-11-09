import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("src/app/api/stripe/webhook/route.ts", "utf8");
const helper = readFileSync("src/lib/stripeCheckoutAttempts.ts", "utf8");

assert.match(route, /import \{ reconcileStripeCheckoutTerminalEvidence \} from "@\/lib\/stripeCheckoutAttempts"/);
assert.match(route, /async function retrieveTerminalCheckoutSession\(/);
assert.match(route, /stripe\.checkout\.sessions\.retrieve\(sessionId\)/);
assert.match(route, /session\.id !== sessionId \|\| session\.status !== expectedStatus/);
assert.match(route, /async function reconcileWebhookCheckoutAttempt\(/);
assert.match(route, /if \(!attemptId\) return;/); // legacy sessions, no new claim
assert.match(route, /reconcileStripeCheckoutTerminalEvidence\(/);
assert.match(route, /customer: stripeCustomerId,\s*subscription: subscriptionId/);

const completed = route.match(/case "checkout\.session\.completed": \{([\s\S]*?)\n      \}\n\n      case "checkout\.session\.expired"/)?.[1];
assert.ok(completed, "Completed handler must precede expired handler");
assert.match(completed, /await retrieveTerminalCheckoutSession\(eventSession\.id, "complete"\)/);
assert.match(completed, /await upsertProfile\(/);
assert.match(completed, /await markTrialUsedIfNeeded\(/);
assert.match(completed, /await reconcileWebhookCheckoutAttempt\(session\)/);
assert.ok(
  completed.indexOf("await reconcileWebhookCheckoutAttempt(session)") >
  completed.indexOf("await markTrialUsedIfNeeded("),
  "Completed claim must reconcile after subscription/trial sync",
);

const expired = route.match(/case "checkout\.session\.expired": \{([\s\S]*?)\n      \}\n\n      case "customer\.subscription\.created"/)?.[1];
assert.ok(expired, "Expired handler must be present");
assert.match(expired, /await retrieveTerminalCheckoutSession\(eventSession\.id, "expired"\)/);
assert.match(expired, /await reconcileWebhookCheckoutAttempt\(session\)/);
assert.doesNotMatch(expired, /await upsertProfile\(/);
assert.doesNotMatch(expired, /await markTrialUsedIfNeeded\(/);

const markEventIndex = route.lastIndexOf("await markEventProcessed(");
const expiredCaseIndex = route.indexOf('case "checkout.session.expired"');
assert.ok(markEventIndex > expiredCaseIndex, "Event acknowledgement must follow reconciliation");
assert.match(helper, /export async function reconcileStripeCheckoutTerminalEvidence\(/);
console.log("✓ Stripe Checkout webhook lifecycle wiring regression test passed");
