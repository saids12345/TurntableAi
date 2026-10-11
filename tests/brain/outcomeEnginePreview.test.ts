import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { NextResponse } from "next/server";
import ts from "typescript";

const enginePath = "src/lib/outcomeEngine.ts";
const routePath = "src/app/api/outcome-engine/run/route.ts";
function compile(path: string) {
  return ts.transpileModule(readFileSync(path, "utf8"), {
    fileName: path,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}
const compiledEngine = compile(enginePath);
const compiledRoute = compile(routePath);
const day = 86400000;
const now = Date.now();
const at = (days: number) => new Date(now + days * day).toISOString();
const verification = { verified: false, eligibleForReasoning: false, verdict: "inconclusive" };
type Scenario = {
  existing?: boolean;
  actions?: "empty" | "young" | "mixed";
  readError?: "auto_actions" | "performance_signal_history" | "reviews";
  writeError?: boolean;
  forbidMemory?: boolean;
};
type QueryResult = { data: unknown; error: unknown };
type MemoryPayload = Record<string, unknown> & {
  source_action_id: string;
  evidence: { outcomeVerification: typeof verification };
};
type EngineResult = {
  evaluated: number;
  saved: number;
  results: { actionId: string; saved: boolean; evaluation?: unknown; memory?: unknown; skippedReason?: string }[];
};

function harness(scenario: Scenario = {}) {
  const tables: string[] = [];
  const writes: { operation: "insert" | "update"; payload: MemoryPayload }[] = [];
  const logs: unknown[][] = [];
  const verificationCalls: unknown[] = [];
  const mature = {
    id: "mature-action", user_id: "test-user", location_name: "Test restaurant",
    action_type: "operator_action", title: "Test action", status: "executed",
    created_at: at(-4), updated_at: at(-3), recommended_payload: {}, source_signal: {},
  };
  const young = { ...mature, id: "young-action", updated_at: at(-1 / 24) };
  const actions = scenario.actions === "empty" ? [] : scenario.actions === "young" ? [young]
    : scenario.actions === "mixed" ? [mature, young] : [mature];
  const results: Record<string, QueryResult> = {
    auto_actions: { data: actions, error: null },
    performance_signal_history: { data: [-4, -1].map((days, index) => ({
      id: `performance-${index}`, location_name: mature.location_name, source_system: "square",
      source_record_id: `source-${index}`, captured_at: at(days), ingested_at: at(days),
      revenue: index === 0 ? 100 : 120, orders: 10, avg_ticket: 10, refunds: 0, labor_pct: 30, margin_pct: 20,
    })), error: null },
    reviews: { data: [], error: null },
    operator_memory: { data: scenario.existing ? [{ id: "test-memory" }] : [], error: null },
  };
  if (scenario.readError) results[scenario.readError].error = new Error("private read detail");
  class Query {
    table: string;
    payload?: MemoryPayload;
    constructor(table: string) {
      tables.push(table);
      assert.ok(Object.hasOwn(results, table), `Unexpected table: ${table}`);
      if (scenario.forbidMemory) assert.notEqual(table, "operator_memory", "Preview must not access memory storage");
      this.table = table;
    }
    select() { return this; }
    eq() { return this; }
    in() { return this; }
    gte() { return this; }
    order() { return this; }
    limit() { return this; }
    insert(payload: MemoryPayload) { return this.write("insert", payload); }
    update(payload: MemoryPayload) { return this.write("update", payload); }
    write(operation: "insert" | "update", payload: MemoryPayload) {
      assert.equal(this.table, "operator_memory");
      this.payload = payload;
      writes.push({ operation, payload });
      return this;
    }
    single() {
      return Promise.resolve({
        data: scenario.writeError ? null : { id: "test-memory", ...this.payload },
        error: scenario.writeError ? new Error("private write detail") : null,
      });
    }
    then(resolve: (value: QueryResult) => unknown, reject?: (error: unknown) => unknown) {
      return Promise.resolve(results[this.table]).then(resolve, reject);
    }
  }
  const engine = {} as {
    evaluateRecentExecutedActions: (options: { userId: string; persist?: unknown }) => Promise<EngineResult>;
  };
  const dependencies: Record<string, unknown> = {
    "next/server": { NextResponse },
    "@/lib/performanceSignalTrust": { TRUSTED_PERFORMANCE_SOURCES: ["square"] },
    "@/lib/requirePro": { requireProForApi: async () => undefined },
    "@/lib/supabaseRoute": { getSupabaseRouteClient: async () => ({
      auth: { getUser: async () => ({ data: { user: { id: "test-user" } }, error: null }) },
      from: (table: string) => new Query(table),
    }) },
    "@/lib/brain/outcomeVerification/decisionOutcomeVerifier": {
      verifyDecisionOutcome: (input: unknown) => { verificationCalls.push(input); return verification; },
    },
    "@/lib/outcomeEngine": engine,
  };
  const context = {
    Error,
    console: { error: (...args: unknown[]) => { logs.push(args); } },
    require: (name: string) => {
      assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  };
  const route = {} as { GET: () => Promise<Response>; POST: (request: Request) => Promise<Response> };
  runInNewContext(compiledEngine, { ...context, exports: engine }, { filename: enginePath });
  runInNewContext(compiledRoute, { ...context, exports: route }, { filename: routePath });
  return { route, engine, tables, writes, logs, verificationCalls };
}

async function invoke(method: "GET" | "POST", scenario: Scenario = {}) {
  const state = harness({ ...scenario, forbidMemory: method === "GET" });
  const response = method === "GET" ? await state.route.GET() : await state.route.POST(new Request(
    "http://localhost/api/outcome-engine/run", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}),
    },
  ));
  return { ...state, response, body: await response.json() };
}

async function run() {
  for (const method of ["GET", "POST"] as const) {
    for (const existing of [false, true]) {
      for (const actions of [undefined, "empty", "young", "mixed"] as const) {
        const actual = await invoke(method, { existing, actions });
        const label = `${method}, existing=${existing}, actions=${actions}`;
        const measured = actions === "empty" || actions === "young" ? 0 : 1;
        const saved = method === "POST" ? measured : 0;
        assert.equal(actual.response.status, 200, label);
        assert.equal(actual.body.ok, true, label);
        assert.equal(actual.body.mode, method === "GET" ? "preview" : "manual_post", label);
        assert.equal(actual.body.evaluated, actions === "empty" ? 0 : actions === "mixed" ? 2 : 1, label);
        assert.equal(actual.body.saved, saved, label);
        assert.equal(actual.writes.length, saved, label);
        assert.equal(actual.verificationCalls.length, measured, label);
        assert.equal(actual.tables.includes("operator_memory"), saved > 0, label);
        assert.equal(actual.logs.length, 0, label);
        if (measured) {
          const item = actual.body.results.find((result: { actionId: string }) => result.actionId === "mature-action");
          assert.equal(item.saved, method === "POST", label);
          assert.equal(item.evaluation.sourceActionId, "mature-action", label);
          assert.equal(item.evaluation.baseline.revenue, 100, label);
          assert.equal(item.evaluation.current.revenue, 120, label);
          assert.deepEqual(item.evaluation.evidence.outcomeVerification, verification, label);
          assert.equal(Object.hasOwn(item, "memory"), method === "POST", label);
          if (method === "POST") {
            assert.equal(item.memory.id, "test-memory", label);
            assert.equal(actual.writes[0].operation, existing ? "update" : "insert", label);
            assert.equal(actual.writes[0].payload.source_action_id, "mature-action", label);
            assert.deepEqual(actual.writes[0].payload.evidence.outcomeVerification, verification, label);
          }
        }
        if (actions === "young" || actions === "mixed") {
          const skipped = actual.body.results.find((result: { actionId: string }) => result.actionId === "young-action");
          assert.equal(skipped.saved, false, label);
          assert.match(skipped.skippedReason, /not old enough/, label);
          assert.equal(Object.hasOwn(skipped, "evaluation"), false, label);
          assert.equal(Object.hasOwn(skipped, "memory"), false, label);
        }
      }
    }
    for (const readError of ["auto_actions", "performance_signal_history", "reviews"] as const) {
      const failed = await invoke(method, { readError });
      assert.equal(failed.response.status, 500);
      assert.deepEqual(failed.body, { error: "Outcome engine failed" });
      assert.equal(failed.writes.length, 0);
    }
  }
  // Missing or truthy non-boolean options must never authorize a save.
  for (const persist of [undefined, false, null, "true", 1]) {
    const state = harness({ forbidMemory: true });
    const result = await state.engine.evaluateRecentExecutedActions({ userId: "test-user", persist });
    assert.equal(result.evaluated, 1);
    assert.equal(result.saved, 0);
    assert.equal(result.results[0].saved, false);
    assert.ok(result.results[0].evaluation);
    assert.equal(Object.hasOwn(result.results[0], "memory"), false);
    assert.equal(state.tables.includes("operator_memory"), false);
    assert.equal(state.writes.length, 0);
  }
  const failedSave = await invoke("POST", { writeError: true });
  assert.equal(failedSave.response.status, 500);
  assert.deepEqual(failedSave.body, { error: "Outcome engine failed" });
  assert.equal(failedSave.writes.length, 1);
}

run().then(() => {
  console.log("✓ Outcome Engine read-only preview regression test passed");
}).catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
