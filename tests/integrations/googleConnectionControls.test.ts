import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const path = "src/app/api/google/connection/route.ts";
const compiled = ts.transpileModule(readFileSync(path, "utf8"), {
  fileName: path,
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

type Mode = "read" | "update" | "delete";
type Method = "GET" | "PATCH" | "DELETE";
type TestOptions = {
  userId?: string | null;
  ownerId?: string;
  hasConnection?: boolean;
  revocationFails?: boolean;
  locationDeleteFails?: boolean;
  connectionReadFails?: boolean;
};

function harness(options: TestOptions = {}) {
  const ownerId = options.ownerId ?? "user-a";
  const state = {
    connected: options.hasConnection !== false,
    email: "old@restaurant.com",
    locationCount: 2,
    dbCalls: 0,
    events: [] as string[],
    revocationBodies: [] as string[],
  };
  class Query {
    filters: Record<string, unknown> = {};
    mode: Mode = "read";
    updateBody: Record<string, unknown> | null = null;
    selected = "";
    constructor(readonly table: string) { state.dbCalls++; }
    select(columns: string) { this.selected = columns; return this; }
    eq(key: string, value: unknown) { this.filters[key] = value; return this; }
    update(payload: Record<string, unknown>) { this.mode = "update"; this.updateBody = payload; return this; }
    delete() { this.mode = "delete"; return this; }
    maybeSingle() { return Promise.resolve(this.execute()); }
    then(onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
      return Promise.resolve(this.execute()).then(onFulfilled, onRejected);
    }
    execute() {
      if (this.table === "review_connections") {
        const match = state.connected && this.filters.user_id === ownerId &&
          this.filters.provider === "google" &&
          (this.filters.id === undefined || this.filters.id === "connection-1");
        if (this.mode === "read") {
          if (options.connectionReadFails) return { data: null, error: new Error("private SQL detail") };
          if (!match) return { data: null, error: null };
          return { data: {
            id: "connection-1", email: state.email, account_name: "Cafe Group",
            tokens: { refresh_token: "v1.encrypted", access_token: "v1.encrypted" },
          }, error: null };
        }
        if (this.mode === "update") {
          if (match) state.email = String(this.updateBody?.email);
          state.events.push("update-connection");
          return { data: match ? { email: state.email } : null, error: null };
        }
        if (this.mode === "delete") {
          if (match) state.connected = false;
          state.events.push("delete-connection");
          return { data: null, error: null };
        }
      }
      if (this.table === "review_locations") {
        if (this.mode === "delete") {
          state.events.push("delete-locations");
          if (options.locationDeleteFails) return { data: null, error: new Error("child delete failed") };
          state.locationCount = 0;
          return { data: null, error: null };
        }
        return { count: state.locationCount, error: null };
      }
      throw new Error(`Unexpected table: ${this.table}`);
    }
  }
  const routeExports = {} as Record<Method, (request?: Request) => Promise<Response>>;
  const requires: Record<string, unknown> = {
    "next/server": { NextResponse: { json: (obj: unknown, opts?: ResponseInit) => Response.json(obj, opts) } },
    "@/lib/supabaseServer": {
      getSupabaseServerClient: async () => ({
        auth: { getUser: async () => ({
          data: { user: options.userId === null ? null : { id: options.userId ?? "user-a" } },
          error: null,
        }) },
      }),
    },
    "@/lib/supabaseAdmin": { getSupabaseAdmin: () => ({ from: (table: string) => new Query(table) }) },
    "@/lib/integrationTokenCrypto": { decryptIntegrationToken: (_: string) => "decoded-google-refresh-token" },
  };
  runInNewContext(compiled, {
    exports: routeExports,
    require: (id: string) => {
      assert.ok(Object.hasOwn(requires, id), `Unknown dependency ${id}`);
      return requires[id];
    },
    Response,
    fetch: async (url: string, args: RequestInit) => {
      assert.equal(url, "https://oauth2.googleapis.com/revoke");
      state.revocationBodies.push(String(args.body));
      return new Response(null, { status: options.revocationFails ? 500 : 200 });
    },
    URLSearchParams,
    Date,
    console: { error: () => {} },
  }, { filename: path });
  return { route: routeExports, state };
}

async function request(
  route: Record<Method, (req?: Request) => Promise<Response>>,
  method: Method,
  body?: unknown,
) {
  const response = await route[method](body === undefined ? undefined : new Request(
    "http://localhost/api/google/connection",
    { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
  ));
  return { status: response.status, json: await response.json() as Record<string, unknown> };
}

async function run() {
  for (const method of ["GET", "PATCH", "DELETE"] as const) {
    const state = harness({ userId: null });
    const actual = await request(state.route, method,
      method === "PATCH" ? { alertEmail: "new@restaurant.com" } : undefined);
    assert.equal(actual.status, 401, `unauthenticated ${method}`);
    assert.equal(state.state.dbCalls, 0, `unauthenticated ${method} must not query database`);
  }

  const connected = harness();
  const status = await request(connected.route, "GET");
  assert.equal(status.status, 200);
  assert.equal(status.json.connected, true);
  assert.equal(status.json.locationCount, 2);
  assert.equal(status.json.alertEmail, "old@restaurant.com");
  assert.equal(status.json.accountName, "Cafe Group");
  assert.equal(JSON.stringify(status.json).includes("token"), false, "tokens must not be leaked");

  const outsider = harness({ userId: "user-b" });
  assert.equal((await request(outsider.route, "GET")).json.connected, false);
  assert.equal((await request(outsider.route, "PATCH", { alertEmail: "other@restaurant.com" })).status, 404);
  assert.equal(outsider.state.email, "old@restaurant.com");
  assert.equal((await request(outsider.route, "DELETE")).json.disconnected, false);
  assert.equal(outsider.state.connected, true, "other owner's connection must remain intact");

  const missing = harness({ hasConnection: false });
  assert.equal((await request(missing.route, "GET")).json.locationCount, 0);
  assert.equal((await request(missing.route, "DELETE")).json.revocation, "not_needed");

  const saved = harness();
  for (const value of [null, "", "bad", "foo@", " bad@domain.com", "a".repeat(256)+"@example.com"]) {
    const result = await request(saved.route, "PATCH", { alertEmail: value });
    assert.equal(result.status, 400, String(value));
  }
  const update = await request(saved.route, "PATCH", { alertEmail: "team@restaurant.com" });
  assert.equal(update.status, 200);
  assert.equal(update.json.alertEmail, "team@restaurant.com");
  assert.equal(saved.state.email, "team@restaurant.com");

  const disconnected = harness();
  const removed = await request(disconnected.route, "DELETE");
  assert.equal(removed.status, 200);
  assert.equal(removed.json.disconnected, true);
  assert.equal(removed.json.revocation, "confirmed");
  assert.equal(disconnected.state.connected, false);
  assert.deepEqual(disconnected.state.events, ["delete-locations", "delete-connection"]);
  assert.equal(disconnected.state.revocationBodies.length, 1);
  assert.match(disconnected.state.revocationBodies[0], /decoded-google-refresh-token/);
  assert.equal(disconnected.state.events.includes("delete-reviews"), false);

  const uncertain = harness({ revocationFails: true });
  const uncertainResult = await request(uncertain.route, "DELETE");
  assert.equal(uncertainResult.status, 200);
  assert.equal(uncertainResult.json.revocation, "unconfirmed");
  assert.equal(uncertain.state.connected, false);

  const failedChild = harness({ locationDeleteFails: true });
  const failedDelete = await request(failedChild.route, "DELETE");
  assert.equal(failedDelete.status, 500);
  assert.deepEqual(failedChild.state.events, ["delete-locations"]);
  assert.equal(failedChild.state.connected, true);
  assert.equal(failedChild.state.revocationBodies.length, 0);
  assert.equal(JSON.stringify(failedDelete.json).includes("child delete"), false);

  const failedRead = harness({ connectionReadFails: true });
  assert.equal((await request(failedRead.route, "GET")).status, 500);

  const ui = readFileSync("src/app/integrations/page.tsx", "utf8");
  const store = readFileSync("src/lib/store.ts", "utf8");
  const privacy = readFileSync("src/app/privacy/page.tsx", "utf8");
  assert.ok(ui.includes('fetch("/api/google/connection"'));
  assert.ok(ui.includes('method: "PATCH"'));
  assert.ok(ui.includes('method: "DELETE"'));
  assert.ok(!ui.includes("/api/google/poll"), "broken manual poll button must be gone");
  assert.ok(!ui.includes("owner@example.com"), "placeholder owner must not be shown as saved");
  assert.match(store, /existing\.data\.email \|\| input\.email/);
  assert.match(store, /input\.lastSeenByLocation \?\? existing\.data\.last_seen_by_location \?\? \{\}/);
  assert.ok(privacy.includes("Previously collected review records remain"));
  const callback = readFileSync("src/app/api/google/auth/callback/route.ts", "utf8");
  assert.ok(callback.includes("google_account_email_required"));
  assert.ok(!callback.includes("owner@example.com"));
  console.log("✓ Google connection ownership, alert settings, disconnect and UI regression test passed");
}

run().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
