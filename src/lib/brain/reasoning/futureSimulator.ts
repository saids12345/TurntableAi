import type {
  BrainContext,
} from "@/lib/brain/brainContext";

import type {
  Belief,
} from "./beliefSystem";

import type {
  HypothesisCategory,
} from "./hypothesisEngine";

import type {
  StrategyCandidate,
  StrategyDecisionMode,
  StrategyKind,
  StrategyQuestionProvenance,
  StrategyRisk,
  StrategyReversibility,
  StrategyUrgency,
} from "./strategyGenerator";

export type SimulationScenarioName =
  | "best_case"
  | "base_case"
  | "worst_case";

export type ImpactScale =
  | "normalized_-1_to_1";

export interface ScenarioImpact {
  revenue: number;

  guestExperience: number;

  operations: number;
}

export interface SimulatedScenario {
  name: SimulationScenarioName;

  probability: number;

  summary: string;

  impact: ScenarioImpact;

  risk: number;

  assumptions: string[];
}

export interface SimulatedFuture {
  /**
   * Existing compatibility fields.
   */
  strategyId: string;

  summary: string;

  confidence: number;

  expectedRevenueImpact: number;

  expectedGuestExperienceImpact: number;

  expectedOperationalImpact: number;

  expectedRisk: number;

  /**
   * Rich future-simulation state.
   */
  strategyTitle?: string;

  strategyKind?: StrategyKind;

  decisionMode?: StrategyDecisionMode;

  relatedBeliefId?: string;

  sourceQuestion?:
  StrategyQuestionProvenance;

  relatedBeliefCategory?: HypothesisCategory;

  evidenceCoverage?: number;

  uncertainty?: number;

  decisionModeFit?: number;

  impactScale?: ImpactScale;

  timeHorizon?: string;

  bestCase?: SimulatedScenario;

  baseCase?: SimulatedScenario;

  worstCase?: SimulatedScenario;

  scenarios?: SimulatedScenario[];

  expectedOutcome?: string;

  successMetrics?: string[];

  leadingIndicators?: string[];

  failureConditions?: string[];

  assumptions?: string[];

  unknowns?: string[];

  generatedAt?: string;
}

interface ImpactVector {
  revenue: number;

  guestExperience: number;

  operations: number;
}

interface SimulationProfile {
  revenue: number;

  guestExperience: number;

  operations: number;

  intrinsicRisk: number;

  variability: number;

  timeHorizon: string;
}

interface CategoryMultiplier {
  revenue: number;

  guestExperience: number;

  operations: number;

  risk: number;
}

interface ScenarioProbabilities {
  bestCase: number;

  baseCase: number;

  worstCase: number;
}

const SIMULATION_PROFILES: Record<
  StrategyKind,
  SimulationProfile
> = {
  corrective_action: {
    revenue: 0.22,

    guestExperience: 0.32,

    operations: 0.4,

    intrinsicRisk: 0.38,

    variability: 0.26,

    timeHorizon:
      "1 to 4 weeks",
  },

  controlled_experiment: {
    revenue: 0.12,

    guestExperience: 0.15,

    operations: 0.19,

    intrinsicRisk: 0.16,

    variability: 0.17,

    timeHorizon:
      "3 days to 3 weeks",
  },

  information_gathering: {
    revenue: 0.02,

    guestExperience: 0.03,

    operations: 0.13,

    intrinsicRisk: 0.06,

    variability: 0.08,

    timeHorizon:
      "1 day to 2 weeks",
  },

  risk_containment: {
    revenue: 0.08,

    guestExperience: 0.14,

    operations: 0.26,

    intrinsicRisk: 0.1,

    variability: 0.12,

    timeHorizon:
      "Immediate to 2 weeks",
  },

  growth: {
    revenue: 0.43,

    guestExperience: 0.17,

    operations: 0.1,

    intrinsicRisk: 0.44,

    variability: 0.31,

    timeHorizon:
      "2 to 8 weeks",
  },

  maintain_monitor: {
    revenue: 0.01,

    guestExperience: 0.04,

    operations: 0.04,

    intrinsicRisk: 0.08,

    variability: 0.08,

    timeHorizon:
      "Until the next review cycle",
  },
};

const CATEGORY_MULTIPLIERS: Record<
  HypothesisCategory,
  CategoryMultiplier
> = {
  stability: {
    revenue: 0.5,

    guestExperience: 0.75,

    operations: 0.75,

    risk: 0.65,
  },

  demand: {
    revenue: 1.3,

    guestExperience: 0.8,

    operations: 0.75,

    risk: 1,
  },

  service: {
    revenue: 0.75,

    guestExperience: 1.35,

    operations: 1.1,

    risk: 1.1,
  },

  staffing: {
    revenue: 0.7,

    guestExperience: 1.05,

    operations: 1.35,

    risk: 1.15,
  },

  profitability: {
    revenue: 1.2,

    guestExperience: 0.7,

    operations: 1,

    risk: 1.1,
  },

  reputation: {
    revenue: 0.75,

    guestExperience: 1.35,

    operations: 0.8,

    risk: 1,
  },

  execution: {
    revenue: 0.85,

    guestExperience: 1,

    operations: 1.35,

    risk: 1.1,
  },

  growth: {
    revenue: 1.35,

    guestExperience: 0.95,

    operations: 0.8,

    risk: 1.2,
  },

  unknown: {
    revenue: 0.4,

    guestExperience: 0.4,

    operations: 0.6,

    risk: 1.25,
  },
};

const RISK_LEVELS: Record<
  StrategyRisk,
  number
> = {
  low: 0.2,

  medium: 0.55,

  high: 1,
};

const REVERSIBILITY_LEVELS: Record<
  StrategyReversibility,
  number
> = {
  low: 0.2,

  medium: 0.6,

  high: 1,
};

const URGENCY_LEVELS: Record<
  StrategyUrgency,
  number
> = {
  low: 0.25,

  medium: 0.55,

  high: 0.82,

  critical: 1,
};

const DECISION_MODE_COMPATIBILITY: Record<
  StrategyDecisionMode,
  Record<
    StrategyDecisionMode,
    number
  >
> = {
  act: {
    act: 1,

    test: 0.65,

    investigate: 0.35,

    contain: 0.82,

    monitor: 0.28,
  },

  test: {
    act: 0.5,

    test: 1,

    investigate: 0.82,

    contain: 0.72,

    monitor: 0.52,
  },

  investigate: {
    act: 0.22,

    test: 0.82,

    investigate: 1,

    contain: 0.68,

    monitor: 0.63,
  },

  contain: {
    act: 0.82,

    test: 0.7,

    investigate: 0.65,

    contain: 1,

    monitor: 0.55,
  },

  monitor: {
    act: 0.3,

    test: 0.58,

    investigate: 0.62,

    contain: 0.5,

    monitor: 1,
  },
};

const LEADING_INDICATORS: Record<
  HypothesisCategory,
  string[]
> = {
  stability: [
    "Revenue and order trends remain within the normal operating range.",
    "Guest rating and complaint frequency remain stable.",
    "No material increase in alerts, refunds, or labor pressure.",
  ],

  demand: [
    "Orders and guest traffic begin moving in the intended direction.",
    "Revenue improves without excessive discounting.",
    "Incremental contribution remains positive.",
  ],

  service: [
    "Wait-time, order-accuracy, or service-recovery metrics improve.",
    "Guest complaints decline.",
    "Rating and sentiment begin improving.",
  ],

  staffing: [
    "Critical shifts achieve adequate labor coverage.",
    "Labor productivity improves.",
    "Service performance improves without unsustainable overtime.",
  ],

  profitability: [
    "Margin begins moving toward target.",
    "Refund, discount, labor, or channel leakage declines.",
    "Revenue remains protected during the intervention.",
  ],

  reputation: [
    "Negative review frequency declines.",
    "Repeated complaint categories become less common.",
    "Average rating and sentiment begin improving.",
  ],

  execution: [
    "Operational alerts and process failures decline.",
    "Corrective actions are completed on time.",
    "Refunds, errors, or backlogs begin falling.",
  ],

  growth: [
    "Incremental orders and revenue exceed the baseline.",
    "Incremental contribution remains positive.",
    "Service, staffing, and margin guardrails remain healthy.",
  ],

  unknown: [
    "Evidence coverage increases.",
    "The confidence gap between competing beliefs grows.",
    "Blocking executive questions are resolved.",
  ],
};

function clamp(
  value: number,
  minimum = 0,
  maximum = 1,
) {
  return Math.min(
    maximum,
    Math.max(
      minimum,
      value,
    ),
  );
}

function clampImpact(
  value: number,
) {
  return Math.min(
    1,
    Math.max(
      -1,
      value,
    ),
  );
}

function round(
  value: number,
  decimals = 4,
) {
  const multiplier =
    10 ** decimals;

  return (
    Math.round(
      value * multiplier,
    ) / multiplier
  );
}

function uniqueStrings(
  values:
    | string[]
    | undefined,
) {
  return Array.from(
    new Set(
      values ?? [],
    ),
  );
}

function getRelatedBelief(
  context: BrainContext,
  strategy: StrategyCandidate,
): Belief | undefined {
  const beliefSystem =
    context.reasoning
      .beliefs;

  if (!beliefSystem) {
    return undefined;
  }

  if (
    strategy.relatedBeliefId
  ) {
    const matched =
      beliefSystem.beliefs.find(
        (belief) =>
          belief.id ===
          strategy.relatedBeliefId,
      );

    if (matched) {
      return matched;
    }
  }

  return beliefSystem
    .primaryBelief;
}

function inferRecommendedMode(
  context: BrainContext,
  belief:
    | Belief
    | undefined,
): StrategyDecisionMode {
  const uncertainty =
    clamp(
      context.reasoning
        .beliefs
        ?.uncertainty ??
        (
          belief
            ? 1 -
              belief.confidence
            : 1
        ),
    );

  const unresolvedQuestions =
    context.reasoning
      .internalDialogue
      ?.unresolvedCount ??
    0;

  if (
    !belief ||
    belief.status ===
      "rejected" ||
    uncertainty >= 0.7
  ) {
    return "investigate";
  }

  if (
    belief.status ===
      "contested" ||
    belief.status ===
      "provisional" ||
    unresolvedQuestions > 0
  ) {
    return "test";
  }

  if (
    belief.category ===
    "stability"
  ) {
    return "monitor";
  }

  if (
    belief.category ===
    "growth"
  ) {
    return "test";
  }

  return "act";
}

function getDecisionModeFit(
  strategyMode:
    | StrategyDecisionMode
    | undefined,
  recommendedMode:
    StrategyDecisionMode,
) {
  if (!strategyMode) {
    return 0.5;
  }

  return (
    DECISION_MODE_COMPATIBILITY[
      recommendedMode
    ][strategyMode]
  );
}

function getSimulationConfidence(
  params: {
    beliefConfidence: number;

    strategyConfidence: number;

    evidenceCoverage: number;

    uncertainty: number;

    decisionModeFit: number;
  },
) {
  const {
    beliefConfidence,
    strategyConfidence,
    evidenceCoverage,
    uncertainty,
    decisionModeFit,
  } = params;

  return round(
    clamp(
      0.12 +
        beliefConfidence *
          0.25 +
        strategyConfidence *
          0.2 +
        evidenceCoverage *
          0.23 +
        (
          1 -
          uncertainty
        ) *
          0.12 +
        decisionModeFit *
          0.08,
      0.12,
      0.94,
    ),
  );
}

function multiplyImpact(
  impact: ImpactVector,
  multiplier: number,
): ImpactVector {
  return {
    revenue:
      clampImpact(
        impact.revenue *
          multiplier,
      ),

    guestExperience:
      clampImpact(
        impact.guestExperience *
          multiplier,
      ),

    operations:
      clampImpact(
        impact.operations *
          multiplier,
      ),
  };
}

function addImpact(
  left: ImpactVector,
  right: ImpactVector,
): ImpactVector {
  return {
    revenue:
      clampImpact(
        left.revenue +
          right.revenue,
      ),

    guestExperience:
      clampImpact(
        left.guestExperience +
          right.guestExperience,
      ),

    operations:
      clampImpact(
        left.operations +
          right.operations,
      ),
  };
}

function weightedImpact(
  scenarios: Array<{
    probability: number;

    impact: ImpactVector;
  }>,
): ImpactVector {
  return scenarios.reduce<ImpactVector>(
    (
      total,
      scenario,
    ) => ({
      revenue:
        total.revenue +
        scenario.impact
          .revenue *
          scenario.probability,

      guestExperience:
        total.guestExperience +
        scenario.impact
          .guestExperience *
          scenario.probability,

      operations:
        total.operations +
        scenario.impact
          .operations *
          scenario.probability,
    }),
    {
      revenue: 0,

      guestExperience: 0,

      operations: 0,
    },
  );
}

function getBaseImpact(
  profile: SimulationProfile,
  categoryMultiplier: CategoryMultiplier,
  effectiveness: number,
): ImpactVector {
  return {
    revenue:
      clampImpact(
        profile.revenue *
          categoryMultiplier
            .revenue *
          effectiveness,
      ),

    guestExperience:
      clampImpact(
        profile.guestExperience *
          categoryMultiplier
            .guestExperience *
          effectiveness,
      ),

    operations:
      clampImpact(
        profile.operations *
          categoryMultiplier
            .operations *
          effectiveness,
      ),
  };
}

function getScenarioProbabilities(
  confidence: number,
  uncertainty: number,
  decisionModeFit: number,
  expectedRisk: number,
): ScenarioProbabilities {
  const worstCase =
    clamp(
      0.1 +
        uncertainty * 0.18 +
        (
          1 -
          decisionModeFit
        ) *
          0.12 +
        expectedRisk * 0.08,
      0.1,
      0.4,
    );

  const bestCase =
    clamp(
      0.16 +
        confidence * 0.14 +
        (
          1 -
          uncertainty
        ) *
          0.07 -
        expectedRisk * 0.06,
      0.12,
      0.35,
    );

  const baseCase =
    Math.max(
      0.2,
      1 -
        bestCase -
        worstCase,
    );

  const total =
    bestCase +
    baseCase +
    worstCase;

  return {
    bestCase:
      round(
        bestCase / total,
      ),

    baseCase:
      round(
        baseCase / total,
      ),

    worstCase:
      round(
        worstCase / total,
      ),
  };
}

function describeImpact(
  value: number,
) {
  if (value >= 0.4) {
    return "strong improvement";
  }

  if (value >= 0.2) {
    return "moderate improvement";
  }

  if (value >= 0.06) {
    return "slight improvement";
  }

  if (value <= -0.4) {
    return "serious deterioration";
  }

  if (value <= -0.2) {
    return "moderate deterioration";
  }

  if (value <= -0.06) {
    return "slight deterioration";
  }

  return "limited material change";
}

function getDominantImpact(
  impact: ImpactVector,
) {
  const values = [
    {
      label:
        "revenue performance",

      value:
        impact.revenue,
    },

    {
      label:
        "guest experience",

      value:
        impact.guestExperience,
    },

    {
      label:
        "operational performance",

      value:
        impact.operations,
    },
  ];

  return values.sort(
    (
      left,
      right,
    ) =>
      Math.abs(
        right.value,
      ) -
      Math.abs(
        left.value,
      ),
  )[0];
}

function buildScenarioSummary(
  strategy: StrategyCandidate,
  scenarioName: SimulationScenarioName,
  impact: ImpactVector,
  risk: number,
) {
  const dominant =
    getDominantImpact(
      impact,
    );

  const scenarioLabel =
    scenarioName ===
    "best_case"
      ? "In the best case"
      : scenarioName ===
          "worst_case"
        ? "In the worst case"
        : "In the most likely case";

  return (
    `${scenarioLabel}, "${strategy.title}" produces ` +
    `${describeImpact(
      dominant.value,
    )} in ${dominant.label}. ` +
    `Estimated scenario risk is ${Math.round(
      risk * 100,
    )}%.`
  );
}

function getExpectedRisk(
  params: {
    profile: SimulationProfile;

    categoryMultiplier: CategoryMultiplier;

    strategyRisk: number;

    reversibility: number;

    uncertainty: number;

    decisionModeFit: number;
  },
) {
  const {
    profile,
    categoryMultiplier,
    strategyRisk,
    reversibility,
    uncertainty,
    decisionModeFit,
  } = params;

  return round(
    clamp(
      profile.intrinsicRisk *
        0.35 *
        categoryMultiplier.risk +
        strategyRisk * 0.25 +
        uncertainty * 0.25 +
        (
          1 -
          decisionModeFit
        ) *
          0.2 -
        reversibility * 0.13,
    ),
  );
}

function getFailureConditions(
  strategy: StrategyCandidate,
  category: HypothesisCategory,
) {
  const conditions: string[] =
    [];

  switch (
    strategy.kind
  ) {
    case "corrective_action":
      conditions.push(
        "The targeted operating metric fails to improve during the review window.",
        "Guest experience, margin, or service quality worsens after implementation.",
        "New evidence materially weakens the diagnosis supporting the intervention.",
      );

      break;

    case "controlled_experiment":
      conditions.push(
        "The experiment does not produce a meaningful difference from the baseline.",
        "A financial, service, staffing, or reputation guardrail is breached.",
        "The test does not collect enough reliable evidence to distinguish competing explanations.",
      );

      break;

    case "information_gathering":
      conditions.push(
        "The collected evidence is incomplete, stale, or unreliable.",
        "The new information does not change belief confidence or strategy ranking.",
        "The investigation delays action while the operating situation materially worsens.",
      );

      break;

    case "risk_containment":
      conditions.push(
        "The underlying operating problem continues worsening despite containment.",
        "The cost of containment exceeds the avoided downside.",
        "Temporary controls become permanent without resolving the root cause.",
      );

      break;

    case "growth":
      conditions.push(
        "Incremental contribution margin is negative.",
        "Service, labor, reputation, or execution guardrails deteriorate.",
        "The apparent growth is temporary or driven by unprofitable discounting.",
      );

      break;

    case "maintain_monitor":
      conditions.push(
        "A critical operating threshold is crossed.",
        "Revenue, guest experience, margin, or operational health deteriorates.",
        "Monitoring fails to detect a worsening condition early enough to intervene.",
      );

      break;

    default:
      conditions.push(
        "The expected operating outcome does not materialize.",
      );
  }

  if (
    category === "unknown"
  ) {
    conditions.push(
      "The Brain remains unable to identify a defensible primary explanation.",
    );
  }

  return uniqueStrings(
    conditions,
  );
}

function getUnknowns(
  strategy: StrategyCandidate,
  belief:
    | Belief
    | undefined,
  context: BrainContext,
) {
  return uniqueStrings([
    ...(
      strategy
        .requiredEvidence ??
      []
    ),

    ...(
      belief?.unknowns ??
      []
    ),

    ...(
      context.reasoning
        .hypotheses
        ?.unknowns ??
      []
    ),
  ]).slice(
    0,
    8,
  );
}

function getAssumptions(
  strategy: StrategyCandidate,
  belief:
    | Belief
    | undefined,
) {
  return uniqueStrings([
    ...(
      strategy.assumptions ??
      []
    ),

    ...(
      belief?.assumptions ??
      []
    ),
  ]).slice(
    0,
    8,
  );
}

export function simulateFuture(
  context: BrainContext,
  strategy: StrategyCandidate,
): SimulatedFuture {
  const belief =
    getRelatedBelief(
      context,
      strategy,
    );

  const category =
    belief?.category ??
    "unknown";

  const strategyKind =
    strategy.kind ??
    "maintain_monitor";

  const profile =
    SIMULATION_PROFILES[
      strategyKind
    ];

  const categoryMultiplier =
    CATEGORY_MULTIPLIERS[
      category
    ];

  const beliefConfidence =
    clamp(
      belief?.confidence ??
      0.4,
    );

  const strategyConfidence =
    clamp(
      strategy.confidence ??
      beliefConfidence,
    );

  const evidenceCoverage =
    clamp(
      belief?.evidenceCoverage ??
      context.reasoning
        .beliefs
        ?.evidenceCoverage ??
      context.reasoning
        .hypotheses
        ?.evidenceCoverage ??
      0.25,
    );

  const uncertainty =
    clamp(
      context.reasoning
        .beliefs
        ?.uncertainty ??
        (
          belief
            ? 1 -
              belief.confidence
            : 0.75
        ),
    );

  const recommendedMode =
    inferRecommendedMode(
      context,
      belief,
    );

  const decisionModeFit =
    getDecisionModeFit(
      strategy.decisionMode,
      recommendedMode,
    );

  const strategyRisk =
    strategy.risk
      ? RISK_LEVELS[
          strategy.risk
        ]
      : 0.55;

  const reversibility =
    strategy.reversibility
      ? REVERSIBILITY_LEVELS[
          strategy.reversibility
        ]
      : 0.5;

  const urgency =
    strategy.urgency
      ? URGENCY_LEVELS[
          strategy.urgency
        ]
      : 0.5;

  const signalQuality =
    clamp(
      0.18 +
        beliefConfidence *
          0.26 +
        evidenceCoverage *
          0.24 +
        decisionModeFit *
          0.18 +
        (
          1 -
          uncertainty
        ) *
          0.14,
      0.15,
      1,
    );

  const executionQuality =
    clamp(
      0.34 +
        strategyConfidence *
          0.28 +
        reversibility *
          0.12 +
        urgency *
          0.06 -
        strategyRisk *
          0.08,
      0.2,
      1,
    );

  const effectiveness =
    clamp(
      signalQuality * 0.55 +
        executionQuality *
          0.45,
      0.15,
      1,
    );

  const confidence =
    getSimulationConfidence({
      beliefConfidence,

      strategyConfidence,

      evidenceCoverage,

      uncertainty,

      decisionModeFit,
    });

  const expectedRisk =
    getExpectedRisk({
      profile,

      categoryMultiplier,

      strategyRisk,

      reversibility,

      uncertainty,

      decisionModeFit,
    });

  const baseImpact =
    getBaseImpact(
      profile,
      categoryMultiplier,
      effectiveness,
    );

  const upside =
    profile.variability *
    (
      0.55 +
      confidence * 0.45
    );

  const downside =
    profile.variability *
    (
      0.65 +
      uncertainty * 0.65 +
      strategyRisk * 0.35 +
      (
        1 -
        decisionModeFit
      ) *
        0.4
    ) *
    (
      1 -
      reversibility * 0.2
    );

  const bestCaseImpact =
    addImpact(
      baseImpact,
      {
        revenue:
          upside *
          categoryMultiplier
            .revenue,

        guestExperience:
          upside *
          categoryMultiplier
            .guestExperience *
          0.85,

        operations:
          upside *
          categoryMultiplier
            .operations *
          0.8,
      },
    );

  const worstCaseImpact =
    addImpact(
      baseImpact,
      {
        revenue:
          -downside *
          categoryMultiplier
            .revenue,

        guestExperience:
          -downside *
          categoryMultiplier
            .guestExperience,

        operations:
          -downside *
          categoryMultiplier
            .operations,
      },
    );

  const probabilities =
    getScenarioProbabilities(
      confidence,
      uncertainty,
      decisionModeFit,
      expectedRisk,
    );

  const assumptions =
    getAssumptions(
      strategy,
      belief,
    );

  const bestCaseRisk =
    round(
      clamp(
        expectedRisk * 0.62,
      ),
    );

  const baseCaseRisk =
    expectedRisk;

  const worstCaseRisk =
    round(
      clamp(
        expectedRisk +
          profile.variability *
            0.55 +
          0.12,
      ),
    );

  const bestCase: SimulatedScenario =
    {
      name:
        "best_case",

      probability:
        probabilities.bestCase,

      summary:
        buildScenarioSummary(
          strategy,
          "best_case",
          bestCaseImpact,
          bestCaseRisk,
        ),

      impact:
        multiplyImpact(
          bestCaseImpact,
          1,
        ),

      risk:
        bestCaseRisk,

      assumptions,
    };

  const baseCase: SimulatedScenario =
    {
      name:
        "base_case",

      probability:
        probabilities.baseCase,

      summary:
        buildScenarioSummary(
          strategy,
          "base_case",
          baseImpact,
          baseCaseRisk,
        ),

      impact:
        multiplyImpact(
          baseImpact,
          1,
        ),

      risk:
        baseCaseRisk,

      assumptions,
    };

  const worstCase: SimulatedScenario =
    {
      name:
        "worst_case",

      probability:
        probabilities.worstCase,

      summary:
        buildScenarioSummary(
          strategy,
          "worst_case",
          worstCaseImpact,
          worstCaseRisk,
        ),

      impact:
        multiplyImpact(
          worstCaseImpact,
          1,
        ),

      risk:
        worstCaseRisk,

      assumptions,
    };

  const scenarios = [
    bestCase,
    baseCase,
    worstCase,
  ];

  const expectedImpact =
    weightedImpact(
      scenarios.map(
        (scenario) => ({
          probability:
            scenario.probability,

          impact:
            scenario.impact,
        }),
      ),
    );

  const probabilityWeightedRisk =
    round(
      clamp(
        scenarios.reduce(
          (
            total,
            scenario,
          ) =>
            total +
            scenario.risk *
              scenario.probability,
          0,
        ),
      ),
    );

  const dominantExpectedImpact =
    getDominantImpact(
      expectedImpact,
    );

  const summary =
    `"${strategy.title}" is projected to create ` +
    `${describeImpact(
      dominantExpectedImpact.value,
    )} in ${dominantExpectedImpact.label}. ` +
    `Simulation confidence is ${Math.round(
      confidence * 100,
    )}% and probability-weighted risk is ${Math.round(
      probabilityWeightedRisk *
        100,
    )}%.`;

  return {
    strategyId:
      strategy.id,

    strategyTitle:
      strategy.title,

    strategyKind,

    decisionMode:
      strategy.decisionMode,

    relatedBeliefId:
      belief?.id,

      sourceQuestion:
  strategy.sourceQuestion,

    relatedBeliefCategory:
      category,

    summary,

    confidence,

    expectedRevenueImpact:
      round(
        clampImpact(
          expectedImpact.revenue,
        ),
      ),

    expectedGuestExperienceImpact:
      round(
        clampImpact(
          expectedImpact
            .guestExperience,
        ),
      ),

    expectedOperationalImpact:
      round(
        clampImpact(
          expectedImpact.operations,
        ),
      ),

    expectedRisk:
      probabilityWeightedRisk,

    evidenceCoverage:
      round(
        evidenceCoverage,
      ),

    uncertainty:
      round(
        uncertainty,
      ),

    decisionModeFit:
      round(
        decisionModeFit,
      ),

    impactScale:
      "normalized_-1_to_1",

    timeHorizon:
      profile.timeHorizon,

    bestCase,

    baseCase,

    worstCase,

    scenarios,

    expectedOutcome:
      strategy.expectedOutcome,

    successMetrics:
      uniqueStrings(
        strategy.successMetrics,
      ),

    leadingIndicators:
      LEADING_INDICATORS[
        category
      ],

    failureConditions:
      getFailureConditions(
        strategy,
        category,
      ),

    assumptions,

    unknowns:
      getUnknowns(
        strategy,
        belief,
        context,
      ),

    generatedAt:
      new Date().toISOString(),
  };
}