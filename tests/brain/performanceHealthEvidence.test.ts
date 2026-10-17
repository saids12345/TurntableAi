import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const api = readFileSync("src/app/api/operator-snapshot/performance/route.ts", "utf8");
const page = readFileSync("src/app/(pro)/sales/page.tsx", "utf8");

function functionSource(name: string): string {
  const marker = `function ${name}(`;
  const start = api.indexOf(marker);
  assert.notEqual(start, -1, `Missing function: ${name}`);
  assert.equal(api.indexOf(marker, start + marker.length), -1, `Duplicate function: ${name}`);
  const end = api.indexOf("\n}\n", start);
  assert.notEqual(end, -1, `Unterminated function: ${name}`);
  return api.slice(start, end + 2);
}

const fragment = [
  'type HealthStatus = "healthy" | "watch" | "risk" | "unknown";',
  functionSource("pctAtMost"),
  functionSource("pctBelow"),
  functionSource("measuredAtLeast"),
  functionSource("ratingBelow"),
  functionSource("deriveHealth"),
  "exports.deriveHealth = deriveHealth;",
].join("\n\n");

const compiled = ts.transpileModule(fragment, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

const exported = {} as { deriveHealth?: (values: {
  revenueDeltaPct: number | null;
  laborPct: number | null;
  avgRating: number | null;
}) => string };

runInNewContext(compiled, { exports: exported });
assert.ok(exported.deriveHealth);
const health = exported.deriveHealth;

assert.equal(health({ revenueDeltaPct: null, laborPct: null, avgRating: null }), "unknown");
assert.equal(health({ revenueDeltaPct: 0, laborPct: null, avgRating: 4.8 }), "unknown");
assert.equal(health({ revenueDeltaPct: null, laborPct: 19, avgRating: 4.8 }), "unknown");
assert.equal(health({ revenueDeltaPct: 0, laborPct: 19, avgRating: null }), "unknown");
assert.equal(health({ revenueDeltaPct: 0, laborPct: 19, avgRating: 4.8 }), "healthy");
assert.equal(health({ revenueDeltaPct: -10, laborPct: null, avgRating: null }), "risk");
assert.equal(health({ revenueDeltaPct: null, laborPct: 26, avgRating: null }), "risk");
assert.equal(health({ revenueDeltaPct: null, laborPct: null, avgRating: 3.2 }), "risk");
assert.equal(health({ revenueDeltaPct: -2, laborPct: null, avgRating: null }), "watch");
assert.equal(health({ revenueDeltaPct: null, laborPct: 23, avgRating: null }), "watch");

assert.ok(page.includes('label: "Insufficient Evidence"'));
assert.ok(page.includes('Insufficient evidence to assess operational risk.'));
assert.ok(page.includes('title="Recent Verified Performance Snapshot"'));
assert.ok(page.includes('unknown: 2, healthy: 3'));
assert.ok(api.includes('recommendedAction: health === "unknown" ? null : recommendedAction('));

console.log("✓ Performance insufficient-evidence health regression test passed");
