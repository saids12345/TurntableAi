export interface ConfidenceAssessment {
  overallConfidence: number;

  confidenceLevel:
    | "very_low"
    | "low"
    | "medium"
    | "high"
    | "very_high";

  agreementScore: number;

  evidenceQuality: number;

  uncertaintyScore: number;

  reasons: string[];

  concerns: string[];
}

export interface ConfidenceInput {
  planningConfidence: number;

  causalConfidence: number;

  predictionConfidence: number;

  worldModelConfidence: number;

  strategyConfidence: number;

  executiveConfidence: number;

  decisionReviewConfidence: number;
}

function clamp(
  value: number,
  minimum = 0,
  maximum = 100,
): number {
  return Math.min(
    maximum,
    Math.max(minimum, value),
  );
}

function average(
  values: number[],
): number {
  if (values.length === 0) {
    return 0;
  }

  return (
    values.reduce(
      (sum, value) => sum + value,
      0,
    ) / values.length
  );
}

function calculateAgreement(
  input: ConfidenceInput,
): number {
  const values = [
    input.planningConfidence,
    input.causalConfidence,
    input.predictionConfidence,
    input.worldModelConfidence,
    input.strategyConfidence,
    input.executiveConfidence,
    input.decisionReviewConfidence,
  ];

  const mean = average(values);

  const averageDeviation = average(
    values.map((value) =>
      Math.abs(value - mean),
    ),
  );

  return clamp(
    Math.round(
      100 - averageDeviation * 2,
    ),
  );
}
function calculateEvidenceQuality(
  input: ConfidenceInput,
): number {
  const values = [
    input.planningConfidence,
    input.causalConfidence,
    input.predictionConfidence,
    input.worldModelConfidence,
    input.strategyConfidence,
    input.executiveConfidence,
    input.decisionReviewConfidence,
  ];

  return clamp(
    Math.round(
      average(values),
    ),
  );
}
function calculateUncertainty(
  agreementScore: number,
  evidenceQuality: number,
): number {
  return clamp(
    Math.round(
      100 -
        (agreementScore * 0.6 +
          evidenceQuality * 0.4),
    ),
  );
}
function determineConfidenceLevel(
  overallConfidence: number,
): ConfidenceAssessment["confidenceLevel"] {
  if (overallConfidence >= 90) {
    return "very_high";
  }

  if (overallConfidence >= 75) {
    return "high";
  }

  if (overallConfidence >= 60) {
    return "medium";
  }

  if (overallConfidence >= 40) {
    return "low";
  }

  return "very_low";
}
function buildReasons(
  agreementScore: number,
  evidenceQuality: number,
): string[] {
  const reasons: string[] = [];

  if (agreementScore >= 80) {
    reasons.push(
      "Strong agreement across reasoning engines.",
    );
  }

  if (evidenceQuality >= 80) {
    reasons.push(
      "High-quality supporting evidence.",
    );
  }

  if (reasons.length === 0) {
    reasons.push(
      "Recommendation is supported, but additional evidence would improve confidence.",
    );
  }

  return reasons;
}
function buildConcerns(
  agreementScore: number,
  uncertaintyScore: number,
): string[] {
  const concerns: string[] = [];

  if (agreementScore < 60) {
    concerns.push(
      "Reasoning engines disagree on the recommended course of action.",
    );
  }

  if (uncertaintyScore >= 40) {
    concerns.push(
      "Uncertainty remains relatively high.",
    );
  }

  if (concerns.length === 0) {
    concerns.push(
      "No significant confidence concerns identified.",
    );
  }

  return concerns;
}
export function buildConfidenceAssessment(
  input: ConfidenceInput,
): ConfidenceAssessment {
  const agreementScore =
    calculateAgreement(input);

  const evidenceQuality =
    calculateEvidenceQuality(input);

  const uncertaintyScore =
    calculateUncertainty(
      agreementScore,
      evidenceQuality,
    );

  const overallConfidence = clamp(
    Math.round(
      agreementScore * 0.45 +
      evidenceQuality * 0.45 +
      (100 - uncertaintyScore) * 0.10,
    ),
  );

  return {
    overallConfidence,

    confidenceLevel:
      determineConfidenceLevel(
        overallConfidence,
      ),

    agreementScore,

    evidenceQuality,

    uncertaintyScore,

    reasons: buildReasons(
      agreementScore,
      evidenceQuality,
    ),

    concerns: buildConcerns(
      agreementScore,
      uncertaintyScore,
    ),
  };
}