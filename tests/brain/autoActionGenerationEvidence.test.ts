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

type Action = {
  id: string;
  user_id: string;
  location_name: string;
  created_at: string;
  status: string;
  source_signal: { testTag: string };
};

type Options = {
  active?: Action[];
  recent?: Action[];
  verified?: string[];
  evidenceError?: boolean;
  queryError?: boolean;
  userId?: string | null;
};

function action(
  id: string,
  status = "pending",
  owner = "owner-1",
): Action {
  return {
    id,
    user_id: owner,
    location_name: "Test Cafe",
    created_at: new Date().toISOString(),
    status,
    source_signal: { testTag: id },
  };
}

function harness(options: Options = {}) {
  const events: string[] = [];
  const verified: string[] = [];

  class Query {
    private filters: Record<string, unknown> = {};

    constructor(private table: string) {}

    select(_columns: string) {
      return this;
    }

    eq(field: string, value: unknown) {
      this.filters[field] = value;
      return this;
    }

    in(field: string, value: unknown) {
      this.filters[field] = value;
      return this;
    }

    gte(field: string, value: unknown) {
      this.filters[field] = value;
      return this;
    }

    order(_field: string, _options?: unknown) {
      return this;
    }

    limit(_count: number) {
      return Promise.resolve(this.result());
    }

    then(
      resolve: (value: unknown) => unknown,
      reject?: (reason: unknown) => unknown,
    ) {
      return Promise.resolve(this.result()).then(resolve, reject);
    }

    private result() {
      const active = Array.isArray(this.filters.status);
      const label = this.table === "auto_actions"
        ? active ? "active" : "recent"
        : this.table;

      events.push(`query:${label}`);

      if (this.table === "auto_actions") {
        if (options.queryError) {
          return {
            data: null,
            error: { message: "Simulated database failure" },
          };
        }

        const candidates = active
          ? options.active ?? []
          : options.recent ?? [];

        return {
          data: candidates.filter(
            (row) =>
              row.user_id === this.filters.user_id &&
              (
                !active ||
                (this.filters.status as string[]).includes(row.status)
              ),
          ),
          error: null,
        };
      }

      assert.ok(
        this.table === "review_connections" ||
          this.table === "reviews",
        `Unexpected table: ${this.table}`,
      );

      return { data: [], error: null };
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
    "@/lib/restaurantDataReadiness": {
      filterReadyRestaurantData: () => [],
    },
    "@/lib/restaurantState": {
      getRestaurantStates: async () => [],
    },
    "@/lib/supabaseRoute": {
      getSupabaseRouteClient: async () => ({
        auth: {
          getUser: async () => ({
            data: {
              user: options.userId === null
                ? null
                : { id: options.userId ?? "owner-1" },
            },
            error: null,
          }),
        },
        from: (table: string) => new Query(table),
      }),
    },
    "@/lib/requirePro": {
      requireProForApi: async () => ({}),
    },
    "@/lib/aiKernel": {
      runAIKernel: async () => {
        throw new Error("No source data: AI Kernel must not run");
      },
    },
    "@/lib/brain/decisionProvenance": {
      buildDecisionChangeProvenance: () => ({}),
    },
    "@/lib/operatorLearning": {
      applyConfidenceBoost: () => 0,
      getRelevantLessons: async () => null,
      inferProblemTypeFromSignals: () => "unknown",
    },
    "@/lib/connectedGoogleReviewEvidence": {
      mapConnectedGoogleReviewRows,
    },
    "@/lib/autoActionEvidenceServer": {
      verifyAutoActionEvidence: async (input: {
        userId: string;
        sourceSignal: { testTag: string };
      }) => {
        assert.equal(input.userId, "owner-1");

        const id = input.sourceSignal.testTag;
        events.push(`verify:${id}`);
        verified.push(id);

        if (options.evidenceError) {
          throw new Error("Simulated evidence source failure");
        }

        return (options.verified ?? []).includes(id);
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
    Request,
    Response,
    URL,
    process: { env: { NODE_ENV: "production" } },
    console: { error() {}, warn() {}, log() {} },
  }, { filename: path });

  async function call() {
    const response = await route.POST(
      new Request("https://turntableai.net/api/auto-actions/generate", {
        method: "POST",
      }),
    );

    return {
      status: response.status,
      body: await response.json() as {
        reason?: string;
        skipped?: boolean;
        items?: Action[];
      },
    };
  }

  return { call, events, verified };
}

async function run() {
  const active = harness({
    active: [
      action("valid"),
      action("stale"),
      action("foreign", "pending", "owner-2"),
    ],
    verified: ["valid"],
  });

  const activeResult = await active.call();

  assert.equal(activeResult.status, 200);
  assert.equal(activeResult.body.reason, "active_actions_exist");
  assert.deepEqual(
    activeResult.body.items?.map((item) => item.id),
    ["valid"],
  );
  assert.deepEqual(active.verified.sort(), ["stale", "valid"]);
  assert.equal(active.events.includes("query:recent"), false);

  const cooldown = harness({
    active: [action("stale")],
    recent: [action("fresh")],
    verified: ["fresh"],
  });

  const cooldownResult = await cooldown.call();

  assert.equal(cooldownResult.status, 200);
  assert.equal(cooldownResult.body.reason, "cooldown_active");
  assert.deepEqual(
    cooldownResult.body.items?.map((item) => item.id),
    ["fresh"],
  );

  const allStale = harness({
    active: [action("old-pending")],
    recent: [action("old-recent")],
  });

  const staleResult = await allStale.call();

  assert.equal(staleResult.status, 200);
  assert.equal(staleResult.body.reason, "no_locations");
  assert.equal(staleResult.body.skipped, true);
  assert.ok(allStale.events.includes("query:review_connections"));
  assert.ok(allStale.events.includes("query:reviews"));

  const evidenceFailure = harness({
    active: [action("unavailable")],
    evidenceError: true,
  });

  assert.equal((await evidenceFailure.call()).status, 500);
  assert.equal(
    evidenceFailure.events.includes("query:review_connections"),
    false,
  );

  const databaseFailure = harness({
    active: [action("valid")],
    queryError: true,
  });

  assert.equal((await databaseFailure.call()).status, 500);
  assert.equal(databaseFailure.verified.length, 0);

  const unauthenticated = harness({ userId: null });

  assert.equal((await unauthenticated.call()).status, 401);
  assert.deepEqual(unauthenticated.events, []);

  console.log(
    "✓ Auto Action generation evidence regression test passed",
  );
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
