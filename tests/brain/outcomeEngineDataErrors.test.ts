import assert from "node:assert/strict";
import { requireOutcomeEngineRows } from "../../src/lib/outcomeEngine";

type Row = { id: string };
const rows: Row[] = [{ id: "test-row" }];
const sources = ["reviews", "trusted performance"] as const;
const loggedErrors: unknown[][] = [];
const originalConsoleError = console.error;

console.error = (...args: unknown[]) => {
  loggedErrors.push(args);
};

try {
  for (const source of sources) {
    assert.strictEqual(
      requireOutcomeEngineRows<Row>({ data: rows, error: null }, source),
      rows,
      "Successful rows must be preserved.",
    );

    assert.deepEqual(
      requireOutcomeEngineRows<Row>({ data: [], error: null }, source),
      [],
      "A successful empty query must remain a valid empty result.",
    );

    const databaseError = {
      message: "Sensitive internal database detail",
      code: "TEST_DB_FAILURE",
    };

    for (const data of [null, [], rows]) {
      assert.throws(
        () => requireOutcomeEngineRows<Row>({ data, error: databaseError }, source),
        {
          name: "Error",
          message: `Outcome Engine data unavailable: ${source} could not be loaded.`,
        },
        "Database errors must throw even when rows accompany the error.",
      );

      assert.strictEqual(
        loggedErrors[loggedErrors.length - 1]?.[1],
        databaseError,
        "Full database error details must remain available in server logs.",
      );
    }

    assert.throws(
      () => requireOutcomeEngineRows<Row>({ data: null, error: null }, source),
      {
        name: "Error",
        message: `Outcome Engine data unavailable: ${source} returned an invalid response.`,
      },
      "A missing result must not be treated as a successful empty query.",
    );
  }
} finally {
  console.error = originalConsoleError;
}

console.log("✓ Outcome Engine data error regression test passed");
