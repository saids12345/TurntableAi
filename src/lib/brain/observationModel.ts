export type ObservationCategory =
  | "revenue"
  | "orders"
  | "demand"
  | "reputation"
  | "service"
  | "staffing"
  | "labor"
  | "profitability"
  | "refunds"
  | "inventory"
  | "marketing"
  | "operations";

export type ObservationDirection =
  | "increasing"
  | "decreasing"
  | "stable"
  | "unknown";

export type ObservationSeverity =
  | "informational"
  | "positive"
  | "watch"
  | "risk"
  | "critical";

export type ObservationSource =
  | "restaurant_state"
  | "pos"
  | "reviews"
  | "labor"
  | "inventory"
  | "marketing"
  | "weather"
  | "events"
  | "competitors"
  | "operator_memory"
  | "execution_history";

export interface ObservationEvidence {
  metric: string;

  currentValue: number | string | null;

  comparisonValue?: number | string | null;

  changePct?: number | null;

  period?: string | null;
}

export interface BrainObservation {
  id: string;

  category: ObservationCategory;

  title: string;

  description: string;

  direction: ObservationDirection;

  severity: ObservationSeverity;

  confidence: number;

  source: ObservationSource;

  locationName: string | null;

  evidence: ObservationEvidence[];

  detectedAt: string;
}

export interface ObservationSet {
  observations: BrainObservation[];

  criticalObservations: BrainObservation[];

  riskObservations: BrainObservation[];

  positiveObservations: BrainObservation[];

  generatedAt: string;
}

function clampConfidence(
  confidence: number,
): number {
  return Math.min(
    1,
    Math.max(0, confidence),
  );
}

export function createObservation(
  input: Omit<
    BrainObservation,
    "confidence" | "detectedAt"
  > & {
    confidence: number;

    detectedAt?: string;
  },
): BrainObservation {
  return {
    ...input,

    confidence:
      clampConfidence(
        input.confidence,
      ),

    detectedAt:
      input.detectedAt ??
      new Date().toISOString(),
  };
}

export function buildObservationSet(
  observations: BrainObservation[],
): ObservationSet {
  const normalizedObservations =
    observations.map(
      (observation) => ({
        ...observation,

        confidence:
          clampConfidence(
            observation.confidence,
          ),

        evidence:
          [...observation.evidence],
      }),
    );

  return {
    observations:
      normalizedObservations,

    criticalObservations:
      normalizedObservations.filter(
        (observation) =>
          observation.severity ===
          "critical",
      ),

    riskObservations:
      normalizedObservations.filter(
        (observation) =>
          observation.severity ===
            "risk" ||
          observation.severity ===
            "watch",
      ),

    positiveObservations:
      normalizedObservations.filter(
        (observation) =>
          observation.severity ===
          "positive",
      ),

    generatedAt:
      new Date().toISOString(),
  };
}