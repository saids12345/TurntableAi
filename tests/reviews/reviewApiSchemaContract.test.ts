import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const paths = [
  { file: "src/app/api/operator-snapshot/reviews/route.ts", key: "reviews" },
  { file: "src/app/api/reviews/route.ts", key: "items" },
] as const;

const reviewColumns = new Set([
  "id", "user_id", "location_id", "provider", "provider_review_id", "author",
  "rating", "text", "posted_at", "status", "created_at", "updated_at",
  "location_name", "reviewer_name", "comment", "create_time", "update_time", "raw",
]);
const workflowColumns = new Set([
  "id", "user_id", "review_id", "status", "note", "suggested_reply",
  "created_at", "updated_at",
]);

const now = "2026-10-28T12:00:00.000Z";
const example = {
  id: "review-1", user_id: "owner-1", provider: "google",
  location_name: "locations/123", reviewer_name: null, author: "Google Guest",
  rating: 2, text: "The coffee was cold", status: null,
  update_time: now, create_time: now,
};

type Options = {
  rows?: Array<Record<string, unknown>>;
  workflows?: Array<Record<string, unknown>>;
  reviewsError?: boolean;
  owner?: string;
};

function harness(file: string, options: Options = {}) {
  const compiled = ts.transpileModule(readFileSync(file, "utf8"), {
    fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const scope: string[] = [];
  const owner = options.owner ?? "owner-1";
  const supabase = {
    auth: { getUser: async () => ({ data: { user: { id: owner } } }) },
    from(table: string) {
      assert.ok(table === "reviews" || table === "review_workflow_states");
      const validColumns = table === "reviews" ? reviewColumns : workflowColumns;
      let queriedOwner: unknown;
      const query = {
        select(fields: string) {
          const columns = fields.split(",").map((name) => name.trim());
          for (const col of columns) {
            assert.ok(validColumns.has(col), `${file} requested absent ${table}.${col}`);
          }
          return query;
        },
        eq(column: string, value: unknown) {
          assert.equal(column, "user_id");
          queriedOwner = value;
          scope.push(`${table}:${value}`);
          return query;
        },
        gte(column: string, _value: string) { assert.equal(column, "update_time"); return query; },
        order(column: string) {
          assert.equal(column, table === "reviews" ? "update_time" : "updated_at");
          return query;
        },
        then(resolve: (value: unknown) => unknown, reject?: (err: unknown) => unknown) {
          const all = table === "reviews" ? (options.rows ?? []) : (options.workflows ?? []);
          const data = all.filter((row) => row.user_id === queriedOwner);
          const error = table === "reviews" && options.reviewsError
            ? { code: "SIMULATED_DB_FAILURE", message: "simulated" } : null;
          return Promise.resolve({ data: error ? null : data, error }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  const route = {} as { GET: () => Promise<Response> };
  const deps: Record<string, unknown> = {
    "next/server": { NextResponse: { json: (value: unknown, init?: ResponseInit) => Response.json(value, init) } },
    "@/lib/supabaseRoute": { getSupabaseRouteClient: async () => supabase },
    "@/lib/requirePro": { requireProForApi: async () => undefined },
  };
  runInNewContext(compiled, {
    exports: route,
    require: (name: string) => { assert.ok(Object.hasOwn(deps, name), name); return deps[name]; },
    Response, Date, Map, console: { error() {}, log() {}, warn() {} },
  }, { filename: file });
  return {
    scope,
    call: async () => {
      const response = await route.GET();
      return { status: response.status, body: await response.json() as Record<string, unknown> };
    },
  };
}

async function main() {
  for (const { file, key } of paths) {
    const empty = harness(file);
    const emptyResponse = await empty.call();
    assert.equal(emptyResponse.status, 200);
    assert.deepEqual(emptyResponse.body[key], []);
    assert.deepEqual(empty.scope, ["reviews:owner-1", "review_workflow_states:owner-1"]);

    const withRealReview = harness(file, { rows: [example] });
    const realResponse = await withRealReview.call();
    assert.equal(realResponse.status, 200);
    const real = (realResponse.body[key] as Array<Record<string, unknown>>)[0];
    assert.equal(real.platform, "Google");
    assert.equal(real.reviewerName, "Google Guest");
    assert.equal(real.status, "new", "Low rating alone is not proof of escalation");
    assert.equal(typeof real.suggestedReply, "string");

    const workflow = {
      id: "workflow-1", user_id: "owner-1", review_id: "review-1",
      status: "resolved", note: "Manager followed up", suggested_reply: "Owner draft",
      created_at: now, updated_at: now,
    };
    const managedResponse = await harness(file, {
      rows: [{ ...example, status: "drafted", reviewer_name: "Preferred reviewer" }],
      workflows: [workflow],
    }).call();
    const managed = (managedResponse.body[key] as Array<Record<string, unknown>>)[0];
    assert.equal(managed.status, "resolved");
    assert.equal(managed.reviewerName, "Preferred reviewer");
    assert.equal(managed.suggestedReply, "Owner draft");
    assert.equal(managed.note, "Manager followed up");

    const owned = await harness(file, {
      rows: [example, { ...example, id: "foreign-review", user_id: "owner-2" }],
      workflows: [workflow, { ...workflow, review_id: "foreign-review", user_id: "owner-2" }],
    }).call();
    assert.equal((owned.body[key] as unknown[]).length, 1);

    const errorResponse = await harness(file, { reviewsError: true }).call();
    assert.equal(errorResponse.status, 500);
    assert.equal(errorResponse.body[key], undefined);

    const unknownProvider = await harness(file, {
      rows: [{ ...example, provider: "unknown-provider" }],
    }).call();
    assert.equal(unknownProvider.status, 500, "Do not label an unknown provider as Google");
    assert.equal(unknownProvider.body[key], undefined);
  }
  console.log("✓ Both Reviews API schema and behavior regression checks passed");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
