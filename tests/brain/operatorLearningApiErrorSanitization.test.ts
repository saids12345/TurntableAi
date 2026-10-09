import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { NextResponse } from "next/server";
import ts from "typescript";

const routePath = "src/app/api/operator-memory/learn/route.ts";
const compiled = ts.transpileModule(readFileSync(routePath, "utf8"), {
  fileName: routePath,
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

type Method = "GET" | "POST";
type DatabaseError = { message: string; code: string };
type QueryResult = { data: unknown; error: unknown };
type Scenario = {
  noUser?: boolean;
  authError?: unknown;
  clientError?: unknown;
  readFailure?: { table: string; error: DatabaseError };
  writeError?: DatabaseError;
  existing?: boolean;
  refreshError?: unknown;
  refreshReply?: { status: number; body: unknown; invalidJson?: boolean };
};

function loadRoute(scenario: Scenario) {
  const tables: string[] = [];
  const logs: unknown[][] = [];
  let proChecks = 0;
  let writes = 0;
  let saved = 0;
  let refreshes = 0;
  const actionDate = new Date(Date.now() - 3 * 86400000).toISOString();
  const results: Record<string, QueryResult> = {
    auto_actions: { data: [{
      id: "test-action", user_id: "test-user", location_name: "Test restaurant",
      action_type: "review_followup", title: "Test action", status: "executed",
      created_at: actionDate, updated_at: actionDate, recommended_payload: {}, source_signal: {},
    }], error: null },
    performance_signal_history: { data: [], error: null },
    reviews: { data: [], error: null },
    operator_memory: { data: scenario.existing ? [{
      id: "test-memory", location_name: "Test restaurant", problem_type: "guest_sentiment_risk",
      action_type: "review_followup", evidence: { autoActionId: "test-action" },
    }] : [], error: null },
  };
  if (scenario.readFailure) {
    results[scenario.readFailure.table] = { data: null, error: scenario.readFailure.error };
  }

  class Query {
    table: string;
    constructor(table: string) {
      assert.ok(Object.hasOwn(results, table), `Unexpected table: ${table}`);
      this.table = table;
      tables.push(table);
    }
    select() { return this; }
    eq() { return this; }
    in() { return this; }
    gte() { return this; }
    lte() { return this; }
    order() { return this; }
    limit() { return this; }
    contains() { return this; }
    is() { return this; }
    insert() { assert.equal(this.table, "operator_memory"); writes += 1; return this; }
    update() { assert.equal(this.table, "operator_memory"); writes += 1; return this; }
    single() {
      if (scenario.writeError) return Promise.resolve({ data: null, error: scenario.writeError });
      saved += 1;
      return Promise.resolve({ data: { id: "test-memory" }, error: null });
    }
    then(resolve: (value: QueryResult) => unknown, reject?: (error: unknown) => unknown) {
      return Promise.resolve(results[this.table]).then(resolve, reject);
    }
  }

  const dependencies: Record<string, unknown> = {
    "next/server": { NextResponse },
    "@/lib/performanceSignalTrust": { TRUSTED_PERFORMANCE_SOURCES: ["square"] },
    "@/lib/requirePro": { requireProForApi: async () => { proChecks += 1; } },
    "@/lib/supabaseRoute": {
      getSupabaseRouteClient: async () => {
        if ("clientError" in scenario) throw scenario.clientError;
        return {
          auth: { getUser: async () => ({
            data: { user: scenario.noUser ? null : { id: "test-user" } },
            error: scenario.authError ?? null,
          }) },
          from: (table: string) => new Query(table),
        };
      },
    },
  };
  const route = {} as { GET: () => Promise<Response>; POST: (request: Request) => Promise<Response> };
  const log = (...args: unknown[]) => { logs.push(args); };
  // All database operations and refresh requests stay inside these mocks.
  runInNewContext(compiled, {
    exports: route, Error, URL,
    console: { error: log, warn: log },
    fetch: async () => {
      refreshes += 1;
      if ("refreshError" in scenario) throw scenario.refreshError;
      const reply: NonNullable<Scenario["refreshReply"]> =
        scenario.refreshReply ?? { status: 200, body: { ok: true, saved: 2 } };
      return reply.invalidJson
        ? new Response("not JSON", { status: reply.status })
        : NextResponse.json(reply.body, { status: reply.status });
    },
    require: (name: string) => {
      assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  }, { filename: routePath });

  return {
    route, tables, logs,
    get proChecks() { return proChecks; }, get writes() { return writes; },
    get saved() { return saved; }, get refreshes() { return refreshes; },
  };
}

async function invoke(method: Method, scenario: Scenario = {}) {
  const state = loadRoute(scenario);
  const response = method === "GET"
    ? await state.route.GET()
    : await state.route.POST(new Request("http://localhost/api/operator-memory/learn", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ actionId: "test-action" }),
      }));
  assert.equal(state.proChecks, 1, `${method} must retain the Pro check`);
  return { ...state, response, body: await response.json() };
}

async function expectFailure(method: Method, scenario: Scenario, status = 500, message = "Operator learning failed") {
  const actual = await invoke(method, scenario);
  assert.equal(actual.response.status, status);
  assert.deepEqual(actual.body, { error: message });
  assert.equal(actual.saved, 0);
  assert.equal(actual.refreshes, 0);
  return actual;
}

function hasDatabaseDetail(logs: unknown[][], detail: DatabaseError) {
  return logs.some((entry) => entry[1] === detail ||
    (entry[1] instanceof Error && entry[1].message.includes(detail.message)));
}

async function expectRefreshFailure(scenario: Scenario) {
  const actual = await invoke("POST", scenario);
  assert.equal(actual.response.status, 200, "A refresh failure must not fail saved learning");
  assert.equal(actual.body.ok, true);
  assert.equal(actual.body.mode, "saved");
  assert.equal(actual.body.learned, 1);
  assert.equal(actual.body.items[0].savedMemoryId, "test-memory");
  assert.equal(actual.writes, 1);
  assert.equal(actual.saved, 1);
  assert.equal(actual.refreshes, 1);
  assert.deepEqual(actual.body.decisionRefresh, {
    attempted: true, ok: false, reason: "refresh_failed", saved: 0, error: "Decision refresh failed",
  });
  assert.equal(actual.logs.length, 1);
  return actual;
}

async function run() {
  for (const method of ["GET", "POST"] as const) {
    for (const authError of [new Error("private auth detail"), { message: "private auth detail", code: "AUTH_FAILED" }]) {
      const actual = await expectFailure(method, { authError }, 401, "Authentication failed");
      assert.equal(actual.tables.length, 0);
      assert.ok(actual.logs.some((entry) => entry[1] === authError), "Retain the full authentication error in logs");
    }
    const unauthorized = await expectFailure(method, { noUser: true }, 401, "Unauthorized");
    assert.equal(unauthorized.tables.length, 0);
    assert.equal(unauthorized.logs.length, 0);

    for (const clientError of [new Error("private client detail"), "private thrown value"]) {
      const actual = await expectFailure(method, { clientError });
      assert.equal(actual.tables.length, 0);
      assert.ok(actual.logs.some((entry) => entry[1] === clientError), "Retain the full exception in logs");
    }
    const failureTables = ["auto_actions", "performance_signal_history", "reviews"];
    if (method === "POST") failureTables.push("operator_memory");
    for (const table of failureTables) {
      const error = { message: `private ${table} detail`, code: "XX000" };
      const actual = await expectFailure(method, { readFailure: { table, error } });
      assert.ok(actual.tables.includes(table));
      assert.equal(actual.writes, 0);
      assert.ok(hasDatabaseDetail(actual.logs, error), "Retain database diagnostics in logs");
    }

    const success = await invoke(method);
    assert.equal(success.response.status, 200);
    assert.equal(success.body.ok, true);
    assert.equal(success.body.mode, method === "GET" ? "preview" : "saved");
    assert.equal(success.body.learned, 1);
    assert.equal(success.saved, method === "POST" ? 1 : 0);
    assert.equal(success.refreshes, method === "POST" ? 1 : 0);
    if (method === "POST") {
      assert.equal(success.body.items[0].savedMemoryId, "test-memory");
      assert.deepEqual(success.body.decisionRefresh, {
        attempted: true, ok: true, reason: "generated", saved: 2, error: null,
      });
    } else {
      assert.equal(success.tables.includes("operator_memory"), false);
      assert.equal(Object.hasOwn(success.body.items[0], "savedMemoryId"), false);
    }
    assert.equal(success.logs.length, 0);
  }

  for (const existing of [false, true]) {
    const writeError = { message: "private memory write detail", code: "XX000" };
    const actual = await expectFailure("POST", { existing, writeError });
    assert.equal(actual.writes, 1);
    assert.ok(hasDatabaseDetail(actual.logs, writeError));
  }
  for (const status of [200, 503]) {
    const detail = "private refresh response detail";
    const actual = await expectRefreshFailure({ refreshReply: { status, body: { ok: false, error: detail } } });
    assert.ok(actual.logs.some((entry) => entry[1] === detail));
    assert.equal(JSON.stringify(actual.body).includes(detail), false);
  }
  for (const invalidJson of [false, true]) {
    const actual = await expectRefreshFailure({ refreshReply: { status: 502, body: null, invalidJson } });
    assert.ok(actual.logs.some((entry) => entry[1] === "Decision refresh failed with status 502."));
  }
  for (const refreshError of [new Error("private refresh exception"), "private refresh thrown value"]) {
    const actual = await expectRefreshFailure({ refreshError });
    assert.ok(actual.logs.some((entry) => entry[1] === refreshError), "Retain the full refresh exception in logs");
    const detail = refreshError instanceof Error ? refreshError.message : refreshError;
    assert.equal(JSON.stringify(actual.body).includes(detail), false);
  }
}

run().then(() => {
  console.log("✓ Operator learning API error sanitization regression test passed");
}).catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
