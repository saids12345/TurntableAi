import type {
  BrainContext,
} from "@/lib/brain/brainContext";
import {
  inferMemoryOutcomeSignal,
} from "@/lib/operatorMemoryTrust";

export type EvidenceSource =
  | "perception"
  | "working_memory"
  | "knowledge"
  | "operator_memory"
  | "planning"
  | "causal_analysis"
  | "prediction"
  | "world_model"
  | "restaurant_state";

export type EvidenceKind =
  | "metric"
  | "trend"
  | "risk"
  | "opportunity"
  | "observation"
  | "assessment"
  | "prediction"
  | "memory"
  | "status"
  | "unknown";

export type EvidenceDirection =
  | "positive"
  | "negative"
  | "neutral"
  | "mixed";

export type HypothesisCategory =
  | "stability"
  | "demand"
  | "service"
  | "staffing"
  | "profitability"
  | "reputation"
  | "execution"
  | "growth"
  | "unknown";

export interface Evidence {
  id: string;

  title: string;

  value: unknown;

  confidence: number;

  source?: EvidenceSource;

  kind?: EvidenceKind;

  direction?: EvidenceDirection;

  path?: string;

  locationName?: string;

  observedAt?: string;
  question?: string;

submissionId?: string;
}

export interface Hypothesis {
  id: string;

  title: string;

  description: string;

  confidence: number;

  supportingEvidence: string[];

  category?: HypothesisCategory;

  evidenceCoverage?: number;

  contradictingEvidence?: string[];

  assumptions?: string[];

  unknowns?: string[];
  resolvedUnknowns?: string[];

partiallyResolvedUnknowns?: string[];

  whatWouldChangeMyMind?: string[];

  reasoning?: string[];

  score?: number;
}

export interface HypothesisResult {
  evidence: Evidence[];

  hypotheses: Hypothesis[];

  primaryHypothesis?: Hypothesis;

  overallConfidence?: number;

  evidenceCoverage?: number;

  unknowns?: string[];
  resolvedUnknowns?: string[];

partiallyResolvedUnknowns?: string[];

  generatedAt?: string;
}

type ScalarValue =
  | string
  | number
  | boolean
  | null;

interface EvidenceRoot {
  path: string;

  value: unknown;

  source: EvidenceSource;

  confidence: number;
}

interface EvidenceLeaf {
  path: string;

  value: ScalarValue;

  source: EvidenceSource;

  confidence: number;

  locationName?: string;
}

interface HypothesisSignal {
  category: HypothesisCategory;

  effect: "support" | "contradict";

  strength: number;

  evidenceId: string;
}

interface HypothesisAccumulator {
  supportingEvidence: Map<string, number>;

  contradictingEvidence: Map<string, number>;
}

interface CategoryDefinition {
  title: string;

  description: string;

  assumptions: string[];

  unknowns: string[];

  whatWouldChangeMyMind: string[];
}

const MAX_EVIDENCE_ITEMS = 60;

const MAX_OBJECT_DEPTH = 5;

const CATEGORY_DEFINITIONS: Record<
  HypothesisCategory,
  CategoryDefinition
> = {
  stability: {
    title:
      "Operations are broadly stable",

    description:
      "The available evidence does not currently indicate a severe operational constraint requiring immediate intervention.",

    assumptions: [
      "The available operating data is recent enough to represent current conditions.",
      "No material restaurant signal is missing from the current Brain context.",
    ],

    unknowns: [
      "Whether performance is equally stable across every daypart and shift.",
      "Whether external conditions could materially change demand soon.",
    ],

    whatWouldChangeMyMind: [
      "A meaningful decline in revenue, orders, margin, rating, or operational health.",
      "A new cluster of alerts, refunds, complaints, or execution failures.",
    ],
  },

  demand: {
    title:
      "Demand weakness is constraining performance",

    description:
      "Revenue or order pressure may be primarily caused by weaker customer demand rather than an isolated execution failure.",

    assumptions: [
      "Revenue and order trends are measured over comparable operating periods.",
      "Major closures or reporting gaps are not distorting the trend.",
    ],

    unknowns: [
      "Guest traffic versus conversion rate.",
      "Daypart-level sales and order trends.",
      "Promotion, weather, event, and competitor effects.",
    ],

    whatWouldChangeMyMind: [
      "Orders and traffic remain healthy while revenue continues to decline.",
      "Service, staffing, or product-quality evidence becomes materially stronger.",
    ],
  },

  service: {
    title:
      "Guest experience or service execution is under pressure",

    description:
      "Service quality, speed, accuracy, or recovery failures may be weakening guest satisfaction and restaurant performance.",

    assumptions: [
      "Guest feedback is representative of the broader customer experience.",
      "Refunds and complaints are tied to service execution rather than isolated exceptions.",
    ],

    unknowns: [
      "Ticket-time and wait-time trends.",
      "Order accuracy by channel and daypart.",
      "Shift-level service performance.",
    ],

    whatWouldChangeMyMind: [
      "Guest ratings and service metrics improve while the business problem persists.",
      "Demand or cost evidence explains the observed performance more convincingly.",
    ],
  },

  staffing: {
    title:
      "Staffing capacity or labor deployment is constraining operations",

    description:
      "Labor availability, scheduling, productivity, or role deployment may be limiting restaurant execution.",

    assumptions: [
      "Labor percentages are calculated consistently.",
      "Staffing pressure is not solely the result of a temporary sales fluctuation.",
    ],

    unknowns: [
      "Scheduled versus actual labor hours.",
      "Overtime, absenteeism, and turnover.",
      "Labor allocation by shift and station.",
    ],

    whatWouldChangeMyMind: [
      "Labor productivity normalizes without operational improvement.",
      "Service or demand evidence becomes stronger while staffing remains stable.",
    ],
  },

  profitability: {
    title:
      "Cost structure or margin pressure is the primary constraint",

    description:
      "The restaurant may be generating insufficient contribution because of margin compression, labor pressure, refunds, or weak revenue efficiency.",

    assumptions: [
      "Margin and labor figures reflect comparable accounting periods.",
      "One-time costs are not materially distorting profitability.",
    ],

    unknowns: [
      "Food and beverage cost variance.",
      "Discount and promotion leakage.",
      "Channel fees and product-level contribution margin.",
    ],

    whatWouldChangeMyMind: [
      "Margin improves while the broader performance problem remains.",
      "Demand or execution evidence becomes the stronger explanation.",
    ],
  },

  reputation: {
    title:
      "Reputation pressure is weakening guest trust",

    description:
      "Ratings, reviews, sentiment, or repeated complaints may be reducing repeat visits and future demand.",

    assumptions: [
      "Recent reviews reflect current restaurant operations.",
      "Review volume is sufficient to identify a meaningful pattern.",
    ],

    unknowns: [
      "Review sentiment by issue category.",
      "Repeat-guest behavior following negative experiences.",
      "Platform-level rating and response trends.",
    ],

    whatWouldChangeMyMind: [
      "Ratings and sentiment recover without improvement in business performance.",
      "Operational metrics show a stronger cause unrelated to guest perception.",
    ],
  },

  execution: {
    title:
      "Operational execution is producing avoidable leakage",

    description:
      "Alerts, refunds, backlogs, process failures, or inconsistent execution may be creating preventable restaurant losses.",

    assumptions: [
      "Open alerts and pending actions represent unresolved operating conditions.",
      "Execution failures are recurring rather than isolated incidents.",
    ],

    unknowns: [
      "Failure frequency by process and shift.",
      "Root causes behind refunds and operational alerts.",
      "Whether existing corrective actions were completed successfully.",
    ],

    whatWouldChangeMyMind: [
      "Execution metrics normalize while the performance problem remains.",
      "Demand, staffing, or profitability evidence becomes materially stronger.",
    ],
  },

  growth: {
    title:
      "The business has a controlled growth opportunity",

    description:
      "Strong or improving conditions may support a measured growth experiment without creating disproportionate operational risk.",

    assumptions: [
      "Current performance is repeatable rather than temporary.",
      "Growth capacity exists without weakening service or profitability.",
    ],

    unknowns: [
      "Incremental capacity by location and daypart.",
      "Expected acquisition cost and contribution margin.",
      "Operational limits under higher demand.",
    ],

    whatWouldChangeMyMind: [
      "Service, staffing, or margin performance weakens.",
      "Growth experiments fail to produce profitable incremental demand.",
    ],
  },

  unknown: {
    title:
      "The primary operating condition is not yet clear",

    description:
      "The Brain does not currently have enough reliable evidence to select a well-supported explanation.",

    assumptions: [
      "Missing evidence may materially change the diagnosis.",
    ],

    unknowns: [
      "Recent restaurant performance metrics.",
      "Guest-experience and operational execution signals.",
      "Comparable historical outcomes.",
    ],

    whatWouldChangeMyMind: [
      "Additional reliable restaurant evidence becomes available.",
    ],
  },
};

const CATEGORY_KEYWORDS: Partial<
  Record<HypothesisCategory, string[]>
> = {
  demand: [
    "demand",
    "traffic",
    "orders",
    "order volume",
    "transactions",
    "revenue",
    "sales",
    "conversion",
    "foot traffic",
  ],

  service: [
    "service",
    "wait",
    "queue",
    "ticket time",
    "speed",
    "guest experience",
    "customer experience",
    "hospitality",
    "order accuracy",
    "wrong order",
  ],

  staffing: [
    "staff",
    "staffing",
    "labor",
    "employee",
    "overtime",
    "schedule",
    "absentee",
    "turnover",
    "productivity",
  ],

  profitability: [
    "profit",
    "profitability",
    "margin",
    "cost",
    "food cost",
    "labor cost",
    "contribution",
    "discount",
    "fee",
  ],

  reputation: [
    "rating",
    "review",
    "reputation",
    "sentiment",
    "complaint",
    "guest trust",
  ],

  execution: [
    "execution",
    "operations",
    "operational",
    "refund",
    "alert",
    "backlog",
    "pending action",
    "error",
    "accuracy",
    "failure",
  ],

  growth: [
    "growth",
    "opportunity",
    "expansion",
    "upsell",
    "promotion",
    "increase demand",
    "strong demand",
    "capacity",
    "incremental capacity",
    "daypart",
    "unused seats",
  ],

  stability: [
    "stable",
    "healthy",
    "on track",
    "no action needed",
    "performing well",
  ],
};

const NEGATIVE_TERMS = [
  "risk",
  "decline",
  "declining",
  "decrease",
  "decreasing",
  "falling",
  "weak",
  "weakness",
  "pressure",
  "problem",
  "issue",
  "critical",
  "complaint",
  "refund",
  "failure",
  "underperform",
  "below target",
  "negative",
  "worsening",
  "shortage",
  "backlog",
  "at capacity",
"no capacity",
"cannot handle",
"unable to handle",
"overloaded",
"requires additional labor",
];

const POSITIVE_TERMS = [
  "healthy",
  "stable",
  "improving",
  "improvement",
  "growth",
  "opportunity",
  "strong",
  "above target",
  "on track",
  "positive",
  "recovering",
  "increase",
  "increasing",
  "available capacity",
"unused",
"can handle",
"without adding labor",
"room to grow",
];

const BLOCKED_PATH_SEGMENTS = new Set([
  "id",
  "runid",
  "createdat",
  "updatedat",
  "generatedat",
  "completedat",
  "confidence",
  "confidencescore",
  "candidatestrategies",
  "futuresimulations",
  "futurecomparison",
  "executivedecision",
  "internaldialogue",
  "beliefs",
  "hypotheses",
  "strategy",
  "strategies",
  "checklist",
  "recommendedaction",
]);

const RELEVANT_TERMS = [
  "summary",
  "assessment",
  "observation",
  "risk",
  "opportunity",
  "cause",
  "hypothesis",
  "prediction",
  "health",
  "level",
  "status",
  "revenue",
  "sales",
  "orders",
  "traffic",
  "demand",
  "refund",
  "rating",
  "review",
  "sentiment",
  "labor",
  "staff",
  "margin",
  "profit",
  "service",
  "operation",
  "alert",
  "action",
  "score",
  "issue",
  "complaint",
  "performance",
  "outcome",
];

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isScalar(
  value: unknown,
): value is ScalarValue {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

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

function normalizeConfidence(
  value: unknown,
): number | null {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return null;
  }

  if (value > 1) {
    return clamp(
      value / 100,
    );
  }

  return clamp(
    value,
  );
}

function normalizeSegment(
  value: string,
) {
  return value
    .replace(/\[(\d+)\]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function humanize(
  value: string,
) {
  return value
    .replace(/\[(\d+)\]/g, " $1")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase(),
    );
}

function titleFromPath(
  path: string,
) {
  const segments = path
    .split(".")
    .filter(Boolean);

  const last =
    segments.at(-1) ??
    "Evidence";

  const parent =
    segments.at(-2);

  const genericKeys = new Set([
    "summary",
    "status",
    "level",
    "value",
    "title",
    "description",
    "explanation",
    "cause",
  ]);

  if (
    parent &&
    genericKeys.has(
      normalizeSegment(last),
    )
  ) {
    return `${humanize(parent)} ${humanize(last)}`;
  }

  return humanize(last);
}

function stableHash(
  value: string,
) {
  let hash = 0;

  for (
    let index = 0;
    index < value.length;
    index += 1
  ) {
    hash =
      (hash << 5) -
      hash +
      value.charCodeAt(index);

    hash |= 0;
  }

  return Math.abs(
    hash,
  ).toString(36);
}

function truncateString(
  value: string,
  maximum = 500,
) {
  const normalized =
    value
      .replace(/\s+/g, " ")
      .trim();

  if (
    normalized.length <= maximum
  ) {
    return normalized;
  }

  return `${normalized.slice(
    0,
    maximum - 1,
  )}…`;
}

function getLocationName(
  value: Record<string, unknown>,
  inherited?: string,
) {
  const candidates = [
    value.locationName,
    value.location_name,
    value.displayName,
  ];

  for (
    const candidate of candidates
  ) {
    if (
      typeof candidate === "string" &&
      candidate.trim()
    ) {
      return candidate.trim();
    }
  }

  return inherited;
}

function getLocalConfidence(
  value: Record<string, unknown>,
  inherited: number,
) {
  const local =
    normalizeConfidence(
      value.confidence,
    ) ??
    normalizeConfidence(
      value.confidenceScore,
    );

  if (local === null) {
    return inherited;
  }

  return clamp(
    inherited * 0.45 +
      local * 0.55,
  );
}

function shouldInspectPath(
  path: string,
) {
  const segments =
    path
      .split(".")
      .map(normalizeSegment);

  return !segments.some(
    (segment) =>
      BLOCKED_PATH_SEGMENTS.has(
        segment,
      ),
  );
}

function isRelevantLeaf(
  path: string,
  value: ScalarValue,
) {
  if (
    !shouldInspectPath(path)
  ) {
    return false;
  }

  const normalizedPath =
    path.toLowerCase();

  const valueText =
    typeof value === "string"
      ? value.toLowerCase()
      : "";

  return RELEVANT_TERMS.some(
    (term) =>
      normalizedPath.includes(term) ||
      valueText.includes(term),
  );
}

function collectScalarLeaves(
  value: unknown,
  path: string,
  source: EvidenceSource,
  confidence: number,
  output: EvidenceLeaf[],
  depth = 0,
  inheritedLocationName?: string,
  seen = new WeakSet<object>(),
) {
  if (
    output.length >= MAX_EVIDENCE_ITEMS * 2 ||
    depth > MAX_OBJECT_DEPTH
  ) {
    return;
  }

  if (
    isScalar(value)
  ) {
    if (
      isRelevantLeaf(
        path,
        value,
      )
    ) {
      output.push({
        path,

        value:
          typeof value === "string"
            ? truncateString(value)
            : value,

        source,

        confidence,

        locationName:
          inheritedLocationName,
      });
    }

    return;
  }

  if (
    typeof value !== "object" ||
    value === null
  ) {
    return;
  }

  if (
    seen.has(value)
  ) {
    return;
  }

  seen.add(value);

  if (
    Array.isArray(value)
  ) {
    value.forEach(
      (item, index) => {
        collectScalarLeaves(
          item,
          `${path}[${index}]`,
          source,
          confidence,
          output,
          depth + 1,
          inheritedLocationName,
          seen,
        );
      },
    );

    return;
  }

  if (
    !isRecord(value)
  ) {
    return;
  }

  const locationName =
    getLocationName(
      value,
      inheritedLocationName,
    );

  const localConfidence =
    getLocalConfidence(
      value,
      confidence,
    );

  for (
    const [key, child] of Object.entries(
      value,
    )
  ) {
    const childPath =
      path
        ? `${path}.${key}`
        : key;

    if (
      !shouldInspectPath(
        childPath,
      )
    ) {
      continue;
    }

    collectScalarLeaves(
      child,
      childPath,
      source,
      localConfidence,
      output,
      depth + 1,
      locationName,
      seen,
    );
  }
}

function inferEvidenceKind(
  path: string,
): EvidenceKind {
  const normalized =
    path.toLowerCase();

  if (
    normalized.includes("prediction") ||
    normalized.includes("forecast")
  ) {
    return "prediction";
  }

  if (
    normalized.includes("opportunity")
  ) {
    return "opportunity";
  }

  if (
    normalized.includes("risk") ||
    normalized.includes("alert")
  ) {
    return "risk";
  }

  if (
    normalized.includes("delta") ||
    normalized.includes("trend") ||
    normalized.includes("change")
  ) {
    return "trend";
  }

  if (
    normalized.includes("memory") ||
    normalized.includes("outcome")
  ) {
    return "memory";
  }

  if (
    normalized.includes("observation")
  ) {
    return "observation";
  }

  if (
    normalized.includes("assessment") ||
    normalized.includes("summary") ||
    normalized.includes("cause") ||
    normalized.includes("hypothesis")
  ) {
    return "assessment";
  }

  if (
    normalized.includes("status") ||
    normalized.includes("health") ||
    normalized.includes("level")
  ) {
    return "status";
  }

  if (
    typeof path === "string" &&
    [
      "revenue",
      "sales",
      "orders",
      "refund",
      "rating",
      "labor",
      "margin",
      "score",
      "alerts",
    ].some(
      (term) =>
        normalized.includes(term),
    )
  ) {
    return "metric";
  }

  return "unknown";
}

function inferNumericDirection(
  path: string,
  value: number,
): EvidenceDirection {
  const normalized =
    path.toLowerCase();

  if (
    normalized.includes("delta") ||
    normalized.includes("change") ||
    normalized.includes("growth")
  ) {
    if (value <= -3) {
      return "negative";
    }

    if (value >= 3) {
      return "positive";
    }

    return "neutral";
  }

  if (
    normalized.includes("rating")
  ) {
    if (value < 4) {
      return "negative";
    }

    if (value >= 4.3) {
      return "positive";
    }

    return "neutral";
  }

  if (
    normalized.includes("reviewissue") ||
    normalized.includes("negativecount") ||
    normalized.includes("openalerts") ||
    normalized.includes("pendingactions") ||
    normalized.includes("refund")
  ) {
    if (value >= 3) {
      return "negative";
    }

    if (value === 0) {
      return "positive";
    }

    return "neutral";
  }

  if (
    normalized.includes("laborpct") ||
    normalized.includes("laborpercentage")
  ) {
    if (value > 35) {
      return "negative";
    }

    if (
      value >= 20 &&
      value <= 32
    ) {
      return "positive";
    }

    return "neutral";
  }

  if (
    normalized.includes("marginpct") ||
    normalized.includes("marginpercentage")
  ) {
    if (value < 8) {
      return "negative";
    }

    if (value >= 15) {
      return "positive";
    }

    return "neutral";
  }

  if (
    normalized.includes("score")
  ) {
    if (value < 60) {
      return "negative";
    }

    if (value >= 75) {
      return "positive";
    }

    return "neutral";
  }

  return "neutral";
}

function inferTextDirection(
  value: string,
): EvidenceDirection {
  const normalized =
    value.toLowerCase();

  if (
    normalized.includes(
      "no significant risk",
    ) ||
    normalized.includes(
      "no major risk",
    ) ||
    normalized.includes(
      "no critical issue",
    ) ||
    normalized.includes(
      "no action needed",
    )
  ) {
    return "positive";
  }

  const positiveMatches =
    POSITIVE_TERMS.filter(
      (term) =>
        normalized.includes(term),
    ).length;

  const negativeMatches =
    NEGATIVE_TERMS.filter(
      (term) =>
        normalized.includes(term),
    ).length;

  if (
    positiveMatches > 0 &&
    negativeMatches > 0
  ) {
    return "mixed";
  }

  if (
    negativeMatches > 0
  ) {
    return "negative";
  }

  if (
    positiveMatches > 0
  ) {
    return "positive";
  }

  return "neutral";
}

function inferEvidenceDirection(
  path: string,
  value: ScalarValue,
): EvidenceDirection {
  if (
    typeof value === "number"
  ) {
    return inferNumericDirection(
      path,
      value,
    );
  }

  if (
    typeof value === "string"
  ) {
    return inferTextDirection(
      value,
    );
  }

  if (
    typeof value === "boolean"
  ) {
    const normalized =
      path.toLowerCase();

    if (
      normalized.includes("risk") ||
      normalized.includes("alert") ||
      normalized.includes("failed")
    ) {
      return value
        ? "negative"
        : "positive";
    }
  }

  return "neutral";
}
const MAX_OPERATOR_EVIDENCE_ITEMS =
  15;

const MIN_PARTIAL_RESOLUTION_CONFIDENCE =
  0.55;

const MIN_FULL_RESOLUTION_CONFIDENCE =
  0.75;

type UnknownResolution = {
  unresolved: string[];
  resolved: string[];
  partiallyResolved: string[];
};

function readText(
  value: unknown,
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized =
    value
      .replace(/\s+/g, " ")
      .trim();

  return normalized || null;
}

function normalizeMemoryConfidence(
  value: unknown,
): number {
  const numeric =
    normalizeConfidence(value);

  if (numeric !== null) {
    return numeric;
  }

  const label =
    readText(value)
      ?.toLowerCase();

  if (label === "high") {
    return 0.85;
  }

  if (label === "medium") {
    return 0.65;
  }

  if (label === "low") {
    return 0.4;
  }

  return 0.7;
}

function normalizeObservedAt(
  value: unknown,
): string | undefined {
  const text =
    readText(value);

  if (!text) {
    return undefined;
  }

  const parsed =
    new Date(text);

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
    return text;
  }

  return parsed.toISOString();
}

function getOperatorMemoryContainer(
  context: BrainContext,
): unknown {
  return context.knowledge.operatorMemory;
}

function getRecentOperatorMemoryRows(
  context: BrainContext,
): Record<string, unknown>[] {
  const container =
    getOperatorMemoryContainer(
      context,
    );

  if (Array.isArray(container)) {
    return container.filter(
      (
        item,
      ): item is Record<
        string,
        unknown
      > => isRecord(item),
    );
  }

  if (!isRecord(container)) {
    return [];
  }

  const possibleRows =
    container.recentMemories ??
    container.items ??
    container.memories;

  if (!Array.isArray(possibleRows)) {
    return [];
  }

  return possibleRows.filter(
    (
      item,
    ): item is Record<
      string,
      unknown
    > => isRecord(item),
  );
}

function isEvidenceGapMemory(
  memory: Record<
    string,
    unknown
  >,
) {
  const problemType =
    readText(
      memory.problem_type,
    ) ??
    readText(
      memory.problemType,
    );

  return (
    problemType
      ?.toLowerCase() ===
    "evidence_gap"
  );
}

function getOperatorLearningMemory(
  context: BrainContext,
): unknown {
  const container =
    getOperatorMemoryContainer(
      context,
    );

  const learningRows =
    getRecentOperatorMemoryRows(
      context,
    ).filter(
      (memory) =>
        !isEvidenceGapMemory(
          memory,
        ),
    );

  if (Array.isArray(container)) {
    return learningRows;
  }

  if (!isRecord(container)) {
    return container;
  }

  /*
   * rankedMemories is decision metadata used to choose and
   * order the most relevant historical memories.
   *
   * The underlying memories have already been placed into
   * recentMemories by the AI Kernel in ranked order.
   *
   * Do not expose rankedMemories itself to recursive evidence
   * extraction, otherwise the same historical lesson can enter
   * hypothesis reasoning both as a raw memory and again through
   * rankedMemories[].memory, while ranking scores/reasons can
   * incorrectly become restaurant evidence.
   */
  const {
    rankedMemories: _rankedMemories,
    ...learningContainer
  } = container;

  return {
    ...learningContainer,

    recentMemories:
      learningRows,

    ...(Array.isArray(
      container.items,
    )
      ? {
          items:
            learningRows,
        }
      : {}),

    ...(Array.isArray(
      container.memories,
    )
      ? {
          memories:
            learningRows,
        }
      : {}),
  };
}

function inferOperatorEvidenceDirection(
  question: string,
  value: string,
): EvidenceDirection {
  const combined =
    `${question} ${value}`
      .toLowerCase();

  const blockingPhrases = [
    "at capacity",
    "no capacity",
    "cannot handle",
    "unable to handle",
    "overloaded",
    "requires additional labor",
  ];

  const enablingPhrases = [
    "available capacity",
    "unused",
    "can handle",
    "without adding labor",
    "room to grow",
  ];

  const hasBlockingSignal =
    blockingPhrases.some(
      (phrase) =>
        combined.includes(
          phrase,
        ),
    );

  const hasEnablingSignal =
    enablingPhrases.some(
      (phrase) =>
        combined.includes(
          phrase,
        ),
    );

  if (
    hasBlockingSignal &&
    hasEnablingSignal
  ) {
    return "mixed";
  }

  if (hasBlockingSignal) {
    return "negative";
  }

  if (hasEnablingSignal) {
    return "positive";
  }

  return inferTextDirection(
    value,
  );
}

function extractOperatorEvidenceSubmissions(
  context: BrainContext,
): Evidence[] {
  const output:
    Evidence[] = [];

  for (
    const memory of
    getRecentOperatorMemoryRows(
      context,
    )
  ) {
    if (
      !isEvidenceGapMemory(
        memory,
      )
    ) {
      continue;
    }

    const evidencePayload =
      isRecord(memory.evidence)
        ? memory.evidence
        : null;

    const latest =
      evidencePayload &&
      isRecord(
        evidencePayload.latest,
      )
        ? evidencePayload.latest
        : null;

    const question =
      readText(
        latest?.question,
      ) ??
      readText(
        evidencePayload?.question,
      ) ??
      readText(
        memory.action_title,
      ) ??
      readText(
        memory.actionTitle,
      );

    const value =
      readText(
        latest?.value,
      ) ??
      readText(
        memory.result_summary,
      ) ??
      readText(
        memory.resultSummary,
      );

    if (
      !question ||
      !value
    ) {
      continue;
    }

    const confidence =
      normalizeMemoryConfidence(
        latest?.confidence ??
          memory.confidence,
      );

    const locationName =
      readText(
        latest?.locationName,
      ) ??
      readText(
        latest?.location_name,
      ) ??
      readText(
        memory.location_name,
      ) ??
      readText(
        memory.locationName,
      ) ??
      undefined;

    const observedAt =
      normalizeObservedAt(
        latest?.observedAt ??
          latest?.observed_at ??
          memory.updated_at ??
          memory.created_at,
      );

    const submissionId =
      readText(
        latest?.id,
      ) ??
      readText(
        memory.id,
      ) ??
      stableHash(
        `${question}:${value}:${observedAt ?? ""}`,
      );

    output.push({
      id:
        `evidence-operator-${stableHash(
          `${submissionId}:${question}:${value}`,
        )}`,

      title:
        question,

      question,

      submissionId,

      value,

      confidence,

      source:
        "operator_memory",

      kind:
        "observation",

      direction:
        inferOperatorEvidenceDirection(
          question,
          value,
        ),

      path:
        `knowledge.operatorMemory.evidenceGap.${stableHash(
          question,
        )}`,

      locationName,

      observedAt,
    });
  }

  const deduped =
    new Map<
      string,
      Evidence
    >();

  for (const item of output) {
    deduped.set(
      item.id,
      item,
    );
  }

  return Array.from(
    deduped.values(),
  )
    .sort(
      (left, right) =>
        right.confidence -
        left.confidence,
    )
    .slice(
      0,
      MAX_OPERATOR_EVIDENCE_ITEMS,
    );
}

const QUESTION_STOP_WORDS =
  new Set([
    "a",
    "an",
    "and",
    "are",
    "at",
    "by",
    "for",
    "in",
    "is",
    "of",
    "on",
    "or",
    "the",
    "to",
    "under",
    "whether",
  ]);

function normalizeQuestion(
  value: string,
) {
  return value
    .toLowerCase()
    .replace(
      /[^a-z0-9\s]/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function getQuestionTokens(
  value: string,
) {
  return new Set(
    normalizeQuestion(value)
      .split(" ")
      .filter(
        (token) =>
          token.length > 2 &&
          !QUESTION_STOP_WORDS.has(
            token,
          ),
      ),
  );
}

function questionsMatch(
  unknown: string,
  question: string,
) {
  const normalizedUnknown =
    normalizeQuestion(
      unknown,
    );

  const normalizedQuestion =
    normalizeQuestion(
      question,
    );

  if (
    normalizedUnknown ===
    normalizedQuestion
  ) {
    return true;
  }

  const unknownTokens =
    getQuestionTokens(
      unknown,
    );

  const questionTokens =
    getQuestionTokens(
      question,
    );

  if (
    unknownTokens.size < 2 ||
    questionTokens.size < 2
  ) {
    return false;
  }

  let overlap = 0;

  for (
    const token of unknownTokens
  ) {
    if (
      questionTokens.has(
        token,
      )
    ) {
      overlap += 1;
    }
  }

  const containment =
    overlap /
    Math.min(
      unknownTokens.size,
      questionTokens.size,
    );

  return (
    overlap >= 3 &&
    containment >= 0.8
  );
}

function resolveUnknowns(
  unknowns: string[],
  evidence: Evidence[],
): UnknownResolution {
  const operatorEvidence =
    evidence.filter(
      (item) =>
        item.source ===
          "operator_memory" &&
        item.kind ===
          "observation" &&
        Boolean(item.question) &&
        typeof item.value ===
          "string" &&
        item.value.trim().length >=
          12,
    );

  const unresolved:
    string[] = [];

  const resolved:
    string[] = [];

  const partiallyResolved:
    string[] = [];

  for (const unknown of unknowns) {
    const matchingEvidence =
      operatorEvidence.filter(
        (item) =>
          Boolean(
            item.question &&
              questionsMatch(
                unknown,
                item.question,
              ),
          ),
      );

    const strongestConfidence =
      matchingEvidence.reduce(
        (strongest, item) =>
          Math.max(
            strongest,
            item.confidence,
          ),
        0,
      );

    if (
      strongestConfidence >=
      MIN_FULL_RESOLUTION_CONFIDENCE
    ) {
      resolved.push(
        unknown,
      );

      continue;
    }

    if (
      strongestConfidence >=
      MIN_PARTIAL_RESOLUTION_CONFIDENCE
    ) {
      partiallyResolved.push(
        unknown,
      );

      unresolved.push(
        unknown,
      );

      continue;
    }

    unresolved.push(
      unknown,
    );
  }

  return {
    unresolved,
    resolved,
    partiallyResolved,
  };
}
function buildEvidenceRoots(
  context: BrainContext,
): EvidenceRoot[] {
  return [
    {
      path:
        "perception.businessUnderstanding",

      value:
        context.perception
          .businessUnderstanding,

      source:
        "perception",

      confidence:
        0.88,
    },

    {
      path:
        "perception.situationAssessment",

      value:
        context.perception
          .situationAssessment,

      source:
        "perception",

      confidence:
        0.9,
    },

    {
      path:
        "perception.observations",

      value:
        context.perception
          .observations,

      source:
        "perception",

      confidence:
        0.92,
    },

    {
      path:
        "perception.worldState",

      value:
        context.perception
          .worldState,

      source:
        "perception",

      confidence:
        0.84,
    },

    {
      path:
        "perception.restaurantState",

        value:
        context.perception.restaurantState,

      source:
        "restaurant_state",

      confidence:
        0.86,
    },

    {
      path:
        "workingMemory",

      value:
        context.workingMemory,

      source:
        "working_memory",

      confidence:
        0.78,
    },

    {
      path:
        "knowledge.knowledgeModel",

      value:
        context.knowledge
          .knowledgeModel,

      source:
        "knowledge",

      confidence:
        0.76,
    },

    
      {
        path:
          "knowledge.operatorMemory",
      
        value:
          getOperatorLearningMemory(
            context,
          ),
      
        source:
          "operator_memory",
      
        confidence:
          0.7,
      },

    {
      path:
        "reasoning.planning",

        value:
        context.reasoning.planning,

      source:
        "planning",

      confidence:
        0.72,
    },

    {
      path:
        "reasoning.causalAnalysis",

        value:
        context.reasoning.causalAnalysis,

      source:
        "causal_analysis",

      confidence:
        0.88,
    },

    {
      path:
        "reasoning.prediction",

        value:
        context.reasoning.prediction,

      source:
        "prediction",

      confidence:
        0.82,
    },

    {
      path:
        "reasoning.worldModel",

        value:
        context.reasoning.worldModel,

      source:
        "world_model",

      confidence:
        0.8,
    },
  ];
}

function extractEvidence(
  context: BrainContext,
): Evidence[] {
  const operatorEvidence =
    extractOperatorEvidenceSubmissions(
      context,
    );

  /*
   * Protect the highest-ranked learned outcomes from being
   * crowded out by higher-confidence perception evidence.
   *
   * recentMemories is already ordered by contextual relevance
   * by the AI Kernel.
   *
   * We preserve that ranking here and extract only what actually
   * happened after an action:
   *
   * - outcome score
   * - result summary
   * - learned lesson
   *
   * The previous action title provides context for what the
   * measured outcome refers to, but the action title itself is
   * never emitted as evidence.
   */
  const learningOutcomeEvidence:
    Evidence[] = [];

  const rankedLearningMemories =
    getRecentOperatorMemoryRows(
      context,
    )
      .map(
        (memory, rankIndex) => ({
          memory,
          rankIndex,
        }),
      )
      .filter(
        ({ memory }) =>
          !isEvidenceGapMemory(
            memory,
          ),
      )
      .slice(
        0,
        3,
      );

  for (
    const {
      memory,
      rankIndex,
    } of rankedLearningMemories
  ) {
    const actionTitle =
      readText(
        memory.action_title,
      ) ??
      readText(
        memory.actionTitle,
      );

    const locationName =
      readText(
        memory.location_name,
      ) ??
      readText(
        memory.locationName,
      ) ??
      undefined;

    const observedAt =
      normalizeObservedAt(
        memory.updated_at ??
          memory.created_at,
      );

    const confidence =
  normalizeMemoryConfidence(
    memory.confidence,
  );

/*
 * The measured outcome determines how the historical
 * result summary should vote.
 *
 * This prevents phrases such as:
 *
 * "Run a Controlled Growth Test"
 *
 * from becoming positive evidence merely because the
 * previous action title contains the word "growth".
 */
/*
 * Verified Decision Outcome Verification is the
 * authority for historical outcome direction.
 *
 * Legacy outcome_score, success, titles, lessons,
 * or summaries are never allowed to reverse it.
 */
const verifiedOutcomeSignal =
  inferMemoryOutcomeSignal(
    memory,
  );

const measuredOutcomeDirection:
  EvidenceDirection | null =
  verifiedOutcomeSignal ===
    "supporting"
    ? "positive"
    : verifiedOutcomeSignal ===
        "cautionary"
      ? "negative"
      : verifiedOutcomeSignal ===
          "mixed"
        ? "mixed"
        : null;

const outcomeFields: Array<{
      key: string;
      value: unknown;
    }> = [
      {
        key:
          "outcome_score",

        value:
          memory.outcome_score ??
          memory.outcomeScore,
      },

      {
        key:
          "result_summary",

        value:
          memory.result_summary ??
          memory.resultSummary,
      },

      {
        key:
          "lesson",

        value:
          memory.lesson,
      },
    ];

    for (
      const field of outcomeFields
    ) {
      if (
        !isScalar(
          field.value,
        ) ||
        field.value === null
      ) {
        continue;
      }

      if (
        typeof field.value ===
          "string" &&
        !field.value.trim()
      ) {
        continue;
      }

      const value =
        typeof field.value ===
          "string"
          ? truncateString(
              field.value,
            )
          : field.value;

      /*
       * Preserve the original ranked-memory index.
       *
       * This gives us direct traceability from:
       *
       * rankedMemories[n]
       *      ↓
       * recentMemories[n]
       *      ↓
       * hypothesis evidence
       */
      const path =
        `knowledge.operatorMemory.recentMemories[${rankIndex}].${field.key}`;

      const baseTitle =
        titleFromPath(
          path,
        );

      /*
       * The action title supplies subject context only.
       *
       * Example:
       *
       * "Run a Controlled Growth Test: Outcome Score"
       *
       * The direction still comes from the measured outcome.
       * Therefore a poor score can contradict growth instead of
       * the words "growth test" positively voting for themselves.
       */
      const title =
        actionTitle
          ? `${actionTitle}: ${baseTitle}`
          : baseTitle;

      const id =
        `evidence-${stableHash(
          `${path}:${String(
            value,
          )}:${locationName ?? ""}`,
        )}`;

      learningOutcomeEvidence.push({
        id,

        title,

        value,

        confidence,

        source:
          "operator_memory",

        kind:
          inferEvidenceKind(
            path,
          ),

        direction:
  measuredOutcomeDirection !==
  null
    ? measuredOutcomeDirection
    : "neutral",

        path,

        locationName,

        observedAt,
      });
    }
  }

  const leaves:
    EvidenceLeaf[] = [];

  for (
    const root of buildEvidenceRoots(
      context,
    )
  ) {
    /*
     * Normal learned Operator Memory is handled by the protected
     * outcome path above.
     *
     * Do not also send the whole memory object through generic
     * recursive extraction.
     *
     * This prevents action titles and metadata from becoming
     * self-reinforcing evidence and prevents Operator Memory from
     * consuming the shared generic leaf budget.
     */
    if (
      root.source ===
      "operator_memory"
    ) {
      continue;
    }

    if (
      root.value === undefined ||
      root.value === null
    ) {
      continue;
    }

    collectScalarLeaves(
      root.value,
      root.path,
      root.source,
      root.confidence,
      leaves,
    );
  }

  const evidence:
    Evidence[] = [];

  const dedupe =
    new Set<string>();

  for (
    const leaf of leaves
  ) {
    const title =
      titleFromPath(
        leaf.path,
      );

    const dedupeKey = [
      title.toLowerCase(),

      String(
        leaf.value,
      ).toLowerCase(),

      leaf.locationName ??
        "",
    ].join("|");

    if (
      dedupe.has(
        dedupeKey,
      )
    ) {
      continue;
    }

    dedupe.add(
      dedupeKey,
    );

    const id =
      `evidence-${stableHash(
        `${leaf.path}:${String(
          leaf.value,
        )}:${leaf.locationName ?? ""}`,
      )}`;

    evidence.push({
      id,

      title,

      value:
        leaf.value,

      confidence:
        clamp(
          leaf.confidence,
        ),

      source:
        leaf.source,

      kind:
        inferEvidenceKind(
          leaf.path,
        ),

      direction:
        inferEvidenceDirection(
          leaf.path,
          leaf.value,
        ),

      path:
        leaf.path,

      locationName:
        leaf.locationName,
    });
  }

  /*
   * Generic evidence can still compete by confidence.
   *
   * Ranked learning outcomes and explicit operator evidence are
   * protected before that competition happens.
   */
  const genericEvidence =
    evidence
      .filter(
        (item) =>
          item.source !==
          "operator_memory",
      )
      .sort(
        (left, right) =>
          right.confidence -
          left.confidence,
      );

  const combinedEvidence = [
    ...operatorEvidence,

    ...learningOutcomeEvidence,

    ...genericEvidence,
  ];

  /*
   * Final deduplication preserves priority order:
   *
   * 1. Explicit evidence-gap submissions.
   * 2. Highest-ranked learned outcomes.
   * 3. Current generic evidence.
   */
  const selectedEvidence:
    Evidence[] = [];

  const selectedIds =
    new Set<string>();

  for (
    const item of combinedEvidence
  ) {
    if (
      selectedIds.has(
        item.id,
      )
    ) {
      continue;
    }

    selectedIds.add(
      item.id,
    );

    selectedEvidence.push(
      item,
    );

    if (
      selectedEvidence.length >=
      MAX_EVIDENCE_ITEMS
    ) {
      break;
    }
  }

  return selectedEvidence;
}

function getIssueEffect(
  direction: EvidenceDirection,
): "support" | "contradict" | null {
  if (
    direction === "negative"
  ) {
    return "support";
  }

  if (
    direction === "positive"
  ) {
    return "contradict";
  }

  return null;
}

function getPositiveEffect(
  direction: EvidenceDirection,
): "support" | "contradict" | null {
  if (
    direction === "positive"
  ) {
    return "support";
  }

  if (
    direction === "negative"
  ) {
    return "contradict";
  }

  return null;
}

function classifyEvidence(
  evidence: Evidence,
): HypothesisSignal[] {
  const signals =
    new Map<
      string,
      HypothesisSignal
    >();

  const path =
    evidence.path?.toLowerCase() ??
    "";

  const valueText =
    typeof evidence.value === "string"
      ? evidence.value.toLowerCase()
      : "";

  const searchableText =
    `${path} ${evidence.title.toLowerCase()} ${valueText}`;

  const direction =
    evidence.direction ??
    "neutral";

  const addSignal = (
    category: HypothesisCategory,
    effect:
      | "support"
      | "contradict"
      | null,
    multiplier = 1,
  ) => {
    if (!effect) {
      return;
    }

    const key =
      `${category}:${effect}`;

    const strength =
      clamp(
        evidence.confidence *
          multiplier,
        0.05,
        1,
      );

    const existing =
      signals.get(key);

    if (
      !existing ||
      strength >
        existing.strength
    ) {
      signals.set(
        key,
        {
          category,

          effect,

          strength,

          evidenceId:
            evidence.id,
        },
      );
    }
  };

  const issueEffect =
    getIssueEffect(
      direction,
    );

  const positiveEffect =
    getPositiveEffect(
      direction,
    );

  if (
    direction === "positive"
  ) {
    addSignal(
      "stability",
      "support",
      0.65,
    );
  }

  if (
    direction === "negative"
  ) {
    addSignal(
      "stability",
      "contradict",
      0.7,
    );
  }

  if (
    path.includes("revenue") ||
    path.includes("sales")
  ) {
    if (
      path.includes("delta") ||
      path.includes("change") ||
      path.includes("trend")
    ) {
      addSignal(
        "demand",
        issueEffect,
        1,
      );

      addSignal(
        "profitability",
        issueEffect,
        0.75,
      );

      addSignal(
        "growth",
        positiveEffect,
        0.8,
      );
    }
  }

  if (
    path.includes("orders") ||
    path.includes("traffic") ||
    path.includes("demand")
  ) {
    addSignal(
      "demand",
      issueEffect,
      1,
    );

    addSignal(
      "growth",
      positiveEffect,
      0.85,
    );
  }

  if (
    path.includes("rating") ||
    path.includes("review") ||
    path.includes("sentiment")
  ) {
    addSignal(
      "reputation",
      issueEffect,
      1,
    );

    addSignal(
      "service",
      issueEffect,
      0.8,
    );
  }

  if (
    path.includes("refund")
  ) {
    addSignal(
      "execution",
      issueEffect,
      1,
    );

    addSignal(
      "service",
      issueEffect,
      0.85,
    );

    addSignal(
      "profitability",
      issueEffect,
      0.65,
    );
  }

  if (
    path.includes("labor") ||
    path.includes("staff")
  ) {
    addSignal(
      "staffing",
      issueEffect,
      1,
    );

    addSignal(
      "profitability",
      issueEffect,
      0.7,
    );
  }

  if (
    path.includes("margin") ||
    path.includes("profitability")
  ) {
    addSignal(
      "profitability",
      issueEffect,
      1,
    );
  }

  if (
    path.includes("service")
  ) {
    addSignal(
      "service",
      issueEffect,
      1,
    );
  }

  if (
    path.includes("openalerts") ||
    path.includes("pendingactions") ||
    path.includes("operations") ||
    path.includes("execution")
  ) {
    addSignal(
      "execution",
      issueEffect,
      0.9,
    );
  }

  if (
    path.includes("overallscore") ||
    path.includes("health") ||
    path.includes("status")
  ) {
    addSignal(
      "stability",
      positiveEffect,
      1,
    );

    addSignal(
      "execution",
      issueEffect,
      0.65,
    );
  }

  if (
    path.includes("opportunity")
  ) {
    addSignal(
      "growth",
      positiveEffect ??
        "support",
      1,
    );
  }

  for (
    const [
      category,
      keywords,
    ] of Object.entries(
      CATEGORY_KEYWORDS,
    ) as Array<
      [
        HypothesisCategory,
        string[],
      ]
    >
  ) {
    if (
      !keywords.some(
        (keyword) =>
          searchableText.includes(
            keyword,
          ),
      )
    ) {
      continue;
    }

    if (
      category === "stability" ||
      category === "growth"
    ) {
      addSignal(
        category,
        positiveEffect,
        0.7,
      );
    } else {
      addSignal(
        category,
        issueEffect,
        0.7,
      );
    }
  }

  return Array.from(
    signals.values(),
  );
}

function createAccumulators() {
  const accumulators =
    new Map<
      HypothesisCategory,
      HypothesisAccumulator
    >();

  for (
    const category of Object.keys(
      CATEGORY_DEFINITIONS,
    ) as HypothesisCategory[]
  ) {
    accumulators.set(
      category,
      {
        supportingEvidence:
          new Map(),

        contradictingEvidence:
          new Map(),
      },
    );
  }

  return accumulators;
}

function sumWeights(
  values: Map<string, number>,
) {
  return Array.from(
    values.values(),
  ).reduce(
    (
      total,
      value,
    ) =>
      total + value,
    0,
  );
}

function buildGlobalUnknowns(
  evidence: Evidence[],
) {
  const evidenceText =
    evidence
      .map(
        (item) =>
          `${item.title} ${item.path ?? ""}`,
      )
      .join(" ")
      .toLowerCase();

  const unknowns: string[] = [];

  if (
    !evidenceText.includes(
      "revenue",
    ) &&
    !evidenceText.includes(
      "sales",
    )
  ) {
    unknowns.push(
      "Recent revenue trend is unavailable.",
    );
  }

  if (
    !evidenceText.includes(
      "orders",
    ) &&
    !evidenceText.includes(
      "traffic",
    ) &&
    !evidenceText.includes(
      "demand",
    )
  ) {
    unknowns.push(
      "Order volume or guest-traffic trend is unavailable.",
    );
  }

  if (
    !evidenceText.includes(
      "rating",
    ) &&
    !evidenceText.includes(
      "review",
    )
  ) {
    unknowns.push(
      "Recent guest rating and review evidence is unavailable.",
    );
  }

  if (
    !evidenceText.includes(
      "labor",
    ) &&
    !evidenceText.includes(
      "staff",
    )
  ) {
    unknowns.push(
      "Labor and staffing evidence is unavailable.",
    );
  }

  if (
    !evidenceText.includes(
      "margin",
    ) &&
    !evidenceText.includes(
      "profit",
    )
  ) {
    unknowns.push(
      "Margin and profitability evidence is unavailable.",
    );
  }

  if (
    !evidenceText.includes(
      "outcome",
    ) &&
    !evidenceText.includes(
      "memory",
    )
  ) {
    unknowns.push(
      "Comparable historical outcomes are unavailable.",
    );
  }

  return unknowns;
}

function uniqueStrings(
  values: string[],
) {
  return Array.from(
    new Set(
      values,
    ),
  );
}

function buildHypothesisDescription(
  category: HypothesisCategory,
  supportingEvidence: string[],
  evidenceById: Map<string, Evidence>,
) {
  const definition =
    CATEGORY_DEFINITIONS[
      category
    ];

  const strongestSignals =
    supportingEvidence
      .map(
        (id) =>
          evidenceById.get(
            id,
          ),
      )
      .filter(
        (
          item,
        ): item is Evidence =>
          Boolean(item),
      )
      .slice(
        0,
        3,
      )
      .map(
        (item) =>
          item.locationName
            ? `${item.title} at ${item.locationName}`
            : item.title,
      );

  if (
    strongestSignals.length === 0
  ) {
    return definition.description;
  }

  return `${definition.description} Strongest current signals: ${strongestSignals.join(
    "; ",
  )}.`;
}

function buildRankedHypotheses(
  evidence: Evidence[],
) {
  const accumulators =
    createAccumulators();

  for (
    const item of evidence
  ) {
    const signals =
      classifyEvidence(
        item,
      );

    for (
      const signal of signals
    ) {
      const accumulator =
        accumulators.get(
          signal.category,
        );

      if (!accumulator) {
        continue;
      }

      const target =
        signal.effect ===
        "support"
          ? accumulator.supportingEvidence
          : accumulator.contradictingEvidence;

      const existing =
        target.get(
          signal.evidenceId,
        ) ?? 0;

      target.set(
        signal.evidenceId,
        Math.max(
          existing,
          signal.strength,
        ),
      );
    }
  }

  const evidenceById =
    new Map(
      evidence.map(
        (item) =>
          [
            item.id,
            item,
          ] as const,
      ),
    );

  const hypotheses: Hypothesis[] =
    [];

  for (
    const [
      category,
      accumulator,
    ] of accumulators
  ) {
    if (
      category === "unknown"
    ) {
      continue;
    }

    const supportWeight =
      sumWeights(
        accumulator.supportingEvidence,
      );

    const contradictionWeight =
      sumWeights(
        accumulator.contradictingEvidence,
      );

    if (
      supportWeight < 0.2
    ) {
      continue;
    }

    const supportingEvidence =
      Array.from(
        accumulator.supportingEvidence.entries(),
      )
        .sort(
          (
            left,
            right,
          ) =>
            right[1] -
            left[1],
        )
        .map(
          ([id]) =>
            id,
        );

    const contradictingEvidence =
      Array.from(
        accumulator.contradictingEvidence.entries(),
      )
        .sort(
          (
            left,
            right,
          ) =>
            right[1] -
            left[1],
        )
        .map(
          ([id]) =>
            id,
        );

    const totalWeight =
      supportWeight +
      contradictionWeight;

    const supportRatio =
      totalWeight > 0
        ? supportWeight /
          totalWeight
        : 0;

    const evidenceCoverage =
      clamp(
        (
          supportingEvidence.length +
          contradictingEvidence.length
        ) / 4,
      );

    const evidenceStrength =
      clamp(
        supportWeight /
          2.4,
      );

    const contradictionPenalty =
      clamp(
        contradictionWeight /
          2.4,
      );

    const confidence =
      clamp(
        0.24 +
          supportRatio *
            0.42 +
          evidenceStrength *
            0.18 +
          evidenceCoverage *
            0.16 -
          contradictionPenalty *
            0.16,
        0.15,
        0.95,
      );

    const definition =
      CATEGORY_DEFINITIONS[
        category
      ];
      const unknownResolution =
  resolveUnknowns(
    definition.unknowns,
    evidence,
  );

  const evidenceReasoning =
      supportingEvidence
        .map(
          (id) =>
            evidenceById.get(
              id,
            ),
        )
        .filter(
          (
            item,
          ): item is Evidence =>
            Boolean(item),
        )
        .slice(
          0,
          4,
        )
        .map(
          (item) =>
            `${item.title} provides ${item.direction ?? "neutral"} evidence from ${item.source ?? "an unknown source"}.`,
        );
        const reasoning = [
          ...evidenceReasoning,
        
          ...unknownResolution
            .resolved
            .map(
              (unknown) =>
                `Operator evidence resolved the question: ${unknown}`,
            ),
        
          ...unknownResolution
            .partiallyResolved
            .map(
              (unknown) =>
                `Operator evidence partially addressed the question: ${unknown}`,
            ),
        ];

    const score =
      clamp(
        confidence *
          (
            0.72 +
            evidenceCoverage *
              0.28
          ) +
          Math.min(
            0.08,
            supportWeight *
              0.025,
          ),
      );

    hypotheses.push({
      id:
        `hypothesis-${category}`,

      category,

      title:
        definition.title,

      description:
        buildHypothesisDescription(
          category,
          supportingEvidence,
          evidenceById,
        ),

      confidence,

      evidenceCoverage,

      supportingEvidence,

      contradictingEvidence,

      assumptions:
        definition.assumptions,

        unknowns:
        unknownResolution
          .unresolved,
      
      resolvedUnknowns:
        unknownResolution
          .resolved,
      
      partiallyResolvedUnknowns:
        unknownResolution
          .partiallyResolved,

      whatWouldChangeMyMind:
        definition.whatWouldChangeMyMind,

      reasoning,

      score,
    });
  }

  return hypotheses
    .sort(
      (left, right) =>
        (
          right.score ??
          right.confidence
        ) -
        (
          left.score ??
          left.confidence
        ),
    )
    .slice(
      0,
      4,
    );
}

function createFallbackHypothesis(
  evidence: Evidence[],
  unknowns: string[],
): Hypothesis {
  if (
    evidence.length > 0
  ) {
    const definition =
      CATEGORY_DEFINITIONS
        .stability;

    return {
      id:
        "hypothesis-stability",

      category:
        "stability",

      title:
        definition.title,

      description:
        "The current evidence does not form a strong negative operating pattern, but the diagnosis remains provisional because signal coverage is limited.",

      confidence:
        0.58,

      evidenceCoverage:
        clamp(
          evidence.length / 8,
        ),

      supportingEvidence:
        evidence
          .slice(
            0,
            3,
          )
          .map(
            (item) =>
              item.id,
          ),

      contradictingEvidence:
        [],

      assumptions:
        definition.assumptions,

      unknowns:
        uniqueStrings([
          ...unknowns,
          ...definition.unknowns,
        ]),

      whatWouldChangeMyMind:
        definition.whatWouldChangeMyMind,

      reasoning: [
        "No competing negative explanation currently has sufficient supporting evidence.",
      ],

      score:
        0.5,
    };
  }

  const definition =
    CATEGORY_DEFINITIONS
      .unknown;

  return {
    id:
      "hypothesis-unknown",

    category:
      "unknown",

    title:
      definition.title,

    description:
      definition.description,

    confidence:
      0.25,

    evidenceCoverage:
      0,

    supportingEvidence:
      [],

    contradictingEvidence:
      [],

    assumptions:
      definition.assumptions,

    unknowns:
      uniqueStrings([
        ...unknowns,
        ...definition.unknowns,
      ]),

    whatWouldChangeMyMind:
      definition.whatWouldChangeMyMind,

    reasoning: [
      "No reliable restaurant evidence was available to support a diagnosis.",
    ],

    score:
      0.2,
  };
}

export function buildHypotheses(
  context: BrainContext,
): HypothesisResult {
  const evidence =
    extractEvidence(
      context,
    );

    const globalUnknownResolution =
    resolveUnknowns(
      buildGlobalUnknowns(
        evidence,
      ),
      evidence,
    );
  
  const globalUnknowns =
    globalUnknownResolution
      .unresolved;

  const rankedHypotheses =
    buildRankedHypotheses(
      evidence,
    );

  const hypotheses =
    rankedHypotheses.length > 0
      ? rankedHypotheses
      : [
          createFallbackHypothesis(
            evidence,
            globalUnknowns,
          ),
        ];

  const primaryHypothesis =
    hypotheses[0];

  const evidenceCoverage =
    clamp(
      evidence.length / 10,
    );

  return {
    evidence,

    hypotheses,

    primaryHypothesis,

    overallConfidence:
      primaryHypothesis
        .confidence,

    evidenceCoverage,

    resolvedUnknowns:
  uniqueStrings([
    ...globalUnknownResolution
      .resolved,

    ...(
      primaryHypothesis
        .resolvedUnknowns ??
      []
    ),
  ]),

partiallyResolvedUnknowns:
  uniqueStrings([
    ...globalUnknownResolution
      .partiallyResolved,

    ...(
      primaryHypothesis
        .partiallyResolvedUnknowns ??
      []
    ),
  ]),

    generatedAt:
      new Date().toISOString(),
  };
}