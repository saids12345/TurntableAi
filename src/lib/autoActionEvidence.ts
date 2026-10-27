export type AutoActionEvidenceRequirement =
  | "performance"
  | "reviews"
  | "unverified";

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function getAutoActionEvidenceRequirement(
  sourceSignal: unknown,
): AutoActionEvidenceRequirement {
  if (!isRecord(sourceSignal) || !isRecord(sourceSignal.trigger)) {
    return "unverified";
  }

  const trigger = sourceSignal.trigger.type;

  switch (trigger) {
    case "traffic_decline":
    case "refund_spike":
    case "ops_pressure":
      return "performance";

    case "guest_sentiment_risk":
    case "throughput_pressure":
      return "reviews";

    default:
      return "unverified";
  }
}

export type VerifiedAutoActionSignals = {
  salesDeltaPct?: number | null;
  refunds?: number | null;
  laborPct?: number | null;
  negativeReviewCount?: number | null;
  avgRating?: number | null;
  reviewIssues?: string[];
};

export function isAutoActionEvidenceSatisfied(input: {
  sourceSignal: unknown;
  hasFreshOwnedPerformanceEvidence: boolean;
  hasFreshOwnedReviewEvidence: boolean;
  verifiedSignals?: VerifiedAutoActionSignals | null;
}): boolean {
  const requirement =
    getAutoActionEvidenceRequirement(input.sourceSignal);

  if (requirement === "unverified" || !input.verifiedSignals) {
    return false;
  }

  if (
    requirement === "performance" &&
    !input.hasFreshOwnedPerformanceEvidence
  ) {
    return false;
  }

  if (
    requirement === "reviews" &&
    !input.hasFreshOwnedReviewEvidence
  ) {
    return false;
  }

  const trigger = isRecord(input.sourceSignal) &&
    isRecord(input.sourceSignal.trigger)
      ? input.sourceSignal.trigger.type
      : null;

  const signals = input.verifiedSignals;
  const valid = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value);

  switch (trigger) {
    case "traffic_decline":
      return valid(signals.salesDeltaPct) &&
        signals.salesDeltaPct <= -12;

    case "refund_spike":
      return valid(signals.refunds) &&
        signals.refunds >= 4;

    case "ops_pressure":
      return valid(signals.laborPct) &&
        signals.laborPct > 35;

    case "guest_sentiment_risk":
      return (
        valid(signals.negativeReviewCount) &&
        signals.negativeReviewCount >= 3
      ) || (
        valid(signals.avgRating) &&
        signals.avgRating < 4
      );

    case "throughput_pressure":
      return Array.isArray(signals.reviewIssues) &&
        signals.reviewIssues.some(
          (issue) =>
            typeof issue === "string" &&
            /wait|service/i.test(issue),
        );

    default:
      return false;
  }
}
