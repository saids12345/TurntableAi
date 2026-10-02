import assert from "node:assert/strict";

import {
  assertSquareProductionIngestionAllowed,
} from "@/lib/squareDailyIngestion";

const previousEnvironment =
  process.env.SQUARE_ENVIRONMENT;

try {
  process.env.SQUARE_ENVIRONMENT =
    "sandbox";

  assert.throws(
    () =>
      assertSquareProductionIngestionAllowed(
        "sandbox",
      ),
    /sandbox data is not allowed/,
  );

  assert.throws(
    () =>
      assertSquareProductionIngestionAllowed(
        "production",
      ),
    /requires SQUARE_ENVIRONMENT=production/,
  );

  process.env.SQUARE_ENVIRONMENT =
    "production";

  assert.doesNotThrow(
    () =>
      assertSquareProductionIngestionAllowed(
        "production",
      ),
  );

  console.log(
    "✓ Square production ingestion trust regression test passed",
  );
} finally {
  if (
    previousEnvironment === undefined
  ) {
    delete process.env
      .SQUARE_ENVIRONMENT;
  } else {
    process.env.SQUARE_ENVIRONMENT =
      previousEnvironment;
  }
}
