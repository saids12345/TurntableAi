import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { canTransitionAutoActionStatus } from "@/lib/autoActionStatus";
import { resolveUniqueConnectedGoogleLocation } from "@/lib/connectedGoogleReviewEvidence";

const sourcePath = "src/app/api/auto-actions/route.ts";
const compiled = ts.transpileModule(readFileSync(sourcePath, "utf8"), {
  fileName: sourcePath,
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

type Options = {
  locations?: Array<{ name: string; title: string }>;
  reviewMode?: "normal" | "none" | "foreign";
  actionType?: string;
  existingWorkflowStatus?: "resolved" | "drafted" | "escalated";
  workflowResult?: "normal" | "empty" | "foreign" | "error";
};
function harness(options: Options = {}) {
  const now = new Date().toISOString();
  const resourceId = "locations/101";
  const row: Record<string, unknown> = {
    id: "action-1", user_id: "owner-1", location_name: "Test Cafe",
    action_type: options.actionType ?? "review_response_push",
    title: "Follow up with guests", reason: "Guest sentiment is down",
    recommended_payload: {},
    source_signal: { trigger: { type: "guest_sentiment_risk" } },
    status: "approved", execution_claim_token: null, execution_claimed_at: null,
    priority_score: 90, created_at: now, updated_at: now,
  };
  const connections = options.locations ?? [{ name: resourceId, title: "Test Cafe" }];
  const reviews = options.reviewMode === "none" ? [] : [{
    id: "review-1", user_id: options.reviewMode === "foreign" ? "owner-2" : "owner-1",
    provider: "google", location_name: resourceId, provider_review_id: "google-review-1",
    rating: 2, text: "Slow service", reviewer_name: "Guest", update_time: now,
  }];
  const operations: string[] = [];
  const drafted: Array<Record<string, unknown>> = [];
  // Represents durable workflow records that an owner may have edited.
  const storedWorkflows: Array<Record<string, unknown>> =
    options.existingWorkflowStatus ? [{
      id: "wf-existing", user_id: "owner-1", review_id: "review-1",
      status: options.existingWorkflowStatus,
      note: "Owner manual note", suggested_reply: "Owner manual reply",
      created_at: now, updated_at: now,
    }] : [];
  let outcomeWrites = 0;
  const supabase = {
    auth: { getUser: async () => ({ data: { user: { id: "owner-1" } }, error: null }) },
    from(table: string) {
      operations.push(`from:${table}`);
      if (table === "ai_insight_outcomes") {
        return { upsert: async () => { outcomeWrites++; return { error: null }; } };
      }
      if (table === "operator_memory") {
        return { upsert: async () => ({ error: null }) };
      }
      if (table === "review_workflow_states") {
        return {
          upsert(payload: Array<Record<string, unknown>>, opts: Record<string, unknown>) {
            assert.equal(opts.onConflict, "user_id,review_id");
            assert.equal(opts.ignoreDuplicates, true, "Never overwrite owner workflow edits");
            const fresh = payload.filter((candidate) =>
              !storedWorkflows.some((saved) =>
                saved.user_id === candidate.user_id &&
                saved.review_id === candidate.review_id,
              ),
            );
            if (options.workflowResult === "error") {
              return { select: async () => ({ data: null, error: { message: "simulated write outage" } }) };
            }
            if (options.workflowResult === "empty") {
              return { select: async () => ({ data: [], error: null }) };
            }
            const savedRows = fresh.map((candidate, index) => ({
              ...candidate, id: `wf-${index}`, created_at: now,
            }));
            drafted.push(...fresh);
            storedWorkflows.push(...savedRows);
            const responseRows = options.workflowResult === "foreign"
              ? savedRows.map((saved) => ({ ...saved, user_id: "owner-2" }))
              : savedRows;
            return { select: async () => ({ data: responseRows, error: null }) };
          },
        };
      }
      const eqs: Record<string, unknown> = {};
      const nullChecks = new Set<string>();
      let updating: Record<string, unknown> | null = null;
      const query = {
        select(_columns: string) { return query; },
        eq(key: string, value: unknown) { eqs[key] = value; return query; },
        is(key: string, value: unknown) { assert.equal(value, null); nullChecks.add(key); return query; },
        lte(_key: string, _value: number) { return query; },
        gte(_key: string, _value: string) { return query; },
        order(_key: string, _value?: unknown) { return query; },
        limit(_value: number) { return query; },
        update(payload: Record<string, unknown>) { updating = payload; return query; },
        async single() {
          assert.equal(table, "auto_actions");
          return { data: eqs.user_id === row.user_id && eqs.id === row.id ? { ...row } : null, error: null };
        },
        async maybeSingle() {
          assert.equal(table, "auto_actions");
          assert.ok(updating);
          if (Object.entries(eqs).some(([key, value]) => row[key] !== value)) return { data: null, error: null };
          if ([...nullChecks].some((key) => row[key] !== null && row[key] !== undefined)) return { data: null, error: null };
          Object.assign(row, updating);
          return { data: { ...row }, error: null };
        },
        then(resolve: (value: unknown) => unknown, reject?: (error: unknown) => unknown) {
          if (table === "review_connections") {
            assert.equal(eqs.user_id, "owner-1");
            assert.equal(eqs.provider, "google");
            return Promise.resolve({ data: [{ review_locations: connections }], error: null }).then(resolve, reject);
          }
          assert.equal(table, "reviews");
          assert.equal(eqs.user_id, "owner-1");
          assert.equal(eqs.provider, "google");
          assert.equal(eqs.location_name, resourceId);
          const matching = reviews.filter((r) => r.user_id === eqs.user_id && r.provider === eqs.provider && r.location_name === eqs.location_name);
          return Promise.resolve({ data: matching, error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  const route = {} as { PATCH: (r: Request) => Promise<Response> };
  const deps: Record<string, unknown> = {
    "next/server": { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) } },
    "@/lib/supabaseRoute": { getSupabaseRouteClient: async () => supabase },
    "@/lib/requirePro": { requireProForApi: async () => ({}) },
    "@/lib/autoActionStatus": { canTransitionAutoActionStatus },
    "@/lib/operatorMemoryTrust": { buildProvisionalMemoryEvidence: (value: unknown) => value },
    "@/lib/autoActionEvidenceServer": { verifyAutoActionEvidence: async () => true },
    "@/lib/connectedGoogleReviewEvidence": { resolveUniqueConnectedGoogleLocation },
  };
  runInNewContext(compiled, {
    exports: route,
    require: (name: string) => { assert.ok(Object.hasOwn(deps, name), `Unexpected dependency: ${name}`); return deps[name]; },
    Response,
    crypto: { randomUUID: () => "00000000-0000-4000-8000-000000000001" },
    console: { log() {}, error() {}, warn() {} },
  }, { filename: sourcePath });
  const call = async () => {
    const response = await route.PATCH(new Request("https://turntableai.net/api/auto-actions", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "action-1", status: "executed" }),
    }));
    return { status: response.status, body: await response.json() as Record<string, unknown> };
  };
  return { call, row, drafted, storedWorkflows, operations, getOutcomeWrites: () => outcomeWrites };
}

async function run() {
  const valid = harness();
  const success = await valid.call();
  assert.equal(success.status, 200, JSON.stringify(success.body));
  assert.equal(valid.row.status, "executed");
  assert.equal(valid.drafted.length, 1);
  assert.equal(valid.drafted[0].review_id, "review-1");
  assert.equal(valid.getOutcomeWrites(), 1);
  assert.ok(valid.operations.includes("from:review_connections"));
  assert.ok(valid.operations.includes("from:review_workflow_states"));
  assert.equal(valid.operations.includes("from:review_workflow_state"), false);
  assert.equal((success.body.executionResult as {workflowItemsCreated: number}).workflowItemsCreated, 1);

  const ambiguous = harness({ locations: [
    { name: "locations/101", title: "Test Cafe" },
    { name: "locations/102", title: "Test Cafe" },
  ] });
  const ambiguousResult = await ambiguous.call();
  assert.equal(ambiguousResult.status, 500);
  assert.equal(ambiguousResult.body.code, "AUTO_ACTION_EXECUTION_RECONCILIATION_REQUIRED");
  assert.equal(ambiguous.row.status, "approved");
  assert.ok(ambiguous.row.execution_claim_token);
  assert.equal(ambiguous.drafted.length, 0);
  assert.equal(ambiguous.getOutcomeWrites(), 0);
  assert.equal(ambiguous.operations.includes("from:reviews"), false);

  const disconnected = harness({ locations: [{ name: "locations/222", title: "Other Cafe" }] });
  assert.equal((await disconnected.call()).status, 500);
  assert.equal(disconnected.drafted.length, 0);

  const empty = harness({ reviewMode: "none" });
  const emptyResult = await empty.call();
  assert.equal(emptyResult.status, 500);
  assert.equal(emptyResult.body.code, "AUTO_ACTION_EXECUTION_RECONCILIATION_REQUIRED");
  assert.equal(empty.row.status, "approved");
  assert.equal(empty.drafted.length, 0);
  assert.equal(empty.getOutcomeWrites(), 0);

  const foreign = harness({ reviewMode: "foreign" });
  assert.equal((await foreign.call()).status, 500);
  assert.equal(foreign.drafted.length, 0);

  const resolved = harness({ existingWorkflowStatus: "resolved" });
  const resolvedResult = await resolved.call();
  assert.equal(resolvedResult.status, 500);
  assert.equal(resolvedResult.body.code, "AUTO_ACTION_EXECUTION_RECONCILIATION_REQUIRED");
  assert.equal(resolved.row.status, "approved");
  assert.ok(resolved.row.execution_claim_token);
  assert.equal(resolved.storedWorkflows[0].status, "resolved");
  assert.equal(resolved.storedWorkflows[0].note, "Owner manual note");
  assert.equal(resolved.storedWorkflows[0].suggested_reply, "Owner manual reply");
  assert.equal(resolved.drafted.length, 0);
  assert.equal(resolved.getOutcomeWrites(), 0);

  const alreadyDrafted = harness({ existingWorkflowStatus: "drafted" });
  assert.equal((await alreadyDrafted.call()).status, 500);
  assert.equal(alreadyDrafted.storedWorkflows[0].status, "drafted");
  assert.equal(alreadyDrafted.drafted.length, 0);

  const noConfirm = harness({ workflowResult: "empty" });
  const noConfirmResponse = await noConfirm.call();
  assert.equal(noConfirmResponse.status, 500);
  assert.equal(noConfirmResponse.body.code, "AUTO_ACTION_EXECUTION_RECONCILIATION_REQUIRED");
  assert.equal(noConfirm.getOutcomeWrites(), 0);
  assert.equal(noConfirm.row.status, "approved");
  assert.ok(noConfirm.row.execution_claim_token);

  const mismatched = harness({ workflowResult: "foreign" });
  assert.equal((await mismatched.call()).status, 500);
  assert.equal(mismatched.getOutcomeWrites(), 0);
  assert.equal(mismatched.row.status, "approved");

  const writeError = harness({ workflowResult: "error" });
  assert.equal((await writeError.call()).status, 500);
  assert.equal(writeError.getOutcomeWrites(), 0);

  const service = harness({ actionType: "service_recovery" });
  const serviceResult = await service.call();
  assert.equal(serviceResult.status, 200, JSON.stringify(serviceResult.body));
  assert.equal(service.drafted[0].status, "escalated");
  assert.equal(service.row.status, "executed");

  const snapshotSource = readFileSync("src/app/api/operator-snapshot/reviews/route.ts", "utf8");
  assert.ok(snapshotSource.includes('.from("review_workflow_states")'));
  assert.equal(snapshotSource.includes('.from("review_workflow_state")'), false);

  console.log("✓ Auto Action Google review workflow storage and owner-state regression test passed");
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
