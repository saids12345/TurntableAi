import "server-only";

import {
  getConfiguredSquareEnvironment,
  searchSquareCompletedOrders,
  type SquareEnvironment,
} from "@/lib/square";

import {
  aggregateSquareDailyPerformance,
  buildSquareDailyWindow,
} from "@/lib/squareDailyPerformance";

import {
  ingestPerformanceSignal,
} from "@/lib/performanceSignalIngestion";

export type IngestSquareDailyPerformanceInput = {
  userId: string;
  environment: SquareEnvironment;
  merchantId: string;
  accessToken: string;
  locationId: string;
  locationName: string;
  timezone: string;
  currency: string;
  localDate: string;
};

export function assertSquareProductionIngestionAllowed(
  environment: SquareEnvironment,
) {
  if (environment !== "production") {
    throw new Error(
      "Square sandbox data is not allowed in the trusted performance pipeline.",
    );
  }

  const configuredEnvironment =
    getConfiguredSquareEnvironment();

  if (configuredEnvironment !== "production") {
    throw new Error(
      "Square trusted performance ingestion requires SQUARE_ENVIRONMENT=production.",
    );
  }
}

export async function ingestSquareDailyPerformance(
  input: IngestSquareDailyPerformanceInput,
) {
  /*
   * HARD TRUST BOUNDARY.
   * This runs before Square API access
   * and before performance_signal_history writes.
   */
  assertSquareProductionIngestionAllowed(
    input.environment,
  );

  const window =
    buildSquareDailyWindow(
      input.localDate,
      input.timezone,
    );

  const orders =
    await searchSquareCompletedOrders({
      accessToken:
        input.accessToken,

      locationId:
        input.locationId,

      startAt:
        window.startAt,

      endAt:
        window.endAt,
    });

  const snapshot =
    aggregateSquareDailyPerformance({
      environment:
        input.environment,

      merchantId:
        input.merchantId,

      locationId:
        input.locationId,

      locationName:
        input.locationName,

      currency:
        input.currency,

      localDate:
        input.localDate,

      capturedAt:
        window.capturedAt,

      orders,
    });

  return ingestPerformanceSignal({
    userId:
      input.userId,

    sourceSystem:
      snapshot.sourceSystem,

    sourceRecordId:
      snapshot.sourceRecordId,

    locationName:
      snapshot.locationName,

    revenue:
      snapshot.revenue,

    orders:
      snapshot.orders,

    avgTicket:
      snapshot.avgTicket,

    laborPct:
      snapshot.laborPct,

    marginPct:
      snapshot.marginPct,

    refunds:
      snapshot.refunds,

    capturedAt:
      snapshot.capturedAt,
  });
}
