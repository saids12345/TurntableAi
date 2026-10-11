import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Compile the actual production modules while replacing only external storage.
const enginePath = "src/lib/outcomeEngine.ts";
const verifierPath = "src/lib/brain/outcomeVerification/decisionOutcomeVerifier.ts";
function compile(path: string) {
  return ts.transpileModule(readFileSync(path, "utf8"), {
    fileName: path,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}
const compiledEngine = compile(enginePath);
const compiledVerifier = compile(verifierPath);
const now = Date.now();
const day = 24 * 60 * 60 * 1000;
const at = (days: number) => new Date(now + days * day).toISOString();

type MetricValues = Partial<Record<
  "revenue" | "orders" | "avg_ticket" | "labor_pct" | "margin_pct" | "refunds",
  number | null
>>;
type Fixture = {
  name: string;
  before?: MetricValues;
  after?: MetricValues;
  beforeRatings?: Array<number | null>;
  afterRatings?: Array<number | null>;
  expectedScore: number | null;
  expectedMeasured: number;
  expectedBeforeIssues?: number | null;
  expectedAfterIssues?: number | null;
  expectedReviewIssueDelta?: number | null;
};
type Verification = {
  verified: boolean;
  verdict: string;
  eligibleForReasoning: boolean;
  outcomeScore: number | null;
};
type Evaluation = {
  status: string;
  outcomeScore: number | null;
  success: boolean | null;
  confidence: string;
  lessonStrength: string;
  reuseRecommended: boolean;
  summary: string;
  lesson: string;
  baseline: { revenue: number | null; reviewIssueCount: number | null };
  current: { revenue: number | null; reviewIssueCount: number | null };
  delta: Record<string, number | null>;
  evidence: {
    measuredFields: number;
    executedAt: string;
    outcomeVerification: Verification;
  };
};
type MemoryPayload = Record<string, unknown> & {
  outcome_score: number | null;
  success: boolean | null;
  evidence: { outcomeVerification: Verification };
};
type EngineResult = {
  evaluated: number;
  saved: number;
  results: Array<{
    saved: boolean;
    evaluation?: Evaluation;
    memory?: MemoryPayload & { id: string };
  }>;
};
type QueryResult = { data: unknown; error: null };
type Verifier = (input: {
  evaluation: Evaluation;
  expectedOutcome?: string;
  successMetric?: string;
  failureConditions?: string[];
}) => Verification;

const verifierExports = {} as { verifyDecisionOutcome: Verifier };
runInNewContext(compiledVerifier, {
  exports: verifierExports,
  require: (name: string) => { throw new Error(`Unexpected verifier dependency: ${name}`); },
}, { filename: verifierPath });
const verifyDecisionOutcome = verifierExports.verifyDecisionOutcome;
assert.equal(typeof verifyDecisionOutcome, "function");

function performanceRow(days: number, metrics: MetricValues) {
  return {
    id: `performance-${days}`,
    location_name: "Test restaurant",
    source_system: "square",
    source_record_id: `square-${days}`,
    ingested_at: at(days),
    captured_at: at(days),
    ...metrics,
  };
}
function reviewRows(days: number, ratings: Array<number | null> = []) {
  return ratings.map((rating, index) => ({
    id: `review-${days}-${index}`,
    location_name: "Test restaurant",
    rating,
    update_time: at(days),
  }));
}

function harness(fixture: Fixture, options: { persist: boolean; existing?: boolean }) {
  const tables: string[] = [];
  const writes: Array<{ operation: "insert" | "update"; payload: MemoryPayload }> = [];
  const performanceRows = [
    ...(fixture.before === undefined ? [] : [performanceRow(-6, fixture.before)]),
    ...(fixture.after === undefined ? [] : [performanceRow(-2, fixture.after)]),
  ];
  const reviews = [
    ...reviewRows(-6, fixture.beforeRatings),
    ...reviewRows(-2, fixture.afterRatings),
  ];
  const action = {
    id: "mature-action",
    user_id: "test-user",
    location_name: "Test restaurant",
    action_type: "traffic_reactivation",
    title: "Test outcome action",
    status: "executed",
    created_at: at(-7),
    updated_at: at(-5),
    recommended_payload: {
      cognitiveWorkflow: {
        expectedOutcome: "Increase revenue and orders",
        successMetric: "revenue and orders",
      },
    },
    source_signal: {},
  };
  const results: Record<string, QueryResult> = {
    auto_actions: { data: [action], error: null },
    performance_signal_history: { data: performanceRows, error: null },
    reviews: { data: reviews, error: null },
    operator_memory: {
      data: options.existing ? [{ id: "existing-memory" }] : [],
      error: null,
    },
  };

  class Query {
    payload?: MemoryPayload;
    constructor(readonly table: string) {
      tables.push(table);
      assert.ok(Object.hasOwn(results, table), `Unexpected table: ${table}`);
      if (!options.persist) {
        assert.notEqual(table, "operator_memory", "Preview must not read Operator Memory");
      }
    }
    select() { return this; }
    eq() { return this; }
    in() { return this; }
    gte() { return this; }
    order() { return this; }
    limit() { return this; }
    insert(payload: MemoryPayload) { return this.write("insert", payload); }
    update(payload: MemoryPayload) { return this.write("update", payload); }
    write(operation: "insert" | "update", payload: MemoryPayload) {
      assert.equal(this.table, "operator_memory");
      this.payload = payload;
      writes.push({ operation, payload });
      return this;
    }
    single() {
      return Promise.resolve({
        data: {
          id: options.existing ? "existing-memory" : "new-memory",
          ...this.payload,
        },
        error: null,
      });
    }
    then(resolve: (result: QueryResult) => unknown, reject?: (error: unknown) => unknown) {
      return Promise.resolve(results[this.table]).then(resolve, reject);
    }
  }

  const engine = {} as {
    evaluateRecentExecutedActions: (input: { userId: string; persist: boolean }) => Promise<EngineResult>;
  };
  const dependencies: Record<string, unknown> = {
    "@/lib/performanceSignalTrust": { TRUSTED_PERFORMANCE_SOURCES: ["square"] },
    "@/lib/supabaseRoute": { getSupabaseRouteClient: async () => ({
      from: (table: string) => new Query(table),
    }) },
    "@/lib/brain/outcomeVerification/decisionOutcomeVerifier": { verifyDecisionOutcome },
  };
  runInNewContext(compiledEngine, {
    exports: engine,
    require: (name: string) => {
      assert.ok(Object.hasOwn(dependencies, name), `Unexpected engine dependency: ${name}`);
      return dependencies[name];
    },
    console,
  }, { filename: enginePath });
  return { engine, tables, writes };
}

const fixtures: Fixture[] = [
  { name: "no performance or reviews", expectedScore: null, expectedMeasured: 0 },
  { name: "before-only revenue", before: { revenue: 100 }, expectedScore: null, expectedMeasured: 0 },
  { name: "after-only revenue", after: { revenue: 110 }, expectedScore: null, expectedMeasured: 0 },
  {
    name: "nonmatching before and after metrics",
    before: { revenue: 100 }, after: { orders: 10 },
    expectedScore: null, expectedMeasured: 0,
  },
  {
    name: "zero revenue denominator without usable comparison",
    before: { revenue: 0 }, after: { revenue: 100 },
    expectedScore: null, expectedMeasured: 0,
  },
  {
    name: "before-only rated reviews",
    beforeRatings: [2], expectedScore: null, expectedMeasured: 0,
    expectedBeforeIssues: 1, expectedAfterIssues: null, expectedReviewIssueDelta: null,
  },
  {
    name: "after-only rated reviews",
    afterRatings: [2], expectedScore: null, expectedMeasured: 0,
    expectedBeforeIssues: null, expectedAfterIssues: 1, expectedReviewIssueDelta: null,
  },
  {
    name: "unrated reviews in both windows",
    beforeRatings: [null], afterRatings: [null],
    expectedScore: null, expectedMeasured: 0,
    expectedBeforeIssues: null, expectedAfterIssues: null, expectedReviewIssueDelta: null,
  },
  {
    name: "one genuine revenue comparison plus unpaired other fields",
    before: { revenue: 100, orders: 10 },
    after: { revenue: 110, labor_pct: 20 },
    expectedScore: 73, expectedMeasured: 1,
  },
  {
    name: "neutral paired revenue is a real score of 50",
    before: { revenue: 100 }, after: { revenue: 100 },
    expectedScore: 50, expectedMeasured: 1,
  },
  {
    name: "zero refunds before and after count as real measurement",
    before: { refunds: 0 }, after: { refunds: 0 },
    expectedScore: 50, expectedMeasured: 1,
  },
  {
    name: "refund growth from a zero baseline uses absolute fallback",
    before: { refunds: 0 }, after: { refunds: 10 },
    expectedScore: 38, expectedMeasured: 1,
  },
  {
    name: "rated reviews with zero negative reviews keep genuine zeros",
    beforeRatings: [4], afterRatings: [4],
    expectedScore: 50, expectedMeasured: 2,
    expectedBeforeIssues: 0, expectedAfterIssues: 0, expectedReviewIssueDelta: 0,
  },
  {
    name: "missing after reviews never invent complaint improvement",
    before: { revenue: 100 }, after: { revenue: 100 },
    beforeRatings: [2], expectedScore: 50, expectedMeasured: 1,
    expectedBeforeIssues: 1, expectedAfterIssues: null, expectedReviewIssueDelta: null,
  },
  {
    name: "two real positive comparisons score without phantom review fields",
    before: { revenue: 100, orders: 10 }, after: { revenue: 120, orders: 12 },
    expectedScore: 100, expectedMeasured: 2,
  },
];

async function check(fixture: Fixture, options: { persist: boolean; existing?: boolean }) {
  const label = `${fixture.name}, persist=${options.persist}, existing=${!!options.existing}`;
  const state = harness(fixture, options);
  const result = await state.engine.evaluateRecentExecutedActions({
    userId: "test-user", persist: options.persist,
  });
  assert.equal(result.evaluated, 1, label);
  assert.equal(result.saved, options.persist ? 1 : 0, label);
  assert.equal(result.results.length, 1, label);
  const item = result.results[0];
  assert.equal(item.saved, options.persist, label);
  assert.ok(item.evaluation, label);
  const evaluation = item.evaluation;
  assert.equal(evaluation.outcomeScore, fixture.expectedScore, label);
  assert.equal(evaluation.evidence.measuredFields, fixture.expectedMeasured, label);
  assert.equal(evaluation.status, fixture.expectedMeasured >= 2 ? "measured" : "partial", label);
  assert.equal(evaluation.reuseRecommended,
    fixture.expectedScore !== null && fixture.expectedScore >= 65 && fixture.expectedMeasured >= 2, label);
  assert.equal(evaluation.evidence.outcomeVerification.outcomeScore, fixture.expectedScore, label);

  if (fixture.expectedBeforeIssues !== undefined) {
    assert.equal(evaluation.baseline.reviewIssueCount, fixture.expectedBeforeIssues, label);
  }
  if (fixture.expectedAfterIssues !== undefined) {
    assert.equal(evaluation.current.reviewIssueCount, fixture.expectedAfterIssues, label);
  }
  if (fixture.expectedReviewIssueDelta !== undefined) {
    assert.equal(evaluation.delta.reviewIssueDelta, fixture.expectedReviewIssueDelta, label);
  }
  if (fixture.expectedScore === null) {
    assert.equal(evaluation.success, null, label);
    assert.equal(evaluation.confidence, "low", label);
    assert.equal(evaluation.lessonStrength, "weak", label);
    assert.equal(evaluation.reuseRecommended, false, label);
    assert.match(evaluation.summary, /remains unscored/i, label);
    assert.match(evaluation.lesson, /not yet known/i, label);
    assert.equal(evaluation.evidence.outcomeVerification.verified, false, label);
    assert.equal(evaluation.evidence.outcomeVerification.verdict, "inconclusive", label);
    assert.equal(evaluation.evidence.outcomeVerification.eligibleForReasoning, false, label);
  }

  assert.equal(state.writes.length, options.persist ? 1 : 0, label);
  assert.equal(state.tables.includes("operator_memory"), options.persist, label);
  assert.equal(Object.hasOwn(item, "memory"), options.persist, label);
  if (options.persist) {
    const write = state.writes[0];
    assert.equal(write.operation, options.existing ? "update" : "insert", label);
    assert.equal(write.payload.source_action_id, "mature-action", label);
    assert.equal(write.payload.outcome_score, fixture.expectedScore, label);
    assert.equal(write.payload.success, evaluation.success, label);
    assert.equal(write.payload.evidence.outcomeVerification.outcomeScore, fixture.expectedScore, label);
    assert.equal(item.memory?.outcome_score, fixture.expectedScore, label);
    assert.equal(item.memory?.id, options.existing ? "existing-memory" : "new-memory", label);
  }
  return evaluation;
}

async function run() {
  let checks = 0;
  for (const fixture of fixtures) {
    await check(fixture, { persist: false });
    await check(fixture, { persist: true });
    checks += 2;
  }
  // An existing record must be updated, not duplicated, even when unscored.
  await check(fixtures[0], { persist: true, existing: true });
  await check(fixtures[fixtures.length - 1], { persist: true, existing: true });
  checks += 2;

  // Exercise the *real* verifier with intentionally misleading positive evidence.
  // A null score must fail closed even if all the other fields look convincing.
  const original = await check(fixtures[0], { persist: false });
  const misleading: Evaluation = {
    ...original,
    status: "measured",
    outcomeScore: null,
    success: true,
    delta: { ...original.delta, revenueDeltaPct: 25, ordersDeltaPct: 25 },
    evidence: { ...original.evidence, measuredFields: 7, executedAt: at(-5) },
  };
  const verification = verifyDecisionOutcome({
    evaluation: misleading,
    expectedOutcome: "Increase revenue and orders",
    successMetric: "revenue and orders",
  });
  assert.equal(verification.outcomeScore, null);
  assert.equal(verification.verified, false);
  assert.equal(verification.verdict, "inconclusive");
  assert.equal(verification.eligibleForReasoning, false);
  console.log(`✓ Outcome Engine insufficient-evidence regression test passed (${checks} persistence/preview cases and real-verifier null guard)`);
}

run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
