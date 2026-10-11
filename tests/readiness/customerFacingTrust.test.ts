import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file: string) => readFileSync(file, "utf8");
const marketing = read("src/components/MarketingHome.tsx");
const privacy = read("src/app/privacy/page.tsx");
const terms = read("src/app/terms/page.tsx");
const deletion = read("src/app/data-deletion/page.tsx");
const schedule = JSON.parse(read("vercel.json")) as {
  crons: { path: string; schedule: string }[];
};

// No claims of instant / real-time review detection when ingestion is scheduled.
for (const phrase of ["in real time", "instantly", "continuously analyzes", "replies in seconds"]) {
  assert.ok(!marketing.toLowerCase().includes(phrase.toLowerCase()), `Overclaim: ${phrase}`);
}
assert.match(marketing, /Google Business Profile review checks are scheduled daily/);
assert.match(marketing, /Square sales trends/);
assert.match(marketing, /One Restaurant or Many/);
assert.match(marketing, /Available data and features depend on your connections/);
assert.match(marketing, /AI-drafted and editable/);
assert.ok(!marketing.includes("Google, Yelp, email alerts"), "Do not imply live Yelp integration");

// Daily scheduled review checks really exist in configuration (09:00 UTC).
assert.ok(schedule.crons.some(job =>
  job.path === "/api/cron/gmail-yelp" && job.schedule === "0 9 * * *"
));

for (const [body, page] of [
  [privacy, "privacy"], [terms, "terms"], [deletion, "data-deletion"],
] as const) {
  assert.ok(body.includes(`https://turntableai.net/${page}`), page);
  assert.ok(!body.includes(`https://app.turntableai.net/${page}`), page);
}
assert.ok(!privacy.includes("123 Example St"));
assert.ok(privacy.includes("privacy@turntableai.net"));
assert.ok(!terms.includes("On disconnection or verified deletion request, we remove stored Google tokens and associated review records"));
assert.ok(terms.includes("previously collected reviews remain until you separately request deletion"));
assert.ok(deletion.includes("Previously collected reviews remain in your account"));

console.log("✓ Customer-facing claims and policy consistency regression test passed");
console.log("NOTE: Governing law, real postal address, effective dates and legal review remain unverified.");
