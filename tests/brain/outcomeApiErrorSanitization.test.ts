import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { NextResponse } from "next/server";
import ts from "typescript";

const routePath = "src/app/api/outcome-engine/run/route.ts";
const compiled = ts.transpileModule(readFileSync(routePath, "utf8"), {
  fileName: routePath,
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;

type Scenario = {
  user?: { id: string } | null;
  authError?: unknown;
  clientError?: unknown;
  engineError?: unknown;
};

const engineResult = { success: true, evaluated: 1 };
const minimumAge = 24;

function loadRoute(scenario: Scenario) {
  const logs: unknown[][] = [];
  const engineCalls: unknown[] = [];
  let proChecks = 0;
  const route = {} as {
    GET: () => Promise<Response>;
    POST: (request: Request) => Promise<Response>;
  };
  const dependencies: Record<string, unknown> = {
    "next/server": { NextResponse },
    "@/lib/requirePro": {
      requireProForApi: async () => { proChecks += 1; },
    },
    "@/lib/supabaseRoute": {
      getSupabaseRouteClient: async () => {
        if ("clientError" in scenario) throw scenario.clientError;
        return {
          auth: {
            getUser: async () => ({
              data: {
                user: scenario.user === undefined ? { id: "test-user" } : scenario.user,
              },
              error: scenario.authError ?? null,
            }),
          },
        };
      },
    },
    "@/lib/outcomeEngine": {
      MIN_OUTCOME_VERIFICATION_AGE_HOURS: minimumAge,
      evaluateRecentExecutedActions: async (options: unknown) => {
        engineCalls.push(options);
        if ("engineError" in scenario) throw scenario.engineError;
        return engineResult;
      },
    },
  };

  // Execute the actual handlers with all service dependencies replaced.
  runInNewContext(compiled, {
    exports: route,
    Error,
    console: { error: (...args: unknown[]) => { logs.push(args); } },
    require: (name: string) => {
      if (!Object.hasOwn(dependencies, name)) {
        throw new Error(`Unexpected route dependency: ${name}`);
      }
      return dependencies[name];
    },
  }, { filename: routePath });

  return { route, logs, engineCalls, get proChecks() { return proChecks; } };
}

async function run() {
  for (const method of ["GET", "POST"] as const) {
    async function invoke(scenario: Scenario = {}) {
      const harness = loadRoute(scenario);
      const response = method === "GET"
        ? await harness.route.GET()
        : await harness.route.POST(new Request("http://localhost/api/outcome-engine/run", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ limit: 100, minAgeHours: 0, reviewWindowDays: 100 }),
          }));
      assert.equal(harness.proChecks, 1, `${method} must retain the Pro check`);
      return { ...harness, response, body: await response.json() };
    }

    async function expectFailure(
      scenario: Scenario, status: number, message: string, expectedCalls: number,
      detail?: unknown,
    ) {
      const actual = await invoke(scenario);
      assert.equal(actual.response.status, status, `${method} status`);
      assert.deepEqual(actual.body, { error: message }, `${method} public error`);
      assert.equal(actual.engineCalls.length, expectedCalls, `${method} evaluation count`);
      if (detail !== undefined) {
        assert.ok(
          actual.logs.some((entry) => entry[1] === detail),
          `${method} must retain the full error in server logs`,
        );
      }
    }

    const authError = new Error("private authentication detail");
    await expectFailure({ authError }, 401, "Authentication failed", 0, authError);
    await expectFailure({ user: null }, 401, "Unauthorized", 0);

    const clientError = new Error("private database connection detail");
    await expectFailure({ clientError }, 500, "Outcome engine failed", 0, clientError);

    for (const engineError of [new Error("private query detail"), "private thrown value"]) {
      await expectFailure({ engineError }, 500, "Outcome engine failed", 1, engineError);
    }

    const success = await invoke();
    const options = method === "GET"
      ? { limit: 20, minAgeHours: minimumAge, reviewWindowDays: 7 }
      : { limit: 50, minAgeHours: minimumAge, reviewWindowDays: 60 };
    assert.equal(success.response.status, 200);
    assert.deepEqual(success.body, {
      ...engineResult,
      mode: method === "GET" ? "manual_get" : "manual_post",
      ...(method === "POST" ? { options } : {}),
    });
    // Normalize objects created inside the VM before comparing prototypes.
    assert.deepEqual(JSON.parse(JSON.stringify(success.engineCalls)), [
      { userId: "test-user", ...options },
    ]);
    assert.equal(success.logs.length, 0);
  }
}

run().then(() => {
  console.log("✓ Outcome API error sanitization regression test passed");
}).catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
