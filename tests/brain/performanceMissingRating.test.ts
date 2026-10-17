import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { verifySquarePerformanceRow } from "../../src/lib/verifiedSquarePerformance";

const path = "src/app/api/operator-snapshot/performance/route.ts";

const compiled = ts.transpileModule(
  readFileSync(path, "utf8"),
  {
    fileName: path,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;

async function loadPerformance(
  rating: number | null,
  refundCount: number | null = null,
  metrics = { laborPct: 18 as number | null, marginPct: 60 as number | null },
  capturedAt?: string,
  connected = true,
  comparison?: {
    previousCapturedAt?: string;
    previousSourceRecordId?: string;
  },
) {
  const now = capturedAt ?? new Date().toISOString();
  const previousCapturedAt = comparison?.previousCapturedAt ?? (
    Number.isFinite(Date.parse(now))
      ? new Date(Date.parse(now) - 24 * 60 * 60 * 1000).toISOString()
      : now
  );

  const performance = [
    {
      id: "latest",
      location_name: "Test Cafe",
      source_system: "square",
      source_record_id: "square:daily:production:merchant-1:location-1:2026-10-13",
      revenue: 1100,
      orders: 55,
      avg_ticket: 20,
      labor_pct: metrics.laborPct,
      margin_pct: metrics.marginPct,
      refunds: refundCount,
      captured_at: now,
    },
    {
      id: "previous",
      location_name: "Test Cafe",
      source_system: "square",
      source_record_id: comparison?.previousSourceRecordId ??
        "square:daily:production:merchant-1:location-1:2026-10-12",
      revenue: 1000,
      orders: 50,
      avg_ticket: 20,
      labor_pct: 18,
      margin_pct: 60,
      refunds: null,
      captured_at: previousCapturedAt,
    },
  ];

  const reviews = rating === null
    ? []
    : [{
        id: "review-1",
        location_name: "Test Cafe",
        rating,
        text: "Slow service",
        update_time: now,
      }];

  const route = {} as {
    GET: () => Promise<Response>;
  };

  const dependencies: Record<string, unknown> = {
    "next/server": {
      NextResponse: {
        json: (body: unknown, init?: ResponseInit) =>
          Response.json(body, init),
      },
    },
    "@/lib/performanceSignalTrust": {
      TRUSTED_PERFORMANCE_SOURCES: ["square"],
    },
    "@/lib/verifiedSquarePerformance": { verifySquarePerformanceRow },
    "@/lib/squareConnectionReader": {
      loadSquareProductionConnections: async (ownerId: string) => {
        assert.equal(ownerId, "owner-1");
        return connected ? [{
          userId: "owner-1",
          merchantId: "merchant-1",
          locations: [{ providerLocationId: "location-1", name: "Test Cafe", status: "ACTIVE" }],
        }] : [];
      },
    },
    "@/lib/supabaseRoute": {
      getSupabaseRouteClient: async () => ({
        auth: {
          getUser: async () => ({
            data: { user: { id: "owner-1" } },
          }),
        },
        from(table: string) {
          assert.equal(
            table,
            "performance_signal_history",
            "Unlinked review rows must not be queried by Performance",
          );

          let owner: string | null = null;

          const query = {
            select(fields: string) {
              if (table === "performance_signal_history") {
                assert.ok(fields.includes("source_system"));
                assert.ok(fields.includes("source_record_id"));
              }
              return query;
            },
            eq(field: string, value: unknown) {
              if (field === "user_id") owner = String(value);
              return query;
            },
            in(_field: string, _values: unknown) { return query; },
            gte(_field: string, _value: unknown) { return query; },
            order(_field: string, _options?: unknown) { return query; },
            then(
              resolve: (value: unknown) => unknown,
              reject?: (error: unknown) => unknown,
            ) {
              assert.equal(owner, "owner-1");

              return Promise.resolve({
                data: performance,
                error: null,
              }).then(resolve, reject);
            },
          };

          return query;
        },
      }),
    },
    "@/lib/requirePro": {
      requireProForApi: async () => ({}),
    },
  };

  runInNewContext(compiled, {
    exports: route,
    require: (name: string) => {
      assert.ok(
        Object.hasOwn(dependencies, name),
        `Unexpected dependency: ${name}`,
      );
      return dependencies[name];
    },
    Response,
    console,
  }, { filename: path });

  const response = await route.GET();
  assert.equal(response.status, 200);

  return await response.json() as {
    locations: Array<{
      avgRating: number | null;
      city: string;
      refunds: number | null;
      laborPct: number | null;
      marginPct: number | null;
      revenueDeltaPct: number | null;
      ordersDeltaPct: number | null;
      aovDeltaPct: number | null;
    }>;
    alerts: Array<{ type: string }>;
    actions: Array<{ title: string }>;
  };
}

async function run() {
  const missing = await loadPerformance(null);
  assert.equal(missing.locations[0].refunds, null);
  assert.equal(missing.locations[0].revenueDeltaPct, 10);
  assert.equal(missing.locations[0].ordersDeltaPct, 10);
  assert.equal(missing.locations[0].aovDeltaPct, 0);

  const genuineZero = await loadPerformance(null, 0);
  assert.equal(genuineZero.locations[0].refunds, 0);

  const unavailable = await loadPerformance(null, null, { laborPct: null, marginPct: null });
  assert.equal(unavailable.locations[0].laborPct, null);
  assert.equal(unavailable.locations[0].marginPct, null);
  assert.equal(unavailable.alerts.some((a) => a.type === "labor" || a.type === "margin"), false);

  const zeros = await loadPerformance(null, null, { laborPct: 0, marginPct: 0 });
  assert.equal(zeros.locations[0].laborPct, 0);
  assert.equal(zeros.locations[0].marginPct, 0);

  const losses = await loadPerformance(null, null, { laborPct: -2, marginPct: -7 });
  assert.equal(losses.locations[0].laborPct, null);
  assert.equal(losses.locations[0].marginPct, -7);

  const elevated = await loadPerformance(null, null, { laborPct: 28, marginPct: 67 });
  assert.equal(elevated.alerts.some((a) => a.type === "labor"), true);
  assert.equal(elevated.alerts.some((a) => a.type === "margin"), true);

  assert.equal(missing.locations.length, 1);
  assert.equal(missing.locations[0].avgRating, null);
  assert.equal(missing.locations[0].city, "");

  assert.equal(
    missing.alerts.some((alert) => alert.type === "reviews"),
    false,
  );

  for (const capturedAt of [
    new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    "invalid-timestamp",
  ]) {
    const stale = await loadPerformance(null, null, undefined, capturedAt);
    assert.equal(stale.locations.length, 0);
    assert.equal(stale.alerts.length, 0);
    assert.equal(stale.actions.length, 0);
  }

  const disconnected = await loadPerformance(null, null, undefined, undefined, false);
  assert.equal(disconnected.locations.length, 0);
  assert.equal(disconnected.alerts.length, 0);
  assert.equal(disconnected.actions.length, 0);

  const comparisonNow = new Date().toISOString();
  const sourceForSameDate = "square:daily:production:merchant-1:location-1:2026-10-13";
  const invalidComparisons = [
    { previousCapturedAt: comparisonNow },
    { previousCapturedAt: new Date(Date.parse(comparisonNow) - 96 * 60 * 60 * 1000).toISOString() },
    { previousCapturedAt: new Date(Date.parse(comparisonNow) + 60 * 60 * 1000).toISOString() },
    { previousSourceRecordId: sourceForSameDate },
    { previousSourceRecordId: "square:daily:production:merchant-1:location-1:2026-10-14" },
  ];

  for (const comparison of invalidComparisons) {
    const invalid = await loadPerformance(
      null, null, undefined, comparisonNow, true, comparison,
    );
    assert.equal(invalid.locations.length, 1);
    assert.equal(invalid.locations[0].revenueDeltaPct, null);
    assert.equal(invalid.locations[0].ordersDeltaPct, null);
    assert.equal(invalid.locations[0].aovDeltaPct, null);
    assert.equal(invalid.alerts.some((alert) => alert.type === "revenue"), false);
  }

  const lowRating = await loadPerformance(2);
  assert.equal(lowRating.actions.length, 0);

  const healthyMargin = await loadPerformance(4.8, null, { laborPct: 18, marginPct: 67 });
  assert.equal(healthyMargin.actions.length, 0);

  // A name match is not proof that a Google review belongs to a Square location.
  assert.equal(lowRating.locations[0].avgRating, null);

  assert.equal(
    lowRating.alerts.some((alert) => alert.type === "reviews"),
    false,
  );

  console.log(
    "✓ Performance missing-rating API regression test passed",
  );
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
