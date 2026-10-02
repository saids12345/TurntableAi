import "server-only";

import {
  getConfiguredSquareEnvironment,
} from "@/lib/square";

import {
  loadSquareProductionConnections,
} from "@/lib/squareConnectionReader";

import {
  getFreshSquareAccessToken,
} from "@/lib/squareTokenLifecycle";

import {
  ingestSquareDailyPerformance,
} from "@/lib/squareDailyIngestion";

import {
  getRecentCompletedLocalDates,
} from "@/lib/squareDailyPerformance";

export async function syncSquareDailyPerformanceForUser(
  input: {
    userId: string;
    completedDays?: number;
    now?: Date;
  },
) {
  if (
    getConfiguredSquareEnvironment() !==
    "production"
  ) {
    throw new Error(
      "Square daily sync requires SQUARE_ENVIRONMENT=production.",
    );
  }

  const connections =
    await loadSquareProductionConnections(
      input.userId,
    );

  let syncedRows = 0;

  const skipped: string[] = [];
  const failures: string[] = [];

  for (const connection of connections) {
    let accessToken: string;

    try {
      accessToken =
        await getFreshSquareAccessToken(
          connection,
        );
    } catch (error) {
      failures.push(
        `Merchant ${connection.merchantId}: ${
          error instanceof Error
            ? error.message
            : "token refresh failed"
        }`,
      );

      continue;
    }

    for (const location of connection.locations) {
      if (
        location.status
          ?.trim()
          .toUpperCase() ===
        "INACTIVE"
      ) {
        skipped.push(
          `${location.name}: inactive`,
        );

        continue;
      }

      if (
        !location.timezone ||
        !location.currency
      ) {
        failures.push(
          `${location.name}: missing timezone or currency`,
        );

        continue;
      }

      const localDates =
        getRecentCompletedLocalDates(
          location.timezone,
          input.completedDays ?? 3,
          input.now ?? new Date(),
        );

      for (const localDate of localDates) {
        try {
          await ingestSquareDailyPerformance({
            userId:
              connection.userId,

            environment:
              "production",

            merchantId:
              connection.merchantId,

            accessToken,

            locationId:
              location.providerLocationId,

            locationName:
              location.name,

            timezone:
              location.timezone,

            currency:
              location.currency,

            localDate,
          });

          syncedRows += 1;
        } catch (error) {
          failures.push(
            `${location.name} ${localDate}: ${
              error instanceof Error
                ? error.message
                : "sync failed"
            }`,
          );
        }
      }
    }
  }

  return {
    ok:
      failures.length === 0,

    connectionCount:
      connections.length,

    syncedRows,

    skipped,

    failures,
  };
}
