import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const path = "src/lib/google.ts";
const googleApi = {} as { googleAuthUrl: (state: string) => string };
const js = ts.transpileModule(readFileSync(path, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
runInNewContext(js, {
  exports: googleApi,
  process: { env: {
    GOOGLE_INTEGRATIONS_CLIENT_ID: "test-id",
    GOOGLE_INTEGRATIONS_CLIENT_SECRET: "test-secret",
    GOOGLE_INTEGRATIONS_REDIRECT: "https://turntableai.net/api/google/auth/callback",
  } },
  URLSearchParams,
});
const url = new URL(googleApi.googleAuthUrl("test-state"));
const scopes = (url.searchParams.get("scope") ?? "").split(" ");
assert.ok(scopes.includes("https://www.googleapis.com/auth/business.manage"));
assert.ok(!scopes.some((scope) => scope.includes("gmail")));
assert.equal(url.searchParams.get("include_granted_scopes"), "false");
assert.equal(url.searchParams.get("state"), "test-state");
console.log("✓ Google Business Profile least-privilege scope regression test passed");
