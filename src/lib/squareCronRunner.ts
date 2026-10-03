export type SquareCronUserResult = {
  syncedRows: number;
  failures: string[];
  skipped: string[];
};

export async function runSquareCronUsers(
  userIds: string[],
  syncUser: (
    userId: string,
  ) => Promise<SquareCronUserResult>,
) {
  let syncedRows = 0;
  let failureCount = 0;
  let skippedCount = 0;

  for (const userId of userIds) {
    try {
      const result =
        await syncUser(userId);

      syncedRows +=
        result.syncedRows;

      failureCount +=
        result.failures.length;

      skippedCount +=
        result.skipped.length;
    } catch (error) {
      failureCount += 1;

      console.error(
        "Square performance sync failed for one user:",
        error,
      );
    }
  }

  return {
    syncedRows,
    failureCount,
    skippedCount,
  };
}
