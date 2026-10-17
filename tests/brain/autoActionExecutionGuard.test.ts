import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { resolveUniqueConnectedGoogleLocation } from "@/lib/connectedGoogleReviewEvidence";
import { canTransitionAutoActionStatus } from "@/lib/autoActionStatus";

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

type Options = {
  status?: "pending" | "approved" | "executed" | "dismissed";
  verified?: boolean;
  verifierThrows?: boolean;
  userId?: string | null;
};

function harness(options: Options = {}) {
  const events: string[] = [];
  const verifiedInputs: unknown[] = [];

  const row = {
    id: "action-1",
    user_id: "owner-1",
    location_name: "Test Cafe",
    action_type: "margin_protection",
    title: "Review refunds",
    reason: "Refund spike",
    recommended_payload: {},
    source_signal: { trigger: { type: "refund_spike" } },
    status: options.status ?? "pending",
    priority_score: 90,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const supabase = {
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
    from(table: string) {
      events.push(`query:${table}`);
      assert.equal(
        table,
        "auto_actions",
        "Unverified actions must never cause downstream writes.",
      );

      const filters: Record<string, unknown> = {};
      let update: Record<string, unknown> | null = null;

      const query = {
        select(_columns: string) {
          return query;
        },
        eq(key: string, value: unknown) {
          filters[key] = value;
          return query;
        },
        update(payload: Record<string, unknown>) {
          update = payload;
          return query;
        },
        is(_key: string, _value: unknown) { return query; },
        async maybeSingle() { return query.single(); },
        async single() {
          if (
            filters.id !== row.id ||
            filters.user_id !== row.user_id
          ) {
            return { data: null, error: null };
          }

          if (update) {
            events.push(`update:${String(update.status)}`);
            return {
              data: { ...row, ...update },
              error: null,
            };
          }

          return { data: row, error: null };
        },
      };

      return query;
    },
  };

  const route = {} as {
    PATCH: (request: Request) => Promise<Response>;
  };

  const deps: Record<string, unknown> = {
    "next/server": {
      NextResponse: {
        json: (body: unknown, init?: ResponseInit) =>
          Response.json(body, init),
      },
    },
    "@/lib/supabaseRoute": {
      getSupabaseRouteClient: async () => supabase,
    },
    "@/lib/requirePro": {
      requireProForApi: async () => ({}),
    },
    "@/lib/autoActionStatus": {
      canTransitionAutoActionStatus,
    },
    "@/lib/operatorMemoryTrust": {
      buildProvisionalMemoryEvidence: (value: unknown) => value,
    },
    "@/lib/connectedGoogleReviewEvidence": { resolveUniqueConnectedGoogleLocation },
    "@/lib/autoActionEvidenceServer": {
      verifyAutoActionEvidence: async (input: unknown) => {
        verifiedInputs.push(input);
        events.push("verify");

        if (options.verifierThrows) {
          throw new Error("Evidence source unavailable");
        }

        return options.verified ?? false;
      },
    },
  };

  runInNewContext(compiled, {
    exports: route,
    require: (name: string) => {
      assert.ok(Object.hasOwn(deps, name), `Unknown dependency: ${name}`);
      return deps[name];
    },
    Response,
    console: { error() {}, warn() {}, log() {} },
  }, { filename: path });

  async function call(status: string, id = "action-1") {
    const response = await route.PATCH(
      new Request("https://turntableai.net/api/auto-actions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      }),
    );

    return {
      status: response.status,
      body: await response.json() as Record<string, unknown>,
    };
  }

  return { call, events, verifiedInputs };
}

async function run() {
  const blockedApproval = harness();
  const approval = await blockedApproval.call("approved");

  assert.equal(approval.status, 409);
  assert.equal(approval.body.code, "AUTO_ACTION_EVIDENCE_UNVERIFIED");
  assert.equal(blockedApproval.verifiedInputs.length, 1);
  assert.equal(
    (blockedApproval.verifiedInputs[0] as { userId: string }).userId,
    "owner-1",
  );
  assert.deepEqual(
    blockedApproval.events,
    ["query:auto_actions", "verify"],
  );

  const blockedExecution = harness({ status: "approved" });
  const execution = await blockedExecution.call("executed");

  assert.equal(execution.status, 409);
  assert.deepEqual(
    blockedExecution.events,
    ["query:auto_actions", "verify"],
    "Unverified execution must have no side effects.",
  );

  const approved = harness({ verified: true });
  const permitted = await approved.call("approved");

  assert.equal(permitted.status, 200);
  assert.deepEqual(
    approved.events,
    ["query:auto_actions", "verify", "query:auto_actions", "update:approved"],
  );

  const dismissed = harness();
  const dismissal = await dismissed.call("dismissed");

  assert.equal(dismissal.status, 200);
  assert.equal(dismissed.verifiedInputs.length, 0);
  assert.ok(dismissed.events.includes("update:dismissed"));

  const invalidTransition = harness();
  assert.equal((await invalidTransition.call("executed")).status, 400);
  assert.equal(invalidTransition.verifiedInputs.length, 0);

  const otherOwner = harness({ userId: "owner-2" });
  assert.equal((await otherOwner.call("approved")).status, 404);
  assert.equal(otherOwner.verifiedInputs.length, 0);

  const unavailableEvidence = harness({ verifierThrows: true });
  assert.equal((await unavailableEvidence.call("approved")).status, 500);
  assert.equal(
    unavailableEvidence.events.some((event) => event.startsWith("update:")),
    false,
  );

  const unauthenticated = harness({ userId: null });
  assert.equal((await unauthenticated.call("approved")).status, 401);
  assert.equal(unauthenticated.events.length, 0);

  console.log(
    "✓ Auto Action API execution evidence guard regression test passed",
  );
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
