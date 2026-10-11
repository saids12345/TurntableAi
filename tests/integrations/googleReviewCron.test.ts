import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const routePath = "src/app/api/cron/gmail-yelp/route.ts";
const compiledRoute = ts.transpileModule(
  readFileSync(routePath, "utf8"),
  {
    fileName: routePath,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;

type Method = "GET" | "POST";
type Route = Record<Method, (req: Request) => Promise<Response>>;

type PollRequest = {
  url: string;
  method: string | undefined;
  secret: string | undefined;
  cache: string | undefined;
};

function harness(options: {
  secret?: string;
  pollFails?: boolean;
} = {}) {
  const secret = Object.hasOwn(options, "secret")
    ? options.secret
    : "example-cron-secret";
  const calls: PollRequest[] = [];
  const route = {} as Route;

  const dependencies: Record<string, unknown> = {
    "next/server": {
      NextResponse: {
        json: (body: unknown, init?: ResponseInit) =>
          Response.json(body, init),
      },
    },
    resend: {
      Resend: class {
        constructor() {
          throw new Error("No email should be sent by this test");
        }
      },
    },
  };

  runInNewContext(
    compiledRoute,
    {
      exports: route,
      require: (name: string) => {
        assert.ok(Object.hasOwn(dependencies, name), `Unexpected import: ${name}`);
        return dependencies[name];
      },
      process: {
        env: {
          CRON_SECRET: secret,
          NEXT_PUBLIC_SITE_URL: "https://turntableai.net",
          // Deliberately no Resend credentials; tests never send mail.
        },
      },
      URL,
      Response,
      fetch: async (url: string, init?: RequestInit) => {
        const headers = init?.headers as Record<string, string> | undefined;
        calls.push({
          url,
          method: init?.method,
          secret: headers?.["x-cron-secret"],
          cache: init?.cache,
        });
        if (options.pollFails) {
          throw new Error("simulated transient poll failure");
        }
        return Response.json({ ok: true, sent: 0, saved: 0 });
      },
      setTimeout: (fn: () => void) => {
        fn(); // Fast-forward retry delays in an isolated test harness.
        return 0;
      },
      console: { log() {}, warn() {}, error() {} },
    },
    { filename: routePath },
  );

  return { route, calls };
}

async function invoke(options: {
  method: Method;
  headers?: Record<string, string>;
  secret?: string;
  pollFails?: boolean;
  testMode?: boolean;
}) {
  const { route, calls } = harness(options);
  const request = new Request(
    `https://turntableai.net/api/cron/gmail-yelp${options.testMode ? "?test=1" : ""}`,
    { method: options.method, headers: options.headers },
  );
  const response = await route[options.method](request);
  return { status: response.status, body: await response.json(), calls };
}

async function main() {
  const goodGet = await invoke({
    method: "GET",
    headers: { authorization: "Bearer example-cron-secret" },
  });
  assert.equal(goodGet.status, 200);
  assert.equal(goodGet.body.ok, true);
  assert.equal(goodGet.body.saved, 0);
  assert.equal(goodGet.body.testMode, false);
  assert.equal(goodGet.calls.length, 1);
  assert.deepEqual(goodGet.calls[0], {
    url: "https://turntableai.net/api/google/poll",
    method: "POST",
    secret: "example-cron-secret",
    cache: "no-store",
  });

  const goodPost = await invoke({
    method: "POST",
    headers: { "x-cron-secret": "example-cron-secret" },
    testMode: true,
  });
  assert.equal(goodPost.status, 200);
  assert.equal(goodPost.body.testMode, true);
  assert.equal(goodPost.calls.length, 1);

  const denied = [
    { method: "GET", headers: {} },
    { method: "GET", headers: { authorization: "Bearer wrong" } },
    { method: "GET", headers: { "x-cron-secret": "example-cron-secret" } },
    { method: "POST", headers: {} },
    { method: "POST", headers: { "x-cron-secret": "wrong" } },
    { method: "POST", headers: { authorization: "Bearer example-cron-secret" } },
  ] as const;

  for (const candidate of denied) {
    const actual = await invoke(candidate);
    assert.equal(actual.status, 401, JSON.stringify(candidate));
    assert.equal(actual.body.ok, false, JSON.stringify(candidate));
    assert.equal(actual.calls.length, 0, "Unauthorized requests must not poll");
  }

  for (const method of ["GET", "POST"] as const) {
    const actual = await invoke({
      method,
      secret: "",
      headers: {
        authorization: "Bearer ",
        "x-cron-secret": "",
      },
    });
    assert.equal(actual.status, 401, `${method}: missing configured secret`);
    assert.equal(actual.calls.length, 0);
  }

  const failedPoll = await invoke({
    method: "GET",
    headers: { authorization: "Bearer example-cron-secret" },
    pollFails: true,
  });
  assert.equal(failedPoll.status, 500);
  assert.equal(failedPoll.body.ok, false);
  assert.equal(failedPoll.calls.length, 3, "Retry behavior must be preserved");

  console.log("✓ Google review cron GET/Bearer and legacy POST authorization regression test passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
