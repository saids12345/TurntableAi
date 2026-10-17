import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import {
  mapConnectedGoogleReviewRows,
} from "@/lib/connectedGoogleReviewEvidence";

const path = "src/app/api/auto-actions/generate/route.ts";

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

type Row = {
  id: string;
  user_id: string;
  location_name: string;
  status: string;
  action_type: string;
  source_signal: Record<string, unknown>;
  recommended_payload: Record<string, unknown>;
  title: string;
  reason: string;
  created_at: string;
  updated_at: string;
  execution_claim_token?: string | null;
};

function harness(options: {
  allowedLocations?: string[];
  evidenceFailure?: boolean;
  claimedLocation?: string;
  claimedOwner?: string;
  claimLookupError?: boolean;
} = {}) {
  const oldDate = new Date(
    Date.now() - 5 * 86400000,
  ).toISOString();

  const existing: Row[] = [
    "Downtown Cafe",
    "Harbor Cafe",
  ].map((location, index) => ({
    id: `old-${index}`,
    user_id: "owner-1",
    location_name: location,
    status: "pending",
    action_type: "service_recovery",
    source_signal: { testTag: "old" },
    recommended_payload: {},
    title: "Old recommendation",
    reason: "Old evidence",
    created_at: oldDate,
    updated_at: oldDate,
  }));

  existing.push({
    ...existing[0],
    id: "other-owner",
    user_id: "owner-2",
  });

  if (options.claimedLocation) {
    existing.push({
      ...existing[0],
      id: "unresolved-execution-claim",
      user_id: options.claimedOwner ?? "owner-1",
      location_name: options.claimedLocation,
      status: "approved",
      execution_claim_token: "00000000-0000-4000-8000-000000000001",
    });
  }

  const inserted: Row[] = [];
  const verified: string[] = [];
  const writes: string[] = [];

  const connectedLocations = [
    { name: "locations/101", title: "Downtown Cafe", id: "loc-101" },
    { name: "locations/202", title: "Harbor Cafe", id: "loc-202" },
  ];

  const reviews = connectedLocations.flatMap(
    (location) => Array.from({ length: 3 }, (_, index) => ({
      id: `${location.id}-${index}`,
      location_name: location.name,
      rating: 1,
      text: "Slow service and a long wait",
      update_time: new Date().toISOString(),
    })),
  );

  class Query {
    private filters: Record<string, unknown> = {};
    private minimums: Record<string, string> = {};
    private mode = "read";
    private payload: unknown = null;

    constructor(private readonly table: string) {}

    select(_columns: string) { return this; }
    order(_key: string, _options?: unknown) { return this; }
    eq(key: string, value: unknown) {
      this.filters[key] = value;
      return this;
    }
    in(key: string, value: unknown) {
      this.filters[key] = value;
      return this;
    }
    gte(key: string, value: string) {
      this.minimums[key] = value;
      return this;
    }
    insert(value: unknown) {
      this.mode = "insert";
      this.payload = value;
      return this;
    }
    update(value: unknown) {
      this.mode = "update";
      this.payload = value;
      return this;
    }
    limit(_value: number) {
      return Promise.resolve(this.execute());
    }
    then(
      resolve: (value: unknown) => unknown,
      reject?: (reason: unknown) => unknown,
    ) {
      return Promise.resolve(this.execute()).then(resolve, reject);
    }

    private execute() {
      if (this.table === "review_connections") {
        return {
          data: [{ review_locations: connectedLocations }],
          error: null,
        };
      }

      if (this.table === "reviews") {
        return { data: reviews, error: null };
      }

      assert.equal(this.table, "auto_actions");

      if (this.mode === "insert") {
        const payload = this.payload as Row[];

        for (const row of payload) {
          inserted.push(row);
        }

        writes.push("insert");

        return {
          data: payload.map((row, index) => ({
            ...row,
            id: `new-${index}`,
          })),
          error: null,
        };
      }

      if (
        options.claimLookupError &&
        this.mode === "read" &&
        typeof this.filters.location_name === "string" &&
        Array.isArray(this.filters.status)
      ) {
        return { data: null, error: { message: "Simulated claim lookup failure" } };
      }

      const matches = existing.filter((row) => {
        if (
          this.filters.user_id !== undefined &&
          row.user_id !== this.filters.user_id
        ) {
          return false;
        }

        if (
          this.filters.location_name !== undefined &&
          row.location_name !== this.filters.location_name
        ) {
          return false;
        }

        if (typeof this.filters.status === "string" &&
            row.status !== this.filters.status) {
          return false;
        }

        if (Array.isArray(this.filters.status) &&
            !this.filters.status.includes(row.status)) {
          return false;
        }

        if (Array.isArray(this.filters.id) &&
            !this.filters.id.includes(row.id)) {
          return false;
        }

        if (this.minimums.created_at &&
            row.created_at < this.minimums.created_at) {
          return false;
        }

        return true;
      });

      if (this.mode === "update") {
        const values = this.payload as Partial<Row>;

        for (const row of matches) {
          Object.assign(row, values);
          writes.push(`update:${row.id}`);
        }

        return { data: matches, error: null };
      }

      return { data: matches, error: null };
    }
  }

  const route = {} as {
    POST: (request: Request) => Promise<Response>;
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
        from: (table: string) => new Query(table),
      }),
    },
    "@/lib/restaurantDataReadiness": {
      filterReadyRestaurantData: () => [],
    },
    "@/lib/restaurantState": {
      getRestaurantStates: async () => [],
    },
    "@/lib/connectedGoogleReviewEvidence": {
      mapConnectedGoogleReviewRows,
    },
    "@/lib/autoActionEvidenceServer": {
      verifyAutoActionEvidence: async (input: {
        userId: string;
        locationName: string;
        sourceSignal: Record<string, unknown>;
      }) => {
        assert.equal(input.userId, "owner-1");

        if (options.evidenceFailure) {
          throw new Error("Simulated evidence outage");
        }

        if (input.sourceSignal.testTag === "old") {
          return false;
        }

        verified.push(input.locationName);

        return (options.allowedLocations ?? [])
          .includes(input.locationName);
      },
    },
    "@/lib/aiKernel": {
      runAIKernel: async () => {
        throw new Error("Cognitive fallback fixture");
      },
    },
    "@/lib/brain/decisionProvenance": {
      buildDecisionChangeProvenance: () => null,
    },
    "@/lib/operatorLearning": {
      getRelevantLessons: async () => null,
      applyConfidenceBoost: (value: number) => value,
      inferProblemTypeFromSignals: () => "guest_sentiment_risk",
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
    Request,
    Response,
    URL,
    process: { env: { NODE_ENV: "production" } },
    console: { error() {}, warn() {}, log() {} },
  }, { filename: path });

  async function call(force = false) {
    const response = await route.POST(
      new Request(
        "https://turntableai.net/api/auto-actions/generate" + (force ? "?force=true" : ""),
        { method: "POST" },
      ),
    );

    return {
      status: response.status,
      body: await response.json() as {
        reason?: string;
        saved?: number;
      },
    };
  }

  return { call, existing, inserted, verified, writes };
}

async function run() {
  const partial = harness({
    allowedLocations: ["Downtown Cafe"],
  });

  const partialResult = await partial.call();

  assert.equal(partialResult.status, 200);
  assert.equal(partialResult.body.saved, 1);
  assert.equal(partial.inserted.length, 1);
  assert.equal(
    partial.inserted[0].location_name,
    "Downtown Cafe",
  );
  assert.equal(partial.writes.includes("insert"), true);

  assert.equal(
    partial.existing.find((row) => row.id === "old-0")?.status,
    "dismissed",
  );
  assert.equal(
    partial.existing.find((row) => row.id === "old-1")?.status,
    "pending",
  );
  assert.equal(
    partial.existing.find((row) => row.id === "other-owner")?.status,
    "pending",
  );

  const blocked = harness();
  const blockedResult = await blocked.call();

  assert.equal(blockedResult.status, 200);
  assert.equal(
    blockedResult.body.reason,
    "insufficient_verified_evidence",
  );
  assert.equal(blocked.inserted.length, 0);
  assert.deepEqual(blocked.writes, []);

  const unavailable = harness({ evidenceFailure: true });
  const unavailableResult = await unavailable.call();

  assert.equal(unavailableResult.status, 500);
  assert.equal(unavailable.inserted.length, 0);
  assert.deepEqual(unavailable.writes, []);

  const claimed = harness({
    allowedLocations: ["Downtown Cafe", "Harbor Cafe"],
    claimedLocation: "Downtown Cafe",
  });
  const claimedResult = await claimed.call(true);
  assert.equal(claimedResult.status, 200);
  assert.equal(claimedResult.body.saved, 1);
  assert.deepEqual(claimed.inserted.map((row) => row.location_name), ["Harbor Cafe"]);
  assert.equal(claimed.existing.find((row) => row.id === "old-0")?.status, "pending");
  assert.equal(claimed.existing.find((row) => row.id === "old-1")?.status, "dismissed");
  assert.equal(
    claimed.existing.find((row) => row.id === "unresolved-execution-claim")?.status,
    "approved",
  );

  const blockedOnly = harness({
    allowedLocations: ["Downtown Cafe"],
    claimedLocation: "Downtown Cafe",
  });
  const blockedOnlyResult = await blockedOnly.call(true);
  assert.equal(blockedOnlyResult.status, 200);
  assert.equal(blockedOnlyResult.body.reason, "execution_reconciliation_required");
  assert.equal(blockedOnly.inserted.length, 0);
  assert.deepEqual(blockedOnly.writes, []);

  const foreignClaim = harness({
    allowedLocations: ["Downtown Cafe"],
    claimedLocation: "Downtown Cafe",
    claimedOwner: "owner-2",
  });
  const foreignResult = await foreignClaim.call(true);
  assert.equal(foreignResult.status, 200);
  assert.equal(foreignResult.body.saved, 1);
  assert.equal(foreignClaim.inserted[0]?.location_name, "Downtown Cafe");

  const claimLookupFailure = harness({
    allowedLocations: ["Downtown Cafe"],
    claimLookupError: true,
  });
  const lookupResult = await claimLookupFailure.call(true);
  assert.equal(lookupResult.status, 500);
  assert.equal(claimLookupFailure.inserted.length, 0);
  assert.deepEqual(claimLookupFailure.writes, []);

  console.log(
    "✓ Auto Action pre-insert evidence and location isolation regression test passed",
  );
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
