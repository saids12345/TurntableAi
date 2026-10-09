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

type MemoryPayload = {
  source_action_id: string;
  evidence: { outcomeVerification: { verified: boolean; eligibleForReasoning: boolean } };
};
type QueryResult = { data: unknown; error: unknown };

function loadRoute(existing: boolean, noActions: boolean) {
  const tables: string[] = [];
  const writes: Array<{ operation: string; table: string; payload: MemoryPayload }> = [];
  const logs: unknown[][] = [];
  let refreshes = 0;
  const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * 86400000).toISOString();
  const location = "Test restaurant";
  const memoryId = existing ? "existing-memory" : "new-memory";
  const results: Record<string, QueryResult> = {
    auto_actions: { data: noActions ? [] : [{
      id: "test-action", user_id: "test-user", location_name: location,
      action_type: "review_followup", title: "Test action", status: "executed",
      created_at: iso(4), updated_at: iso(3), recommended_payload: {}, source_signal: {},
    }], error: null },
    performance_signal_history: { data: [
      { id: "before", captured_at: iso(4), revenue: 100 },
      { id: "after", captured_at: iso(2), revenue: 120 },
    ].map((row) => ({
      ...row, location_name: location, source_system: "square",
      source_record_id: row.id, ingested_at: row.captured_at,
      orders: row.revenue / 10, avg_ticket: 10, labor_pct: null, margin_pct: null, refunds: 0,
    })), error: null },
    reviews: { data: [], error: null },
    operator_memory: { data: existing ? [{
      id: memoryId, location_name: location, problem_type: "guest_sentiment_risk",
      action_type: "review_followup", evidence: { autoActionId: "test-action" },
    }] : [], error: null },
  };

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
    insert(payload: MemoryPayload) {
      writes.push({ operation: "insert", table: this.table, payload }); return this;
    }
    update(payload: MemoryPayload) {
      writes.push({ operation: "update", table: this.table, payload }); return this;
    }
    single() { return Promise.resolve({ data: { id: memoryId }, error: null }); }
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
  // Database writes and decision refreshes are captured without contacting services.
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

  return { route, tables, writes, logs, memoryId, get refreshes() { return refreshes; } };
}

async function run() {
  for (const [existing, noActions] of [[false, false], [true, false], [false, true]]) {
    const state = loadRoute(existing, noActions);
    const count = noActions ? 0 : 1;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await state.route.GET();
      const body = await response.json();
      assert.equal(response.status, 200);
      assert.equal(body.mode, "preview");
      assert.equal(body.learned, count);
      assert.equal(body.items.length, count);
      assert.equal(state.tables.includes("operator_memory"), false, "GET must not access memory persistence");
      assert.equal(state.writes.length, 0, "Repeated previews must never write memory");
      assert.equal(state.refreshes, 0, "GET must never refresh decisions");
      if (!noActions) {
        assert.equal(body.items[0].revenueBefore, 100);
        assert.equal(body.items[0].revenueAfter, 120);
        assert.equal(Object.hasOwn(body.items[0], "savedMemoryId"), false);
      }
    }

    const response = await state.route.POST(new Request("http://localhost/api/operator-memory/learn", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ actionId: "test-action" }),
    }));
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.mode, "saved");
    assert.equal(body.learned, count);
    assert.equal(state.writes.length, count, "POST must retain the explicit save operation");
    assert.equal(state.refreshes, count);
    assert.equal(body.decisionRefresh.attempted, !noActions);
    if (!noActions) {
      assert.equal(body.items[0].savedMemoryId, state.memoryId);
      assert.equal(state.writes[0].operation, existing ? "update" : "insert");
      assert.equal(state.writes[0].table, "operator_memory");
      assert.equal(state.writes[0].payload.source_action_id, "test-action");
      const verification = state.writes[0].payload.evidence.outcomeVerification;
      assert.equal(verification.verified, false);
      assert.equal(verification.eligibleForReasoning, false);
    }
    assert.equal(state.logs.length, 0);
  }
}

run().then(() => {
  console.log("✓ Operator learning read-only preview regression test passed");
}).catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
