import type {
  BrainContext,
} from "@/lib/brain/brainContext";

export type DecisionRecommendation =
  | "approve"
  | "review"
  | "reject";

export type DecisionMode =
  | "act"
  | "test"
  | "investigate"
  | "monitor";

export interface DecisionEvaluation {
  /**
   * Existing compatibility fields.
   */
  missionAlignment: number;

  principleAlignment: number;

  confidence: number;

  recommendation: DecisionRecommendation;

  reasoning: string[];

  /**
   * Rich decision-readiness state.
   */
  objectiveAlignment?: number;

  beliefConfidence?: number;

  evidenceCoverage?: number;

  uncertainty?: number;

  contradictionRatio?: number;

  readinessScore?: number;

  unresolvedQuestions?: number;

  decisionMode?: DecisionMode;

  blockingReasons?: string[];

  unknowns?: string[];

  primaryBeliefId?: string;

  primaryCategory?: string;
}

const DECISION_PRINCIPLE_LENSES = {
  guest: [
    "guest",
    "customer",
    "experience",
    "service",
    "hospitality",
  ],

  longTerm: [
    "long term",
    "long-term",
    "sustainable",
    "durable",
    "future",
  ],

  revenue: [
    "revenue",
    "sales",
    "growth",
    "profit",
    "financial",
  ],

  efficiency: [
    "efficiency",
    "operations",
    "operational",
    "cost",
    "productivity",
  ],

  learning: [
    "learning",
    "evidence",
    "experiment",
    "improvement",
    "adapt",
  ],
} as const;

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

function average(
  values: number[],
  fallback = 0,
) {
  if (values.length === 0) {
    return fallback;
  }

  return (
    values.reduce(
      (total, value) =>
        total + value,
      0,
    ) / values.length
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
function getFactualUnknowns(
  context: BrainContext,
): string[] {
  const primaryBelief =
    context.reasoning
      .beliefs
      ?.primaryBelief;

  return uniqueStrings([
    ...(
      primaryBelief
        ?.unknowns ??
      []
    ),

    ...(
      context.reasoning
        .hypotheses
        ?.unknowns ??
      []
    ),
  ]);
}
function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function getTextProperty(
  value: unknown,
  keys: string[],
) {
  if (!isRecord(value)) {
    return "";
  }

  for (
    const key of keys
  ) {
    const candidate =
      value[key];

    if (
      typeof candidate === "string" &&
      candidate.trim()
    ) {
      return candidate.trim();
    }
  }

  return "";
}

function getPrincipleText(
  principle: unknown,
) {
  if (!isRecord(principle)) {
    return "";
  }

  return [
    getTextProperty(
      principle,
      [
        "title",
        "name",
        "label",
      ],
    ),

    getTextProperty(
      principle,
      [
        "description",
        "statement",
        "reason",
      ],
    ),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function calculateObjectiveAlignment(
  context: BrainContext,
) {
  const objective =
    context.reasoning
      .objective;

  if (!objective) {
    return 0.25;
  }

  const confidence =
    clamp(
      objective.confidence,
    );

  const hasTitle =
    Boolean(
      objective.title?.trim(),
    );

  const hasReason =
    Boolean(
      objective.reason?.trim(),
    );

  return round(
    clamp(
      0.42 +
        confidence * 0.4 +
        (
          hasTitle
            ? 0.1
            : 0
        ) +
        (
          hasReason
            ? 0.08
            : 0
        ),
    ),
  );
}

function calculateMissionAlignment(
  context: BrainContext,
  objectiveAlignment: number,
  beliefConfidence: number,
) {
  const mission =
    context.reasoning
      .mission;

  if (!mission) {
    return round(
      clamp(
        0.3 +
          objectiveAlignment *
            0.25 +
          beliefConfidence *
            0.1,
      ),
    );
  }

  const hasMissionTitle =
    Boolean(
      mission.title?.trim(),
    );

  return round(
    clamp(
      0.55 +
        (
          hasMissionTitle
            ? 0.12
            : 0
        ) +
        objectiveAlignment *
          0.23 +
        beliefConfidence *
          0.1,
    ),
  );
}

function getRecognizedPrincipleCoverage(
  context: BrainContext,
) {
  const principles =
    context.reasoning
      .principles ??
    [];

  if (
    principles.length === 0
  ) {
    return 0;
  }

  const principleText =
    principles
      .map(
        (principle) =>
          getPrincipleText(
            principle,
          ),
      )
      .join(" ");

  const recognizedLenses =
    Object.values(
      DECISION_PRINCIPLE_LENSES,
    ).filter(
      (keywords) =>
        keywords.some(
          (keyword) =>
            principleText.includes(
              keyword,
            ),
        ),
    ).length;

  const recognizedCoverage =
    recognizedLenses /
    Object.keys(
      DECISION_PRINCIPLE_LENSES,
    ).length;

  const structuralCoverage =
    clamp(
      principles.length / 5,
    );

  return Math.max(
    recognizedCoverage,
    structuralCoverage * 0.7,
  );
}

function getDialogueCoverage(
  context: BrainContext,
) {
  const questions =
    context.reasoning
      .internalDialogue
      ?.questions ??
    [];

  if (
    questions.length === 0
  ) {
    return 0;
  }

  const kinds =
    new Set(
      questions
        .map(
          (question) =>
            question.kind,
        )
        .filter(
          (
            kind,
          ): kind is NonNullable<
            typeof kind
          > =>
            Boolean(kind),
        ),
    );

  const requiredKinds = [
    "risk",
    "opportunity",
    "uncertainty",
    "decision_threshold",
    "learning",
  ];

  const coveredKinds =
    requiredKinds.filter(
      (kind) =>
        kinds.has(
          kind as never,
        ),
    ).length;

  return clamp(
    coveredKinds /
      requiredKinds.length,
  );
}

function calculatePrincipleAlignment(
  context: BrainContext,
) {
  const principles =
    context.reasoning
      .principles ??
    [];

  const principleCoverage =
    getRecognizedPrincipleCoverage(
      context,
    );

  const dialogueCoverage =
    getDialogueCoverage(
      context,
    );

  if (
    principles.length === 0
  ) {
    return round(
      clamp(
        0.3 +
          dialogueCoverage *
            0.25,
      ),
    );
  }

  return round(
    clamp(
      0.48 +
        principleCoverage *
          0.27 +
        dialogueCoverage *
          0.25,
    ),
  );
}

function determineDecisionMode(
  context: BrainContext,
  evidenceCoverage: number,
  uncertainty: number,
  contradictionRatio: number,
  unresolvedQuestions: number,
): DecisionMode {
  const primaryBelief =
    context.reasoning
      .beliefs
      ?.primaryBelief;

  if (
    !primaryBelief ||
    primaryBelief.status ===
      "rejected"
  ) {
    return "investigate";
  }

  if (
    uncertainty >= 0.7 ||
    evidenceCoverage < 0.3
  ) {
    return "investigate";
  }

  if (
    primaryBelief.status ===
      "contested" ||
    primaryBelief.status ===
      "provisional" ||
    contradictionRatio >= 0.3 ||
    unresolvedQuestions > 0
  ) {
    return "test";
  }

  if (
    primaryBelief.category ===
    "stability"
  ) {
    return "monitor";
  }

  if (
    primaryBelief.category ===
    "growth"
  ) {
    return "test";
  }

  return "act";
}

function buildBlockingReasons(
  context: BrainContext,
  evidenceCoverage: number,
  uncertainty: number,
  contradictionRatio: number,
  unresolvedQuestions: number,
) {
  const reasons: string[] =
    [];

  const primaryBelief =
    context.reasoning
      .beliefs
      ?.primaryBelief;

  if (
    !context.reasoning
      .mission
  ) {
    reasons.push(
      "No Brain mission is available for decision alignment.",
    );
  }

  if (
    !context.reasoning
      .objective
  ) {
    reasons.push(
      "No current operating objective has been established.",
    );
  }

  if (!primaryBelief) {
    reasons.push(
      "No primary belief has been formed.",
    );
  }

  if (
    primaryBelief?.status ===
    "rejected"
  ) {
    reasons.push(
      "The current primary belief has insufficient support.",
    );
  }

  if (
    primaryBelief?.status ===
    "contested"
  ) {
    reasons.push(
      "The primary belief remains contested by a competing explanation.",
    );
  }

  if (
    evidenceCoverage < 0.3
  ) {
    reasons.push(
      "Evidence coverage is too limited for a high-confidence action.",
    );
  }

  if (
    uncertainty >= 0.7
  ) {
    reasons.push(
      "Belief-system uncertainty is too high for a large or irreversible action.",
    );
  }

  if (
    contradictionRatio >= 0.4
  ) {
    reasons.push(
      "Material evidence contradicts the primary belief.",
    );
  }

  if (
    unresolvedQuestions > 0
  ) {
    reasons.push(
      `${unresolvedQuestions} executive question${
        unresolvedQuestions === 1
          ? ""
          : "s"
      } may block a high-confidence decision.`,
    );
  }

  return uniqueStrings(
    reasons,
  );
}

function determineRecommendation(
  params: {
    confidence: number;

    readinessScore: number;

    decisionMode: DecisionMode;

    blockingReasons: string[];

    primaryBeliefStatus:
      | string
      | undefined;

    evidenceCoverage: number;
  },
): DecisionRecommendation {
  const {
    confidence,
    readinessScore,
    decisionMode,
    blockingReasons,
    primaryBeliefStatus,
    evidenceCoverage,
  } = params;

  if (
    primaryBeliefStatus ===
      "rejected" ||
    (
      evidenceCoverage < 0.12 &&
      confidence < 0.35
    ) ||
    readinessScore < 0.3
  ) {
    return "reject";
  }

  if (
    decisionMode ===
      "investigate" ||
    decisionMode ===
      "test" ||
    blockingReasons.length > 0 ||
    confidence < 0.7
  ) {
    return "review";
  }

  return "approve";
}

export function evaluateDecision(
  context: BrainContext,
): DecisionEvaluation {
  const reasoning: string[] =
    [];

  const beliefSystem =
    context.reasoning
      .beliefs;

  const primaryBelief =
    beliefSystem
      ?.primaryBelief;

  const objectiveAlignment =
    calculateObjectiveAlignment(
      context,
    );

  const beliefConfidence =
    clamp(
      primaryBelief
        ?.confidence ??
      0,
    );

  const evidenceCoverage =
    round(
      clamp(
        average(
          [
            beliefSystem
              ?.evidenceCoverage,

            context.reasoning
              .hypotheses
              ?.evidenceCoverage,

            primaryBelief
              ?.evidenceCoverage,
          ].filter(
            (
              value,
            ): value is number =>
              typeof value ===
                "number" &&
              Number.isFinite(
                value,
              ),
          ),
          0,
        ),
      ),
    );

  const uncertainty =
    round(
      clamp(
        beliefSystem
          ?.uncertainty ??
        (
          primaryBelief
            ? 1 -
              primaryBelief
                .confidence
            : 1
        ),
      ),
    );

  const contradictionRatio =
    round(
      clamp(
        primaryBelief
          ?.contradictionRatio ??
        0,
      ),
    );

  const unresolvedQuestions =
  getFactualUnknowns(
    context,
  ).length;
  const missionAlignment =
    calculateMissionAlignment(
      context,
      objectiveAlignment,
      beliefConfidence,
    );

  const principleAlignment =
    calculatePrincipleAlignment(
      context,
    );

  const unresolvedPenalty =
    clamp(
      unresolvedQuestions *
        0.035,
      0,
      0.18,
    );

  const contradictionPenalty =
    contradictionRatio *
    0.15;

  const statusPenalty =
    primaryBelief?.status ===
      "rejected"
      ? 0.3
      : primaryBelief
            ?.status ===
          "contested"
        ? 0.12
        : primaryBelief
              ?.status ===
            "provisional"
          ? 0.05
          : 0;

  const confidence =
    round(
      clamp(
        missionAlignment *
          0.1 +
          principleAlignment *
            0.1 +
          objectiveAlignment *
            0.12 +
          beliefConfidence *
            0.28 +
          evidenceCoverage *
            0.2 +
          (
            1 -
            uncertainty
          ) *
            0.2 -
          unresolvedPenalty -
          contradictionPenalty -
          statusPenalty,
      ),
    );

  const readinessScore =
    round(
      clamp(
        confidence *
          0.55 +
          evidenceCoverage *
            0.15 +
          objectiveAlignment *
            0.1 +
          missionAlignment *
            0.1 +
          principleAlignment *
            0.1,
      ),
    );

  const decisionMode =
    determineDecisionMode(
      context,
      evidenceCoverage,
      uncertainty,
      contradictionRatio,
      unresolvedQuestions,
    );

  const blockingReasons =
    buildBlockingReasons(
      context,
      evidenceCoverage,
      uncertainty,
      contradictionRatio,
      unresolvedQuestions,
    );

  const recommendation =
    determineRecommendation({
      confidence,

      readinessScore,

      decisionMode,

      blockingReasons,

      primaryBeliefStatus:
        primaryBelief?.status,

      evidenceCoverage,
    });

  const mission =
    context.reasoning
      .mission;

  const objective =
    context.reasoning
      .objective;

  if (mission) {
    reasoning.push(
      `Decision evaluated against the mission "${mission.title}".`,
    );
  } else {
    reasoning.push(
      "The Brain mission is unavailable, reducing decision alignment confidence.",
    );
  }

  if (objective) {
    reasoning.push(
      `Current objective: "${objective.title}" with ${Math.round(
        clamp(
          objective.confidence,
        ) * 100,
      )}% confidence.`,
    );
  } else {
    reasoning.push(
      "No current objective is available.",
    );
  }

  if (primaryBelief) {
    reasoning.push(
      `Primary belief: "${primaryBelief.statement}" with ${Math.round(
        beliefConfidence * 100,
      )}% confidence and status "${primaryBelief.status ?? "unspecified"}".`,
    );
  } else {
    reasoning.push(
      "No primary belief has been formed.",
    );
  }

  reasoning.push(
    `Evidence coverage is ${Math.round(
      evidenceCoverage * 100,
    )}% and uncertainty is ${Math.round(
      uncertainty * 100,
    )}%.`,
  );

  if (
    contradictionRatio > 0
  ) {
    reasoning.push(
      `${Math.round(
        contradictionRatio * 100,
      )}% of weighted evidence pressure contradicts the primary belief.`,
    );
  }

  reasoning.push(
    `Decision mode is "${decisionMode}" and recommendation is "${recommendation}".`,
  );

  return {
    missionAlignment,

    principleAlignment,

    objectiveAlignment,

    beliefConfidence,

    evidenceCoverage,

    uncertainty,

    contradictionRatio,

    confidence,

    readinessScore,

    unresolvedQuestions,

    decisionMode,

    recommendation,

    blockingReasons,

    unknowns:
      uniqueStrings([
        ...(
          primaryBelief
            ?.unknowns ??
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
      ),

    primaryBeliefId:
      primaryBelief?.id,

    primaryCategory:
      primaryBelief
        ?.category,

    reasoning,
  };
}