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
  InternalQuestion,
} from "./internalDialogue";

export type StrategyKind =
  | "corrective_action"
  | "controlled_experiment"
  | "information_gathering"
  | "risk_containment"
  | "growth"
  | "maintain_monitor";

export type StrategyDecisionMode =
  | "act"
  | "test"
  | "investigate"
  | "contain"
  | "monitor";

export type StrategyUrgency =
  | "low"
  | "medium"
  | "high"
  | "critical";

export type StrategyRisk =
  | "low"
  | "medium"
  | "high";

export type StrategyReversibility =
  | "low"
  | "medium"
  | "high";

export type StrategyFinancialExposure =
  | "none"
  | "low"
  | "medium"
  | "high"
  | "unknown";

export type StrategySafetyBoolean =
  | boolean
  | "unknown";

  export type StrategySafetyProfile = {
  financialExposure:
    StrategyFinancialExposure;

  customerFacing:
    StrategySafetyBoolean;

  legalOrComplianceImpact:
    StrategySafetyBoolean;
};
  export type StrategyQuestionProvenance =
  Pick<
    InternalQuestion,
    | "id"
    | "question"
    | "importance"
    | "kind"
    | "relatedBeliefId"
    | "relatedEvidenceIds"
    | "blockingDecision"
  >;
export interface StrategyCandidate {
  /**
   * Existing compatibility fields.
   */
  id: string;

  title: string;

  description: string;

  priority: number;

  /**
   * Rich strategy metadata.
   */
  kind?: StrategyKind;

  decisionMode?: StrategyDecisionMode;

  rationale?: string;

  confidence?: number;

  urgency?: StrategyUrgency;

  risk?: StrategyRisk;

  

  reversibility?: StrategyReversibility;

  financialExposure?: StrategyFinancialExposure;

customerFacing?: StrategySafetyBoolean;

legalOrComplianceImpact?: StrategySafetyBoolean;

  objectiveId?: string;

  relatedBeliefId?: string;

  relatedHypothesisId?: string;

sourceQuestion?:
  StrategyQuestionProvenance;

expectedOutcome?: string;

  successMetrics?: string[];

  actions?: string[];

  requiredEvidence?: string[];

  assumptions?: string[];
}

interface StrategyBlueprint {
  label: string;

  correctiveTitle: string;

  correctiveDescription: string;

  experimentTitle: string;

  experimentDescription: string;

  expectedOutcome: string;

  actions: string[];

  experimentActions: string[];

  containmentActions: string[];

  successMetrics: string[];

  risk: StrategyRisk;
    correctiveSafety?: StrategySafetyProfile;

  experimentSafety?: StrategySafetyProfile;

  containmentSafety?: StrategySafetyProfile;

}

const MAX_STRATEGIES = 6;

const NEGATIVE_CATEGORIES =
  new Set<HypothesisCategory>([
    "demand",
    "service",
    "staffing",
    "profitability",
    "reputation",
    "execution",
  ]);

const STRATEGY_BLUEPRINTS: Record<
  HypothesisCategory,
  StrategyBlueprint
> = {
  stability: {
    label:
      "operational stability",

    correctiveTitle:
      "Maintain Stable Operations",

    correctiveDescription:
      "Preserve current execution while watching for early signs of deterioration.",

    experimentTitle:
      "Validate Operational Stability",

    experimentDescription:
      "Confirm that current performance is stable across locations, shifts, and dayparts before making larger changes.",

    expectedOutcome:
      "Current performance remains consistent without introducing unnecessary operational risk.",

    actions: [
      "Continue current operating practices.",
      "Monitor the highest-value restaurant signals.",
      "Review performance again at the next decision cycle.",
    ],

    experimentActions: [
      "Compare performance across recent shifts and dayparts.",
      "Validate that stable results are not being driven by one temporary factor.",
      "Define thresholds that would trigger intervention.",
    ],

    containmentActions: [
      "Preserve existing service and staffing standards.",
      "Avoid unnecessary operating changes.",
      "Escalate only when a meaningful negative signal appears.",
    ],

    successMetrics: [
      "Revenue remains stable or improves.",
      "Guest rating remains stable.",
      "No meaningful increase in alerts or refunds.",
    ],

    risk:
      "low",
            correctiveSafety: {
        financialExposure:
          "none",

        customerFacing:
          false,

        legalOrComplianceImpact:
          false,
      },

      experimentSafety: {
        financialExposure:
          "none",

        customerFacing:
          false,

        legalOrComplianceImpact:
          false,
      },

      containmentSafety: {
        financialExposure:
          "none",

        customerFacing:
          false,

        legalOrComplianceImpact:
          false,
      },
  },

  demand: {
    label:
      "demand weakness",

    correctiveTitle:
      "Recover Profitable Guest Demand",

    correctiveDescription:
      "Address the strongest demand constraint while protecting margin and restaurant capacity.",

    experimentTitle:
      "Test the Source of Demand Weakness",

    experimentDescription:
      "Run a limited experiment to determine whether traffic, conversion, daypart demand, or offer relevance is causing the decline.",

    expectedOutcome:
      "Guest demand improves without relying on unprofitable discounting.",

    actions: [
      "Identify the location and daypart with the largest demand decline.",
      "Review traffic, orders, conversion, and recent promotional activity.",
      "Launch one targeted demand-recovery action.",
      "Measure incremental revenue and contribution margin.",
    ],

    experimentActions: [
      "Select one affected location or daypart.",
      "Test one targeted offer, channel, or local demand action.",
      "Compare results against a similar untreated period.",
      "Stop the test if margin or service quality deteriorates.",
    ],

    containmentActions: [
      "Avoid broad discounting before the demand cause is confirmed.",
      "Protect contribution margin.",
      "Pause low-performing acquisition activity where evidence supports it.",
    ],

    successMetrics: [
      "Order volume improves.",
      "Revenue improves.",
      "Incremental contribution margin remains positive.",
    ],

    risk:
      "medium",
            correctiveSafety: {
        financialExposure:
          "low",

        customerFacing:
          true,

        legalOrComplianceImpact:
          "unknown",
      },

      experimentSafety: {
        financialExposure:
          "low",

        customerFacing:
          true,

        legalOrComplianceImpact:
          "unknown",
      },

      containmentSafety: {
        financialExposure:
          "low",

        customerFacing:
          false,

        legalOrComplianceImpact:
          false,
      },
  },

  service: {
    label:
      "service pressure",

    correctiveTitle:
      "Restore Guest Experience Execution",

    correctiveDescription:
      "Correct the service issue most likely to be affecting guest satisfaction, retention, and reputation.",

    experimentTitle:
      "Isolate the Primary Service Failure",

    experimentDescription:
      "Use a controlled operational intervention to determine whether speed, accuracy, hospitality, or recovery is the main service constraint.",

    expectedOutcome:
      "Guest experience improves while service failures and complaints decline.",

    actions: [
      "Identify the highest-frequency service failure.",
      "Review the affected shifts, channels, and handoff points.",
      "Coach the responsible operating team.",
      "Track service outcomes during the next review period.",
    ],

    experimentActions: [
      "Choose one shift or service process for intervention.",
      "Apply one specific workflow or coaching change.",
      "Track wait time, accuracy, complaints, and refunds.",
      "Compare performance before and after the intervention.",
    ],

    containmentActions: [
      "Escalate severe guest complaints quickly.",
      "Strengthen service recovery for affected guests.",
      "Prevent the issue from spreading across additional shifts or locations.",
    ],

    successMetrics: [
      "Guest rating improves.",
      "Service complaints decline.",
      "Refunds or recovery incidents decline.",
    ],

    risk:
      "high",
            correctiveSafety: {
        financialExposure:
          "low",

        customerFacing:
          true,

        legalOrComplianceImpact:
          "unknown",
      },

      experimentSafety: {
        financialExposure:
          "low",

        customerFacing:
          true,

        legalOrComplianceImpact:
          "unknown",
      },

      containmentSafety: {
        financialExposure:
          "low",

        customerFacing:
          true,

        legalOrComplianceImpact:
          "unknown",
      },
  },

  staffing: {
    label:
      "staffing pressure",

    correctiveTitle:
      "Rebalance Staffing Capacity",

    correctiveDescription:
      "Align labor capacity and deployment with the restaurant’s most important operating constraints.",

    experimentTitle:
      "Test the Staffing Constraint",

    experimentDescription:
      "Determine whether labor availability, scheduling, deployment, or productivity is causing the observed performance problem.",

    expectedOutcome:
      "Operational performance improves without creating unsustainable labor cost.",

    actions: [
      "Review labor deployment by shift and station.",
      "Identify overtime, understaffing, absenteeism, or productivity gaps.",
      "Reassign labor toward the highest-impact constraint.",
      "Measure service and labor performance after the change.",
    ],

    experimentActions: [
      "Select one affected shift.",
      "Adjust staffing coverage or role deployment.",
      "Measure service, throughput, and labor percentage.",
      "Compare the result with a similar baseline shift.",
    ],

    containmentActions: [
      "Protect critical operating positions.",
      "Reduce avoidable overtime where safe.",
      "Avoid labor reductions that would worsen service execution.",
    ],

    successMetrics: [
      "Labor percentage moves toward target.",
      "Service performance improves.",
      "Overtime or staffing failures decline.",
    ],

    risk:
      "high",
            correctiveSafety: {
        financialExposure:
          "medium",

        customerFacing:
          false,

        legalOrComplianceImpact:
          true,
      },

      experimentSafety: {
        financialExposure:
          "medium",

        customerFacing:
          false,

        legalOrComplianceImpact:
          true,
      },

      containmentSafety: {
        financialExposure:
          "medium",

        customerFacing:
          false,

        legalOrComplianceImpact:
          true,
      },
  },

  profitability: {
    label:
      "profitability pressure",

    correctiveTitle:
      "Protect Restaurant Profitability",

    correctiveDescription:
      "Address the highest-impact source of margin leakage without weakening guest experience or long-term demand.",

    experimentTitle:
      "Isolate the Main Margin Constraint",

    experimentDescription:
      "Test whether labor, refunds, discounts, product mix, or channel costs are primarily responsible for margin pressure.",

    expectedOutcome:
      "Contribution margin improves while revenue and guest experience remain protected.",

    actions: [
      "Identify the largest controllable source of margin pressure.",
      "Separate demand problems from cost and execution problems.",
      "Apply one focused margin-protection action.",
      "Track financial and guest-experience effects together.",
    ],

    experimentActions: [
      "Select one margin variable for intervention.",
      "Apply a limited cost, mix, or process adjustment.",
      "Measure margin, revenue, and service effects.",
      "Reverse the change if guest or demand performance deteriorates.",
    ],

    containmentActions: [
      "Stop avoidable discount, refund, or labor leakage.",
      "Preserve high-contribution demand.",
      "Avoid broad cost cutting before the primary cause is confirmed.",
    ],

    successMetrics: [
      "Margin percentage improves.",
      "Revenue remains protected.",
      "Refund or cost leakage declines.",
    ],

    risk:
      "high",
            correctiveSafety: {
        financialExposure:
          "medium",

        customerFacing:
          "unknown",

        legalOrComplianceImpact:
          "unknown",
      },

      experimentSafety: {
        financialExposure:
          "medium",

        customerFacing:
          "unknown",

        legalOrComplianceImpact:
          "unknown",
      },

      containmentSafety: {
        financialExposure:
          "medium",

        customerFacing:
          "unknown",

        legalOrComplianceImpact:
          "unknown",
      },
  },

  reputation: {
    label:
      "reputation pressure",

    correctiveTitle:
      "Recover Guest Trust",

    correctiveDescription:
      "Resolve the operating issue behind negative guest sentiment while improving visible service recovery.",

    experimentTitle:
      "Validate the Reputation Root Cause",

    experimentDescription:
      "Determine which recurring guest issue is most responsible for rating and sentiment pressure.",

    expectedOutcome:
      "Guest sentiment improves because the underlying experience becomes more reliable.",

    actions: [
      "Group recent negative feedback by issue.",
      "Identify the most repeated and operationally credible complaint.",
      "Correct the underlying restaurant process.",
      "Respond to unresolved guest feedback promptly.",
    ],

    experimentActions: [
      "Choose the highest-frequency complaint category.",
      "Apply one operating correction at the affected location.",
      "Monitor new reviews, complaints, and service metrics.",
      "Compare results with the previous review period.",
    ],

    containmentActions: [
      "Respond quickly to severe unresolved complaints.",
      "Prevent repeated guest failures.",
      "Escalate issues that indicate safety or systemic operating risk.",
    ],

    successMetrics: [
      "Average rating improves.",
      "Negative review frequency declines.",
      "Repeated complaint categories decline.",
    ],

    risk:
      "high",
            correctiveSafety: {
        financialExposure:
          "low",

        customerFacing:
          true,

        legalOrComplianceImpact:
          "unknown",
      },

      experimentSafety: {
        financialExposure:
          "low",

        customerFacing:
          "unknown",

        legalOrComplianceImpact:
          "unknown",
      },

      containmentSafety: {
        financialExposure:
          "low",

        customerFacing:
          true,

        legalOrComplianceImpact:
          "unknown",
      },
  },

  execution: {
    label:
      "execution leakage",

    correctiveTitle:
      "Eliminate Operational Leakage",

    correctiveDescription:
      "Correct the workflow, accountability, or process failure creating preventable restaurant losses.",

    experimentTitle:
      "Identify the Failing Operating Process",

    experimentDescription:
      "Use a focused intervention to determine which operational process is creating alerts, refunds, errors, or backlogs.",

    expectedOutcome:
      "Execution becomes more reliable and avoidable operating losses decline.",

    actions: [
      "Identify the most frequent execution failure.",
      "Trace the failure to its process, shift, and accountable role.",
      "Apply one corrective workflow change.",
      "Verify completion and measure the outcome.",
    ],

    experimentActions: [
      "Select one high-frequency operating failure.",
      "Change one workflow or control point.",
      "Track error frequency and downstream impact.",
      "Expand the intervention only after improvement is confirmed.",
    ],

    containmentActions: [
      "Stop the highest-cost recurring failure.",
      "Escalate unresolved critical alerts.",
      "Add temporary verification to vulnerable process points.",
    ],

    successMetrics: [
      "Operational alerts decline.",
      "Refunds or errors decline.",
      "Corrective actions are completed successfully.",
    ],

    risk:
      "high",
            correctiveSafety: {
        financialExposure:
          "medium",

        customerFacing:
          "unknown",

        legalOrComplianceImpact:
          "unknown",
      },

      experimentSafety: {
        financialExposure:
          "medium",

        customerFacing:
          "unknown",

        legalOrComplianceImpact:
          "unknown",
      },

      containmentSafety: {
        financialExposure:
          "medium",

        customerFacing:
          "unknown",

        legalOrComplianceImpact:
          "unknown",
      },
  },

  growth: {
    label:
      "controlled growth",

    correctiveTitle:
      "Pursue Controlled Growth",

    correctiveDescription:
      "Use current operating strength to test a profitable growth opportunity without destabilizing execution.",

    experimentTitle:
      "Run a Controlled Growth Test",

    experimentDescription:
      "Validate a growth opportunity at limited scale before expanding it across locations or channels.",

    expectedOutcome:
      "The restaurant creates profitable incremental demand without weakening service, margin, or staffing.",

    actions: [
      "Select the strongest location or daypart for the test.",
      "Choose one measurable growth action.",
      "Define operational and financial guardrails.",
      "Expand only after profitable results are confirmed.",
    ],

    experimentActions: [
      "Run the growth action at one location or daypart.",
      "Measure incremental orders, revenue, margin, and service impact.",
      "Compare performance with a relevant baseline.",
      "Stop or revise the test if guardrails are breached.",
    ],

    containmentActions: [
      "Limit the initial growth test.",
      "Protect service capacity and contribution margin.",
      "Avoid network-wide rollout before validation.",
    ],

    successMetrics: [
      "Incremental revenue is positive.",
      "Incremental contribution margin is positive.",
      "Service and staffing performance remain stable.",
    ],

    risk:
      "medium",
            correctiveSafety: {
        financialExposure:
          "medium",

        customerFacing:
          "unknown",

        legalOrComplianceImpact:
          "unknown",
      },

      experimentSafety: {
        financialExposure:
          "medium",

        customerFacing:
          "unknown",

        legalOrComplianceImpact:
          "unknown",
      },

      containmentSafety: {
        financialExposure:
          "low",

        customerFacing:
          "unknown",

        legalOrComplianceImpact:
          "unknown",
      },
  },

  unknown: {
    label:
      "diagnostic uncertainty",

    correctiveTitle:
      "Clarify the Operating Situation",

    correctiveDescription:
      "Gather the missing evidence required to form a reliable restaurant diagnosis.",

    experimentTitle:
      "Run a Diagnostic Investigation",

    experimentDescription:
      "Resolve the most important uncertainty before committing to a larger operating action.",

    expectedOutcome:
      "The Brain obtains enough reliable evidence to choose a defensible action.",

    actions: [
      "Identify the highest-impact missing information.",
      "Collect the relevant operational evidence.",
      "Compare the leading explanations.",
      "Re-run the reasoning cycle after the evidence is available.",
    ],

    experimentActions: [
      "Choose the uncertainty most likely to change the decision.",
      "Collect or test that evidence at limited cost.",
      "Update hypothesis confidence.",
      "Avoid irreversible action until the diagnosis improves.",
    ],

    containmentActions: [
      "Avoid irreversible operating changes.",
      "Protect guest experience and cash flow.",
      "Monitor for signals that require immediate intervention.",
    ],

    successMetrics: [
      "Evidence coverage improves.",
      "Belief uncertainty declines.",
      "A primary explanation becomes meaningfully stronger.",
    ],

    risk:
      "low",
            correctiveSafety: {
        financialExposure:
          "none",

        customerFacing:
          false,

        legalOrComplianceImpact:
          false,
      },

      experimentSafety: {
        financialExposure:
          "low",

        customerFacing:
          "unknown",

        legalOrComplianceImpact:
          "unknown",
      },

      containmentSafety: {
        financialExposure:
          "none",

        customerFacing:
          false,

        legalOrComplianceImpact:
          false,
      },
  },
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

function priorityScore(
  value: number,
) {
  return Math.round(
    Math.min(
      100,
      Math.max(
        0,
        value,
      ),
    ),
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

function cleanStatement(
  value:
    | string
    | undefined,
  fallback: string,
) {
  const normalized =
    value
      ?.replace(/\s+/g, " ")
      .trim()
      .replace(/[.!?]+$/g, "");

  return normalized || fallback;
}

function slugify(
  value: string,
) {
  const slug =
    value
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        "-",
      )
      .replace(
        /^-+|-+$/g,
        "",
      )
      .slice(
        0,
        64,
      );

  return slug || "strategy";
}

function getBeliefCategory(
  belief:
    | Belief
    | undefined,
): HypothesisCategory {
  return (
    belief?.category ??
    "unknown"
  );
}

function determineUrgency(
  category: HypothesisCategory,
  confidence: number,
  uncertainty: number,
  unresolvedQuestions: number,
): StrategyUrgency {
  const negativeCategory =
    NEGATIVE_CATEGORIES.has(
      category,
    );

  if (
    negativeCategory &&
    confidence >= 0.82 &&
    unresolvedQuestions === 0
  ) {
    return "critical";
  }

  if (
    negativeCategory &&
    (
      confidence >= 0.68 ||
      unresolvedQuestions > 0
    )
  ) {
    return "high";
  }

  if (
    uncertainty >= 0.65 ||
    category === "unknown"
  ) {
    return "medium";
  }

  return "low";
}

function getFactualUnknowns(
  belief:
    | Belief
    | undefined,
  context: BrainContext,
): string[] {
  return uniqueStrings([
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
  ]);
}

function getRequiredEvidence(
  belief:
    | Belief
    | undefined,
  context: BrainContext,
) {
  return getFactualUnknowns(
    belief,
    context,
  ).slice(
    0,
    5,
  );
}
function toStrategyQuestionProvenance(
  question:
    | InternalQuestion
    | undefined,
):
  | StrategyQuestionProvenance
  | undefined {
  if (!question) {
    return undefined;
  }

  return {
    id:
      question.id,

    question:
      question.question,

    importance:
      question.importance,

    kind:
      question.kind,

    relatedBeliefId:
      question.relatedBeliefId,

    relatedEvidenceIds:
      question.relatedEvidenceIds
        ? [
            ...question
              .relatedEvidenceIds,
          ]
        : undefined,

    blockingDecision:
      question.blockingDecision,
  };
}
function getStrategyDialogueQuestion(
  context: BrainContext,
  options: {
    kinds?: string[];
    relatedBeliefIds?: Array<
      string | undefined
    >;
  } = {},
) {
  const dialogue =
    context.reasoning
      .internalDialogue;

  if (!dialogue) {
    return undefined;
  }

  const allowedKinds =
    options.kinds ?? [];

  const relatedBeliefIds =
    new Set(
      (
        options.relatedBeliefIds ??
        []
      ).filter(
        (
          id,
        ): id is string =>
          typeof id === "string" &&
          id.length > 0,
      ),
    );

  const candidates = [
    ...(
      dialogue.primaryQuestion
        ? [
            dialogue
              .primaryQuestion,
          ]
        : []
    ),

    ...(
      dialogue.questions ??
      []
    ),
  ].filter(
    (question) =>
      question &&
      typeof question.question ===
        "string" &&
      question.question
        .trim()
        .length > 0,
  );

  const matching =
    candidates
      .filter(
        (question) =>
          allowedKinds.length === 0 ||
          (
            question.kind !==
              undefined &&
            allowedKinds.includes(
              question.kind,
            )
          ),
      )
      .filter(
        (question) =>
          relatedBeliefIds.size ===
            0 ||
          !question.relatedBeliefId ||
          relatedBeliefIds.has(
            question.relatedBeliefId,
          ),
      )
      .sort(
        (left, right) => {
          const blockingDifference =
            Number(
              Boolean(
                right.blockingDecision,
              ),
            ) -
            Number(
              Boolean(
                left.blockingDecision,
              ),
            );

          if (
            blockingDifference !== 0
          ) {
            return blockingDifference;
          }

          return (
            right.importance -
            left.importance
          );
        },
      )[0];

  return matching;
}

function createFallbackStrategies(): StrategyCandidate[] {
  return [
    {
      id:
        "maintain",

      title:
        "Maintain Operations",

      description:
        "Continue current operations while monitoring performance.",

      priority:
        50,

      kind:
        "maintain_monitor",

      decisionMode:
        "monitor",

      confidence:
        0.5,

      urgency:
        "low",

      risk:
        "low",

      reversibility:
        "high",

      financialExposure:
        "unknown",

      customerFacing:
        "unknown",

      legalOrComplianceImpact:
        "unknown",
    },

    {
      id:
        "optimize",

      title:
        "Optimize Operations",

      description:
        "Improve efficiency and address the most impactful opportunities.",

      priority:
        75,

      kind:
        "corrective_action",

      decisionMode:
        "act",

      confidence:
        0.6,

      urgency:
        "medium",

      risk:
        "medium",

      reversibility:
        "medium",

      financialExposure:
        "unknown",

      customerFacing:
        "unknown",

      legalOrComplianceImpact:
        "unknown",
    },

    {
      id:
        "growth",

      title:
        "Pursue Growth",

      description:
        "Focus on initiatives that expand revenue and guest acquisition.",

      priority:
        90,

      kind:
        "growth",

      decisionMode:
        "test",

      confidence:
        0.6,

      urgency:
        "low",

      risk:
        "medium",

      reversibility:
        "medium",

      financialExposure:
        "unknown",

      customerFacing:
        "unknown",

      legalOrComplianceImpact:
        "unknown",
    },
  ];
}

function createPrimaryStrategy(
  context: BrainContext,
  primaryBelief: Belief,
  uncertainty: number,
): StrategyCandidate {
  const category =
    getBeliefCategory(
      primaryBelief,
    );

  const blueprint =
    STRATEGY_BLUEPRINTS[
      category
    ];

  const objective =
    context.reasoning
      .objective;

  const objectiveConfidence =
    clamp(
      objective?.confidence ??
      0.5,
    );

  const beliefConfidence =
    clamp(
      primaryBelief.confidence,
    );

    const unresolvedEvidenceGaps =
    getFactualUnknowns(
      primaryBelief,
      context,
    ).length;

  const contested =
    primaryBelief.status ===
      "contested" ||
    context.reasoning
      .beliefs
      ?.contestedBeliefs
      ?.some(
        (belief) =>
          belief.id ===
          primaryBelief.id,
      ) === true;

  const requiresExperiment =
    contested ||
    uncertainty >= 0.55 ||
    beliefConfidence < 0.65;

  const isStability =
    category === "stability";

  const isGrowth =
    category === "growth";

      let kind: StrategyKind;

    let decisionMode: StrategyDecisionMode;

    let title: string;

    let description: string;

    let actions: string[];

    let safetyProfile:
      | StrategySafetyProfile
      | undefined;

    if (
      category === "unknown"
    ) {
      kind =
        "information_gathering";

      decisionMode =
        "investigate";

      title =
        blueprint.experimentTitle;

      description =
        blueprint.experimentDescription;

      actions =
        blueprint.experimentActions;

      safetyProfile = {
        financialExposure:
          "none",

        customerFacing:
          false,

        legalOrComplianceImpact:
          false,
      };
    } else if (
      isStability
    ) {
      kind =
        "maintain_monitor";

      decisionMode =
        "monitor";

      title =
        blueprint.correctiveTitle;

      description =
        blueprint.correctiveDescription;

      actions =
        blueprint.actions;

      safetyProfile = {
        financialExposure:
          "none",

        customerFacing:
          false,

        legalOrComplianceImpact:
          false,
      };
    } else if (
      isGrowth
    ) {
      kind =
        "growth";

      decisionMode =
        "test";

      title =
        blueprint.experimentTitle;

      description =
        blueprint.experimentDescription;

      actions =
        blueprint.experimentActions;

      safetyProfile =
        blueprint.experimentSafety;
    } else if (
      requiresExperiment
    ) {
      kind =
        "controlled_experiment";

      decisionMode =
        "test";

      title =
        blueprint.experimentTitle;

      description =
        blueprint.experimentDescription;

      actions =
        blueprint.experimentActions;

      safetyProfile =
        blueprint.experimentSafety;
    } else {
      kind =
        "corrective_action";

      decisionMode =
        "act";

      title =
        blueprint.correctiveTitle;

      description =
        blueprint.correctiveDescription;

      actions =
        blueprint.actions;

      safetyProfile =
        blueprint.correctiveSafety;
    }

  const basePriority =
    kind ===
    "corrective_action"
      ? 62
      : kind ===
          "controlled_experiment"
        ? 66
        : kind ===
            "information_gathering"
          ? 68
          : kind ===
              "growth"
            ? 58
            : 48;

  const priority =
    priorityScore(
      basePriority +
        beliefConfidence *
          20 +
        objectiveConfidence *
          7 +
        (
          1 -
          uncertainty
        ) *
          (
            kind ===
            "corrective_action"
              ? 8
              : 3
          ) +
          Math.min(
            unresolvedEvidenceGaps *
              2,
            8,
          ),
    );

  const objectiveTitle =
    cleanStatement(
      objective?.title,
      "the current operating objective",
    );

  const beliefStatement =
    cleanStatement(
      primaryBelief.statement,
      "the current primary belief",
    );

  return {
    id:
      `strategy-primary-${slugify(
        category,
      )}`,

    title,

    description,

    priority,

    kind,

    decisionMode,

    rationale:
      `This strategy responds to the belief that "${beliefStatement}" while advancing "${objectiveTitle}".`,

    confidence:
      round(
        beliefConfidence,
      ),

      urgency:
      determineUrgency(
        category,
        beliefConfidence,
        uncertainty,
        unresolvedEvidenceGaps,
      ),

    risk:
      blueprint.risk,

    reversibility:
      kind ===
        "information_gathering" ||
      kind ===
        "controlled_experiment" ||
      kind ===
        "maintain_monitor"
        ? "high"
        : "medium",

    financialExposure:
  safetyProfile?.financialExposure ??
  "unknown",

customerFacing:
  safetyProfile?.customerFacing ??
  "unknown",

legalOrComplianceImpact:
  safetyProfile?.legalOrComplianceImpact ??
  "unknown",
    objectiveId:
      objective?.id,

    relatedBeliefId:
      primaryBelief.id,

    relatedHypothesisId:
      primaryBelief
        .sourceHypothesisId,

    expectedOutcome:
      blueprint.expectedOutcome,

    successMetrics:
      blueprint.successMetrics,

    actions,

    requiredEvidence:
      getRequiredEvidence(
        primaryBelief,
        context,
      ),

    assumptions:
      uniqueStrings(
        primaryBelief.assumptions,
      ),
  };
}

function createInformationStrategy(
  context: BrainContext,
  primaryBelief:
    | Belief
    | undefined,
  uncertainty: number,
): StrategyCandidate {
  const requiredEvidence =
  getRequiredEvidence(
    primaryBelief,
    context,
  );

const unresolvedEvidenceGaps =
  requiredEvidence.length;

const dialogueQuestion =
  getStrategyDialogueQuestion(
    context,
    {
      kinds: [
        "evidence",
        "contradiction",
        "competition",
        "assumption",
        "uncertainty",
        "decision_threshold",
      ],

      relatedBeliefIds: [
        primaryBelief?.id,
      ],
    },
  );

const evidenceActions =
  requiredEvidence
    .slice(
      0,
      dialogueQuestion
        ? 3
        : 4,
    )
    .map(
      (item) =>
        `Collect and validate: ${item}`,
    );

const actions =
  dialogueQuestion
    ? [
        `Resolve the Brain's highest-priority question: ${dialogueQuestion.question}`,
        ...evidenceActions,
      ]
    : evidenceActions.length > 0
      ? evidenceActions
      : [
          "Verify whether any material factual evidence gaps remain.",
          "Compare the strongest competing explanations using current evidence.",
          "Re-run the reasoning cycle before committing to an irreversible action.",
        ];

  return {
    id:
      "strategy-information-gathering",

    title:
      "Resolve the Highest-Impact Unknown",

    description:
      "Gather the evidence most likely to change the Brain’s diagnosis or recommended action.",

      priority:
      priorityScore(
        64 +
          uncertainty *
            27 +
          Math.min(
            unresolvedEvidenceGaps *
              2,
            9,
          ),
      ),

    kind:
      "information_gathering",

    decisionMode:
      "investigate",

      rationale:
      "Material factual evidence gaps or high uncertainty reduce the safety of committing to a larger intervention.",

    confidence:
      round(
        clamp(
          0.55 +
            uncertainty *
              0.35,
        ),
      ),

    urgency:
      uncertainty >= 0.75
        ? "high"
        : "medium",

    risk:
      "low",

    reversibility:
      "high",
            financialExposure:
        "none",

      customerFacing:
        false,

      legalOrComplianceImpact:
        false,

    objectiveId:
      context.reasoning
        .objective?.id,

    relatedBeliefId:
      primaryBelief?.id,

    relatedHypothesisId:
      primaryBelief
        ?.sourceHypothesisId,
        sourceQuestion:
  toStrategyQuestionProvenance(
    dialogueQuestion,
  ),

    expectedOutcome:
      "Evidence coverage improves and the gap between competing explanations becomes large enough to support a safer decision.",

      successMetrics: [
        "Evidence coverage improves.",
        "Belief uncertainty declines.",
        "Material factual evidence gaps are resolved.",
      ],

    actions,

    requiredEvidence,
  };
}

function createCompetingBeliefStrategy(
  context: BrainContext,
  primaryBelief: Belief,
  alternativeBelief: Belief,
  uncertainty: number,
): StrategyCandidate {
  const primaryStatement =
    cleanStatement(
      primaryBelief.statement,
      "the primary explanation",
    );

  const alternativeStatement =
    cleanStatement(
      alternativeBelief.statement,
      "the strongest alternative explanation",
    );
    const dialogueQuestion =
  getStrategyDialogueQuestion(
    context,
    {
      kinds: [
        "competition",
        "contradiction",
        "evidence",
      ],

      relatedBeliefIds: [
        primaryBelief.id,
        alternativeBelief.id,
      ],
    },
  );

  return {
    id:
      "strategy-discriminate-beliefs",

    title:
      "Discriminate Between Competing Explanations",

    description:
      "Run the smallest reliable test that can distinguish the Brain’s two strongest explanations.",

    priority:
      priorityScore(
        68 +
          uncertainty *
            18 +
          (
            1 -
            Math.abs(
              primaryBelief
                .confidence -
                alternativeBelief
                  .confidence,
            )
          ) *
            12,
      ),

    kind:
      "controlled_experiment",

    decisionMode:
      "test",

    rationale:
      `"${primaryStatement}" and "${alternativeStatement}" remain close enough that acting on only one may create avoidable risk.`,

    confidence:
      round(
        clamp(
          (
            primaryBelief
              .confidence +
            alternativeBelief
              .confidence
          ) / 2,
        ),
      ),

    urgency:
      uncertainty >= 0.7
        ? "high"
        : "medium",

    risk:
      "low",

    reversibility:
      "high",

            financialExposure:
        "unknown",

      customerFacing:
        "unknown",

      legalOrComplianceImpact:
        "unknown",

    objectiveId:
      context.reasoning
        .objective?.id,

    relatedBeliefId:
      alternativeBelief.id,

    relatedHypothesisId:
      alternativeBelief
        .sourceHypothesisId,

        sourceQuestion:
  toStrategyQuestionProvenance(
    dialogueQuestion,
  ),

    expectedOutcome:
      "One explanation gains meaningful evidence support while the competing explanation weakens.",

    successMetrics: [
      "The confidence gap between the leading beliefs increases.",
      "Contradicting evidence is reduced or explained.",
      "The next action becomes clearer.",
    ],

    actions:
  dialogueQuestion
    ? [
        `Run a limited-cost test to answer: ${dialogueQuestion.question}`,
        "Collect the discriminating observation required to answer that question.",
        "Update both belief confidence scores from the result.",
        "Advance the stronger explanation only after the result is reviewed.",
      ]
    : [
        "Identify one observation that should differ under the two explanations.",
        "Collect or test that observation at limited cost.",
        "Update both belief confidence scores.",
        "Advance the stronger explanation only after the result is reviewed.",
      ],


    requiredEvidence:
      uniqueStrings([
        ...(
          primaryBelief
            .unknowns ??
          []
        ),

        ...(
          alternativeBelief
            .unknowns ??
          []
        ),
      ]).slice(
        0,
        5,
      ),

    assumptions:
      uniqueStrings([
        ...(
          primaryBelief
            .assumptions ??
          []
        ),

        ...(
          alternativeBelief
            .assumptions ??
          []
        ),
      ]),
  };
}

function createContainmentStrategy(
  context: BrainContext,
  primaryBelief: Belief,
  uncertainty: number,
): StrategyCandidate {
  const category =
    getBeliefCategory(
      primaryBelief,
    );

  const blueprint =
    STRATEGY_BLUEPRINTS[
      category
    ];

  return {
    id:
      `strategy-containment-${slugify(
        category,
      )}`,

    title:
      `Contain ${blueprint.label
        .replace(
          /\b\w/g,
          (character) =>
            character.toUpperCase(),
        )}`,

    description:
      "Limit immediate downside while the Brain continues validating the primary diagnosis.",

    priority:
      priorityScore(
        57 +
          primaryBelief
            .confidence *
            19 +
          uncertainty *
            15,
      ),

    kind:
      "risk_containment",

    decisionMode:
      "contain",

    rationale:
      "The potential cost of waiting or acting on an incomplete diagnosis justifies a reversible protective response.",

    confidence:
      round(
        primaryBelief
          .confidence,
      ),

    urgency:
      primaryBelief
        .confidence >= 0.78
        ? "high"
        : "medium",

    risk:
      "low",

    reversibility:
      "high",

            financialExposure:
  blueprint.containmentSafety
    ?.financialExposure ??
  "unknown",

customerFacing:
  blueprint.containmentSafety
    ?.customerFacing ??
  "unknown",

legalOrComplianceImpact:
  blueprint.containmentSafety
    ?.legalOrComplianceImpact ??
  "unknown",

    objectiveId:
      context.reasoning
        .objective?.id,

    relatedBeliefId:
      primaryBelief.id,

    relatedHypothesisId:
      primaryBelief
        .sourceHypothesisId,

    expectedOutcome:
      "Immediate operating downside is limited without committing the restaurant to an irreversible intervention.",

    successMetrics:
      blueprint.successMetrics,

    actions:
      blueprint
        .containmentActions,

    requiredEvidence:
      getRequiredEvidence(
        primaryBelief,
        context,
      ),

    assumptions:
      uniqueStrings(
        primaryBelief.assumptions,
      ),
  };
}

function createGrowthStrategy(
  context: BrainContext,
  primaryBelief: Belief,
  uncertainty: number,
): StrategyCandidate {
  const blueprint =
    STRATEGY_BLUEPRINTS
      .growth;

  return {
    id:
      "strategy-controlled-growth",

    title:
      blueprint.experimentTitle,

    description:
      blueprint.experimentDescription,

    priority:
      priorityScore(
        54 +
          primaryBelief
            .confidence *
            21 +
          (
            1 -
            uncertainty
          ) *
            17,
      ),

    kind:
      "growth",

    decisionMode:
      "test",

    rationale:
      "Current operating conditions appear strong enough to support a limited growth test with explicit guardrails.",

    confidence:
      round(
        primaryBelief
          .confidence,
      ),

    urgency:
      "low",

    risk:
      blueprint.risk,

    reversibility:
      "high",
            financialExposure:
  blueprint.experimentSafety
    ?.financialExposure ??
  "unknown",

customerFacing:
  blueprint.experimentSafety
    ?.customerFacing ??
  "unknown",

legalOrComplianceImpact:
  blueprint.experimentSafety
    ?.legalOrComplianceImpact ??
  "unknown",

    objectiveId:
      context.reasoning
        .objective?.id,

    relatedBeliefId:
      primaryBelief.id,

    relatedHypothesisId:
      primaryBelief
        .sourceHypothesisId,

    expectedOutcome:
      blueprint.expectedOutcome,

    successMetrics:
      blueprint.successMetrics,

    actions:
      blueprint.experimentActions,

    requiredEvidence:
      getRequiredEvidence(
        primaryBelief,
        context,
      ),

    assumptions:
      uniqueStrings(
        primaryBelief.assumptions,
      ),
  };
}

function createMonitoringStrategy(
  context: BrainContext,
  primaryBelief:
    | Belief
    | undefined,
): StrategyCandidate {
  return {
    id:
      "strategy-maintain-monitor",

    title:
      "Maintain Operations and Monitor",

    description:
      "Preserve current execution while tracking the signals most likely to change the Brain’s diagnosis.",

    priority:
      priorityScore(
        42 +
          (
            primaryBelief
              ?.confidence ??
            0.5
          ) *
            15,
      ),

    kind:
      "maintain_monitor",

    decisionMode:
      "monitor",

    rationale:
      "A reversible monitoring strategy provides a safe baseline against unnecessary intervention.",

    confidence:
      round(
        primaryBelief
          ?.confidence ??
        0.5,
      ),

    urgency:
      "low",

    risk:
      "low",

    reversibility:
      "high",
            financialExposure:
        "none",

      customerFacing:
        false,

      legalOrComplianceImpact:
        false,

    objectiveId:
      context.reasoning
        .objective?.id,

    relatedBeliefId:
      primaryBelief?.id,

    relatedHypothesisId:
      primaryBelief
        ?.sourceHypothesisId,

    expectedOutcome:
      "Operations remain stable while the Brain receives updated evidence.",

    successMetrics: [
      "No meaningful deterioration in restaurant health.",
      "Critical operating thresholds remain within limits.",
      "The next review cycle receives current evidence.",
    ],

    actions: [
      "Continue current operating practices.",
      "Monitor the strongest supporting and contradicting signals.",
      "Re-run the reasoning cycle when thresholds are crossed or new evidence arrives.",
    ],

    requiredEvidence:
      getRequiredEvidence(
        primaryBelief,
        context,
      ),
  };
}

function dedupeStrategies(
  strategies: StrategyCandidate[],
) {
  const seen =
    new Set<string>();

  return strategies.filter(
    (strategy) => {
      const key =
        `${strategy.kind ?? "unknown"}:${strategy.title.toLowerCase()}`;

      if (
        seen.has(key)
      ) {
        return false;
      }

      seen.add(key);

      return true;
    },
  );
}

/**
 * Generates strategies from the Brain's current mental state.
 *
 * Calling generateStrategies() without context remains supported
 * for compatibility with existing callers.
 */
export function generateStrategies(
  context?: BrainContext,
): StrategyCandidate[] {
  if (!context) {
    return createFallbackStrategies();
  }

  const beliefSystem =
    context.reasoning
      .beliefs;

  const primaryBelief =
    beliefSystem
      ?.primaryBelief;

  const uncertainty =
    clamp(
      beliefSystem
        ?.uncertainty ??
        (
          primaryBelief
            ? 1 -
              primaryBelief.confidence
            : 1
        ),
    );

  if (!primaryBelief) {
    return [
      createInformationStrategy(
        context,
        undefined,
        uncertainty,
      ),

      createMonitoringStrategy(
        context,
        undefined,
      ),
    ];
  }

  const strategies: StrategyCandidate[] =
    [
      createPrimaryStrategy(
        context,
        primaryBelief,
        uncertainty,
      ),
    ];

  const alternativeBelief =
    beliefSystem
      ?.alternativeBeliefs
      ?.find(
        (belief) =>
          belief.status !==
          "rejected",
      );

  const confidenceGap =
    alternativeBelief
      ? Math.abs(
          primaryBelief
            .confidence -
            alternativeBelief
              .confidence,
        )
      : 1;

      const hasFactualUnknowns =
      getFactualUnknowns(
        primaryBelief,
        context,
      ).length > 0;

      if (
        uncertainty >= 0.52 ||
        hasFactualUnknowns
      ) {
    strategies.push(
      createInformationStrategy(
        context,
        primaryBelief,
        uncertainty,
      ),
    );
  }

  if (
    alternativeBelief &&
    (
      confidenceGap <= 0.15 ||
      primaryBelief.status ===
        "contested" ||
      alternativeBelief.status ===
        "contested"
    )
  ) {
    strategies.push(
      createCompetingBeliefStrategy(
        context,
        primaryBelief,
        alternativeBelief,
        uncertainty,
      ),
    );
  }

  const category =
    getBeliefCategory(
      primaryBelief,
    );

  if (
    NEGATIVE_CATEGORIES.has(
      category,
    ) &&
    (
      primaryBelief
        .confidence >= 0.65 ||
      uncertainty >= 0.62
    )
  ) {
    strategies.push(
      createContainmentStrategy(
        context,
        primaryBelief,
        uncertainty,
      ),
    );
  }

  if (
    (
      category === "stability" ||
      category === "growth"
    ) &&
    primaryBelief
      .confidence >= 0.65 &&
    uncertainty <= 0.55
  ) {
    strategies.push(
      createGrowthStrategy(
        context,
        primaryBelief,
        uncertainty,
      ),
    );
  }

  strategies.push(
    createMonitoringStrategy(
      context,
      primaryBelief,
    ),
  );

  return dedupeStrategies(
    strategies,
  )
    .sort(
      (left, right) =>
        right.priority -
        left.priority,
    )
    .slice(
      0,
      MAX_STRATEGIES,
    );
}