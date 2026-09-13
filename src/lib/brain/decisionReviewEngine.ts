export type DecisionRecommendationStatus =
  | "approve"
  | "operator_review_required"
  | "monitor"
  | "insufficient_evidence";

export interface DecisionCandidate {
  id: string;
  title: string;

  confidence: number;
  urgency: number;

  expectedImpact: number;

  evidenceSupport: number;

  historicalSupport: number;

  uncertaintyPenalty: number;

  conflictPenalty: number;

  finalScore: number;
}

export interface DecisionReview {
  recommendationStatus: DecisionRecommendationStatus;

  strongestCaseFor: string[];

  strongestCaseAgainst: string[];

  missingEvidence: string[];

  keyTradeoffs: string[];

  decisionRisks: string[];

  reviewedScore: number;

  explanation: string;
}

export interface ReviewDecisionInput {
  candidate: DecisionCandidate;

  confidenceScore: number;

  evidenceCount: number;

  conflictCount: number;

  unknowns: string[];

  assumptions: string[];
}
export interface DecisionStrategy {
    id: string;
  
    title: string;
  
    expectedBusinessValue: number;
  
    executionRisk: number;
  
    confidence: number;
  
    urgency: number;
  
    reversibility: number;
  }
  
  export interface RankedDecision {
    strategy: DecisionStrategy;
  
    overallScore: number;
  
    strengths: string[];
  
    weaknesses: string[];
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

export function reviewExecutiveDecision(
  input: ReviewDecisionInput,
): DecisionReview {
  const strongestCaseFor = [
    `The candidate "${input.candidate.title}" has the highest combined operational score.`,
    `Evidence support score: ${input.candidate.evidenceSupport}/100.`,
    `Historical support score: ${input.candidate.historicalSupport}/100.`,
  ];

  const strongestCaseAgainst: string[] = [];

  if (input.conflictCount > 0) {
    strongestCaseAgainst.push(
      `${input.conflictCount} reasoning conflict(s) remain unresolved.`,
    );
  }

  if (input.evidenceCount < 3) {
    strongestCaseAgainst.push(
      "There is limited supporting evidence.",
    );
  }

  if (input.unknowns.length > 0) {
    strongestCaseAgainst.push(
      "Important unknown variables still exist.",
    );
  }

  const reviewedScore = clamp(
    input.candidate.finalScore -
      input.candidate.conflictPenalty -
      input.candidate.uncertaintyPenalty,
  );

  let recommendationStatus: DecisionRecommendationStatus =
    "approve";

  if (reviewedScore < 35) {
    recommendationStatus =
      "insufficient_evidence";
  } else if (reviewedScore < 55) {
    recommendationStatus =
      "monitor";
  } else if (
    input.conflictCount > 1 ||
    input.unknowns.length > 2
  ) {
    recommendationStatus =
      "operator_review_required";
  }

  return {
    recommendationStatus,

    strongestCaseFor,

    strongestCaseAgainst,

    missingEvidence: input.unknowns,

    keyTradeoffs: input.assumptions,

    decisionRisks: strongestCaseAgainst,

    reviewedScore,

    explanation:
      recommendationStatus === "approve"
        ? "The decision remains well-supported after internal review."
        : recommendationStatus ===
            "operator_review_required"
          ? "The decision is promising but should be reviewed by an operator before execution."
          : recommendationStatus === "monitor"
            ? "Continue monitoring until stronger evidence becomes available."
            : "The available evidence is not sufficient to justify execution.",
  };
}