import assert from "node:assert/strict";
import {
  readFileSync,
} from "node:fs";

const routeExpectations = [
  {
    path:
      "src/app/api/ai-kernel/run/route.ts",
    publicError:
      "AI Kernel failed",
  },
  {
    path:
      "src/app/api/planning-engine/run/route.ts",
    publicError:
      "Planning engine failed",
  },
  {
    path:
      "src/app/api/causal-engine/run/route.ts",
    publicError:
      "Causal engine failed",
  },
  {
    path:
      "src/app/api/prediction-engine/run/route.ts",
    publicError:
      "Prediction engine failed",
  },
  {
    path:
      "src/app/api/world-model/run/route.ts",
    publicError:
      "World model failed",
  },
  {
    path:
      "src/app/api/executive-ai/run/route.ts",
    publicError:
      "Executive AI failed",
  },
  {
    path:
      "src/app/api/execution-engine/run/route.ts",
    publicError:
      "Execution Engine failed",
  },
];

for (
  const {
    path,
    publicError,
  } of routeExpectations
) {
  const source =
    readFileSync(
      path,
      "utf8",
    );

  assert.equal(
    source.includes(
      "authError.message",
    ),
    false,
    `${path} must not expose authError.message`,
  );

  assert.equal(
    source.includes(
      "${error.message}",
    ),
    false,
    `${path} must not expose error.message`,
  );

  assert.equal(
    source.includes(
      'error: "Authentication failed"',
    ),
    true,
    `${path} must use a sanitized authentication error`,
  );

  assert.equal(
    source.includes(
      `error: "${publicError}"`,
    ),
    true,
    `${path} must use its sanitized server error`,
  );

  assert.equal(
    source.includes(
      "console.error(",
    ),
    true,
    `${path} must retain server-side error logging`,
  );
}

console.log(
  "✓ Brain API error sanitization regression test passed",
);
