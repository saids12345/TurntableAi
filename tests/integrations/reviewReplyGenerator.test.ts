import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const path = "src/lib/reviewReplyGenerator.ts";
const js = ts.transpileModule(readFileSync(path, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const output = {} as { generateReviewReply: (input: Record<string, unknown>) => Promise<string> };
const prompts: string[] = [];
const fakeOpenAI = class {
  responses = { create: async (input: { model: string; input: string }) => {
    assert.equal(input.model, "gpt-4.1-mini");
    prompts.push(input.input);
    return { output_text: "Thank you for visiting!" };
  } };
};
runInNewContext(js, {
  exports: output,
  require: (name: string) => {
    if (name === "server-only") return {};
    if (name === "openai") return { default: fakeOpenAI };
    throw new Error("Unexpected dependency: " + name);
  },
  process: { env: { OPENAI_API_KEY: "test-only-key" } },
});
(async () => {
  const reply = await output.generateReviewReply({
    reviewText: "Our order was delayed",
    rating: 2,
    platform: "Google",
    styleGuide: "No exclamation marks",
  });
  assert.equal(reply, "Thank you for visiting!");
  assert.match(prompts[0], /Our order was delayed/);
  assert.match(prompts[0], /No exclamation marks/);
  console.log("✓ Shared review reply generator regression test passed");
})().catch((error) => { console.error(error); process.exitCode = 1; });
