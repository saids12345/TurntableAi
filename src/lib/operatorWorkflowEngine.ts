import {
  buildOperatorTask,
  type OperatorTask,
  type OperatorTaskCategory,
  type OperatorTaskPriority,
  type OperatorTaskStatus,
} from "@/lib/operatorTaskEngine";

export type OperatorWorkflowStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "running"
  | "paused"
  | "completed"
  | "measured"
  | "learned"
  | "cancelled"
  | "failed";

  export type OperatorWorkflowType =
  | "margin_protection"
  | "refund_recovery"
  | "guest_recovery"
  | "revenue_recovery"
  | "labor_optimization"
  | "marketing_campaign"
  | "operations_review"
  | "evidence_investigation"
  | "controlled_test"
  | "risk_containment"
  | "active_monitoring"
  | "reputation_management"
  | "custom";

export type WorkflowStepStatus =
  | "blocked"
  | "ready"
  | "pending_approval"
  | "approved"
  | "running"
  | "completed"
  | "failed"
  | "skipped"
  | "cancelled";

export type WorkflowExecutionMode =
  | "automatic"
  | "approval_required"
  | "manual"
  | "monitor";

export type WorkflowStep = {
  id: string;
  workflowId: string;

  title: string;
  description: string;

  category: OperatorTaskCategory;
  priority: OperatorTaskPriority;

  status: WorkflowStepStatus;
  executionMode: WorkflowExecutionMode;

  order: number;
  dependsOn: string[];

  autoExecutable: boolean;
  requiresApproval: boolean;
  safetyContract: WorkflowStepSafetyContract;

  estimatedImpact: number;
  confidence: number;

  task: OperatorTask | null;

  successMetric: string | null;
  phase?: string | null;

  createdAt: string;
  approvedAt?: string;
  startedAt?: string;
  completedAt?: string;
  failedAt?: string;

  failureReason?: string | null;

  metadata?: Record<string, unknown>;
};

export type WorkflowAuthoritySafetyProfile = {
  riskLevel:
    | "low"
    | "medium"
    | "high"
    | "critical"
    | "unknown";

  reversibility:
    | "easy"
    | "moderate"
    | "hard"
    | "irreversible"
    | "unknown";

  financialExposure:
    | "none"
    | "low"
    | "medium"
    | "high"
    | "unknown";

  customerFacing:
    | boolean
    | "unknown";

  legalOrComplianceImpact:
    | boolean
    | "unknown";
};

export type WorkflowStepSafetyContract =
  WorkflowAuthoritySafetyProfile & {
    rollbackRequirement:
      | "not_required"
      | "required_before_execution"
      | "unknown";

    stopConditionsRequired:
      | boolean
      | "unknown";

    source:
      | "intrinsic"
      | "strategy_inherited"
      | "fallback_unknown";
  };

export type OperatorWorkflow = {
  id: string;

  type: OperatorWorkflowType;
  title: string;
  description: string;

  locationName: string | null;

  status: OperatorWorkflowStatus;

  priority: OperatorTaskPriority;
  executionMode: WorkflowExecutionMode;

  requiresApproval: boolean;
  autoExecutable: boolean;
    authoritySafety:
    WorkflowAuthoritySafetyProfile;

  confidence: number;
  estimatedImpact: number;

  currentStepId: string | null;

  steps: WorkflowStep[];

  successMetric: string;
  expectedOutcome: string;

  source: {
    generatedBy: "TurnTableAI";
    executiveRecommendation: string | null;
    executionPlanSummary: string | null;
    riskLevel: string | null;
  };

  createdAt: string;
  approvedAt?: string;
  startedAt?: string;
  completedAt?: string;
  measuredAt?: string;
  learnedAt?: string;
  cancelledAt?: string;

  metadata?: Record<string, unknown>;
};

export type WorkflowQueue = {
  draft: OperatorWorkflow[];
  pendingApproval: OperatorWorkflow[];
  approved: OperatorWorkflow[];
  running: OperatorWorkflow[];
  paused: OperatorWorkflow[];
  completed: OperatorWorkflow[];
  measured: OperatorWorkflow[];
  learned: OperatorWorkflow[];
  failed: OperatorWorkflow[];
  cancelled: OperatorWorkflow[];
};
export type CognitiveWorkflowDecisionMode =
  | "investigate"
  | "test"
  | "contain"
  | "monitor"
  | "act";

export type CognitiveWorkflowContext = {
  objective?: {
    id?: string | null;

    title?: string | null;

    reason?: string | null;

    confidence?: number | null;
  } | null;

  hypotheses?: {
    primaryHypothesis?: {
      id?: string | null;

      title?: string | null;

      description?: string | null;

      confidence?: number | null;

      category?: string | null;
    } | null;

    unknowns?: string[];
  } | null;

  internalDialogue?: {
    unresolvedCount?: number | null;

    questions?: Array<{
      id?: string | null;

      question?: string | null;

      importance?: number | null;
    }>;
  } | null;

  decisionEvaluation?: {
    decisionMode?: string | null;

    recommendation?: string | null;

    confidence?: number | null;

    readinessScore?: number | null;

    blockingReasons?: string[];

    unknowns?: string[];

    reasoning?: string[];
  } | null;

  selectedStrategy?: {
    rank?: number | null;

    score?: number | null;

    status?: string | null;

    strengths?: string[];

    concerns?: string[];

    reasoning?: string[];

    strategy?: {
      id?: string | null;

      title?: string | null;

      description?: string | null;

      expectedOutcome?: string | null;

      decisionMode?: string | null;

      kind?: string | null;

      risk?: string | null;

      urgency?: string | null;

      reversibility?: string | null;

              financialExposure?:
          | "none"
          | "low"
          | "medium"
          | "high"
          | "unknown";

        customerFacing?:
          | boolean
          | "unknown";

        legalOrComplianceImpact?:
          | boolean
          | "unknown";

      confidence?: number | null;

      relatedBeliefId?: string | null;

relatedHypothesisId?: string | null;

sourceQuestion?: {
  id?: string | null;

  question?: string | null;

  importance?: number | null;

  kind?: string | null;

  relatedBeliefId?: string | null;

  relatedEvidenceIds?: string[];

  blockingDecision?: boolean | null;
} | null;

      successMetrics?: string[];
    } | null;
  } | null;

  futureComparison?: {
    best?: {
      strategyId?: string | null;

      strategyTitle?: string | null;

      summary?: string | null;

      confidence?: number | null;

      expectedRisk?: number | null;

      leadingIndicators?: string[];

      failureConditions?: string[];

      unknowns?: string[];
    } | null;

    decisionConfidence?: number | null;

    bestScore?: number | null;

    warnings?: string[];

    tradeoffs?: string[];

    reasoning?: string[];
  } | null;
};
export type BuildWorkflowInput = {
  actionId?: string | null;

  cognition?:
    | CognitiveWorkflowContext
    | null;

  operatorIntelligence?: {
    judgment?: string | null;
    riskLevel?: string | null;
    confidence?: number | null;
    headline?: string | null;
    situation?: string | null;
    rootCause?: string | null;
    likelyFuture?: string | null;
    firstMove?: string | null;
    whyThisMove?: string | null;
    executionMode?: string | null;
    executionWindow?: string | null;
    doNow?: string[];
    doNotDo?: string[];
    watchNext?: string[];
    successMetric?: string | null;
    locationFocus?: string | null;
  } | null;

  executionPlan?: {
    summary?: string | null;
    mode?: string | null;
    topTask?: {
      id?: string | null;
      title?: string | null;
      description?: string | null;
      priority?: number | null;
      mode?: string | null;
      estimatedImpact?: number | null;
      confidence?: number | null;
      locationName?: string | null;
    } | null;
    queue?: Array<{
      id?: string | null;
      title?: string | null;
      description?: string | null;
      priority?: number | null;
      mode?: string | null;
      estimatedImpact?: number | null;
      confidence?: number | null;
      locationName?: string | null;
    }>;
  } | null;

  executiveAI?: {
    headline?: string | null;
    recommendation?: string | null;
    riskLevel?: string | null;
    confidence?: number | null;
    doNext?: string[];
    watchClosely?: string[];
    successMetric?: string | null;
  } | null;
};

export type WorkflowAdvanceResult = {
  workflow: OperatorWorkflow;
  previousStep: WorkflowStep | null;
  currentStep: WorkflowStep | null;
  workflowCompleted: boolean;
};

function generateId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function now() {
  return new Date().toISOString();
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function safeNumber(
  value: number | null | undefined,
  fallback: number,
) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function compact(
  value: string | null | undefined,
  fallback: string,
) {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  return text || fallback;
}

function normalizeExecutionMode(
  value: string | null | undefined,
): WorkflowExecutionMode {
  const normalized = String(value ?? "").toLowerCase();

  if (normalized === "automatic") return "automatic";

  if (
    normalized === "approval_required" ||
    normalized === "approval required"
  ) {
    return "approval_required";
  }

  if (normalized === "manual") return "manual";

  return "monitor";
}

function priorityFromRisk(
  risk: string | null | undefined,
): OperatorTaskPriority {
  const normalized = String(risk ?? "").toLowerCase();

  if (normalized === "critical") return "critical";
  if (normalized === "high") return "high";
  if (normalized === "medium") return "medium";

  return "low";
}

function categoryFromText(
  value: string,
): OperatorTaskCategory {
  const text = value.toLowerCase();

  if (
    text.includes("review") ||
    text.includes("rating") ||
    text.includes("reputation")
  ) {
    return "reviews";
  }

  if (
    text.includes("staff") ||
    text.includes("labor") ||
    text.includes("schedule")
  ) {
    return "staffing";
  }

  if (
    text.includes("promotion") ||
    text.includes("campaign") ||
    text.includes("social") ||
    text.includes("marketing")
  ) {
    return "marketing";
  }

  if (
    text.includes("inventory") ||
    text.includes("stock") ||
    text.includes("ingredient")
  ) {
    return "inventory";
  }

  if (
    text.includes("price") ||
    text.includes("pricing")
  ) {
    return "pricing";
  }

  if (
    text.includes("margin") ||
    text.includes("finance") ||
    text.includes("revenue")
  ) {
    return "finance";
  }

  if (
    text.includes("guest") ||
    text.includes("refund") ||
    text.includes("service")
  ) {
    return "guest_experience";
  }

  if (
    text.includes("repair") ||
    text.includes("equipment") ||
    text.includes("maintenance")
  ) {
    return "maintenance";
  }

  return "operations";
}

function workflowTypeFromText(
  value: string,
): OperatorWorkflowType {
  const text = value.toLowerCase();

  if (text.includes("refund")) return "refund_recovery";

  if (
    text.includes("guest") ||
    text.includes("rating") ||
    text.includes("review")
  ) {
    return "guest_recovery";
  }

  if (
    text.includes("margin") ||
    text.includes("profit")
  ) {
    return "margin_protection";
  }

  if (
    text.includes("labor") ||
    text.includes("staff")
  ) {
    return "labor_optimization";
  }

  if (
    text.includes("campaign") ||
    text.includes("promotion") ||
    text.includes("marketing")
  ) {
    return "marketing_campaign";
  }

  if (
    text.includes("revenue") ||
    text.includes("sales") ||
    text.includes("traffic")
  ) {
    return "revenue_recovery";
  }

  if (
    text.includes("reputation") ||
    text.includes("review")
  ) {
    return "reputation_management";
  }

  if (
    text.includes("operation") ||
    text.includes("audit") ||
    text.includes("investigate")
  ) {
    return "operations_review";
  }

  return "custom";
}

function workflowStatusFromMode(
  mode: WorkflowExecutionMode,
): OperatorWorkflowStatus {
  if (mode === "automatic") {
    return "approved";
  }

  if (mode === "monitor") {
    return "running";
  }

  if (mode === "approval_required") {
    return "pending_approval";
  }
  
  if (mode === "manual") {
    return "approved";
  }

  return "draft";
}

function stepStatusFromMode(params: {
  mode: WorkflowExecutionMode;
  hasDependencies: boolean;
}): WorkflowStepStatus {
  if (params.hasDependencies) return "blocked";

  if (params.mode === "automatic") return "ready";

  if (params.mode === "approval_required") {
    return "pending_approval";
  }
  
  if (params.mode === "manual") {
    return "ready";
  }

  return "ready";
}

function buildTaskForStep(params: {
  stepTitle: string;
  stepDescription: string;
  priority: OperatorTaskPriority;
  executionMode: WorkflowExecutionMode;
  confidence: number;
  estimatedImpact: number;
  locationName: string | null;
}) {
  return buildOperatorTask({
    executionPlan: {
      topTask: {
        title: params.stepTitle,
        description: params.stepDescription,
        mode:
          params.executionMode === "automatic"
            ? "automatic"
            : "approval_required",
        estimatedImpact: params.estimatedImpact,
        confidence: params.confidence,
        locationName: params.locationName,
      },
    },
    executiveAI: {
      recommendation: params.stepTitle,
      confidence: params.confidence,
      riskLevel: params.priority,
    },
  });
}

function createWorkflowStep(params: {
  workflowId: string;
  title: string;
  description: string;
  order: number;
  dependsOn?: string[];
  executionMode: WorkflowExecutionMode;
  priority: OperatorTaskPriority;
  confidence: number;
  estimatedImpact: number;
  locationName: string | null;
  successMetric?: string | null;
phase?: string | null;
metadata?: Record<string, unknown>;
safetyContract?: WorkflowStepSafetyContract;
}): WorkflowStep {
  const id = generateId("workflow_step");
  const dependsOn = params.dependsOn ?? [];

  const task = buildTaskForStep({
    stepTitle: params.title,
    stepDescription: params.description,
    priority: params.priority,
    executionMode: params.executionMode,
    confidence: params.confidence,
    estimatedImpact: params.estimatedImpact,
    locationName: params.locationName,
  });

  return {
    id,
    workflowId: params.workflowId,

    title: params.title,
    description: params.description,

    category: categoryFromText(
      `${params.title} ${params.description}`,
    ),

    priority: params.priority,

    status: stepStatusFromMode({
      mode: params.executionMode,
      hasDependencies: dependsOn.length > 0,
    }),

    executionMode: params.executionMode,

    order: params.order,
    dependsOn,

    autoExecutable:
      params.executionMode === "automatic",

          requiresApproval:
      params.executionMode ===
      "approval_required",

    safetyContract:
      params.safetyContract ?? {
        riskLevel:
          "unknown",

        reversibility:
          "unknown",

        financialExposure:
          "unknown",

        customerFacing:
          "unknown",

        legalOrComplianceImpact:
          "unknown",

        rollbackRequirement:
          "unknown",

        stopConditionsRequired:
          "unknown",

        source:
          "fallback_unknown",
      },

    estimatedImpact: params.estimatedImpact,
    confidence: params.confidence,

    task,

successMetric: params.successMetric ?? null,
phase: params.phase ?? null,

createdAt: now(),

metadata: params.metadata ?? {},
  };
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

function buildWorkflowStepDescriptions(
  input: BuildWorkflowInput,
) {
  const intelligence = input.operatorIntelligence;
  const executiveAI = input.executiveAI;

  const firstMove = compact(
    intelligence?.firstMove ??
      input.executionPlan?.topTask?.title ??
      executiveAI?.recommendation,
    "Review the highest-priority operating issue.",
  );

  const doNow = uniqueStrings([
    ...(intelligence?.doNow ?? []),
    ...(executiveAI?.doNext ?? []),
  ]).filter(
    (item) =>
      item.toLowerCase() !== firstMove.toLowerCase(),
  );

  const watchNext = uniqueStrings([
    ...(intelligence?.watchNext ?? []),
    ...(executiveAI?.watchClosely ?? []),
  ]);

  return {
    firstMove,
    doNow,
    watchNext,
  };
}
type CognitiveApprovalBehavior =
  | "approval_gate"
  | "execution_authorization";

type CognitiveStepTemplate = {
  title: string;

  description: string;

  executionMode:
    WorkflowExecutionMode;

  successMetric: string;

  phase: string;

  safetyContract?:
  WorkflowStepSafetyContract;
};
function approvalBehaviorFromPhase(
  phase: string,
): CognitiveApprovalBehavior {
  switch (phase) {
    case "test":
    case "contain":
    case "execute":
      return "execution_authorization";

    default:
      return "approval_gate";
  }
}
function normalizeCognitiveDecisionMode(
  value:
    | string
    | null
    | undefined,
): CognitiveWorkflowDecisionMode {
  const normalized =
    String(value ?? "")
      .trim()
      .toLowerCase();

  if (
    normalized === "investigate"
  ) {
    return "investigate";
  }

  if (
    normalized === "test" ||
    normalized === "experiment"
  ) {
    return "test";
  }

  if (
    normalized === "contain" ||
    normalized === "safeguard"
  ) {
    return "contain";
  }

  if (
    normalized === "monitor" ||
    normalized === "observe"
  ) {
    return "monitor";
  }

  return "act";
}

function normalizeCognitiveScore(
  value:
    | number
    | null
    | undefined,

  fallback: number,
) {
  const safeValue =
    safeNumber(
      value,
      fallback,
    );

  const normalized =
    safeValue >= 0 &&
    safeValue <= 1
      ? safeValue * 100
      : safeValue;

  return Math.round(
    clamp(
      normalized,
    ),
  );
}

function workflowTypeFromCognitiveMode(
  mode:
    CognitiveWorkflowDecisionMode,
): OperatorWorkflowType {
  switch (mode) {
    case "investigate":
      return "evidence_investigation";

    case "test":
      return "controlled_test";

    case "contain":
      return "risk_containment";

    case "monitor":
      return "active_monitoring";

    default:
      return "custom";
  }
}

function executionModeFromCognitiveMode(
  mode:
    CognitiveWorkflowDecisionMode,

  fallback:
    | string
    | null
    | undefined,
): WorkflowExecutionMode {
  switch (mode) {
    case "investigate":
    case "test":
    case "contain":
      return "approval_required";

    case "monitor":
      return "monitor";

    default:
      return normalizeExecutionMode(
        fallback,
      );
  }
}
type CognitiveWorkflowStrategy =
  NonNullable<
    NonNullable<
      CognitiveWorkflowContext["selectedStrategy"]
    >["strategy"]
  >;

function authoritySafetyFromCognitiveStrategy(
  strategy: CognitiveWorkflowStrategy,
): WorkflowAuthoritySafetyProfile {
  return {
    riskLevel:
      strategy.risk === "low" ||
      strategy.risk === "medium" ||
      strategy.risk === "high" ||
      strategy.risk === "critical"
        ? strategy.risk
        : "unknown",

    reversibility:
      strategy.reversibility === "high"
        ? "easy"
        : strategy.reversibility === "medium"
          ? "moderate"
          : strategy.reversibility === "low"
            ? "hard"
            : "unknown",

    financialExposure:
      strategy.financialExposure ??
      "unknown",

    customerFacing:
      strategy.customerFacing ??
      "unknown",

    legalOrComplianceImpact:
      strategy.legalOrComplianceImpact ??
      "unknown",
  };
}
function buildCognitiveStepTemplates(params: {
  mode:
    CognitiveWorkflowDecisionMode;

  strategyTitle: string;

  strategyDescription: string;

  expectedOutcome: string;

  unresolvedQuestion: string;

  hypothesisTitle: string;

  successMetric: string;

  warning: string | null;

  leadingIndicators: string[];

  actionExecutionMode:
    WorkflowExecutionMode;

        strategySafety:
      WorkflowAuthoritySafetyProfile;
}): CognitiveStepTemplate[] {
  const warningContext =
    params.warning
      ? ` Decision warning: ${params.warning}`
      : "";

  switch (params.mode) {
    case "investigate":
      return [
        {
          title:
            "Frame the highest-impact unknown",

          description:
            `Turn "${params.unresolvedQuestion}" into a precise decision question before changing operations.${warningContext}`,

          executionMode:
            "approval_required",

          successMetric:
            "The operator confirms the unresolved question, decision scope, and evidence required.",

          phase:
            "question",

            safetyContract: {
              riskLevel:
                "low",

              reversibility:
                "easy",

              financialExposure:
                "none",

              customerFacing:
                false,

              legalOrComplianceImpact:
                false,

              rollbackRequirement:
                "not_required",

              stopConditionsRequired:
                false,

              source:
                "intrinsic",
            },
        },

        {
          title:
            "Gather decisive evidence",

          description:
            "Collect the location, timing, revenue, refund, guest, staffing, margin, and execution evidence needed to distinguish between competing explanations.",

          executionMode:
            "manual",

          successMetric:
            "The minimum evidence required to support or reject the leading explanation is available.",

          phase:
            "evidence",

                        safetyContract: {
              riskLevel:
                "low",

              reversibility:
                "easy",

              financialExposure:
                "none",

              customerFacing:
                false,

              legalOrComplianceImpact:
                "unknown",

              rollbackRequirement:
                "not_required",

              stopConditionsRequired:
                false,

              source:
                "intrinsic",
            },
        },

        {
          title:
            "Challenge the leading hypothesis",

          description:
            `Test "${params.hypothesisTitle}" against the newly collected evidence and actively search for disconfirming signals.`,

          executionMode:
            "manual",

          successMetric:
            "The leading hypothesis is supported, weakened, or replaced using explicit evidence.",

          phase:
            "hypothesis_test",

                        safetyContract: {
              riskLevel:
                "low",

              reversibility:
                "easy",

              financialExposure:
                "none",

              customerFacing:
                false,

              legalOrComplianceImpact:
                false,

              rollbackRequirement:
                "not_required",

              stopConditionsRequired:
                false,

              source:
                "intrinsic",
            },
        },

        {
          title:
            "Re-run the Brain decision",

          description:
            "Update the evidence, hypotheses, beliefs, and confidence state before selecting an operating action.",

          executionMode:
            "automatic",

          successMetric:
            "The Brain produces a refreshed strategy with stronger evidence coverage and decision confidence.",

          phase:
            "reassess",

                        safetyContract: {
              riskLevel:
                "low",

              reversibility:
                "easy",

              financialExposure:
                "none",

              customerFacing:
                false,

              legalOrComplianceImpact:
                false,

              rollbackRequirement:
                "not_required",

              stopConditionsRequired:
                false,

              source:
                "intrinsic",
            },
        },

        {
          title:
            "Store the investigation lesson",

          description:
            "Save what resolved the uncertainty so future restaurant decisions can reuse the evidence pattern.",

          executionMode:
            "manual",

          successMetric:
            "The resolved uncertainty and resulting lesson are stored in Operator Memory.",

          phase:
            "learn",

                        safetyContract: {
              riskLevel:
                "low",

              reversibility:
                "unknown",

              financialExposure:
                "none",

              customerFacing:
                false,

              legalOrComplianceImpact:
                "unknown",

              rollbackRequirement:
                "unknown",

              stopConditionsRequired:
                false,

              source:
                "intrinsic",
            },
        },
      ];

    case "test":
      return [
        {
          title:
            "Approve the controlled test",

          description:
            `Define the smallest reversible test for "${params.strategyTitle}" and confirm its scope, owner, duration, and stopping conditions.${warningContext}`,

          executionMode:
            "approval_required",

          successMetric:
            "A measurable, reversible test plan is approved before execution.",

          phase:
            "design",

                        safetyContract: {
              riskLevel:
                "low",

              reversibility:
                "easy",

              financialExposure:
                "none",

              customerFacing:
                false,

              legalOrComplianceImpact:
                false,

              rollbackRequirement:
                "not_required",

              stopConditionsRequired:
                false,

              source:
                "intrinsic",
            },
        },

        {
          title:
            "Capture the operating baseline",

          description:
            "Record the relevant before-state for revenue, orders, refunds, margin, labor, rating, guest experience, and execution quality.",

          executionMode:
            "manual",

          successMetric:
            "A complete baseline exists for every metric used to evaluate the test.",

          phase:
            "baseline",

                        safetyContract: {
              riskLevel:
                "low",

              reversibility:
                "easy",

              financialExposure:
                "none",

              customerFacing:
                false,

              legalOrComplianceImpact:
                "unknown",

              rollbackRequirement:
                "not_required",

              stopConditionsRequired:
                false,

              source:
                "intrinsic",
            },
        },

        {
          title:
            params.strategyTitle,

          description:
            params.strategyDescription,

          executionMode:
            "approval_required",

          successMetric:
            params.successMetric,

          phase:
            "test",

                        safetyContract: {
              ...params.strategySafety,

              rollbackRequirement:
                "required_before_execution",

              stopConditionsRequired:
                true,

              source:
                "strategy_inherited",
            },
        },

        {
          title:
            "Measure the controlled outcome",

          description:
            params.expectedOutcome,

          executionMode:
            "manual",

          successMetric:
            params.successMetric,

          phase:
            "measure",

                        safetyContract: {
              riskLevel:
                "low",

              reversibility:
                "easy",

              financialExposure:
                "none",

              customerFacing:
                false,

              legalOrComplianceImpact:
                "unknown",

              rollbackRequirement:
                "not_required",

              stopConditionsRequired:
                false,

              source:
                "intrinsic",
            },
        },

        {
          title:
            "Decide whether to scale, revise, or stop",

          description:
            "Compare the measured result against the baseline, risk guardrails, and expected outcome before expanding the strategy.",

          executionMode:
            "approval_required",

          successMetric:
            "The Brain produces an evidence-based scale, revise, or stop decision.",

          phase:
            "decide",

                        safetyContract: {
              riskLevel:
                "low",

              reversibility:
                "easy",

              financialExposure:
                "none",

              customerFacing:
                false,

              legalOrComplianceImpact:
                false,

              rollbackRequirement:
                "not_required",

              stopConditionsRequired:
                false,

              source:
                "intrinsic",
            },
        },

        {
          title:
            "Store the experimental lesson",

          description:
            "Send the test design and measured outcome to Outcome Learning and Operator Memory.",

          executionMode:
            "manual",

          successMetric:
            "The test becomes a measured lesson or reusable playbook.",

          phase:
            "learn",

                        safetyContract: {
              riskLevel:
                "low",

              reversibility:
                "unknown",

              financialExposure:
                "none",

              customerFacing:
                false,

              legalOrComplianceImpact:
                "unknown",

              rollbackRequirement:
                "unknown",

              stopConditionsRequired:
                false,

              source:
                "intrinsic",
            },
        },
      ];

    case "contain":
      return [
        {
          title:
            "Confirm the immediate risk",

          description:
            `Validate the signal requiring containment and confirm the downside that must be prevented.${warningContext}`,

          executionMode:
            "approval_required",

          successMetric:
            "The operator confirms that the risk is real, material, and correctly scoped.",

          phase:
            "validate",

                        safetyContract: {
              riskLevel:
                "low",

              reversibility:
                "easy",

              financialExposure:
                "none",

              customerFacing:
                false,

              legalOrComplianceImpact:
                false,

              rollbackRequirement:
                "not_required",

              stopConditionsRequired:
                false,

              source:
                "intrinsic",
            },
        },

        {
          title:
            params.strategyTitle,

          description:
            params.strategyDescription,

          executionMode:
            "approval_required",

          successMetric:
            params.successMetric,

          phase:
            "contain",

                        safetyContract: {
              ...params.strategySafety,

              rollbackRequirement:
                "required_before_execution",

              stopConditionsRequired:
                true,

              source:
                "strategy_inherited",
            },
        },

        {
          title:
            "Verify the safeguard is not causing harm",

          description:
            "Monitor revenue, margin, refunds, guest experience, staffing, and execution quality after containment.",

          executionMode:
            "manual",

          successMetric:
            "The risk is reduced without creating an unacceptable secondary impact.",

          phase:
            "guardrail",

                        safetyContract: {
              riskLevel:
                "low",

              reversibility:
                "easy",

              financialExposure:
                "none",

              customerFacing:
                false,

              legalOrComplianceImpact:
                "unknown",

              rollbackRequirement:
                "not_required",

              stopConditionsRequired:
                false,

              source:
                "intrinsic",
            },
        },

        {
          title:
            "Choose the durable follow-up",

          description:
            "Use the stabilized state to decide whether to remove, revise, or convert the safeguard into a longer-term operating change.",

          executionMode:
            "approval_required",

          successMetric:
            "A durable follow-up decision is supported by post-containment evidence.",

          phase:
            "decide",

                        safetyContract: {
              riskLevel: "low",
              reversibility: "easy",
              financialExposure: "none",
              customerFacing: false,
              legalOrComplianceImpact: false,
              rollbackRequirement: "not_required",
              stopConditionsRequired: false,
              source: "intrinsic",
            },
        },

        {
          title:
            "Store the containment lesson",

          description:
            "Save the risk signal, safeguard, measured result, and reversal conditions in Operator Memory.",

          executionMode:
            "manual",

          successMetric:
            "The containment pattern becomes available for future matching situations.",

          phase:
            "learn",

                        safetyContract: {
              riskLevel: "low",
              reversibility: "unknown",
              financialExposure: "none",
              customerFacing: false,
              legalOrComplianceImpact: "unknown",
              rollbackRequirement: "unknown",
              stopConditionsRequired: false,
              source: "intrinsic",
            },
        },
      ];

    case "monitor":
      return [
        {
          title:
            "Define the monitored condition",

          description:
            `Specify the signal, decision threshold, observation window, and escalation trigger for "${params.strategyTitle}".`,

          executionMode:
            "monitor",

          successMetric:
            "The monitored signal and escalation thresholds are explicit and measurable.",

          phase:
            "define",

                        safetyContract: {
              riskLevel: "low",
              reversibility: "easy",
              financialExposure: "none",
              customerFacing: false,
              legalOrComplianceImpact: false,
              rollbackRequirement: "not_required",
              stopConditionsRequired: false,
              source: "intrinsic",
            },
        },

        {
          title:
            "Capture the monitoring baseline",

          description:
            "Record the current operating state so future movement can be distinguished from normal variation.",

          executionMode:
            "automatic",

          successMetric:
            "A timestamped baseline is available for every monitored indicator.",

          phase:
            "baseline",

                        safetyContract: {
              riskLevel: "low",
              reversibility: "easy",
              financialExposure: "none",
              customerFacing: false,
              legalOrComplianceImpact: "unknown",
              rollbackRequirement: "not_required",
              stopConditionsRequired: false,
              source: "intrinsic",
            },
        },

        {
          title:
            "Watch the leading indicators",

          description:
            params.leadingIndicators.length > 0
              ? `Monitor: ${params.leadingIndicators.join(
                  "; ",
                )}.`
              : "Monitor the relevant operating, financial, guest, and execution signals for meaningful change.",

          executionMode:
            "monitor",

          successMetric:
            "Meaningful movement is detected without reacting to ordinary operating noise.",

          phase:
            "monitor",

                        safetyContract: {
              riskLevel: "low",
              reversibility: "easy",
              financialExposure: "none",
              customerFacing: false,
              legalOrComplianceImpact: "unknown",
              rollbackRequirement: "not_required",
              stopConditionsRequired: false,
              source: "intrinsic",
            },
        },

        {
          title:
            "Re-evaluate when a threshold is crossed",

          description:
            "Trigger a new Brain cycle when evidence materially strengthens, weakens, or changes the decision.",

          executionMode:
            "automatic",

          successMetric:
            "The Brain re-runs only when the defined evidence threshold is reached.",

          phase:
            "reassess",

                        safetyContract: {
              riskLevel: "low",
              reversibility: "easy",
              financialExposure: "none",
              customerFacing: false,
              legalOrComplianceImpact: false,
              rollbackRequirement: "not_required",
              stopConditionsRequired: false,
              source: "intrinsic",
            },
        },

        {
          title:
            "Store the monitoring lesson",

          description:
            "Record which signals predicted meaningful change and which signals were only noise.",

          executionMode:
            "manual",

          successMetric:
            "The Brain improves its future monitoring thresholds and signal quality.",

          phase:
            "learn",

                        safetyContract: {
              riskLevel: "low",
              reversibility: "unknown",
              financialExposure: "none",
              customerFacing: false,
              legalOrComplianceImpact: "unknown",
              rollbackRequirement: "unknown",
              stopConditionsRequired: false,
              source: "intrinsic",
            },
        },
      ];

    default:
      return [
        {
          title:
            "Confirm execution guardrails",

          description:
            `Confirm the owner, scope, rollback plan, success metric, and downside limits for "${params.strategyTitle}".${warningContext}`,

          executionMode:
            params.actionExecutionMode,

          successMetric:
            "The action has a clear owner, success metric, and reversible rollback plan.",

          phase:
            "validate",

                        safetyContract: {
              riskLevel: "low",
              reversibility: "easy",
              financialExposure: "none",
              customerFacing: false,
              legalOrComplianceImpact: false,
              rollbackRequirement: "not_required",
              stopConditionsRequired: false,
              source: "intrinsic",
            },
        },

        {
          title:
            params.strategyTitle,

          description:
            params.strategyDescription,

          executionMode:
            params.actionExecutionMode,

          successMetric:
            params.successMetric,

          phase:
            "execute",

                        safetyContract: {
              ...params.strategySafety,

              rollbackRequirement:
                "required_before_execution",

              stopConditionsRequired:
                true,

              source:
                "strategy_inherited",
            },
        },

        {
          title:
            "Measure the operating outcome",

          description:
            params.expectedOutcome,

          executionMode:
            "manual",

          successMetric:
            params.successMetric,

          phase:
            "measure",

                        safetyContract: {
              riskLevel: "low",
              reversibility: "easy",
              financialExposure: "none",
              customerFacing: false,
              legalOrComplianceImpact: "unknown",
              rollbackRequirement: "not_required",
              stopConditionsRequired: false,
              source: "intrinsic",
            },
        },

        {
          title:
            "Reconcile the result with the prediction",

          description:
            "Compare what actually happened with the simulated future, expected risk, and decision assumptions.",

          executionMode:
            "automatic",

          successMetric:
            "Prediction error and decision quality are explicitly measured.",

          phase:
            "reconcile",

                        safetyContract: {
              riskLevel: "low",
              reversibility: "easy",
              financialExposure: "none",
              customerFacing: false,
              legalOrComplianceImpact: false,
              rollbackRequirement: "not_required",
              stopConditionsRequired: false,
              source: "intrinsic",
            },
        },

        {
          title:
            "Store the operational lesson",

          description:
            "Send the measured before-and-after result to Outcome Learning and Operator Memory.",

          executionMode:
            "manual",

          successMetric:
            "A measured lesson or reusable playbook is stored in Operator Memory.",

          phase:
            "learn",

                        safetyContract: {
              riskLevel: "low",
              reversibility: "unknown",
              financialExposure: "none",
              customerFacing: false,
              legalOrComplianceImpact: "unknown",
              rollbackRequirement: "unknown",
              stopConditionsRequired: false,
              source: "intrinsic",
            },
        },
      ];
  }
}

function buildCognitiveOperatorWorkflow(
  input:
    BuildWorkflowInput,

  workflowId:
    string,
): OperatorWorkflow | null {
  const cognition =
    input.cognition;

  const selected =
    cognition
      ?.selectedStrategy;

  const strategy =
    selected?.strategy;

  if (
    !cognition ||
    !strategy
  ) {
    return null;
  }

  const sourceQuestion =
  strategy.sourceQuestion;

  const decision =
    cognition
      .decisionEvaluation;

  const comparison =
    cognition
      .futureComparison;

  const bestFuture =
    comparison?.best;

  const mode =
    normalizeCognitiveDecisionMode(
      strategy.decisionMode ??
        decision?.decisionMode,
    );

  const legacyExecutionMode =
    input.operatorIntelligence
      ?.executionMode ??
    input.executionPlan?.mode ??
    input.executionPlan
      ?.topTask?.mode;

  const executionMode =
    executionModeFromCognitiveMode(
      mode,
      legacyExecutionMode,
    );

  const locationName =
    input.operatorIntelligence
      ?.locationFocus ??
    input.executionPlan
      ?.topTask
      ?.locationName ??
    null;

  const riskLevel =
    strategy.urgency ??
    strategy.risk ??
    input.operatorIntelligence
      ?.riskLevel ??
    input.executiveAI
      ?.riskLevel ??
    "medium";

  const priority =
    priorityFromRisk(
      riskLevel,
    );

  const confidence =
    normalizeCognitiveScore(
      comparison
        ?.decisionConfidence ??
        decision?.confidence ??
        strategy.confidence ??
        bestFuture?.confidence,
      60,
    );

  const estimatedImpact =
    normalizeCognitiveScore(
      selected?.score ??
        comparison?.bestScore ??
        input.executionPlan
          ?.topTask
          ?.estimatedImpact,
      confidence,
    );

  const strategyTitle =
    compact(
      strategy.title ??
        bestFuture
          ?.strategyTitle,
      "Review the highest-priority operating decision.",
    );

  const strategyDescription =
    compact(
      strategy.description,
      "Complete the operating strategy selected by the Cognitive Brain.",
    );

  const expectedOutcome =
    compact(
      strategy.expectedOutcome ??
        bestFuture?.summary,
      "Produce a safer decision supported by stronger evidence and measurable operating results.",
    );

  const successMetric =
    compact(
      strategy
        .successMetrics?.[0] ??
        input.operatorIntelligence
          ?.successMetric ??
        input.executiveAI
          ?.successMetric,
      mode === "investigate"
        ? "Evidence coverage and decision confidence improve enough to support a safer next action."
        : "The selected strategy produces a measurable improvement without exceeding its risk guardrails.",
    );

  const questions =
    [
      ...(
        cognition
          .internalDialogue
          ?.questions ??
        []
      ),
    ].sort(
      (left, right) =>
        safeNumber(
          right.importance,
          0,
        ) -
        safeNumber(
          left.importance,
          0,
        ),
    );

    const unresolvedQuestion =
    compact(
      sourceQuestion
        ?.question ??
      decision
        ?.unknowns?.[0] ??
      cognition.hypotheses
        ?.unknowns?.[0] ??
      questions[0]?.question,
      "What evidence would most change the current decision?",
    );

  const hypothesisTitle =
    compact(
      cognition.hypotheses
        ?.primaryHypothesis
        ?.title,
      "the leading operating explanation",
    );

  const warning =
    comparison
      ?.warnings?.[0] ??
    decision
      ?.blockingReasons?.[0] ??
    comparison
      ?.tradeoffs?.[0] ??
    null;

  const templates =
    buildCognitiveStepTemplates({
      mode,

      strategyTitle,

      strategyDescription,

      expectedOutcome,

      unresolvedQuestion,

      hypothesisTitle,

      successMetric,

      warning,

      leadingIndicators:
        bestFuture
          ?.leadingIndicators ??
        [],

      actionExecutionMode:
        executionMode,

              strategySafety:
        authoritySafetyFromCognitiveStrategy(
          strategy,
        ),
    });

  const steps:
    WorkflowStep[] = [];

  for (
    const [
      index,
      template,
    ] of templates.entries()
  ) {
    const previousStep =
      steps[
        steps.length - 1
      ];

    steps.push(
      createWorkflowStep({
        workflowId,

        title:
          template.title,

        description:
          template.description,

        order:
          index + 1,

        dependsOn:
          previousStep
            ? [
                previousStep.id,
              ]
            : [],

        executionMode:
          template
            .executionMode,

        priority:
          template.phase ===
          "learn"
            ? "medium"
            : priority,

        confidence,

        estimatedImpact,

        locationName,

        successMetric:
  template.successMetric,
            safetyContract:
            template.safetyContract,

metadata: {
  phase:
    template.phase,

  generatedFrom:
    "cognitive_brain",

  approvalBehavior:
    template.executionMode ===
    "approval_required"
      ? approvalBehaviorFromPhase(
          template.phase,
        )
      : null,

  cognitiveDecisionMode:
    mode,

  cognitiveStrategyId:
    strategy.id ??
    null,
},
      }),
    );
  }

  const requiresApproval =
    steps.some(
      (step) =>
        step.requiresApproval,
    );

  const autoExecutable =
    steps.length > 0 &&
    steps.every(
      (step) =>
        step.autoExecutable,
    );

  return {
    id:
      workflowId,

    type:
      workflowTypeFromCognitiveMode(
        mode,
      ),

    title:
      strategyTitle,

    description:
      strategyDescription,

    locationName,

    status:
      workflowStatusFromMode(
        executionMode,
      ),

    priority,

    executionMode,

    requiresApproval,

    autoExecutable,

          authoritySafety: {
                riskLevel:
          strategy.risk === "low" ||
          strategy.risk === "medium" ||
          strategy.risk === "high" ||
          strategy.risk === "critical"
            ? strategy.risk
            : "unknown",
        reversibility:
          strategy.reversibility === "high"
            ? "easy"
            : strategy.reversibility === "medium"
              ? "moderate"
              : strategy.reversibility === "low"
                ? "hard"
                : "unknown",

                financialExposure:
          strategy.financialExposure ??
          "unknown",

        customerFacing:
          strategy.customerFacing ??
          "unknown",

        legalOrComplianceImpact:
          strategy.legalOrComplianceImpact ??
          "unknown",
      },

    confidence,

    estimatedImpact,

    currentStepId:
      steps[0]?.id ??
      null,

    steps,

    successMetric,

    expectedOutcome,

    source: {
      generatedBy:
        "TurnTableAI",

      executiveRecommendation:
        strategyTitle,

      executionPlanSummary:
        input.executionPlan
          ?.summary ??
        null,

      riskLevel:
        String(
          riskLevel,
        ),
    },

    createdAt:
      now(),

    metadata: {
  generatedFrom:
    "cognitive_brain",

  sourceActionId:
    input.actionId ??
    null,

  cognitiveDecisionMode:
    mode,

      cognitiveStrategyId:
        strategy.id ??
        null,

        cognitiveQuestionId:
  sourceQuestion?.id ??
  null,

cognitiveQuestionKind:
  sourceQuestion?.kind ??
  null,

cognitiveQuestion:
  sourceQuestion?.question ??
  null,

cognitiveQuestionBlockingDecision:
  sourceQuestion?.blockingDecision ??
  null,

cognitiveRelatedBeliefId:
  sourceQuestion?.relatedBeliefId ??
  strategy.relatedBeliefId ??
  null,

cognitiveRelatedHypothesisId:
  strategy.relatedHypothesisId ??
  null,

      cognitiveObjective:
        cognition.objective
          ?.title ??
        null,

      primaryHypothesis:
        cognition.hypotheses
          ?.primaryHypothesis
          ?.title ??
        null,

      decisionRecommendation:
        decision
          ?.recommendation ??
        null,

      decisionReadiness:
        decision
          ?.readinessScore ??
        null,

      reversibility:
        strategy
          .reversibility ??
        null,

      warnings:
        comparison
          ?.warnings ??
        [],

      tradeoffs:
        comparison
          ?.tradeoffs ??
        [],

      failureConditions:
        bestFuture
          ?.failureConditions ??
        [],
    },
  };
}
export function buildOperatorWorkflow(
  input: BuildWorkflowInput,
): OperatorWorkflow {
  const workflowId = generateId("operator_workflow");
  const cognitiveWorkflow =
    buildCognitiveOperatorWorkflow(
      input,
      workflowId,
    );

  if (cognitiveWorkflow) {
    return cognitiveWorkflow;
  }
  const intelligence = input.operatorIntelligence ?? null;
  const executiveAI = input.executiveAI ?? null;
  const executionPlan = input.executionPlan ?? null;

  const locationName =
    intelligence?.locationFocus ??
    executionPlan?.topTask?.locationName ??
    null;

  const riskLevel =
    intelligence?.riskLevel ??
    executiveAI?.riskLevel ??
    "medium";

  const priority =
    priorityFromRisk(riskLevel);

  const confidence = Math.round(
    clamp(
      safeNumber(
        intelligence?.confidence ??
          executiveAI?.confidence ??
          executionPlan?.topTask?.confidence,
        60,
      ),
    ),
  );

  const estimatedImpact = Math.round(
    clamp(
      safeNumber(
        executionPlan?.topTask?.estimatedImpact,
        confidence,
      ),
    ),
  );

  const executionMode = normalizeExecutionMode(
    intelligence?.executionMode ??
      executionPlan?.mode ??
      executionPlan?.topTask?.mode,
  );

  const requiresApproval =
  executionMode ===
    "approval_required";

  const autoExecutable =
    executionMode === "automatic";

  const stepDescriptions =
    buildWorkflowStepDescriptions(input);

  const rootCause = compact(
    intelligence?.rootCause,
    "The root cause should be confirmed before broad changes are made.",
  );

  const likelyFuture = compact(
    intelligence?.likelyFuture,
    "The AI will monitor the restaurant after execution.",
  );

  const successMetric = compact(
    intelligence?.successMetric ??
      executiveAI?.successMetric,
    "Measure revenue, refunds, labor, margin, rating, and execution quality before and after the workflow.",
  );

  const expectedOutcome = compact(
    intelligence?.whyThisMove,
    "Reduce the highest-priority operating risk and measure the result.",
  );

  const firstStep = createWorkflowStep({
    workflowId,
    title: "Confirm the operating issue",
    description: rootCause,
    order: 1,
    executionMode: "approval_required",
    priority,
    confidence,
    estimatedImpact,
    locationName,
    successMetric:
      "The responsible operator confirms that the signal and root cause are accurate.",
    metadata: {
      phase: "validate",
    },
  });

  const actionStep = createWorkflowStep({
    workflowId,
    title: stepDescriptions.firstMove,
    description: compact(
      intelligence?.whyThisMove ??
        executionPlan?.topTask?.description,
      "Execute the highest-priority action selected by TurnTableAI.",
    ),
    order: 2,
    dependsOn: [firstStep.id],
    executionMode,
    priority,
    confidence,
    estimatedImpact,
    locationName,
    successMetric,
    metadata: {
      phase: "execute",
    },
  });

  const supportingSteps = stepDescriptions.doNow
    .slice(0, 4)
    .map((description, index) =>
      createWorkflowStep({
        workflowId,
        title: description,
        description:
          "Supporting workflow action generated from Operator Intelligence.",
        order: index + 3,
        dependsOn: [actionStep.id],
        executionMode:
          executionMode === "automatic"
            ? "automatic"
            : "approval_required",
        priority:
          priority === "critical"
            ? "high"
            : priority,
        confidence,
        estimatedImpact: Math.max(
          30,
          estimatedImpact - 10,
        ),
        locationName,
        successMetric,
        metadata: {
          phase: "support",
        },
      }),
    );

  const measurementDependencies =
    supportingSteps.length > 0
      ? supportingSteps.map((step) => step.id)
      : [actionStep.id];

  const measurementStep = createWorkflowStep({
    workflowId,
    title: "Measure workflow outcome",
    description: [
      successMetric,
      likelyFuture,
    ].join(" "),
    order: supportingSteps.length + 3,
    dependsOn: measurementDependencies,
    executionMode: "manual",
    priority: "medium",
    confidence,
    estimatedImpact,
    locationName,
    successMetric,
    metadata: {
      phase: "measure",
      watchNext: stepDescriptions.watchNext,
    },
  });

  const learningStep = createWorkflowStep({
    workflowId,
    title: "Store the operational lesson",
    description:
      "Send the measured before-and-after result to Outcome Learning and Operator Memory.",
    order: supportingSteps.length + 4,
    dependsOn: [measurementStep.id],
    executionMode: "manual",
    priority: "medium",
    confidence,
    estimatedImpact,
    locationName,
    successMetric:
      "A measured lesson or reusable playbook is stored in Operator Memory.",
    metadata: {
      phase: "learn",
    },
  });

  const steps = [
    firstStep,
    actionStep,
    ...supportingSteps,
    measurementStep,
    learningStep,
  ];

  return {
    id: workflowId,

    type: workflowTypeFromText(
      [
        stepDescriptions.firstMove,
        intelligence?.situation,
        rootCause,
      ].join(" "),
    ),

    title: compact(
      intelligence?.headline ??
        executiveAI?.headline,
      `TurnTableAI operator workflow${
        locationName
          ? ` for ${locationName}`
          : ""
      }`,
    ),

    description: compact(
      intelligence?.situation ??
        executionPlan?.summary,
      "Coordinated workflow generated from the AI Kernel.",
    ),

    locationName,

    status: workflowStatusFromMode(
      executionMode,
    ),

    priority,
    executionMode,

    requiresApproval,
    autoExecutable,

          authoritySafety: {
        riskLevel:
          riskLevel === "low" ||
          riskLevel === "medium" ||
          riskLevel === "high" ||
          riskLevel === "critical"
            ? riskLevel
            : "unknown",

        reversibility:
          "unknown",

        financialExposure:
          "unknown",

        customerFacing:
          "unknown",

        legalOrComplianceImpact:
          "unknown",
      },

    confidence,
    estimatedImpact,

    currentStepId:
      steps[0]?.id ?? null,

    steps,

    successMetric,
    expectedOutcome,

    source: {
      generatedBy: "TurnTableAI",
      executiveRecommendation:
        executiveAI?.recommendation ?? null,
      executionPlanSummary:
        executionPlan?.summary ?? null,
      riskLevel:
        executiveAI?.riskLevel ??
        intelligence?.riskLevel ??
        null,
    },

    createdAt: now(),

    metadata: {
      operatorJudgment:
        intelligence?.judgment ?? null,

      executionWindow:
        intelligence?.executionWindow ?? null,

      doNotDo:
        intelligence?.doNotDo ?? [],

      watchNext:
        stepDescriptions.watchNext,
    },
  };
}

function dependenciesCompleted(
  step: WorkflowStep,
  steps: WorkflowStep[],
) {
  if (!step.dependsOn.length) return true;

  return step.dependsOn.every((dependencyId) => {
    const dependency = steps.find(
      (candidate) =>
        candidate.id === dependencyId,
    );

    return (
      dependency?.status === "completed" ||
      dependency?.status === "skipped"
    );
  });
}

function refreshStepAvailability(
  workflow: OperatorWorkflow,
) {
  const steps = workflow.steps.map((step) => {
    if (step.status !== "blocked") {
      return step;
    }

    if (
      !dependenciesCompleted(
        step,
        workflow.steps,
      )
    ) {
      return step;
    }

    return {
      ...step,
      status:
        step.requiresApproval
          ? ("pending_approval" as const)
          : ("ready" as const),
    };
  });

  const currentStep =
    steps
      .filter(
        (step) =>
          step.status !== "completed" &&
          step.status !== "skipped" &&
          step.status !== "cancelled",
      )
      .sort(
        (a, b) => a.order - b.order,
      )[0] ?? null;

  return {
    ...workflow,
    steps,
    currentStepId:
      currentStep?.id ?? null,
  };
}

export function approveWorkflow(
  workflow: OperatorWorkflow,
): OperatorWorkflow {
  const timestamp = now();

  const steps = workflow.steps.map((step) => {
    if (
      step.status !== "pending_approval"
    ) {
      return step;
    }

    if (
      !dependenciesCompleted(
        step,
        workflow.steps,
      )
    ) {
      return step;
    }

    return {
      ...step,
      status: "approved" as const,
      approvedAt: timestamp,
    };
  });

  return refreshStepAvailability({
    ...workflow,
    status: "approved",
    approvedAt: timestamp,
    steps,
  });
}
function getStepApprovalBehavior(
  step: WorkflowStep,
): CognitiveApprovalBehavior {
  const behavior =
    step.metadata?.approvalBehavior;

  if (
    behavior ===
    "execution_authorization"
  ) {
    return "execution_authorization";
  }

  return "approval_gate";
}
/*
 * Safety eligibility only.
 *
 * This function never grants production
 * autonomous authority. It only determines
 * whether an already-automatic step is safe
 * enough to cross the workflow start boundary.
 */
export function isWorkflowStepSafetyEligibleForAutonomy(
  step: WorkflowStep,
): boolean {
  if (
    step.executionMode !==
    "automatic"
  ) {
    return false;
  }

  const safety =
    step.safetyContract;

  return (
    safety.source !==
      "fallback_unknown" &&
    safety.riskLevel ===
      "low" &&
    safety.reversibility ===
      "easy" &&
    safety.financialExposure ===
      "none" &&
    safety.customerFacing ===
      false &&
    safety.legalOrComplianceImpact ===
      false &&
    safety.rollbackRequirement ===
      "not_required" &&
    safety.stopConditionsRequired ===
      false
  );
}
export function startWorkflow(
  workflow: OperatorWorkflow,
): OperatorWorkflow {
  const timestamp = now();

  /*
   * First normalize step availability using the workflow's
   * existing dependency rules.
   */
  let refreshed =
    refreshStepAvailability(workflow);

  let currentStep =
    refreshed.steps.find(
      (step) =>
        step.id ===
        refreshed.currentStepId,
    ) ?? null;

  /*
   * An approved current step represents an approval gate.
   *
   * Starting the workflow means that approval gate has now
   * been satisfied. It should therefore become completed,
   * not running.
   */
  if (
    currentStep?.status === "approved" &&
    getStepApprovalBehavior(
      currentStep,
    ) === "approval_gate"
  ) {
    const stepsWithCompletedApproval =
      refreshed.steps.map((step) => {
        if (step.id !== currentStep?.id) {
          return step;
        }

        return {
          ...step,
          status: "completed" as const,
          completedAt: timestamp,
          failureReason: null,
        };
      });

    /*
     * Re-run availability after completing the approval gate.
     * This allows its dependent step to move from blocked
     * into ready and updates currentStepId accordingly.
     */
    refreshed =
      refreshStepAvailability({
        ...refreshed,
        status: "running",
        startedAt:
          refreshed.startedAt ??
          timestamp,
        steps:
          stepsWithCompletedApproval,
      });

    currentStep =
      refreshed.steps.find(
        (step) =>
          step.id ===
          refreshed.currentStepId,
      ) ?? null;
  }

  /*
   * Never bypass an unresolved approval gate.
   */
  if (
    currentStep?.status ===
    "pending_approval"
  ) {
    return refreshed;
  }

    /*
   * Fail closed before changing workflow lifecycle state.
   *
   * An automatic step with incomplete or unsafe
   * safety metadata must remain unstarted.
   *
   * This does NOT grant production authority.
   */
  if (
    currentStep?.executionMode ===
      "automatic" &&
    !isWorkflowStepSafetyEligibleForAutonomy(
      currentStep,
    )
  ) {
    return refreshed;
  }

  /*
   * The first genuinely executable step becomes running.
   *
   * Notice that we intentionally start ONLY a "ready" step.
   * An "approved" step is an approval gate and is handled
   * above instead.
   */
  const steps =
  refreshed.steps.map((step) => {
    if (
      step.id !== currentStep?.id
    ) {
      return step;
    }

          /*
       * Defense-in-depth safety boundary:
       * an automatic step may not start unless
       * its complete safety contract is eligible.
       *
       * This does NOT grant production authority.
       */
      if (
        step.executionMode ===
          "automatic" &&
        !isWorkflowStepSafetyEligibleForAutonomy(
          step,
        )
      ) {
        return step;
      }

    const canStart =
      step.status === "ready" ||
      (
        step.status === "approved" &&
        getStepApprovalBehavior(step) ===
          "execution_authorization"
      );

    if (!canStart) {
      return step;
    }

    return {
      ...step,
      status: "running" as const,
      startedAt:
        step.startedAt ??
        timestamp,
    };
  });

  return {
    ...refreshed,
    status: "running",
    startedAt:
      refreshed.startedAt ??
      timestamp,
    steps,
  };
}

export function completeWorkflowStep(
  workflow: OperatorWorkflow,
  stepId: string,
): WorkflowAdvanceResult {
  const timestamp = now();

  const requestedStep =
    workflow.steps.find(
      (step) =>
        step.id === stepId,
    ) ?? null;

  const currentStepBeforeCompletion =
    workflow.steps.find(
      (step) =>
        step.id ===
        workflow.currentStepId,
    ) ?? null;

  /*
   * Completion is a protected lifecycle boundary.
   *
   * A step may only complete when:
   * - it exists,
   * - it is the workflow's current step,
   * - it legitimately entered running,
   * - and the workflow itself is running.
   *
   * This prevents callers from skipping start,
   * approval, dependency, or safety gates.
   */
  if (
    workflow.status !== "running" ||
    !requestedStep ||
    requestedStep.id !==
      workflow.currentStepId ||
    requestedStep.status !==
      "running"
  ) {
    return {
      workflow,
      previousStep: null,
      currentStep:
        currentStepBeforeCompletion,
      workflowCompleted: false,
    };
  }

  const steps =
    workflow.steps.map(
      (step) => {
        if (
          step.id !== stepId
        ) {
          return step;
        }

        return {
          ...step,
          status:
            "completed" as const,
          completedAt:
            timestamp,
          failureReason:
            null,
        };
      },
    );

  const refreshed =
    refreshStepAvailability({
      ...workflow,
      status: "running",
      steps,
    });

  const incompleteSteps =
    refreshed.steps.filter(
      (step) =>
        step.status !==
          "completed" &&
        step.status !==
          "skipped" &&
        step.status !==
          "cancelled",
    );

  const workflowCompleted =
    incompleteSteps.length === 0;

  const completedWorkflow:
    OperatorWorkflow =
    workflowCompleted
      ? {
          ...refreshed,
          status:
            "completed",
          currentStepId:
            null,
          completedAt:
            timestamp,
        }
      : refreshed;

  const currentStep =
    completedWorkflow.steps.find(
      (step) =>
        step.id ===
        completedWorkflow.currentStepId,
    ) ?? null;

  return {
    workflow:
      completedWorkflow,
    previousStep:
      requestedStep,
    currentStep,
    workflowCompleted,
  };
}

export function failWorkflowStep(
  workflow: OperatorWorkflow,
  stepId: string,
  reason: string,
): OperatorWorkflow {
  const timestamp = now();

  return {
    ...workflow,
    status: "failed",
    steps: workflow.steps.map((step) =>
      step.id === stepId
        ? {
            ...step,
            status: "failed",
            failedAt: timestamp,
            failureReason:
              reason.trim() ||
              "Workflow step failed.",
          }
        : step,
    ),
  };
}

export function pauseWorkflow(
  workflow: OperatorWorkflow,
): OperatorWorkflow {
  return {
    ...workflow,
    status: "paused",
  };
}

export function resumeWorkflow(
  workflow: OperatorWorkflow,
): OperatorWorkflow {
  const refreshed =
    refreshStepAvailability(
      workflow,
    );

  const currentStep =
    refreshed.steps.find(
      (step) =>
        step.id ===
        refreshed.currentStepId,
    ) ?? null;

  /*
   * Re-check automatic-step safety when resuming.
   *
   * A workflow must not regain "running" status
   * around an unsafe automatic step.
   */
  if (
    currentStep?.executionMode ===
      "automatic" &&
    !isWorkflowStepSafetyEligibleForAutonomy(
      currentStep,
    )
  ) {
    return {
      ...refreshed,
      status: "paused",
    };
  }

  return {
    ...refreshed,
    status: "running",
  };
}

export function cancelWorkflow(
  workflow: OperatorWorkflow,
): OperatorWorkflow {
  const timestamp = now();

  return {
    ...workflow,
    status: "cancelled",
    cancelledAt: timestamp,
    currentStepId: null,

    steps: workflow.steps.map((step) => {
      if (
        step.status === "completed" ||
        step.status === "skipped"
      ) {
        return step;
      }

      return {
        ...step,
        status: "cancelled",
      };
    }),
  };
}

export function markWorkflowMeasured(
  workflow: OperatorWorkflow,
): OperatorWorkflow {
  return {
    ...workflow,
    status: "measured",
    measuredAt: now(),
  };
}

export function markWorkflowLearned(
  workflow: OperatorWorkflow,
): OperatorWorkflow {
  return {
    ...workflow,
    status: "learned",
    learnedAt: now(),
  };
}

export function createWorkflowQueue(
  workflows: OperatorWorkflow[],
): WorkflowQueue {
  return {
    draft: workflows.filter(
      (workflow) =>
        workflow.status === "draft",
    ),

    pendingApproval: workflows.filter(
      (workflow) =>
        workflow.status ===
        "pending_approval",
    ),

    approved: workflows.filter(
      (workflow) =>
        workflow.status === "approved",
    ),

    running: workflows.filter(
      (workflow) =>
        workflow.status === "running",
    ),

    paused: workflows.filter(
      (workflow) =>
        workflow.status === "paused",
    ),

    completed: workflows.filter(
      (workflow) =>
        workflow.status === "completed",
    ),

    measured: workflows.filter(
      (workflow) =>
        workflow.status === "measured",
    ),

    learned: workflows.filter(
      (workflow) =>
        workflow.status === "learned",
    ),

    failed: workflows.filter(
      (workflow) =>
        workflow.status === "failed",
    ),

    cancelled: workflows.filter(
      (workflow) =>
        workflow.status === "cancelled",
    ),
  };
}

export function getWorkflowProgress(
  workflow: OperatorWorkflow,
) {
  const relevantSteps =
    workflow.steps.filter(
      (step) =>
        step.status !== "cancelled",
    );

  const completedSteps =
    relevantSteps.filter(
      (step) =>
        step.status === "completed" ||
        step.status === "skipped",
    );

  const percent =
    relevantSteps.length > 0
      ? Math.round(
          (completedSteps.length /
            relevantSteps.length) *
            100,
        )
      : 0;

  return {
    totalSteps: relevantSteps.length,
    completedSteps:
      completedSteps.length,
    percent,
    currentStep:
      workflow.steps.find(
        (step) =>
          step.id ===
          workflow.currentStepId,
      ) ?? null,
  };
}