export type RestaurantDataReadinessStatus =
  | "insufficient"
  | "partial"
  | "ready";

export type RestaurantDataReadinessInput = {
  hasLatestTrustedPerformance: boolean;
  hasPreviousTrustedPerformance: boolean;
  performanceMetricCount: number;
  comparablePerformanceMetricCount: number;
  sameTrustedPerformanceSource: boolean;
  latestPerformanceCapturedAt: string | null;
  previousPerformanceCapturedAt: string | null;
  hasReviewEvidence: boolean;
  now?: Date | string | null;
};

export type RestaurantDataReadiness = {
  status: RestaurantDataReadinessStatus;
  reasons: string[];
};

const MAX_LATEST_AGE_HOURS =
  72;

const MAX_COMPARISON_GAP_HOURS =
  72;

function timestampMs(
  value: string | null,
) {
  if (!value) {
    return null;
  }

  const parsed =
    new Date(value).getTime();

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function currentTimeMs(
  value:
    | Date
    | string
    | null
    | undefined,
) {
  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "string") {
    const parsed =
      new Date(value).getTime();

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return Date.now();
}

export function getRestaurantDataReadiness(
  input: RestaurantDataReadinessInput,
): RestaurantDataReadiness {
  const reasons: string[] = [];

  const latestCapturedMs =
    timestampMs(
      input.latestPerformanceCapturedAt,
    );

  const previousCapturedMs =
    timestampMs(
      input.previousPerformanceCapturedAt,
    );

  const nowMs =
    currentTimeMs(
      input.now,
    );

  const latestAgeHours =
    latestCapturedMs === null
      ? null
      : (
          nowMs -
          latestCapturedMs
        ) /
        (
          60 *
          60 *
          1000
        );

  const comparisonGapHours =
    latestCapturedMs === null ||
    previousCapturedMs === null
      ? null
      : (
          latestCapturedMs -
          previousCapturedMs
        ) /
        (
          60 *
          60 *
          1000
        );

  const latestIsFresh =
    latestAgeHours !== null &&
    latestAgeHours >= 0 &&
    latestAgeHours <=
      MAX_LATEST_AGE_HOURS;

  const comparisonGapIsValid =
    comparisonGapHours !== null &&
    comparisonGapHours > 0 &&
    comparisonGapHours <=
      MAX_COMPARISON_GAP_HOURS;

  if (!input.hasLatestTrustedPerformance) {
    reasons.push(
      "No current trusted POS performance snapshot is available.",
    );
  }

  if (!input.hasPreviousTrustedPerformance) {
    reasons.push(
      "No previous trusted POS snapshot is available for comparison.",
    );
  }

  if (input.performanceMetricCount < 2) {
    reasons.push(
      "Too few trusted performance metrics are available.",
    );
  }

  if (
    input.hasLatestTrustedPerformance &&
    input.hasPreviousTrustedPerformance &&
    input.comparablePerformanceMetricCount < 2
  ) {
    reasons.push(
      "Too few trusted performance metrics are comparable across snapshots.",
    );
  }

  if (
    input.hasLatestTrustedPerformance &&
    input.hasPreviousTrustedPerformance &&
    !input.sameTrustedPerformanceSource
  ) {
    reasons.push(
      "Trusted POS snapshots come from different source systems.",
    );
  }

  if (
    input.hasLatestTrustedPerformance &&
    !latestIsFresh
  ) {
    reasons.push(
      "The latest trusted POS snapshot is stale or has an invalid timestamp.",
    );
  }

  if (
    input.hasLatestTrustedPerformance &&
    input.hasPreviousTrustedPerformance &&
    !comparisonGapIsValid
  ) {
    reasons.push(
      "Trusted POS snapshots are too far apart or out of order for a reliable comparison.",
    );
  }

  if (
    input.hasLatestTrustedPerformance &&
    input.hasPreviousTrustedPerformance &&
    input.performanceMetricCount >= 2 &&
    input.comparablePerformanceMetricCount >= 2 &&
    input.sameTrustedPerformanceSource &&
    latestIsFresh &&
    comparisonGapIsValid
  ) {
    return {
      status: "ready",
      reasons,
    };
  }

  if (
    input.hasLatestTrustedPerformance ||
    input.hasReviewEvidence
  ) {
    return {
      status: "partial",
      reasons,
    };
  }

  return {
    status: "insufficient",
    reasons,
  };
}

export type RestaurantDataReadinessCarrier = {
  dataReadiness?:
    | RestaurantDataReadiness
    | null;
};

export function filterReadyRestaurantData<
  T extends RestaurantDataReadinessCarrier,
>(
  items: T[],
): T[] {
  return items.filter(
    (item) =>
      item.dataReadiness?.status ===
      "ready",
  );
}
