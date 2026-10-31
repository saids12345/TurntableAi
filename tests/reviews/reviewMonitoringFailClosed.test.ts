import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/app/(pro)/reviews/page.tsx", "utf8");

for (const forbidden of [
  "INITIAL_REVIEWS",
  "Using fallback review data",
  "mergedFallback",
  "rev_1",
  "Sarah M.",
]) {
  assert.equal(source.includes(forbidden), false, `Demo fallback still present: ${forbidden}`);
}

assert.ok(source.includes("useState<ReviewItem[]>([])") );
assert.ok(source.includes('useState<string>("")'));
assert.ok(source.includes("if (!Array.isArray(reviewsJson.reviews) || !Array.isArray(workflowJson.items))"));
assert.ok(source.includes("setReviews(sorted)"));
assert.ok(source.includes("type LiveReviewRow = ReviewItem;"));
assert.ok(source.includes("Malformed review records"));
assert.ok(source.includes("setReviews([])"));
assert.ok(source.includes('setSelectedId("")'));
assert.ok(source.includes("Review data is temporarily unavailable. No verified reviews can be displayed."));
assert.ok(source.includes("!liveLoading && !liveError && ("));
assert.ok(source.includes("No verified reviews available yet."));
assert.ok(source.includes("if (liveLoading || liveError || !usingLiveData) return false;"));
assert.ok(source.indexOf("if (!ok) return;\n\n    updateSelectedReviewLocal({ status });") >= 0);

console.log("✓ Reviews fail-closed regression checks passed");
