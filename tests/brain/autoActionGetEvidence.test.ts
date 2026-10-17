import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { resolveUniqueConnectedGoogleLocation } from "@/lib/connectedGoogleReviewEvidence";

const path = "src/app/api/auto-actions/route.ts";

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

const rows = [
  ["live", "pending", "owner-1"],
  ["stale", "approved", "owner-1"],
  ["claimed", "approved", "owner-1"],
  ["failed", "pending", "owner-1"],
  ["executed", "executed", "owner-1"],
  ["dismissed", "dismissed", "owner-1"],
  ["foreign", "pending", "owner-2"],
].map(([id, status, user_id]) => ({
  id,
  status,
  user_id,
  location_name: "Test Cafe",
  created_at: new Date().toISOString(),
  source_signal: { testTag: id },
  execution_claim_token: id === "claimed" ? "private-claim-token" : null,
  execution_claimed_at: id === "claimed" ? new Date().toISOString() : null,
}));

let scopedUser: unknown = null;
const verifiedIds: string[] = [];

const query = {
  select(_columns: string) {
    return this;
  },
  eq(field: string, value: unknown) {
    if (field === "user_id") scopedUser = value;
    return this;
  },
  order(_column: string, _options?: unknown) {
    return this;
  },
  then(
    resolve: (value: unknown) => unknown,
    reject?: (reason: unknown) => unknown,
  ) {
    return Promise.resolve({
      data: rows.filter((row) => row.user_id === scopedUser),
      error: null,
    }).then(resolve, reject);
  },
};

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
  "@/lib/requirePro": {
    requireProForApi: async () => ({}),
  },
  "@/lib/supabaseRoute": {
    getSupabaseRouteClient: async () => ({
      auth: {
        getUser: async () => ({
          data: { user: { id: "owner-1" } },
          error: null,
        }),
      },
      from: (table: string) => {
        assert.equal(table, "auto_actions");
        return query;
      },
    }),
  },
  "@/lib/autoActionStatus": {},
  "@/lib/operatorMemoryTrust": {},
  "@/lib/connectedGoogleReviewEvidence": { resolveUniqueConnectedGoogleLocation },
  "@/lib/autoActionEvidenceServer": {
    verifyAutoActionEvidence: async (input: {
      sourceSignal: { testTag: string };
      userId: string;
    }) => {
      assert.equal(input.userId, "owner-1");
      verifiedIds.push(input.sourceSignal.testTag);

      if (input.sourceSignal.testTag === "failed") {
        throw new Error("Simulated evidence failure");
      }

      return input.sourceSignal.testTag === "live";
    },
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
  console: { error() {}, warn() {}, log() {} },
}, { filename: path });

async function run() {
  const response = await route.GET();

  assert.equal(response.status, 200);
  assert.equal(scopedUser, "owner-1");

  const body = await response.json() as {
    items: Array<{
      id: string;
      evidenceStatus: string;
      execution_claim_token?: string | null;
      execution_claimed_at?: string | null;
    }>;
  };

  assert.deepEqual(
    body.items.map((item) => [item.id, item.evidenceStatus]),
    [
      ["live", "current"],
      ["stale", "unverified"],
      ["claimed", "reconciliation_required"],
      ["failed", "unverified"],
      ["executed", "historical"],
      ["dismissed", "historical"],
    ],
  );

  const claimed = body.items.find((item) => item.id === "claimed");
  assert.ok(claimed);
  assert.equal(claimed.execution_claim_token, undefined,
    "Execution claim token must never be returned to the browser");
  assert.ok(claimed.execution_claimed_at);

  assert.deepEqual(
    verifiedIds.sort(),
    ["failed", "live", "stale"],
  );

  console.log(
    "✓ Auto Action GET evidence classification regression test passed",
  );
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
