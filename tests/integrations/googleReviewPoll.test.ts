import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

type Review = {
  reviewId: string;
  updateTime: string;
  comment: string;
  starRating: "FIVE";
};

const reviews: Review[] = [
  { reviewId: "first", updateTime: "2026-10-10T01:00:00Z", comment: "Great!", starRating: "FIVE" },
  { reviewId: "second", updateTime: "2026-10-10T02:00:00Z", comment: "Excellent!", starRating: "FIVE" },
];
const path = "src/app/api/google/poll/route.ts";
const js = ts.transpileModule(readFileSync(path, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function harness(opts: {
  saveError?: boolean;
  emailError?: boolean;
  checkpointError?: boolean;
  draftError?: boolean;
  profile?: boolean;
  pages?: boolean;
  noConnections?: boolean;
  noEmailProvider?: boolean;
  sameTimestamp?: boolean;
} = {}) {
  const operations: string[] = [];
  const route = {} as { POST: (req: Request) => Promise<Response> };
  const checkpoints: Record<string, string>[] = [];
  const pageItems = opts.sameTimestamp
    ? [reviews[0], { ...reviews[1], updateTime: reviews[0].updateTime }]
    : reviews;
  let page = 0;
  const deps: Record<string, unknown> = {
    "next/server": { NextResponse: { json: (b: unknown, options?: ResponseInit) => Response.json(b, options) } },
    "@/lib/store": {
      getAllGoogleConns: async () => opts.noConnections ? [] : [{
        userId: "user-1", email: "owner@example.com",
        tokens: { access_token: "google-token" },
        lastSeenByLocation: opts.pages ? { "locations/1": "2026-10-09T00:00:00Z" } : {},
        locations: [{ name: "locations/1", title: "Test Cafe" }],
      }],
      upsertReviews: async (rows: unknown[]) => {
        operations.push("save:" + rows.length);
        if (opts.saveError) throw new Error("simulated write failed");
        return { upserted: rows.length };
      },
      setLastSeen: async (_user: string, value: Record<string, string>) => {
        operations.push("checkpoint");
        if (opts.checkpointError) throw new Error("simulated checkpoint failed");
        checkpoints.push(value);
      },
    },
    "@/lib/google": {
      listReviews: async (_token: string, _loc: string, pageToken?: string) => {
        operations.push("fetch:" + (pageToken ?? "first"));
        if (!opts.pages) return { reviews: pageItems };
        page++;
        return page === 1
          ? { reviews: [pageItems[1]], nextPageToken: "page2" }
          : { reviews: [pageItems[0]] };
      },
      refreshToken: async () => ({ access_token: "refreshed" }),
      starToNumber: () => 5,
    },
    "@/lib/email": {
      sendReviewEmail: async () => {
        operations.push("email");
        if (opts.emailError) throw new Error("simulated email failure");
        return opts.noEmailProvider ? { id: "dev-fallback" } : { data: { id: "email-1" }, error: null };
      },
    },
    "@/lib/reviewReplyGenerator": {
      generateReviewReply: async (input: {styleGuide?: string}) => {
        operations.push("draft");
        assert.equal(input.styleGuide, "Cafe brand voice");
        if (opts.draftError) throw new Error("simulated drafting error");
        return "Thank you!";
      },
    },
    "@/lib/supabaseAdmin": {
      getSupabaseAdmin: () => ({ from: (table: string) => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => {
          if (table === "profiles") return { data: { is_pro: opts.profile !== false, plan: "pro", stripe_subscription_status: "active" }, error: null };
          if (table === "voice_profiles") return { data: { style_guide: "Cafe brand voice" }, error: null };
          throw new Error("Unexpected table " + table);
        } }) }),
      }) }),
    },
    "@/lib/plans": {
      hasProAccess: ({isPro}: {isPro:boolean}) => isPro,
    },
  };
  runInNewContext(js, {
    exports: route,
    require: (name: string) => {
      assert.ok(Object.hasOwn(deps, name), "Unknown dependency: " + name);
      return deps[name];
    },
    process: { env: { CRON_SECRET: "example-secret" } },
    console: { error() {}, warn() {}, log() {} },
    Response,
    Set,
    Map,
    String,
    Array,
  }, { filename: path });
  const call = async (secret = "example-secret") => {
    const response = await route.POST(new Request("https://turntableai.net/api/google/poll", {
      method: "POST", headers: { "x-cron-secret": secret },
    }));
    return { status: response.status, body: await response.json(), operations, checkpoints };
  };
  return { call };
}

async function main() {
  const noSecret = await harness().call("wrong");
  assert.equal(noSecret.status, 401);
  assert.equal(noSecret.operations.length, 0);

  const empty = await harness({ noConnections: true }).call();
  assert.equal(empty.status, 200);
  assert.equal(empty.body.sent, 0);

  for (const options of [{}, { pages: true }, { sameTimestamp: true }]) {
    const state = await harness(options).call();
    assert.equal(state.status, 200);
    assert.equal(state.body.ok, true);
    assert.equal(state.body.sent, 2);
    assert.equal(state.body.saved, 2);
    assert.equal(state.body.failedLocations, 0);
    assert.equal(state.operations.filter((x: string) => x === "email").length, 2);
    assert.equal(state.operations.filter((x: string) => x.startsWith("fetch:")).length,
      options.pages ? 2 : 1);
    assert.ok(state.operations.indexOf("save:2") < state.operations.indexOf("email"));
    assert.equal(state.checkpoints.at(-1)?.["locations/1"], reviews[1].updateTime === reviews[0].updateTime || options.sameTimestamp ? reviews[0].updateTime : reviews[1].updateTime);
  }

  for (const options of [
    { saveError: true },
    { emailError: true },
    { checkpointError: true },
    { noEmailProvider: true },
  ]) {
    const state = await harness(options).call();
    assert.equal(state.status, 500, JSON.stringify(options));
    assert.equal(state.body.ok, false, JSON.stringify(options));
    assert.equal(state.body.failedLocations, 1, JSON.stringify(options));
    if (options.saveError) {
      assert.equal(state.operations.includes("email"), false);
      assert.equal(state.checkpoints.length, 0);
    }
    if (options.emailError || options.noEmailProvider) {
      assert.equal(state.checkpoints.length, 0);
    }
  }

  const noDraft = await harness({ draftError: true }).call();
  assert.equal(noDraft.status, 200);
  assert.equal(noDraft.body.sent, 2);
  assert.equal(noDraft.body.draftFailures, 2);

  const expired = await harness({ profile: false }).call();
  assert.equal(expired.status, 200);
  assert.equal(expired.operations.includes("draft"), false);
  assert.equal(expired.body.sent, 2);

  console.log("✓ Google review polling persistence, paging, alerts and draft isolation regression test passed");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
