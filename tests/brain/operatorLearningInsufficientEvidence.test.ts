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
const day = 86400000;
const anchor = Date.now() - 7 * day;
const at = (days: number) => new Date(anchor + days * day).toISOString();
type Value = number | string | null;
type Metrics = Partial<Record<"revenue" | "refunds" | "labor_pct" | "margin_pct", Value>>;
type Scenario = {
  name: string;
  before?: Metrics;
  after?: Metrics;
  ratings?: [Value, Value];
  score: number | null;
  status: "monitoring" | "partial" | "success" | "failed";
  actionType?: string;
};
type MemoryPayload = {
  source_action_id: string;
  outcome_score: number | null;
  success: boolean | null;
  confidence: string;
  lesson_strength: string;
  reuse_recommended: boolean;
  result_summary: string;
  lesson: string;
  evidence: {
    outcomeScore: number | null;
    learningStatus: string;
    executionMarker?: string;
    outcomeVerification: { verified: boolean; eligibleForReasoning: boolean; trustState: string };
  };
};
type QueryResult = { data: unknown; error: unknown };
const scenarios: Scenario[] = [
  { name: "no measurements", score: null, status: "monitoring" },
  { name: "before only", before: { revenue: 100, refunds: 4 }, ratings: [3, null], score: null, status: "monitoring" },
  { name: "after only", after: { revenue: 120, refunds: 2 }, ratings: [null, 4], score: null, status: "monitoring" },
  { name: "unusable values", before: { revenue: "invalid" }, after: { revenue: "" }, ratings: [null, "invalid"], score: null, status: "monitoring" },
  { name: "different metrics on each side", before: { revenue: 100 }, after: { refunds: 0 }, score: null, status: "monitoring" },
  { name: "zero revenue baseline", before: { revenue: 0 }, after: { revenue: 100 }, score: null, status: "monitoring" },
  { name: "zero refunds unchanged", before: { refunds: 0 }, after: { refunds: 0 }, score: 50, status: "partial" },
  { name: "revenue unchanged", before: { revenue: 100 }, after: { revenue: 100 }, score: 50, status: "partial" },
  { name: "rating unchanged", ratings: [3, 3], score: 50, status: "partial" },
  { name: "revenue increase", before: { revenue: 100 }, after: { revenue: 120 }, score: 78, status: "success" },
  { name: "revenue decline", before: { revenue: 100 }, after: { revenue: 80 }, score: 26, status: "failed" },
  { name: "rating increase", ratings: [3, 4], score: 68, status: "partial" },
  { name: "refund reduction", before: { refunds: 5 }, after: { refunds: 0 }, score: 63, status: "partial" },
  { name: "labor evidence alone", before: { labor_pct: 40 }, after: { labor_pct: 30 }, score: 65, status: "partial" },
  { name: "margin evidence alone", before: { margin_pct: 10 }, after: { margin_pct: 20 }, score: 68, status: "partial" },
  { name: "score capped at 100", before: { revenue: 100, refunds: 10 }, after: { revenue: 150, refunds: 0 }, ratings: [3, 4], score: 100, status: "success" },
  { name: "measured score of zero", before: { revenue: 100, refunds: 0 }, after: { revenue: 50, refunds: 10 }, ratings: [4, 3], score: 0, status: "failed" },
];

async function invoke(method: "GET" | "POST", cases: Scenario[], existing = false) {
  const tables: string[] = [];
  const writes: { operation: "insert" | "update"; payload: MemoryPayload }[] = [];
  const logs: unknown[][] = [];
  let refreshes = 0;
  const actions = cases.map((scenario, index) => ({
    id: `action-${index}`, user_id: "test-user", location_name: `Restaurant ${index}`,
    action_type: scenario.actionType ?? "operator_action", title: scenario.name,
    status: "executed", created_at: at(-1), updated_at: at(0), recommended_payload: {},
    source_signal: { previousRevenue: 10, latestRevenue: 9999, previousRefunds: 20, latestRefunds: 0, avgRating: 5 },
  }));
  const performance = cases.flatMap((scenario, index) => [scenario.before, scenario.after].flatMap((metrics, side) => {
    if (!metrics) return [];
    const id = `${index}-${side}`;
    return [{
      id, location_name: actions[index].location_name, source_system: "square", source_record_id: id,
      captured_at: at(side === 0 ? -1 : 1), ingested_at: at(side === 0 ? -1 : 1),
      revenue: null, refunds: null, labor_pct: null, margin_pct: null, ...metrics,
    }];
  }));
  const reviews = cases.flatMap((scenario, index) => (scenario.ratings ?? []).flatMap((rating, side) => rating === null ? [] : [{
    id: `review-${index}-${side}`, location_name: actions[index].location_name,
    update_time: at(side === 0 ? -1 : 1), rating,
  }]));
  const results: Record<string, QueryResult> = {
    auto_actions: { data: actions, error: null },
    performance_signal_history: { data: performance, error: null },
    reviews: { data: reviews, error: null },
    operator_memory: { data: [], error: null },
  };
  class Query {
    table: string;
    constructor(table: string) {
      assert.ok(Object.hasOwn(results, table), `Unexpected table: ${table}`);
      this.table = table; tables.push(table);
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
    insert(payload: MemoryPayload) { writes.push({ operation: "insert", payload }); return this; }
    update(payload: MemoryPayload) { writes.push({ operation: "update", payload }); return this; }
    single() { return Promise.resolve({ data: { id: "test-memory" }, error: null }); }
    then(resolve: (value: QueryResult) => unknown, reject?: (error: unknown) => unknown) {
      // Existing-memory cases contain one action and must overwrite a previous score.
      const result = this.table === "operator_memory" && existing ? {
        data: [{ id: "test-memory", outcome_score: 90, success: true,
          evidence: { outcomeScore: 90, learningStatus: "success", executionMarker: "preserved" } }],
        error: null,
      } : results[this.table];
      return Promise.resolve(result).then(resolve, reject);
    }
  }
  const dependencies: Record<string, unknown> = {
    "next/server": { NextResponse },
    "@/lib/performanceSignalTrust": { TRUSTED_PERFORMANCE_SOURCES: ["square"] },
    "@/lib/requirePro": { requireProForApi: async () => undefined },
    "@/lib/supabaseRoute": { getSupabaseRouteClient: async () => ({
      auth: { getUser: async () => ({ data: { user: { id: "test-user" } }, error: null }) },
      from: (table: string) => new Query(table),
    }) },
  };
  const route = {} as { GET: () => Promise<Response>; POST: (request: Request) => Promise<Response> };
  const log = (...args: unknown[]) => { logs.push(args); };
  runInNewContext(compiled, {
    exports: route, Error, URL, console: { error: log, warn: log },
    fetch: async () => { refreshes += 1; return NextResponse.json({ ok: true, saved: 0 }); },
    require: (name: string) => {
      assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  }, { filename: routePath });
  const response = method === "GET" ? await route.GET() : await route.POST(new Request(
    "http://localhost/api/operator-memory/learn", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}),
    },
  ));
  return { response, body: await response.json(), tables, writes, logs, refreshes };
}

async function run() {
  for (const method of ["GET", "POST"] as const) {
    for (const scenario of scenarios) {
      const actual = await invoke(method, [scenario]);
      const label = `${method}: ${scenario.name}`;
      assert.equal(actual.response.status, 200, label);
      assert.equal(actual.body.ok, true, label);
      assert.equal(actual.body.mode, method === "GET" ? "preview" : "saved", label);
      assert.equal(actual.body.learned, 1, label);
      const item = actual.body.items[0];
      assert.equal(item.outcomeScore, scenario.score, `${label}: score`);
      assert.equal(item.status, scenario.status, `${label}: status`);
      assert.equal(item.reuseRecommended, scenario.score !== null && scenario.score >= 60, label);
      if (scenario.score === null) {
        assert.equal(item.confidence, "low", label);
        assert.equal(item.lessonStrength, "weak", label);
        assert.match(item.resultSummary, /not enough comparable before-and-after evidence/, label);
        assert.match(item.lesson, /not yet known/, label);
        assert.match(item.lesson, /Collect comparable before-and-after/, label);
        assert.doesNotMatch(`${item.resultSummary} ${item.lesson}`, /\/100|may help|Reuse is recommended/, label);
      }
      const summary = actual.body.summary;
      assert.equal(summary.averageOutcomeScore, scenario.score, `${label}: average`);
      assert.equal(summary.monitoringCount, scenario.score === null ? 1 : 0, label);
      assert.equal(summary.successCount, scenario.status === "success" ? 1 : 0, label);
      assert.equal(summary.partialCount, scenario.status === "partial" ? 1 : 0, label);
      assert.equal(summary.failedCount, scenario.status === "failed" ? 1 : 0, label);
      assert.equal(summary.topPlaybook, scenario.score === null ? null : "operator_action", label);
      assert.equal(actual.logs.length, 0, label);
      assert.equal(actual.writes.length, method === "POST" ? 1 : 0, label);
      assert.equal(actual.refreshes, method === "POST" ? 1 : 0, label);
      if (method === "GET") {
        assert.equal(actual.tables.includes("operator_memory"), false, label);
        assert.equal(Object.hasOwn(item, "savedMemoryId"), false, label);
      } else {
        assert.equal(item.savedMemoryId, "test-memory", label);
        const saved = actual.writes[0].payload;
        assert.equal(saved.outcome_score, scenario.score, label);
        assert.equal(saved.evidence.outcomeScore, scenario.score, label);
        assert.equal(saved.evidence.learningStatus, scenario.status, label);
        assert.equal(saved.confidence, item.confidence, label);
        assert.equal(saved.lesson_strength, item.lessonStrength, label);
        assert.equal(saved.reuse_recommended, item.reuseRecommended, label);
        assert.equal(saved.success, scenario.status === "success" ? true : scenario.status === "failed" ? false : null, label);
        assert.equal(saved.evidence.outcomeVerification.verified, false, label);
        assert.equal(saved.evidence.outcomeVerification.eligibleForReasoning, false, label);
        assert.equal(saved.evidence.outcomeVerification.trustState, "provisional", label);
      }
    }
    const empty = await invoke(method, []);
    assert.equal(empty.response.status, 200);
    assert.deepEqual(empty.body.summary, {
      learned: 0, averageOutcomeScore: null, successCount: 0, partialCount: 0,
      failedCount: 0, monitoringCount: 0, reusableCount: 0, topPlaybook: null,
    });
    assert.equal(empty.writes.length, 0);
    assert.equal(empty.refreshes, 0);

    const mixed = await invoke(method, [
      ...scenarios.slice(0, 3).map(scenario => ({ ...scenario, actionType: "unmeasured_action" })),
      ...scenarios.slice(-2).map(scenario => ({ ...scenario, actionType: "measured_action" })),
    ]);
    assert.equal(mixed.response.status, 200);
    assert.deepEqual(mixed.body.summary, {
      learned: 5, averageOutcomeScore: 50, successCount: 1, partialCount: 0,
      failedCount: 1, monitoringCount: 3, reusableCount: 1, topPlaybook: "measured_action",
    }, `${method}: unscored results must not dilute the average or dominate playbooks; score zero must count`);
    assert.equal(mixed.writes.length, method === "POST" ? 5 : 0);
    assert.equal(mixed.refreshes, method === "POST" ? 1 : 0);
  }

  const updated = await invoke("POST", [scenarios[0]], true);
  assert.equal(updated.response.status, 200);
  assert.equal(updated.writes.length, 1);
  assert.equal(updated.writes[0].operation, "update");
  const saved = updated.writes[0].payload;
  assert.equal(saved.outcome_score, null, "An old score must be cleared when evidence is unavailable");
  assert.equal(saved.success, null);
  assert.equal(saved.confidence, "low");
  assert.equal(saved.lesson_strength, "weak");
  assert.equal(saved.reuse_recommended, false);
  assert.equal(saved.evidence.outcomeScore, null);
  assert.equal(saved.evidence.learningStatus, "monitoring");
  assert.equal(saved.evidence.executionMarker, "preserved");
  assert.equal(saved.evidence.outcomeVerification.eligibleForReasoning, false);
}

run().then(() => {
  console.log("✓ Operator learning insufficient evidence regression test passed");
}).catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
