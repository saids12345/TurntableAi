import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import * as ts from "typescript";
import { hasProAccess } from "../../src/lib/plans";

function loadModule(
  path: string,
  imports: Record<string, unknown>,
) {
  const exports: Record<string, any> = {};
  const module = { exports };

  const compiled = ts.transpileModule(
    readFileSync(path, "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;

  runInNewContext(compiled, {
    module,
    exports,
    Response,
    require(name: string) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(imports, name),
        `Unexpected dependency: ${name}`,
      );
      return imports[name];
    },
  }, { filename: path, timeout: 5000 });

  return module.exports;
}

let signedIn = false;
let profileError: { message: string } | null = null;
let profile: Record<string, unknown> | null = null;

const guard = loadModule("src/lib/requirePro.ts", {
  "@/lib/plans": { hasProAccess },
  "@/lib/supabaseServer": {
    async getSupabaseServerClient() {
      const query = {
        select() { return query; },
        eq() { return query; },
        async maybeSingle() {
          return { data: profile, error: profileError };
        },
      };

      return {
        auth: {
          async getUser() {
            return {
              data: {
                user: signedIn ? { id: "test_user" } : null,
              },
            };
          },
        },
        from(table: string) {
          assert.equal(table, "profiles");
          return query;
        },
      };
    },
  },
});

const voice = loadModule(
  "src/app/api/voice-profile/route.ts",
  {
    "next/server": {
      NextResponse: {
        json(body: unknown, options?: { status?: number }) {
          return Response.json(body, {
            status: options?.status ?? 200,
          });
        },
      },
    },
    "@/lib/supabaseRoute": {
      getSupabaseRouteClient() {
        throw new Error("Unauthorized request reached data access");
      },
    },
    "@/lib/requirePro": {
      requireProForApi: guard.requireProForApi,
    },
  },
);

async function verify(
  status: string | null,
  isPro: boolean,
  authenticated: boolean,
  expected: number | "allow",
) {
  signedIn = authenticated;
  profileError = null;

  profile = {
    is_pro: isPro,
    plan: isPro ? "pro" : "free",
    stripe_subscription_status: status,
  };

  const result = await guard.requireProForApi();

  if (expected === "allow") {
    assert.equal(result instanceof Response, false);
    assert.equal(result.user.id, "test_user");
    return;
  }

  assert.ok(result instanceof Response);
  assert.equal(result.status, expected);

  const request = new Request(
    "https://example.invalid/api/voice-profile",
  );

  const getResponse = await voice.GET(request);
  assert.ok(getResponse instanceof Response);
  assert.equal(getResponse.status, expected);

  const postResponse = await voice.POST(
    new Request(request.url, {
      method: "POST",
      body: JSON.stringify({ styleGuide: "test" }),
    }),
  );

  assert.ok(postResponse instanceof Response);
  assert.equal(postResponse.status, expected);
}

function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap(entry => {
      const path = join(dir, entry.name);

      if (entry.isDirectory()) return routeFiles(path);

      return entry.isFile() && entry.name === "route.ts"
        ? [path]
        : [];
    });
}

async function run() {
  await verify(null, false, false, 401);
  await verify("canceled", true, true, 402);
  await verify("past_due", true, true, 402);
  await verify(null, false, true, 402);
  await verify("trialing", true, true, "allow");
  await verify("active", true, true, "allow");
  await verify(null, true, true, "allow");

  // Database outages must fail closed without exposing internals.
  signedIn = true;
  profileError = { message: "private-database-error" };

  const dbResult = await guard.requireProForApi();
  assert.ok(dbResult instanceof Response);
  assert.equal(dbResult.status, 503);
  assert.doesNotMatch(
    await dbResult.text(),
    /private-database-error/,
  );

  const voiceDbResult = await voice.GET(
    new Request("https://example.invalid/api/voice-profile"),
  );
  assert.equal(voiceDbResult.status, 503);

  profileError = null;

  let routes = 0;
  let calls = 0;

  for (const path of routeFiles("src/app/api")) {
    const source = readFileSync(path, "utf8");

    const matches = [
      ...source.matchAll(/await requireProForApi\(\);/g),
    ];

    if (!matches.length) continue;

    routes++;

    for (const match of matches) {
      calls++;

      const remainder = source.slice(
        (match.index ?? 0) + match[0].length,
      );

      const oauthCallback =
        path === "src/app/api/google/auth/callback/route.ts" ||
        path === "src/app/api/square/auth/callback/route.ts";

      assert.match(
        remainder,
        oauthCallback
          ? /^\s*if \(proAccessGate instanceof Response\) throw proAccessGate;/
          : /^\s*if \(proAccessGate instanceof Response\) return proAccessGate;/,
        `Missing denial handling in ${path}`,
      );

      if (oauthCallback) {
        assert.match(
          source,
          /catch\s*\([^)]*\)\s*\{[\s\S]*?instanceof Response/,
          `Missing OAuth callback error handler: ${path}`,
        );
      }
    }
  }

  assert.equal(routes, 41);
  assert.equal(calls, 49);

  console.log("PASS: 503 database errors fail closed");
  console.log("PASS: OAuth callback error handling preserved");
  console.log("PASS: 401 unauthenticated");
  console.log("PASS: 402 canceled and unpaid");
  console.log("PASS: active and trialing access");
  console.log("PASS: 41 routes / 49 guard calls");
  console.log("PASS: Voice Profile GET and POST denial");
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
