export type RestaurantDataReadinessStatus =
  | "insufficient"
  | "partial"
  | "ready";

export type RestaurantDataReadinessInput = {
  hasLatestTrustedPerformance: boolean;
  hasPreviousTrustedPerformance: boolean;
  performanceMetricCount: number;
  hasReviewEvidence: boolean;
};

export type RestaurantDataReadiness = {
  status: RestaurantDataReadinessStatus;
  reasons: string[];
};

export function getRestaurantDataReadiness(
  input: RestaurantDataReadinessInput,
): RestaurantDataReadiness {
  const reasons: string[] = [];

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
    input.performanceMetricCount >= 2
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
