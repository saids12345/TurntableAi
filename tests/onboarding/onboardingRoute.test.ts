import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as ts from "typescript";
import { parseRestaurantIdentity } from "../../src/lib/onboardingInput";

let currentUser: string | null = null;
let failLookup = false;
const groups = new Map<string, any>();
const progress = new Map<string, any>();
let nextId = 1;

function fakeSupabase() {
  return {
    auth: {
      async getUser() {
        return {
          data: {
            user: currentUser ? { id: currentUser } : null,
          },
          error: null,
        };
      },
    },
    from(table: string) {
      const filters: Record<string, unknown> = {};

      return {
        select(_columns: string) {
          return this;
        },
        eq(column: string, value: unknown) {
          filters[column] = value;
          return this;
        },
        async maybeSingle() {
          if (failLookup) {
            return {
              data: null,
              error: { message: "private database error" },
            };
          }

          if (table === "restaurant_groups") {
            assert.ok(Object.hasOwn(filters, "owner_user_id"));
            return {
              data: groups.get(String(filters.owner_user_id)) ?? null,
              error: null,
            };
          }

          assert.equal(table, "restaurant_onboarding");
          return {
            data: progress.get(String(filters.group_id)) ?? null,
            error: null,
          };
        },
        async single() {
          assert.equal(table, "restaurant_onboarding");
          const row = progress.get(String(filters.group_id));
          return {
            data: row ?? null,
            error: row ? null : { message: "missing progress" },
          };
        },
        upsert(values: any, options: any): any {
          if (table === "restaurant_groups") {
            assert.equal(values.owner_user_id, currentUser);
            assert.equal(options.onConflict, "owner_user_id");

            assert.deepEqual(Object.keys(values).sort(), [
              "expected_location_count",
              "name",
              "owner_user_id",
              "primary_goal",
              "updated_at",
            ]);

            return {
              select() {
                return this;
              },
              async single() {
                const owner = String(values.owner_user_id);
                const id = groups.get(owner)?.id ?? `group-${nextId++}`;
                groups.set(owner, { id, ...values });

                return {
                  data: {
                    id,
                    name: values.name,
                    expected_location_count: values.expected_location_count,
                    primary_goal: values.primary_goal,
                  },
                  error: null,
                };
              },
            };
          }

          assert.equal(table, "restaurant_onboarding");
          assert.equal(options.onConflict, "group_id");
          assert.equal(options.ignoreDuplicates, true);

          if (!progress.has(values.group_id)) {
            progress.set(values.group_id, {
              current_step: values.current_step,
              completed_at: null,
            });
          }

          return Promise.resolve({ error: null });
        },
      };
    },
  };
}

const imports: Record<string, unknown> = {
  "next/server": {
    NextResponse: {
      json: (body: unknown, options: ResponseInit) =>
        Response.json(body, options),
    },
  },
  "@/lib/supabaseServer": {
    getSupabaseServerClient: async () => fakeSupabase(),
  },
  "@/lib/onboardingInput": {
    parseRestaurantIdentity,
  },
};

const handlers: Record<string, any> = {};
const internalErrors: unknown[][] = [];

const source = readFileSync(
  "src/app/api/onboarding/route.ts",
  "utf8",
);

const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;

runInNewContext(
  compiled,
  {
    exports: handlers,
    Response,
    Date,
    console: {
      error: (...args: unknown[]) => {
        internalErrors.push(args);
      },
    },
    require(name: string) {
      assert.ok(
        Object.hasOwn(imports, name),
        `Unexpected import: ${name}`,
      );
      return imports[name];
    },
  },
  {
    filename: "src/app/api/onboarding/route.ts",
    timeout: 5000,
  },
);

const valid = (name: string) => ({
  name,
  expectedLocationCount: 3,
  primaryGoal: "operations",
});

const put = (body: unknown) =>
  handlers.PUT(
    new Request("https://example.invalid/api/onboarding", {
      method: "PUT",
      body: typeof body === "string"
        ? body
        : JSON.stringify(body),
    }),
  );

async function run() {
  let response = await handlers.GET();
  assert.equal(response.status, 401);
  assert.equal((await put(valid("Cafe"))).status, 401);

  currentUser = "owner-a";

  response = await handlers.GET();
  assert.equal(response.status, 200);
  assert.equal((await response.json()).restaurant, null);

  assert.equal((await put("not-json")).status, 400);
  assert.equal((await put("x".repeat(8200))).status, 413);
  assert.equal(
    (await put({
      ...valid("Cafe"),
      owner_user_id: "owner-b",
    })).status,
    400,
  );

  response = await put(valid("Cafe One"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");

  const created = await response.json();
  assert.equal(groups.get("owner-a")?.owner_user_id, "owner-a");
  assert.equal(created.restaurant.owner_user_id, undefined);
  assert.equal(created.progress.current_step, "locations");

  response = await handlers.GET();
  assert.equal(response.status, 200);
  assert.equal(
    (await response.json()).restaurant.id,
    created.restaurant.id,
  );

  progress.set(created.restaurant.id, {
    current_step: "readiness",
    completed_at: null,
  });

  response = await put(valid("Cafe One Updated"));
  assert.equal(response.status, 200);

  const updated = await response.json();
  assert.equal(updated.restaurant.id, created.restaurant.id);
  assert.equal(updated.restaurant.name, "Cafe One Updated");
  assert.equal(updated.progress.current_step, "readiness");
  assert.equal(groups.size, 1);

  currentUser = "owner-b";

  response = await handlers.GET();
  assert.equal((await response.json()).restaurant, null);

  response = await put(valid("Cafe Two"));
  assert.equal(response.status, 200);
  assert.notEqual(
    (await response.json()).restaurant.id,
    created.restaurant.id,
  );
  assert.equal(groups.size, 2);

  failLookup = true;

  response = await handlers.GET();
  assert.equal(response.status, 503);
  assert.doesNotMatch(
    await response.text(),
    /private database error/,
  );
  assert.equal(internalErrors.length, 1);

  failLookup = false;
  currentUser = "owner-a";

  response = await handlers.GET();
  assert.equal(
    (await response.json()).restaurant.name,
    "Cafe One Updated",
  );

  console.log("PASS: Anonymous onboarding requests denied");
  console.log("PASS: Invalid and oversized requests rejected");
  console.log("PASS: Forged owner field rejected");
  console.log("PASS: Restaurant creation and saved progress");
  console.log("PASS: Editing does not reset progress");
  console.log("PASS: Different owners isolated in mocked API");
  console.log("PASS: Database failures return sanitized 503");
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
