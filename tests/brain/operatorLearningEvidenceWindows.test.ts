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
const now = Date.now();
const anchor = now - 50 * day;
const iso = (time: number) => new Date(time).toISOString();
const at = (days: number) => iso(anchor + days * day);
const location = "Test restaurant";

function performance(id: string, time: string | null, revenue: number | string | null, refunds: number | string | null) {
  return {
    id, location_name: location, source_system: "square", source_record_id: id,
    captured_at: time, ingested_at: time, revenue, refunds,
    orders: null, avg_ticket: null, labor_pct: null, margin_pct: null,
  };
}
function review(id: string, time: string | null, rating: number | string | null) {
  return { id, location_name: location, update_time: time, rating };
}
type Pair = [number | null, number | null];
type Expected = { revenue: Pair; refunds: Pair; rating: Pair; ids: [string | null, string | null] };
type Scenario = {
  name: string;
  performance: ReturnType<typeof performance>[];
  reviews: ReturnType<typeof review>[];
  expected: Expected;
  actionAt?: string | null;
  locationName?: string | null;
  skipEvidenceReads?: boolean;
};
type QueryResult = { data: unknown; error: unknown };
type MemoryPayload = {
  evidence: Record<string, unknown> & {
    outcomeVerification: { verified: boolean; eligibleForReasoning: boolean };
  };
};
const empty: Expected = {
  revenue: [null, null], refunds: [null, null], rating: [null, null], ids: [null, null],
};
const before = performance("before", at(-1), 100, 4);
const after = performance("after", at(1), 120, 2);
const beforeReview = review("before-review", at(-1), 3);
const afterReview = review("after-review", at(1), 4);

const scenarios: Scenario[] = [
  {
    name: "closest valid snapshots and review averages",
    performance: [performance("later", at(2), 160, 0), before, after, performance("earlier", at(-2), 80, 8)],
    reviews: [afterReview, review("earlier-review", at(-2), 5), beforeReview, review("later-review", at(2), 5)],
    expected: { revenue: [100, 120], refunds: [4, 2], rating: [4, 4.5], ids: ["before", "after"] },
  },
  {
    name: "before evidence only", performance: [before], reviews: [beforeReview],
    expected: { revenue: [100, null], refunds: [4, null], rating: [3, null], ids: ["before", null] },
  },
  {
    name: "after evidence only", performance: [after], reviews: [afterReview],
    expected: { revenue: [null, 120], refunds: [null, 2], rating: [null, 4], ids: [null, "after"] },
  },
  {
    name: "action timestamp belongs only to the baseline",
    performance: [performance("boundary", iso(anchor + 2 * 3600000).replace("Z", "+02:00"), 100, 4)],
    reviews: [review("boundary-review", at(0), 3)],
    expected: { revenue: [100, null], refunds: [4, null], rating: [3, null], ids: ["boundary", null] },
  },
  { name: "no evidence despite populated recommendation values", performance: [], reviews: [], expected: empty },
  {
    name: "invalid timestamps and unrelated locations",
    performance: [performance("missing-time", null, 9999, 0), performance("bad-time", "invalid", 9999, 0),
      { ...after, location_name: "Other restaurant" }],
    reviews: [review("missing-review-time", null, 5), review("bad-review-time", "invalid", 5),
      { ...afterReview, location_name: "Other restaurant" }],
    expected: empty,
  },
  {
    name: "missing metric values retain provenance without recommendation fallbacks",
    performance: [performance("before", at(-1), null, ""), performance("after", at(1), "invalid", null)],
    reviews: [review("before-review", at(-1), null), review("after-review", at(1), "invalid")],
    expected: { ...empty, ids: ["before", "after"] },
  },
  {
    name: "observation bounds include their edges and exclude outside rows",
    performance: [performance("outside-before", iso(anchor - 14 * day - 1), 9999, 0),
      performance("start", at(-14), 100, 4), performance("end", at(14), 120, 2),
      performance("outside-after", iso(anchor + 14 * day + 1), 9999, 0)],
    reviews: [review("outside-review-before", iso(anchor - 45 * day - 1), 5),
      review("review-start", at(-45), 3), review("review-end", at(45), 4),
      review("outside-review-after", iso(anchor + 45 * day + 1), 1)],
    expected: { revenue: [100, 120], refunds: [4, 2], rating: [3, 4], ids: ["start", "end"] },
  },
  {
    name: "future observations are excluded", actionAt: iso(now - 2 * day),
    performance: [performance("recent-before", iso(now - 3 * day), 100, 4),
      performance("future", iso(now + day), 9999, 0)],
    reviews: [review("recent-review", iso(now - 3 * day), 3), review("future-review", iso(now + day), 5)],
    expected: { revenue: [100, null], refunds: [4, null], rating: [3, null], ids: ["recent-before", null] },
  },
];
for (const actionAt of [null, "", "invalid", iso(now + day)]) {
  scenarios.push({
    name: `unusable action timestamp: ${actionAt}`, actionAt,
    performance: [before, after], reviews: [beforeReview, afterReview], expected: empty, skipEvidenceReads: true,
  });
}
for (const locationName of [null, "   ", "!!!"]) {
  scenarios.push({
    name: `unusable location: ${locationName}`, locationName,
    performance: [before, after], reviews: [beforeReview, afterReview], expected: empty, skipEvidenceReads: true,
  });
}

async function invoke(method: "GET" | "POST", scenario: Scenario) {
  const tables: string[] = [];
  const writes: MemoryPayload[] = [];
  const logs: unknown[][] = [];
  let refreshes = 0;
  const results: Record<string, QueryResult> = {
    auto_actions: { data: [{
      id: "test-action", user_id: "test-user", action_type: "review_followup", title: "Test action",
      status: "executed", created_at: at(-1),
      updated_at: scenario.actionAt === undefined ? at(0) : scenario.actionAt,
      location_name: scenario.locationName === undefined ? location : scenario.locationName,
      recommended_payload: {},
      source_signal: { previousRevenue: 10, latestRevenue: 9999, previousRefunds: 20, latestRefunds: 0, avgRating: 5 },
    }], error: null },
    performance_signal_history: { data: scenario.performance, error: null },
    reviews: { data: scenario.reviews, error: null },
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
    insert(payload: MemoryPayload) { writes.push(payload); return this; }
    update(payload: MemoryPayload) { writes.push(payload); return this; }
    single() { return Promise.resolve({ data: { id: "test-memory" }, error: null }); }
    then(resolve: (value: QueryResult) => unknown, reject?: (error: unknown) => unknown) {
      return Promise.resolve(results[this.table]).then(resolve, reject);
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
  // Deliberately unfiltered, unsorted mock rows exercise the route's own evidence selection.
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
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ actionId: "test-action" }),
    },
  ));
  return { response, body: await response.json(), tables, writes, logs, refreshes };
}

async function run() {
  for (const method of ["GET", "POST"] as const) {
    for (const scenario of scenarios) {
      const actual = await invoke(method, scenario);
      const label = `${method}: ${scenario.name}`;
      assert.equal(actual.response.status, 200, label);
      assert.equal(actual.body.ok, true, label);
      assert.equal(actual.body.mode, method === "GET" ? "preview" : "saved", label);
      assert.equal(actual.body.learned, 1, label);
      const item = actual.body.items[0];
      const expected = scenario.expected;
      const metrics = {
        revenueBefore: expected.revenue[0], revenueAfter: expected.revenue[1],
        refundsBefore: expected.refunds[0], refundsAfter: expected.refunds[1],
        ratingBefore: expected.rating[0], ratingAfter: expected.rating[1],
      };
      for (const [key, value] of Object.entries(metrics)) {
        assert.equal(item[key], value, `${label}: ${key}`);
        if (method === "POST") assert.equal(actual.writes[0].evidence[key], value, `${label}: saved ${key}`);
      }
      for (const [side, rowId] of [["Before", expected.ids[0]], ["After", expected.ids[1]]] as const) {
        const key = `performance${side}Provenance`;
        const row = scenario.performance.find((candidate) => candidate.id === rowId);
        const provenance = row ? {
          rowId: row.id, sourceSystem: row.source_system, sourceRecordId: row.source_record_id,
          ingestedAt: row.ingested_at, capturedAt: row.captured_at,
        } : null;
        assert.deepEqual(item[key], provenance, `${label}: ${key}`);
        if (method === "POST") {
          assert.deepEqual(JSON.parse(JSON.stringify(actual.writes[0].evidence[key])), provenance, `${label}: saved ${key}`);
        }
      }
      for (const metric of ["revenue", "refunds", "rating"] as const) {
        if (expected[metric].includes(null)) {
          assert.equal(item.resultSummary.includes(`${metric} changed`), false, `${label}: no invented ${metric} delta`);
        }
      }
      if ([expected.revenue, expected.refunds, expected.rating].every((pair) => pair.includes(null))) {
        assert.equal(item.reuseRecommended, false, `${label}: incomplete pairs cannot justify reuse`);
      }
      assert.equal(actual.writes.length, method === "POST" ? 1 : 0, label);
      assert.equal(actual.refreshes, method === "POST" ? 1 : 0, label);
      assert.equal(actual.logs.length, 0, label);
      if (scenario.skipEvidenceReads) {
        assert.equal(actual.tables.includes("performance_signal_history"), false, label);
        assert.equal(actual.tables.includes("reviews"), false, label);
      }
      if (method === "POST") {
        assert.equal(item.savedMemoryId, "test-memory", label);
        const verification = actual.writes[0].evidence.outcomeVerification;
        assert.equal(verification.verified, false, label);
        assert.equal(verification.eligibleForReasoning, false, label);
      } else {
        assert.equal(actual.tables.includes("operator_memory"), false, label);
        assert.equal(Object.hasOwn(item, "savedMemoryId"), false, label);
      }
    }
  }
}

run().then(() => {
  console.log("✓ Operator learning evidence window regression test passed");
}).catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
