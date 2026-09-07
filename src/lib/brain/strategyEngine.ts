export type StrategyRisk =
  | "very_low"
  | "low"
  | "medium"
  | "high"
  | "very_high";

export type StrategyCategory =
  | "marketing"
  | "operations"
  | "staffing"
  | "pricing"
  | "menu"
  | "guest_experience"
  | "inventory"
  | "financial"
  | "other";

export interface StrategyOption {
  id: string;

  title: string;

  description: string;

  category: StrategyCategory;

  expectedBusinessValue: number;

  executionRisk: number;

  confidence: number;

  urgency: number;

  reversibility: number;

  estimatedDaysToImpact: number;

  reasoning: string[];

  assumptions: string[];
}

export interface RankedStrategy {
  strategy: StrategyOption;

  overallScore: number;

  strengths: string[];

  weaknesses: string[];

  opportunityCost: string[];

  whyItRanksHere: string;
}

export interface StrategyEvaluation {
  recommendedStrategy: RankedStrategy | null;

  rankings: RankedStrategy[];

  rejectedStrategies: RankedStrategy[];

  executiveSummary: string;

  generatedAt: string;
}
export interface BuildStrategyEvaluationInput {
  strategies: StrategyOption[];

  now?: Date;
}

type StrategyScoreBreakdown = {
  businessValue: number;

  confidence: number;

  urgency: number;

  reversibility: number;

  riskPenalty: number;
};
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
function scoreStrategy(
  strategy: StrategyOption,
): StrategyScoreBreakdown {
  return {
    businessValue: clamp(
      strategy.expectedBusinessValue,
    ),

    confidence: clamp(
      strategy.confidence,
    ),

    urgency: clamp(
      strategy.urgency,
    ),

    reversibility: clamp(
      strategy.reversibility,
    ),

    riskPenalty: clamp(
      strategy.executionRisk,
    ),
  };
}
function calculateOverallScore(
  breakdown: StrategyScoreBreakdown,
): number {
  return clamp(
    Math.round(
      breakdown.businessValue * 0.35 +
      breakdown.confidence * 0.25 +
      breakdown.urgency * 0.20 +
      breakdown.reversibility * 0.10 -
      breakdown.riskPenalty * 0.10,
    ),
  );
}
function buildStrengths(
  strategy: StrategyOption,
  breakdown: StrategyScoreBreakdown,
): string[] {
  const strengths: string[] = [];

  if (breakdown.businessValue >= 80) {
    strengths.push(
      "High expected business value.",
    );
  }

  if (breakdown.confidence >= 75) {
    strengths.push(
      "Supported by strong confidence.",
    );
  }

  if (breakdown.urgency >= 75) {
    strengths.push(
      "Addresses an urgent operational need.",
    );
  }

  if (breakdown.reversibility >= 75) {
    strengths.push(
      "Can be reversed with minimal operational disruption.",
    );
  }

  strengths.push(
    ...strategy.reasoning.slice(0, 2),
  );

  return strengths;
}
function buildWeaknesses(
  strategy: StrategyOption,
  breakdown: StrategyScoreBreakdown,
): string[] {
  const weaknesses: string[] = [];

  if (breakdown.riskPenalty >= 70) {
    weaknesses.push(
      "Execution risk is relatively high.",
    );
  }

  if (breakdown.confidence < 60) {
    weaknesses.push(
      "Confidence remains limited.",
    );
  }

  if (breakdown.businessValue < 60) {
    weaknesses.push(
      "Business value may be limited.",
    );
  }

  if (strategy.assumptions.length > 0) {
    weaknesses.push(
      ...strategy.assumptions.slice(0, 2),
    );
  }

  return weaknesses;
}
function buildOpportunityCost(
  strategy: StrategyOption,
): string[] {
  const opportunityCost: string[] = [];

  switch (strategy.category) {
    case "marketing":
      opportunityCost.push(
        "Operational improvements may be delayed while marketing initiatives receive priority.",
      );
      break;

    case "operations":
      opportunityCost.push(
        "Guest acquisition efforts may progress more slowly while operational improvements are prioritized.",
      );
      break;

    case "pricing":
      opportunityCost.push(
        "Higher pricing could reduce guest demand if market conditions change.",
      );
      break;

    case "staffing":
      opportunityCost.push(
        "Additional labor investment may reduce short-term profitability.",
      );
      break;

    default:
      opportunityCost.push(
        "Alternative strategic initiatives will receive fewer resources while this strategy is executed.",
      );
  }

  return opportunityCost;
}
function buildWhyItRanksHere(
  overallScore: number,
): string {
  if (overallScore >= 90) {
    return "Exceptional balance of value, confidence, urgency, and execution risk.";
  }

  if (overallScore >= 75) {
    return "Strong overall strategic choice with manageable trade-offs.";
  }

  if (overallScore >= 60) {
    return "Reasonable strategy, though several trade-offs should be monitored.";
  }

  if (overallScore >= 40) {
    return "Useful in some situations, but higher-ranked alternatives should be considered first.";
  }

  return "Current evidence does not strongly support prioritizing this strategy.";
}
export function buildStrategyEvaluation(
  input: BuildStrategyEvaluationInput,
): StrategyEvaluation {
  const ranked: RankedStrategy[] =
    input.strategies.map((strategy) => {
      const breakdown = scoreStrategy(strategy);

      const overallScore =
        calculateOverallScore(breakdown);

      return {
        strategy,

        overallScore,

        strengths: buildStrengths(
          strategy,
          breakdown,
        ),

        weaknesses: buildWeaknesses(
          strategy,
          breakdown,
        ),

        opportunityCost:
          buildOpportunityCost(strategy),

        whyItRanksHere:
          buildWhyItRanksHere(overallScore),
      };
    });

  ranked.sort(
    (a, b) =>
      b.overallScore - a.overallScore,
  );

  const recommendedStrategy =
  ranked.length > 0
    ? ranked[0]
    : null;

  const rejectedStrategies =
    ranked.slice(1);

  const executiveSummary =
    recommendedStrategy
      ? `Recommended strategy: "${recommendedStrategy.strategy.title}" with an overall score of ${recommendedStrategy.overallScore}.`
      : "No strategies available for evaluation.";

  return {
    recommendedStrategy,

    rankings: ranked,

    rejectedStrategies,

    executiveSummary,

    generatedAt: (
      input.now ?? new Date()
    ).toISOString(),
  };
}