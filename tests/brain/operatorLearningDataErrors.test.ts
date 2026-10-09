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

type QueryResult = { data: unknown; error: unknown };
type Failure = { table: string; result: QueryResult };
type MemoryPayload = {
  evidence: { outcomeVerification: { verified: boolean; eligibleForReasoning: boolean } };
};

const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * 86400000).toISOString();
const location = "Test restaurant";
const performanceRows = [
  { id: "before", captured_at: iso(4), revenue: 100 },
  { id: "after", captured_at: iso(2), revenue: 120 },
].map((row) => ({
  ...row, location_name: location, source_system: "square",
  source_record_id: row.id, ingested_at: row.captured_at,
  orders: row.revenue / 10, avg_ticket: 10, labor_pct: null, margin_pct: null, refunds: 0,
}));
const reviewRows = [
  { id: "review-before", location_name: location, rating: 4, update_time: iso(4) },
  { id: "review-after", location_name: location, rating: 5, update_time: iso(2) },
];

async function invoke(method: "GET" | "POST", failure?: Failure, empty = false) {
  const logs: unknown[][] = [];
  const tables: string[] = [];
  const writes: Array<{ table: string; payload: MemoryPayload }> = [];
  let refreshes = 0;
  const results: Record<string, QueryResult> = {
    auto_actions: { data: [{
      id: "test-action", user_id: "test-user", location_name: location,
      action_type: "review_followup", title: "Test action", status: "executed",
      created_at: iso(4), updated_at: iso(3), recommended_payload: {},
      source_signal: { previousRevenue: 110, latestRevenue: 130, avgRating: 4.5 },
    }], error: null },
    performance_signal_history: { data: empty ? [] : performanceRows, error: null },
    reviews: { data: empty ? [] : reviewRows, error: null },
    operator_memory: { data: [], error: null },
  };
  if (failure) results[failure.table] = failure.result;

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
    insert(payload: MemoryPayload) { writes.push({ table: this.table, payload }); return this; }
    update(payload: MemoryPayload) { writes.push({ table: this.table, payload }); return this; }
    single() { return Promise.resolve({ data: { id: "test-memory" }, error: null }); }
    then(resolve: (value: QueryResult) => unknown, reject?: (error: unknown) => unknown) {
      return Promise.resolve(results[this.table]).then(resolve, reject);
    }
  }

  const dependencies: Record<string, unknown> = {
    "next/server": { NextResponse },
    "@/lib/performanceSignalTrust": { TRUSTED_PERFORMANCE_SOURCES: ["square"] },
    "@/lib/requirePro": { requireProForApi: async () => undefined },
    "@/lib/supabaseRoute": {
      getSupabaseRouteClient: async () => ({
        auth: { getUser: async () => ({ data: { user: { id: "test-user" } }, error: null }) },
        from: (table: string) => new Query(table),
      }),
    },
  };
  const route = {} as {
    GET: () => Promise<Response>;
    POST: (request: Request) => Promise<Response>;
  };
  const log = (...args: unknown[]) => { logs.push(args); };
  // All database access and the decision-refresh request stay inside these mocks.
  runInNewContext(compiled, {
    exports: route, Error, URL,
    console: { error: log, warn: log },
    fetch: async () => {
      refreshes += 1;
      return NextResponse.json({ ok: true, saved: 0 });
    },
    require: (name: string) => {
      assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  }, { filename: routePath });

  const response = method === "GET"
    ? await route.GET()
    : await route.POST(new Request("http://localhost/api/operator-memory/learn", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ actionId: "test-action" }),
      }));
  return { response, body: await response.json(), logs, tables, writes, refreshes };
}

async function run() {
  const databaseError = { message: "private database detail", code: "XX000" };
  for (const method of ["GET", "POST"] as const) {
    for (const [table, rows] of [
      ["performance_signal_history", performanceRows], ["reviews", reviewRows],
    ] as const) {
      const failures: QueryResult[] = [
        { data: null, error: databaseError },
        { data: [], error: databaseError },
        { data: rows, error: databaseError },
        { data: null, error: null },
        { data: {}, error: null },
      ];
      for (const result of failures) {
        const actual = await invoke(method, { table, result });
        const label = `${method} ${table}`;
        assert.ok(actual.tables.includes(table), `${label} must reach the failed read`);
        assert.equal(actual.response.status, 500, `${label} must fail the request`);
        assert.equal(typeof actual.body.error, "string");
        assert.equal(JSON.stringify(actual.body).includes(databaseError.message), false);
        assert.equal(actual.tables.includes("operator_memory"), false, `${label} must stop before memory access`);
        assert.equal(actual.writes.length, 0, `${label} must not write memory`);
        assert.equal(actual.refreshes, 0, `${label} must not refresh decisions`);
        if (result.error) {
          assert.ok(actual.logs.some((entry) => entry[1] === databaseError), `${label} must log the full error`);
        }
      }
    }
  }

  // Successful row sets and successful empty queries both remain valid responses.
  for (const empty of [false, true]) {
    const actual = await invoke("POST", undefined, empty);
    assert.equal(actual.response.status, 200);
    assert.equal(actual.body.ok, true);
    assert.equal(actual.body.learned, 1);
    assert.equal(actual.writes.length, 1);
    assert.equal(actual.writes[0].table, "operator_memory");
    const verification = actual.writes[0].payload.evidence.outcomeVerification;
    assert.equal(verification.verified, false);
    assert.equal(verification.eligibleForReasoning, false);
    assert.equal(actual.refreshes, 1);
    assert.equal(actual.logs.length, 0);
  }
}

run().then(() => {
  console.log("✓ Operator learning data error regression test passed");
}).catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
