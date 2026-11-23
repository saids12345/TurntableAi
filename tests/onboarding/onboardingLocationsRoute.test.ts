import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as ts from "typescript";
import {
  isLocationId,
  parseLocationDetails,
} from "../../src/lib/onboardingLocationInput";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const GROUP_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const GROUP_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const LOCATION_A = "00000000-0000-4000-8000-000000000001";
const LOCATION_B = "00000000-0000-4000-8000-000000000002";

let user: string | null = null;
let failLookup = false;
let nextId = 3;

const groups: Record<string, { id: string; owner_user_id: string; expected_location_count: number }> = {
  [A]: { id: GROUP_A, owner_user_id: A, expected_location_count: 3 },
  [B]: { id: GROUP_B, owner_user_id: B, expected_location_count: 2 },
};
const locations: Record<string, any>[] = [];
const errors: unknown[][] = [];

class Query {
  filters: Record<string, unknown> = {};
  operation: "read" | "insert" | "update" | "delete" = "read";
  payload: any = null;
  countRequested = false;

  constructor(public readonly table: string) {}

  select(_columns: string, options?: { count?: string; head?: boolean }) {
    this.countRequested = options?.count === "exact" && options?.head === true;
    return this;
  }
  eq(key: string, value: unknown) {
    this.filters[key] = value;
    return this;
  }
  order(_key: string, _options: { ascending: boolean }) {
    return this;
  }
  insert(value: any) {
    this.operation = "insert";
    this.payload = value;
    return this;
  }
  update(value: any) {
    this.operation = "update";
    this.payload = value;
    return this;
  }
  delete() {
    this.operation = "delete";
    return this;
  }
  async single() {
    return this.run("single");
  }
  async maybeSingle() {
    return this.run("maybeSingle");
  }
  then<T = unknown>(
    onSuccess: (value: any) => T,
    onError?: (error: unknown) => never,
  ) {
    return this.run("many").then(onSuccess, onError);
  }

  private async run(mode: "single" | "maybeSingle" | "many") {
    if (failLookup) {
      return { data: null, count: null, error: { message: "private-db-token" } };
    }

    if (this.table === "restaurant_groups") {
      assert.equal(this.filters.owner_user_id, user);
      assert.equal(mode, "maybeSingle");
      return { data: user ? (groups[user] ?? null) : null, error: null };
    }

    assert.equal(this.table, "restaurant_locations");
    const filtered = () => locations.filter(row =>
      Object.entries(this.filters).every(([key, value]) => row[key] === value)
    );

    if (this.operation === "read") {
      if (this.countRequested) {
        return { data: null, count: filtered().length, error: null };
      }
      const rows = filtered();
      return {
        data: mode === "many" ? rows : rows[0] ?? null,
        error: null,
      };
    }

    if (this.operation === "insert") {
      assert.ok(groups[user ?? ""]);
      assert.equal(this.payload.group_id, groups[user!].id);
      assert.equal(this.payload.id, undefined);
      assert.equal(this.payload.owner_user_id, undefined);
      const id = `00000000-0000-4000-8000-${String(nextId++).padStart(12, "0")}`;
      const row = {
        id,
        name: this.payload.name,
        city: this.payload.city,
        region: this.payload.region,
        country_code: this.payload.country_code,
        created_at: "2026-11-11T00:00:00Z",
        group_id: this.payload.group_id,
        is_active: true,
      };
      locations.push(row);
      return { data: row, error: null };
    }

    const matching = filtered();

    if (this.operation === "update") {
      for (const row of matching) Object.assign(row, this.payload);
      return { data: matching[0] ?? null, error: null };
    }

    const first = matching[0] ?? null;
    for (const row of matching) {
      locations.splice(locations.indexOf(row), 1);
    }
    return { data: first ? { id: first.id } : null, error: null };
  }
}

function mockSupabase() {
  return {
    auth: {
      async getUser() {
        return {
          data: { user: user ? { id: user } : null },
          error: null,
        };
      },
    },
    from(table: string) {
      return new Query(table);
    },
  };
}

const source = readFileSync("src/app/api/onboarding/locations/route.ts", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
  },
}).outputText;

const routeHandlers: Record<string, any> = {};
const imports: Record<string, unknown> = {
  "next/server": {
    NextResponse: {
      json: (body: unknown, init?: ResponseInit) => Response.json(body, init),
    },
  },
  "@/lib/supabaseServer": {
    getSupabaseServerClient: async () => mockSupabase(),
  },
  "@/lib/onboardingLocationInput": {
    isLocationId,
    parseLocationDetails,
  },
};

runInNewContext(
  compiled,
  {
    exports: routeHandlers,
    Response,
    console: { error: (...args: unknown[]) => errors.push(args) },
    require(name: string) {
      assert.ok(Object.hasOwn(imports, name), `Unexpected import: ${name}`);
      return imports[name];
    },
  },
  { filename: "src/app/api/onboarding/locations/route.ts", timeout: 5000 },
);

function request(method: "POST" | "PATCH" | "DELETE", body: unknown, contentType = "application/json") {
  return new Request("https://example.invalid/api/onboarding/locations", {
    method,
    headers: { "Content-Type": contentType },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function create(body: unknown, type?: string) {
  return routeHandlers.POST(request("POST", body, type));
}
function update(body: unknown) {
  return routeHandlers.PATCH(request("PATCH", body));
}
function remove(body: unknown) {
  return routeHandlers.DELETE(request("DELETE", body));
}

async function run() {
  assert.equal((await routeHandlers.GET()).status, 401);
  assert.equal((await create({ name: "Cafe" })).status, 401);
  assert.equal((await update({ id: LOCATION_A, name: "Cafe" })).status, 401);
  assert.equal((await remove({ id: LOCATION_A })).status, 401);

  user = "33333333-3333-4333-8333-333333333333";
  assert.equal((await routeHandlers.GET()).status, 409);
  assert.equal((await create({ name: "Cafe" })).status, 409);

  user = A;
  let response = await routeHandlers.GET();
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).locations, []);

  assert.equal((await create("{")).status, 400);
  assert.equal((await create("x".repeat(4200))).status, 413);
  assert.equal((await create({ name: "Cafe" }, "text/plain")).status, 415);
  assert.equal((await create({ name: "Cafe", group_id: GROUP_B })).status, 400);
  assert.equal((await update({ id: LOCATION_A, name: "Cafe", owner_user_id: B })).status, 400);
  assert.equal((await remove({ id: LOCATION_A, group_id: GROUP_B })).status, 400);

  response = await create({ name: "Downtown", city: "San Diego", region: "CA", countryCode: "us" });
  assert.equal(response.status, 201);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const created = (await response.json()).location;
  assert.equal(created.group_id, GROUP_A);
  assert.equal(created.country_code, "US");

  response = await update({ id: created.id, name: "Downtown Updated", city: "San Diego" });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).location.name, "Downtown Updated");

  response = await routeHandlers.GET();
  assert.equal(response.status, 200);
  const listed = await response.json();
  assert.equal(listed.expectedLocationCount, 3);
  assert.equal(listed.locations.length, 1);

  user = B;
  response = await routeHandlers.GET();
  assert.equal((await response.json()).locations.length, 0);

  assert.equal((await update({ id: created.id, name: "Attack" })).status, 404);
  assert.equal((await remove({ id: created.id })).status, 404);
  assert.equal(locations[0].name, "Downtown Updated");

  response = await create({ name: "Airport" });
  assert.equal(response.status, 201);
  assert.equal((await response.json()).location.group_id, GROUP_B);

  user = A;
  assert.equal((await remove({ id: created.id })).status, 200);
  assert.equal(locations.some(row => row.id === created.id && row.is_active === true), false);
  assert.equal(locations.find(row => row.id === created.id)?.is_active, false);

  const retained = [...locations];
  locations.length = 0;
  for (let i = 0; i < 100; i++) {
    locations.push({
      id: i === 0 ? LOCATION_A : `00000000-0000-4000-8000-${String(i + 10).padStart(12, "0")}`,
      group_id: GROUP_A,
      is_active: true,
      name: `Location ${i}`,
    });
  }
  assert.equal((await create({ name: "Too Many" })).status, 409);
  assert.equal(locations.length, 100);
  locations.length = 0;
  locations.push(...retained);

  failLookup = true;
  response = await routeHandlers.GET();
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /private-db-token/);
  assert.equal(errors.length, 1);

  console.log("PASS: Authentication and missing-group protection");
  console.log("PASS: JSON validation and forged ownership rejection");
  console.log("PASS: Create, list, edit, and reversibly archive locations");
  console.log("PASS: Cross-owner updates and deletion blocked");
  console.log("PASS: Maximum location count enforced");
  console.log("PASS: Database errors sanitized");
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
