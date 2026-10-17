import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { resolveUniqueConnectedGoogleLocation } from "@/lib/connectedGoogleReviewEvidence";
import { canTransitionAutoActionStatus } from "@/lib/autoActionStatus";

const path = "src/app/api/auto-actions/route.ts";
const compiled = ts.transpileModule(readFileSync(path, "utf8"), {
  fileName: path,
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

type Options = {
  concurrent?: boolean;
  claimError?: boolean;
  outcomeError?: boolean;
  finalizeError?: boolean;
};

function harness(options: Options = {}) {
  const row: Record<string, unknown> = {
    id: "action-1", user_id: "owner-1", location_name: "Test Cafe",
    action_type: "margin_protection", title: "Review margins", reason: "Refund risk",
    recommended_payload: {}, source_signal: { trigger: { type: "refund_spike" } },
    status: "approved", execution_claim_token: null, execution_claimed_at: null,
    priority_score: 90, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  };
  let claims = 0;
  let outcomes = 0;
  let memories = 0;
  let finalizations = 0;
  let initialReads = 0;
  let releaseReads = () => {};
  const readBarrier = new Promise<void>((resolve) => { releaseReads = resolve; });

  const supabase = {
    auth: { getUser: async () => ({ data: { user: { id: "owner-1" } }, error: null }) },
    from(table: string) {
      if (table === "ai_insight_outcomes") {
        return {
          upsert: async () => {
            outcomes += 1;
            return { error: options.outcomeError ? { message: "simulated write failure" } : null };
          },
          insert: async () => ({ error: { message: "simulated fallback failure" } }),
        };
      }
      if (table === "operator_memory") {
        return { upsert: async () => { memories += 1; return { error: null }; } };
      }
      assert.equal(table, "auto_actions");
      const equals: Record<string, unknown> = {};
      const nullChecks = new Set<string>();
      let payload: Record<string, unknown> | null = null;
      const query = {
        select(_fields: string) { return query; },
        eq(name: string, value: unknown) { equals[name] = value; return query; },
        is(name: string, value: unknown) {
          assert.equal(value, null);
          nullChecks.add(name);
          return query;
        },
        update(value: Record<string, unknown>) { payload = value; return query; },
        async single() {
          if (equals.id !== row.id || equals.user_id !== row.user_id) {
            return { data: null, error: null };
          }
          const snapshot = { ...row };
          if (options.concurrent) {
            initialReads += 1;
            if (initialReads === 2) releaseReads();
            await readBarrier;
          }
          return { data: snapshot, error: null };
        },
        async maybeSingle() {
          assert.ok(payload, "Conditional update must supply a payload");
          const update = payload;
          for (const [key, expected] of Object.entries(equals)) {
            if (row[key] !== expected) return { data: null, error: null };
          }
          for (const key of nullChecks) {
            if (row[key] !== null && row[key] !== undefined) {
              return { data: null, error: null };
            }
          }
          if (Object.hasOwn(update, "execution_claim_token")) {
            if (options.claimError) return { data: null, error: { message: "claim failed" } };
            claims += 1;
          }
          if (update.status === "executed") {
            if (options.finalizeError) return { data: null, error: { message: "finalize failed" } };
            finalizations += 1;
          }
          Object.assign(row, update);
          return { data: { ...row }, error: null };
        },
      };
      return query;
    },
  };

  let uuid = 0;
  const route = {} as { PATCH: (request: Request) => Promise<Response> };
  const dependencies: Record<string, unknown> = {
    "next/server": { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } },
    "@/lib/supabaseRoute": { getSupabaseRouteClient: async () => supabase },
    "@/lib/requirePro": { requireProForApi: async () => ({}) },
    "@/lib/autoActionStatus": { canTransitionAutoActionStatus },
    "@/lib/operatorMemoryTrust": { buildProvisionalMemoryEvidence: (value: unknown) => value },
    "@/lib/connectedGoogleReviewEvidence": { resolveUniqueConnectedGoogleLocation },
    "@/lib/autoActionEvidenceServer": { verifyAutoActionEvidence: async () => true },
  };
  runInNewContext(compiled, {
    exports: route,
    require: (name: string) => {
      assert.ok(Object.hasOwn(dependencies, name), `Unknown dependency: ${name}`);
      return dependencies[name];
    },
    Response,
    crypto: { randomUUID: () => `00000000-0000-4000-8000-${String(++uuid).padStart(12, "0")}` },
    console: { error() {}, warn() {}, log() {} },
  }, { filename: path });

  async function call(status: string) {
    const response = await route.PATCH(new Request("https://turntableai.net/api/auto-actions", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "action-1", status }),
    }));
    return { status: response.status, body: await response.json() as Record<string, unknown> };
  }
  return {
    call, row,
    counts: () => ({ claims, outcomes, memories, finalizations }),
  };
}

async function run() {
  const concurrent = harness({ concurrent: true });
  const results = await Promise.all([
    concurrent.call("executed"),
    concurrent.call("executed"),
  ]);
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
  assert.deepEqual(concurrent.counts(), {
    claims: 1, outcomes: 1, memories: 1, finalizations: 1,
  });
  assert.equal(concurrent.row.status, "executed");
  assert.ok(concurrent.row.execution_claim_token);

  const repeated = await concurrent.call("executed");
  assert.equal(repeated.status, 200);
  const repeatedItem = repeated.body.item as Record<string, unknown>;
  assert.equal(
    Object.hasOwn(repeatedItem, "execution_claim_token"),
    false,
    "Internal execution token must remain private",
  );
  assert.equal(
    Object.hasOwn(repeatedItem, "execution_claimed_at"),
    false,
    "Internal claim timestamp must remain private",
  );
  assert.equal(concurrent.counts().outcomes, 1, "Idempotent repeat must not reexecute");

  const failedClaim = harness({ claimError: true });
  assert.equal((await failedClaim.call("executed")).status, 500);
  assert.equal(failedClaim.row.execution_claim_token, null);
  assert.equal(failedClaim.counts().outcomes, 0);

  const failedOutcome = harness({ outcomeError: true });
  const outcome = await failedOutcome.call("executed");
  assert.equal(outcome.status, 500);
  assert.equal(outcome.body.code, "AUTO_ACTION_EXECUTION_RECONCILIATION_REQUIRED");
  assert.equal(failedOutcome.row.status, "approved");
  assert.ok(failedOutcome.row.execution_claim_token);
  assert.equal((await failedOutcome.call("executed")).status, 409);
  assert.equal((await failedOutcome.call("dismissed")).status, 409);
  assert.equal(failedOutcome.counts().outcomes, 1);

  const failedFinalization = harness({ finalizeError: true });
  assert.equal((await failedFinalization.call("executed")).status, 500);
  assert.equal(failedFinalization.row.status, "approved");
  assert.ok(failedFinalization.row.execution_claim_token);
  assert.equal((await failedFinalization.call("executed")).status, 409);
  assert.equal(failedFinalization.counts().outcomes, 1);

  console.log("✓ Auto Action single-winner execution claim regression test passed");
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
