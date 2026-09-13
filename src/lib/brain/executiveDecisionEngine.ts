import {
  getMemoryVerificationConfidenceScore,
  isMemoryEligibleAsReusablePlaybook,
  isMemoryTrustedForReasoning,
} from "@/lib/operatorMemoryTrust";
import {
  reviewExecutiveDecision,
  type DecisionCandidate,
} from "./decisionReviewEngine";
export type DecisionUrgency = "low" | "medium" | "high" | "critical";

export type DecisionConfidenceLevel =
  | "very_low"
  | "low"
  | "medium"
  | "high"
  | "very_high";

export type DecisionSource =
  | "planning"
  | "causal"
  | "prediction"
  | "world_model"
  | "execution"
  | "operator_memory"
  | "restaurant_state";

export type EvidenceStrength = "weak" | "moderate" | "strong";

export interface ExecutiveDecisionEvidence {
  id: string;
  source: DecisionSource;
  statement: string;
  strength: EvidenceStrength;
  confidence: number;
  locationName?: string | null;
}

export interface ExecutiveDecisionAlternative {
  title: string;
  reasonRejected: string;
  confidence: number;
}

export interface ExecutiveDecisionImpact {
  summary: string;
  revenueChangePct?: number | null;
  ratingChange?: number | null;
  marginChangePct?: number | null;
  laborChangePct?: number | null;
  riskReductionPct?: number | null;
}

export interface ExecutiveDecisionAction {
  title: string;
  description: string;
  reason: string;
  executionMode: string;
  executionWindow: string;
  locationName?: string | null;
  successMetric: string;
  checklist: string[];
}

export interface ExecutiveDecisionConflict {
  sources: DecisionSource[];
  description: string;
  resolution: string;
  severity: "low" | "medium" | "high";
}

export interface ExecutiveDecisionConfidence {
  score: number;
  level: DecisionConfidenceLevel;
  explanation: string;
  evidenceCoverage: number;
  agreementScore: number;
  uncertaintyPenalty: number;
}

export interface ExecutiveDecision {
  ok: boolean;
  mode: "single_location" | "network" | string;

  headline: string;
  executiveJudgment: string;
  situation: string;
  primaryCause: string;

  recommendedAction: ExecutiveDecisionAction;

review: ReturnType<typeof reviewExecutiveDecision>;

reasoning: string[];
  evidence: ExecutiveDecisionEvidence[];
  competingHypotheses: string[];
  rejectedAlternatives: ExecutiveDecisionAlternative[];
  conflicts: ExecutiveDecisionConflict[];

  urgency: DecisionUrgency;
  confidence: ExecutiveDecisionConfidence;
  expectedImpact: ExecutiveDecisionImpact;

  ifNothingChanges: string[];
  assumptions: string[];
  unknowns: string[];
  whatWouldChangeMyMind: string[];

  locationFocus?: string | null;
  nextReviewAt: string;
  generatedAt: string;
}

export interface ExecutiveDecisionPlanningMove {
  id?: string;
  title?: string;
  actionType?: string;
  locationName?: string | null;
  urgency?: string;
  impact?: string;
  risk?: string;
  confidence?: number | null;
  roiScore?: number | null;
  priorityScore?: number | null;
  reason?: string;
  expectedOutcome?: string;
  executionWindow?: string;
  checklist?: string[];
  successMetric?: string;
}

export interface ExecutiveDecisionPlanning {
  summary?: string;
  horizon?: string;
  topMove?: ExecutiveDecisionPlanningMove | null;
  moves?: ExecutiveDecisionPlanningMove[];
  locationName?: string | null;
}

export interface ExecutiveDecisionCausalHypothesis {
  id?: string;
  locationName?: string | null;
  category?: string;
  severity?: string;
  confidence?: string;
  confidenceScore?: number | null;
  cause?: string;
  explanation?: string;
  evidence?: string[];
  affectedMetrics?: string[];
  recommendedActions?: string[];
  whatWouldChangeMyMind?: string[];
}

export interface ExecutiveDecisionCausalAnalysis {
  summary?: string;
  topHypothesis?: ExecutiveDecisionCausalHypothesis | null;
  hypotheses?: ExecutiveDecisionCausalHypothesis[];
}

export interface ExecutiveDecisionPrediction {
  id?: string;
  locationName?: string | null;
  horizon?: string;
  riskLevel?: string;
  confidence?: number | null;
  prediction?: string;
  expectedChange?: string;
  estimatedBusinessImpact?: string;
  leadingIndicators?: string[];
  ifIgnored?: string[];
  bestIntervention?: string[];
  metricsForecast?: {
    revenueChangePct?: number | null;
    refundChangePct?: number | null;
    ratingChange?: number | null;
    marginChangePct?: number | null;
    laborChangePct?: number | null;
  };
}

export interface ExecutiveDecisionPredictionAnalysis {
  summary?: string;
  horizon?: string;
  topPrediction?: ExecutiveDecisionPrediction | null;
  predictions?: ExecutiveDecisionPrediction[];
}

export interface ExecutiveDecisionWorldSignal {
  id?: string;
  type?: string;
  label?: string;
  riskLevel?: string;
  confidence?: number | null;
  summary?: string;
  evidence?: string[];
  operatorImplication?: string;
  recommendedAdjustment?: string;
}

export interface ExecutiveDecisionWorldModel {
  summary?: string;
  topSignal?: {
    signal?: ExecutiveDecisionWorldSignal;
    locationName?: string | null;
  } | null;
  assumptions?: string[];
  locationModels?: Array<{
    locationName?: string | null;
    assumptions?: string[];
    signals?: ExecutiveDecisionWorldSignal[];
  }>;
}

export interface ExecutiveDecisionExecutionTask {
  id?: string;
  title?: string;
  description?: string;
  priority?: number | null;
  mode?: string;
  estimatedImpact?: number | null;
  confidence?: number | null;
}

export interface ExecutiveDecisionExecutionPlan {
  summary?: string;
  mode?: string;
  topTask?: ExecutiveDecisionExecutionTask | null;
  queue?: ExecutiveDecisionExecutionTask[];
}

export interface ExecutiveDecisionMemoryItem {
  id?: string;
  location_name?: string | null;
  problem_type?: string | null;
  action_type?: string | null;
  action_title?: string | null;
  result_summary?: string | null;
  lesson?: string | null;
  confidence?: string | null;
  status?: string | null;
  evidence?:
  | Record<
      string,
      unknown
    >
  | null;
  outcome_score?: number | null;
  success?: boolean | null;
  lesson_strength?: string | null;
  reuse_recommended?: boolean | null;
}

export interface ExecutiveDecisionRestaurantState {
  locationName?: string | null;
  health?: string | null;
  avgRating?: number | null;
  openAlerts?: number | null;
  revenueChangePct?: number | null;
  refundRate?: number | null;
  laborCostPct?: number | null;
  marginPct?: number | null;
  [key: string]: unknown;
}

export interface BuildExecutiveDecisionInput {
  mode?: "single_location" | "network" | string;
  planning?: ExecutiveDecisionPlanning | null;
  causalAnalysis?: ExecutiveDecisionCausalAnalysis | null;
  prediction?: ExecutiveDecisionPredictionAnalysis | null;
  worldModel?: ExecutiveDecisionWorldModel | null;
  executionPlan?: ExecutiveDecisionExecutionPlan | null;
  operatorMemory?: ExecutiveDecisionMemoryItem[] | null;
  restaurantState?: ExecutiveDecisionRestaurantState | null;
  restaurantStates?: ExecutiveDecisionRestaurantState[] | null;
  now?: Date;
}

type SourceConfidence = {
  source: DecisionSource;
  score: number;
  available: boolean;
};

const DEFAULT_REVIEW_HOURS = 24;

function clamp(value: number, minimum = 0, maximum = 100): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function normalizeConfidence(value: number | null | undefined): number {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 0;
  }

  if (value >= 0 && value <= 1) {
    return clamp(value * 100);
  }

  return clamp(value);
}

function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;

  const normalized = value.replace(/\s+/g, " ").trim();

  return normalized.length > 0 ? normalized : null;
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = normalizeText(value);

    if (!normalized) continue;

    const key = normalized.toLowerCase();

    if (seen.has(key)) continue;

    seen.add(key);
    result.push(normalized);
  }

  return result;
}

function titleCase(value: string | null | undefined): string {
  const normalized = normalizeText(value);

  if (!normalized) return "Unknown";

  return normalized
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function inferUrgency(
  planningUrgency?: string | null,
  predictionRisk?: string | null,
  causalSeverity?: string | null,
  restaurantHealth?: string | null
): DecisionUrgency {
  const values = [
    planningUrgency,
    predictionRisk,
    causalSeverity,
    restaurantHealth,
  ]
    .map((value) => value?.toLowerCase())
    .filter((value): value is string => Boolean(value));

  if (
    values.some((value) =>
      ["critical", "severe", "emergency", "very_high"].includes(value)
    )
  ) {
    return "critical";
  }

  if (
    values.some((value) =>
      ["high", "risk", "unhealthy", "urgent"].includes(value)
    )
  ) {
    return "high";
  }

  if (
    values.some((value) =>
      ["medium", "moderate", "watch", "warning"].includes(value)
    )
  ) {
    return "medium";
  }

  return "low";
}

function confidenceLevel(score: number): DecisionConfidenceLevel {
  if (score >= 90) return "very_high";
  if (score >= 75) return "high";
  if (score >= 55) return "medium";
  if (score >= 35) return "low";
  return "very_low";
}

function evidenceStrength(confidence: number): EvidenceStrength {
  if (confidence >= 75) return "strong";
  if (confidence >= 50) return "moderate";
  return "weak";
}

function average(values: number[]): number {
  if (values.length === 0) return 0;

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getMemoryConfidence(
  memory:
    ExecutiveDecisionMemoryItem[],
): number {
  const trustedMemory =
    memory.filter(
      (item) =>
        item.status !==
          "archived" &&
        isMemoryTrustedForReasoning(
          item,
        ),
    );

  if (
    trustedMemory.length ===
    0
  ) {
    return 0;
  }

  const verificationScores =
    trustedMemory
      .map((item) =>
        getMemoryVerificationConfidenceScore(
          item,
        ),
      )
      .filter(
        (score) =>
          score > 0,
      );

  if (
    verificationScores.length ===
    0
  ) {
    return 0;
  }

  const verificationAverage =
    average(
      verificationScores,
    );

  const verificationCoverage =
    verificationScores.length /
    trustedMemory.length;

  const sampleStrength =
    Math.min(
      trustedMemory.length /
        3,
      1,
    );

  return clamp(
    verificationAverage *
      0.75 +
      verificationCoverage *
        100 *
        0.15 +
      sampleStrength *
        100 *
        0.1,
  );
}

function buildSourceConfidences(
  input: BuildExecutiveDecisionInput
): SourceConfidence[] {
  const planningConfidence = normalizeConfidence(
    input.planning?.topMove?.confidence
  );

  const causalConfidence = normalizeConfidence(
    input.causalAnalysis?.topHypothesis?.confidenceScore
  );

  const predictionConfidence = normalizeConfidence(
    input.prediction?.topPrediction?.confidence
  );

  const worldConfidence = normalizeConfidence(
    input.worldModel?.topSignal?.signal?.confidence
  );

  const executionConfidence = normalizeConfidence(
    input.executionPlan?.topTask?.confidence
  );

  const memoryConfidence = getMemoryConfidence(
    input.operatorMemory ?? []
  );

  const stateAvailable =
    Boolean(input.restaurantState) ||
    Boolean(input.restaurantStates?.length);

  return [
    {
      source: "planning",
      score: planningConfidence,
      available: Boolean(input.planning?.topMove),
    },
    {
      source: "causal",
      score: causalConfidence,
      available: Boolean(input.causalAnalysis?.topHypothesis),
    },
    {
      source: "prediction",
      score: predictionConfidence,
      available: Boolean(input.prediction?.topPrediction),
    },
    {
      source: "world_model",
      score: worldConfidence,
      available: Boolean(input.worldModel?.topSignal?.signal),
    },
    {
      source: "execution",
      score: executionConfidence,
      available: Boolean(input.executionPlan?.topTask),
    },
    {
      source: "operator_memory",
      score: memoryConfidence,
      available: Boolean(input.operatorMemory?.length),
    },
    {
      source: "restaurant_state",
      score: stateAvailable ? 70 : 0,
      available: stateAvailable,
    },
  ];
}

function detectConflicts(
  input: BuildExecutiveDecisionInput
): ExecutiveDecisionConflict[] {
  const conflicts: ExecutiveDecisionConflict[] = [];

  const planningMove = normalizeText(input.planning?.topMove?.title);
  const executionMove = normalizeText(
    input.executionPlan?.topTask?.title
  );

  if (
    planningMove &&
    executionMove &&
    planningMove.toLowerCase() !== executionMove.toLowerCase()
  ) {
    conflicts.push({
      sources: ["planning", "execution"],
      description:
        "The Planning Engine and Execution Engine selected different top actions.",
      resolution:
        "The execution-ready action is preferred when it has equal or stronger confidence because it is already operationally defined.",
      severity: "medium",
    });
  }

  const planningUrgency =
    input.planning?.topMove?.urgency?.toLowerCase();

  const predictionRisk =
    input.prediction?.topPrediction?.riskLevel?.toLowerCase();

  if (
    planningUrgency === "low" &&
    ["high", "critical", "severe"].includes(predictionRisk ?? "")
  ) {
    conflicts.push({
      sources: ["planning", "prediction"],
      description:
        "The planner considers the action low urgency while the forecast indicates elevated future risk.",
      resolution:
        "Urgency is increased because forward-looking risk should affect action timing even when the current state appears stable.",
      severity: "high",
    });
  }

  const worldRisk =
    input.worldModel?.topSignal?.signal?.riskLevel?.toLowerCase();

  if (
    planningUrgency === "high" &&
    worldRisk === "low" &&
    predictionRisk === "low"
  ) {
    conflicts.push({
      sources: ["planning", "prediction", "world_model"],
      description:
        "The planner recommends urgent action, but the forecast and external context indicate limited immediate risk.",
      resolution:
        "The recommendation remains visible but receives a confidence penalty until stronger evidence supports urgency.",
      severity: "medium",
    });
  }

  return conflicts;
}

function buildEvidence(
  input: BuildExecutiveDecisionInput
): ExecutiveDecisionEvidence[] {
  const evidence: ExecutiveDecisionEvidence[] = [];

  const causal = input.causalAnalysis?.topHypothesis;
  const prediction = input.prediction?.topPrediction;
  const worldSignal = input.worldModel?.topSignal?.signal;
  const planning = input.planning?.topMove;
  const execution = input.executionPlan?.topTask;

  const causalConfidence = normalizeConfidence(
    causal?.confidenceScore
  );

  for (const [index, statement] of (
    causal?.evidence ?? []
  ).entries()) {
    const normalized = normalizeText(statement);

    if (!normalized) continue;

    evidence.push({
      id: `causal-${index + 1}`,
      source: "causal",
      statement: normalized,
      strength: evidenceStrength(causalConfidence),
      confidence: causalConfidence,
      locationName: causal?.locationName,
    });
  }

  for (const [index, statement] of (
    prediction?.leadingIndicators ?? []
  ).entries()) {
    const normalized = normalizeText(statement);

    if (!normalized) continue;

    const confidence = normalizeConfidence(prediction?.confidence);

    evidence.push({
      id: `prediction-${index + 1}`,
      source: "prediction",
      statement: normalized,
      strength: evidenceStrength(confidence),
      confidence,
      locationName: prediction?.locationName,
    });
  }

  for (const [index, statement] of (
    worldSignal?.evidence ?? []
  ).entries()) {
    const normalized = normalizeText(statement);

    if (!normalized) continue;

    const confidence = normalizeConfidence(worldSignal?.confidence);

    evidence.push({
      id: `world-${index + 1}`,
      source: "world_model",
      statement: normalized,
      strength: evidenceStrength(confidence),
      confidence,
      locationName:
        input.worldModel?.topSignal?.locationName ?? null,
    });
  }

  if (planning?.reason) {
    const confidence = normalizeConfidence(planning.confidence);

    evidence.push({
      id: "planning-reason",
      source: "planning",
      statement: planning.reason,
      strength: evidenceStrength(confidence),
      confidence,
      locationName: planning.locationName,
    });
  }

  if (execution?.description) {
    const confidence = normalizeConfidence(execution.confidence);

    evidence.push({
      id: "execution-description",
      source: "execution",
      statement: execution.description,
      strength: evidenceStrength(confidence),
      confidence,
    });
  }

  const reusableMemory =
  (
    input.operatorMemory ??
    []
  )
    .filter(
      (item) =>
        item.status !==
          "archived" &&
        isMemoryEligibleAsReusablePlaybook(
          item,
        ),
    )
    .slice(0, 3);

  for (const [index, memory] of reusableMemory.entries()) {
    const statement =
      normalizeText(memory.lesson) ??
      normalizeText(memory.result_summary);

    if (!statement) continue;

    const confidence =
      memory.lesson_strength === "strong"
        ? 85
        : memory.lesson_strength === "medium"
          ? 65
          : 50;

    evidence.push({
      id: `memory-${index + 1}`,
      source: "operator_memory",
      statement,
      strength: evidenceStrength(confidence),
      confidence,
      locationName: memory.location_name,
    });
  }

  return evidence.slice(0, 12);
}

function buildCompetingHypotheses(
  input: BuildExecutiveDecisionInput
): string[] {
  const hypotheses =
    input.causalAnalysis?.hypotheses ?? [];

  return uniqueStrings(
    hypotheses
      .slice(1, 5)
      .map((hypothesis) => {
        const cause = normalizeText(hypothesis.cause);
        const explanation = normalizeText(hypothesis.explanation);

        if (cause && explanation) {
          return `${cause}: ${explanation}`;
        }

        return cause ?? explanation;
      })
  );
}

function buildRejectedAlternatives(
  input: BuildExecutiveDecisionInput,
  selectedActionTitle: string
): ExecutiveDecisionAlternative[] {
  const alternatives: ExecutiveDecisionAlternative[] = [];

  for (const move of input.planning?.moves ?? []) {
    const title = normalizeText(move.title);

    if (
      !title ||
      title.toLowerCase() === selectedActionTitle.toLowerCase()
    ) {
      continue;
    }

    const confidence = normalizeConfidence(move.confidence);
    const priority = normalizeConfidence(move.priorityScore);

    alternatives.push({
      title,
      confidence: Math.round(
        average([confidence, priority].filter((score) => score > 0))
      ),
      reasonRejected:
        normalizeText(move.reason) ??
        "This action ranked below the selected move based on urgency, confidence, and expected business impact.",
    });
  }

  return alternatives
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 4);
}

function buildRecommendedAction(
  input: BuildExecutiveDecisionInput
): ExecutiveDecisionAction {
  const executionTask = input.executionPlan?.topTask;
  const planningMove = input.planning?.topMove;
  const causalAction =
    input.causalAnalysis?.topHypothesis?.recommendedActions?.[0];
  const predictedIntervention =
    input.prediction?.topPrediction?.bestIntervention?.[0];
  const worldAdjustment =
    input.worldModel?.topSignal?.signal?.recommendedAdjustment;

  const title =
    normalizeText(executionTask?.title) ??
    normalizeText(planningMove?.title) ??
    normalizeText(causalAction) ??
    normalizeText(predictedIntervention) ??
    normalizeText(worldAdjustment) ??
    "Continue monitoring while more evidence is collected";

  const description =
    normalizeText(executionTask?.description) ??
    normalizeText(input.executionPlan?.summary) ??
    normalizeText(planningMove?.expectedOutcome) ??
    "Execute the highest-supported operational move and measure its result.";

  const reason =
    normalizeText(planningMove?.reason) ??
    normalizeText(
      input.causalAnalysis?.topHypothesis?.explanation
    ) ??
    normalizeText(
      input.worldModel?.topSignal?.signal?.operatorImplication
    ) ??
    "This is the strongest available action based on the current operating evidence.";

  const locationName =
    planningMove?.locationName ??
    input.prediction?.topPrediction?.locationName ??
    input.causalAnalysis?.topHypothesis?.locationName ??
    input.worldModel?.topSignal?.locationName ??
    input.restaurantState?.locationName ??
    null;

  return {
    title,
    description,
    reason,
    executionMode:
      normalizeText(executionTask?.mode) ??
      normalizeText(input.executionPlan?.mode) ??
      "approval_required",
    executionWindow:
      normalizeText(planningMove?.executionWindow) ??
      "Within the next 24 hours",
    locationName,
    successMetric:
      normalizeText(planningMove?.successMetric) ??
      "Confirm measurable improvement in the affected operating metric.",
    checklist: uniqueStrings([
      ...(planningMove?.checklist ?? []),
      "Record the pre-action baseline.",
      "Execute the approved action.",
      "Measure the result after the review window.",
    ]).slice(0, 6),
  };
}

function buildConfidence(
  sourceConfidences: SourceConfidence[],
  conflicts: ExecutiveDecisionConflict[],
  evidenceCount: number
): ExecutiveDecisionConfidence {
  const availableSources = sourceConfidences.filter(
    (source) => source.available
  );

  const scores = availableSources
    .map((source) => source.score)
    .filter((score) => score > 0);

  const weightedSourceScore =
    scores.length > 0 ? average(scores) : 25;

  const evidenceCoverage = clamp(
    (availableSources.length / 7) * 100
  );

  const scoreSpread =
    scores.length > 1
      ? Math.max(...scores) - Math.min(...scores)
      : 40;

  const agreementScore = clamp(100 - scoreSpread);

  const conflictPenalty = conflicts.reduce((total, conflict) => {
    if (conflict.severity === "high") return total + 15;
    if (conflict.severity === "medium") return total + 8;
    return total + 3;
  }, 0);

  const limitedEvidencePenalty =
    evidenceCount === 0
      ? 20
      : evidenceCount < 3
        ? 10
        : 0;

  const uncertaintyPenalty = clamp(
    conflictPenalty + limitedEvidencePenalty,
    0,
    40
  );

  const score = clamp(
    weightedSourceScore * 0.55 +
      evidenceCoverage * 0.25 +
      agreementScore * 0.2 -
      uncertaintyPenalty
  );

  const roundedScore = Math.round(score);
  const level = confidenceLevel(roundedScore);

  const explanation =
    availableSources.length === 0
      ? "Confidence is limited because no reasoning engines returned usable evidence."
      : conflicts.length > 0
        ? `Confidence reflects ${availableSources.length} available evidence sources, with a penalty for ${conflicts.length} unresolved or partially resolved conflict${conflicts.length === 1 ? "" : "s"}.`
        : `Confidence reflects agreement across ${availableSources.length} available evidence sources and the current amount of supporting evidence.`;

  return {
    score: roundedScore,
    level,
    explanation,
    evidenceCoverage: Math.round(evidenceCoverage),
    agreementScore: Math.round(agreementScore),
    uncertaintyPenalty: Math.round(uncertaintyPenalty),
  };
}

function buildExpectedImpact(
  input: BuildExecutiveDecisionInput
): ExecutiveDecisionImpact {
  const forecast =
    input.prediction?.topPrediction?.metricsForecast;

  const estimatedImpact =
    normalizeText(
      input.prediction?.topPrediction
        ?.estimatedBusinessImpact
    ) ??
    normalizeText(input.planning?.topMove?.expectedOutcome) ??
    "Business impact is not yet quantified with enough evidence.";

  return {
    summary: estimatedImpact,
    revenueChangePct: forecast?.revenueChangePct ?? null,
    ratingChange: forecast?.ratingChange ?? null,
    marginChangePct: forecast?.marginChangePct ?? null,
    laborChangePct: forecast?.laborChangePct ?? null,
    riskReductionPct:
      input.executionPlan?.topTask?.estimatedImpact ?? null,
  };
}

function buildReasoning(
  input: BuildExecutiveDecisionInput,
  action: ExecutiveDecisionAction,
  conflicts: ExecutiveDecisionConflict[]
): string[] {
  return uniqueStrings([
    input.causalAnalysis?.topHypothesis?.explanation,
    input.prediction?.topPrediction?.prediction,
    input.worldModel?.topSignal?.signal?.operatorImplication,
    input.planning?.topMove?.reason,
    `The selected action is "${action.title}" because it has the strongest combined support across the available reasoning sources.`,
    ...conflicts.map(
      (conflict) =>
        `${conflict.description} ${conflict.resolution}`
    ),
  ]).slice(0, 8);
}

function buildAssumptions(
  input: BuildExecutiveDecisionInput
): string[] {
  const locationAssumptions =
    input.worldModel?.locationModels?.flatMap(
      (model) => model.assumptions ?? []
    ) ?? [];

  return uniqueStrings([
    ...(input.worldModel?.assumptions ?? []),
    ...locationAssumptions,
    "The available operating data is sufficiently current to support this judgment.",
    "No major unreported operational event has materially changed the restaurant state.",
  ]).slice(0, 8);
}

function buildUnknowns(
  input: BuildExecutiveDecisionInput,
  sourceConfidences: SourceConfidence[]
): string[] {
  const unknowns: string[] = [];

  for (const source of sourceConfidences) {
    if (source.available) continue;

    switch (source.source) {
      case "planning":
        unknowns.push(
          "The Planning Engine did not return a ranked operating move."
        );
        break;
      case "causal":
        unknowns.push(
          "The strongest root cause has not yet been established."
        );
        break;
      case "prediction":
        unknowns.push(
          "Future business impact has not yet been forecast."
        );
        break;
      case "world_model":
        unknowns.push(
          "External conditions are not yet fully represented."
        );
        break;
      case "execution":
        unknowns.push(
          "The recommendation has not yet been converted into an execution-ready task."
        );
        break;
      case "operator_memory":
        unknowns.push(
          "There is not enough historical outcome evidence to validate similar decisions."
        );
        break;
      case "restaurant_state":
        unknowns.push(
          "The current restaurant state is incomplete."
        );
        break;
    }
  }

  const topHypothesis =
    input.causalAnalysis?.topHypothesis;

  return uniqueStrings([
    ...unknowns,
    ...(topHypothesis?.whatWouldChangeMyMind ?? []),
  ]).slice(0, 8);
}

function buildNextReviewAt(
  now: Date,
  urgency: DecisionUrgency
): string {
  const reviewHours =
    urgency === "critical"
      ? 2
      : urgency === "high"
        ? 6
        : urgency === "medium"
          ? 12
          : DEFAULT_REVIEW_HOURS;

  return new Date(
    now.getTime() + reviewHours * 60 * 60 * 1000
  ).toISOString();
}

export function buildExecutiveDecision(
  input: BuildExecutiveDecisionInput
): ExecutiveDecision {
  const now = input.now ?? new Date();

  const action = buildRecommendedAction(input);
  const conflicts = detectConflicts(input);
  const evidence = buildEvidence(input);
  const sourceConfidences = buildSourceConfidences(input);

  const urgency = inferUrgency(
    input.planning?.topMove?.urgency,
    input.prediction?.topPrediction?.riskLevel,
    input.causalAnalysis?.topHypothesis?.severity,
    input.restaurantState?.health
  );

  const confidence = buildConfidence(
    sourceConfidences,
    conflicts,
    evidence.length
  );
const decisionCandidate: DecisionCandidate = {
  id: "primary",

  title: action.title,

  confidence: confidence.score,

  urgency:
    urgency === "critical"
      ? 100
      : urgency === "high"
        ? 80
        : urgency === "medium"
          ? 60
          : 30,

  expectedImpact: 80,

  evidenceSupport: confidence.evidenceCoverage,

  historicalSupport:
    sourceConfidences.find(
      (source) => source.source === "operator_memory",
    )?.score ?? 0,

  uncertaintyPenalty:
    confidence.uncertaintyPenalty,

  conflictPenalty:
    conflicts.length * 8,

  finalScore: confidence.score,
};

  const primaryCause =
    normalizeText(
      input.causalAnalysis?.topHypothesis?.cause
    ) ??
    "No dominant root cause has been established yet.";

  const situation =
    normalizeText(input.causalAnalysis?.summary) ??
    normalizeText(input.prediction?.summary) ??
    normalizeText(input.planning?.summary) ??
    "The Brain is still collecting enough evidence to form a complete operating judgment.";

  const executiveJudgment =
    confidence.score >= 55
      ? `${action.title} is currently the strongest-supported operating decision.`
      : `The current evidence points toward "${action.title}", but operator review is required because confidence remains limited.`;

  const headline =
    urgency === "critical"
      ? `Critical action required: ${action.title}`
      : urgency === "high"
        ? `High-priority decision: ${action.title}`
        : action.title;

  const ifNothingChanges = uniqueStrings([
    ...(input.prediction?.topPrediction?.ifIgnored ?? []),
    input.prediction?.topPrediction?.expectedChange,
    urgency === "high" || urgency === "critical"
      ? "The identified operating risk may intensify before the next review window."
      : null,
  ]).slice(0, 6);

  const whatWouldChangeMyMind = uniqueStrings([
    ...(input.causalAnalysis?.topHypothesis
      ?.whatWouldChangeMyMind ?? []),
    "New restaurant-state data that materially contradicts the current evidence.",
    "A stronger competing hypothesis with higher-quality evidence.",
    "Measured outcomes showing that this action performs poorly in similar conditions.",
  ]).slice(0, 8);

  const competingHypotheses =
    buildCompetingHypotheses(input);

  const rejectedAlternatives = buildRejectedAlternatives(
    input,
    action.title
  );

  const expectedImpact = buildExpectedImpact(input);
  const assumptions = buildAssumptions(input);
  const unknowns = buildUnknowns(
    input,
    sourceConfidences
  );
  const review = reviewExecutiveDecision({
  candidate: decisionCandidate,

  confidenceScore: confidence.score,

  evidenceCount: evidence.length,

  conflictCount: conflicts.length,

  unknowns,

  assumptions,
});
  const reasoning = buildReasoning(
    input,
    action,
    conflicts
  );

  return {
    ok: true,
    mode: input.mode ?? "single_location",

    headline,
    executiveJudgment,
    situation,
    primaryCause,

   recommendedAction: action,

review,

reasoning,
    evidence,
    competingHypotheses,
    rejectedAlternatives,
    conflicts,

    urgency,
    confidence,
    expectedImpact,

    ifNothingChanges,
    assumptions,
    unknowns,
    whatWouldChangeMyMind,

    locationFocus:
      action.locationName ??
      input.restaurantState?.locationName ??
      null,

    nextReviewAt: buildNextReviewAt(now, urgency),
    generatedAt: now.toISOString(),
  };
}