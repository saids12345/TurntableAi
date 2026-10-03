import assert from "node:assert/strict";

import {
  runSquareCronUsers,
} from "@/lib/squareCronRunner";

async function main() {
  const attempted: string[] = [];

  const result =
    await runSquareCronUsers(
      [
        "user-a",
        "user-b",
        "user-c",
      ],
      async (userId) => {
        attempted.push(userId);

        if (userId === "user-a") {
          throw new Error(
            "simulated user failure",
          );
        }

        if (userId === "user-b") {
          return {
            syncedRows: 2,
            failures: [],
            skipped: ["inactive"],
          };
        }

        return {
          syncedRows: 1,
          failures: [
            "one location failed",
          ],
          skipped: [],
        };
      },
    );

  assert.deepEqual(
    attempted,
    [
      "user-a",
      "user-b",
      "user-c",
    ],
  );

  assert.equal(
    result.syncedRows,
    3,
  );

  assert.equal(
    result.failureCount,
    2,
  );

  assert.equal(
    result.skippedCount,
    1,
  );

  console.log(
    "✓ Square cron user isolation regression test passed",
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
