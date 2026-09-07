import { getRestaurantStates } from "@/lib/restaurantState";
import {
  createNetworkPlanningResult,
  createPlanningResult,
  type PlanningHorizon,
} from "@/lib/planningEngine";
import {
  analyzeNetworkCausality,
  analyzeSingleRestaurantCausality,
} from "@/lib/causalEngine";
import {
  predictNetworkFuture,
  predictRestaurantFuture,
  type PredictionHorizon,
} from "@/lib/predictionEngine";
import { buildNetworkWorldModel } from "@/lib/worldModel";
import { buildExecutiveAI } from "@/lib/executiveAI";
import { buildExecutionPlan } from "@/lib/executionEngine";
import {
  buildSituationAssessment,
} from "@/lib/brain/situationAssessment";

import {
  operatorMemoryService,
  type RankedOperatorMemory,
} from "@/lib/operatorMemoryService";
import { buildOperatorIntelligence } from "@/lib/operatorIntelligence";
import { buildOperatorWorkflow } from "@/lib/operatorWorkflowEngine";
import {
  buildExecutiveDecision,
  type ExecutiveDecision,
} from "@/lib/brain/executiveDecisionEngine";
import type {
  BrainContext,
} from "@/lib/brain/brainContext";

import {
  initializeBrain,
} from "@/lib/brain/brainInitializer";

import {
  completeBrainRun,
  runBrain,
} from "@/lib/brain/brainRuntime";

import {
  buildProductionDecisionProvenance,
  type ProductionDecisionProvenance,
} from "@/lib/brain/decisionProvenance";

import {
  evaluateWorkflowAuthorityHandoff,
} from "@/lib/brain/reasoning/workflowAuthorityHandoff";

export type AIKernelMode = "single_location" | "network";

export type AIKernelInput = {
  userId: string;
  actionId?: string | null;
  locationName?: string | null;
  lookbackDays?: number;
  planningHorizon?: PlanningHorizon;
  predictionHorizon?: PredictionHorizon;

  /**
   * Diagnostic-only counterfactual control.
   *
   * "normal":
   *   Operator Memory participates in Cognitive Brain reasoning.
   *
   * "excluded":
   *   Operator Memory may still be loaded/ranked for diagnostics,
   *   but learned memories are withheld from Cognitive Brain reasoning.
   *
   * Existing callers remain unchanged because the default behavior
   * is handled as "normal".
   */
  memoryMode?: "normal" | "excluded";
  forceProvenanceFailure?: boolean;
};

export type AIKernelMemoryContext = {
  loaded: boolean;
  totalMemories: number;
  reusablePlaybooks: number;
  successfulStrategies: number;
  averageOutcomeScore: number | null;
  recentMemories: Array<Record<string, unknown>>;
  rankedMemories?: RankedOperatorMemory[];
  error: string | null;
};
export type AIKernelLearningState = {
  status: "awaiting_execution_outcome";

  message: string;
};
export type AIKernelCognition = {
  metadata:
    BrainContext["metadata"];

  objective:
    BrainContext["reasoning"]["objective"] |
    null;

  hypotheses:
    BrainContext["reasoning"]["hypotheses"] |
    null;

  beliefs:
    BrainContext["reasoning"]["beliefs"] |
    null;

  internalDialogue:
    BrainContext["reasoning"]["internalDialogue"] |
    null;

  decisionEvaluation:
    BrainContext["reasoning"]["decisionEvaluation"] |
    null;

  candidateStrategies:
    BrainContext["reasoning"]["candidateStrategies"] |
    null;

  rankedStrategies:
    BrainContext["reasoning"]["rankedStrategies"] |
    null;

  selectedStrategy:
    BrainContext["reasoning"]["selectedStrategy"] |
    null;

  futureSimulations:
    BrainContext["reasoning"]["futureSimulations"] |
    null;

  futureComparison:
    BrainContext["reasoning"]["futureComparison"] |
    null;

    selfCritique:
  BrainContext["reasoning"]["selfCritique"] |
  null;

  deliberationGate:
  BrainContext["reasoning"]["deliberationGate"] |
  null;

  decisionArbitration:
  BrainContext["reasoning"]["decisionArbitration"] |
  null;

  decisionStability:
  BrainContext["reasoning"]["decisionStability"] |
  null;

    decisionAuthority:
  BrainContext["reasoning"]["decisionAuthority"] |
  null;
    authorityPolicy:
  BrainContext["reasoning"]["authorityPolicy"] |
  null;

  decisionProvenance:
  ProductionDecisionProvenance |
  null;

  strategy:
    BrainContext["reasoning"]["strategy"] |
    null;

  confidence:
    BrainContext["reasoning"]["confidence"] |
    null;
};

export type AIKernelResult = {
  ok: true;

  mode: AIKernelMode;

  locationName: string | null;

  locationsAnalyzed: number;

  restaurantStates:
    Awaited<
      ReturnType<
        typeof getRestaurantStates
      >
    >;

  memory:
    AIKernelMemoryContext;

  cognition:
    AIKernelCognition;

    action:
  BrainContext["action"];


  planning:
    | ReturnType<
        typeof createPlanningResult
      >
    | ReturnType<
        typeof createNetworkPlanningResult
      >;

  causalAnalysis:
    | ReturnType<
        typeof analyzeSingleRestaurantCausality
      >
    | ReturnType<
        typeof analyzeNetworkCausality
      >;

  prediction:
    | ReturnType<
        typeof predictRestaurantFuture
      >
    | ReturnType<
        typeof predictNetworkFuture
      >;

  worldModel:
    ReturnType<
      typeof buildNetworkWorldModel
    >;

  executiveAI:
    ReturnType<
      typeof buildExecutiveAI
    >;

  executionPlan:
    ReturnType<
      typeof buildExecutionPlan
    >;

  executiveDecision:
    ExecutiveDecision;

  operatorIntelligence:
    ReturnType<
      typeof buildOperatorIntelligence
    >;

  operatorWorkflow:
    ReturnType<
      typeof buildOperatorWorkflow
    >;

  learning:
    AIKernelLearningState;

  pipeline: {
    restaurantStateLoaded: boolean;

    operatorMemoryLoaded: boolean;

    planningLoaded: boolean;

    causalLoaded: boolean;

    predictionLoaded: boolean;

    worldModelLoaded: boolean;

    executiveAILoaded: boolean;

    executionPlanLoaded: boolean;

    operatorIntelligenceLoaded: boolean;

    operatorWorkflowLoaded: boolean;

    cognitiveObjectiveLoaded: boolean;

    cognitiveHypothesesLoaded: boolean;

    cognitiveBeliefsLoaded: boolean;

    cognitiveDialogueLoaded: boolean;

    cognitiveStrategiesLoaded: boolean;

    cognitiveFuturesLoaded: boolean;

    cognitiveComparisonLoaded: boolean;

    brainRunCompleted: boolean;

    outcomeLearningReady: boolean;
  };

  generatedAt: string;
};

function getTopWorldSignal(
  worldModel: ReturnType<typeof buildNetworkWorldModel>,
) {
  const topSignal = worldModel.topSignal;

  if (!topSignal?.signal) {
    return null;
  }

  return {
    ...topSignal.signal,
    locationName: topSignal.locationName ?? null,
  };
}

function buildPlanningContexts(
  states: Awaited<ReturnType<typeof getRestaurantStates>>,
) {
  return states.map((state) => ({
    locationName: state.locationName,
    health: state.level,
    scores: state.scores,
    revenue: state.metrics.revenue,
    orders: state.metrics.orders,
    refunds: state.metrics.refunds,
    avgRating: state.metrics.avgRating,
    reviewIssueCount: state.metrics.reviewIssueCount,
    laborPct: state.metrics.laborPct,
    marginPct: state.metrics.marginPct,
    openAlerts: state.metrics.openAlerts,
    topIssue: state.primaryRisk,
    operatorMemoryLessons: state.metrics.memoryLessons,
    averageOutcomeScore: state.metrics.avgOutcomeScore,
    reusableLessons: state.metrics.reusableLessons,
  }));
}

function buildCausalAndPredictionContexts(
  states: Awaited<ReturnType<typeof getRestaurantStates>>,
) {
  return states.map((state) => ({
    locationName: state.locationName,
    overallScore: state.overallScore,
    level: state.level,
    scores: state.scores,
    metrics: {
      revenue: state.metrics.revenue,
      previousRevenue: state.metrics.previousRevenue,
      revenueDeltaPct: state.metrics.revenueDeltaPct,
      orders: state.metrics.orders,
      previousOrders: state.metrics.previousOrders,
      ordersDeltaPct: state.metrics.ordersDeltaPct,
      refunds: state.metrics.refunds,
      avgRating: state.metrics.avgRating,
      reviewIssueCount: state.metrics.reviewIssueCount,
      laborPct: state.metrics.laborPct,
      marginPct: state.metrics.marginPct,
      openAlerts: state.metrics.openAlerts,
      pendingActions: state.metrics.pendingActions,
      avgOutcomeScore: state.metrics.avgOutcomeScore,
    },
    primaryRisk: state.primaryRisk,
    primaryOpportunity: state.primaryOpportunity,
  }));
}

function buildWorldContexts(
  states: Awaited<ReturnType<typeof getRestaurantStates>>,
) {
  return states.map((state) => ({
    locationName: state.locationName,
    revenue: state.metrics.revenue,
    orders: state.metrics.orders,
    refunds: state.metrics.refunds,
    avgRating: state.metrics.avgRating,
    laborPct: state.metrics.laborPct,
    marginPct: state.metrics.marginPct,
    demandScore: state.scores.demand,
    operationsScore: state.scores.operations,
    staffingScore: state.scores.staffing,
    serviceScore: state.scores.service,
    profitabilityScore: state.scores.profitability,
    reputationScore: state.scores.reputation,
  }));
}

async function loadMemoryContext(): Promise<AIKernelMemoryContext> {
  try {
    const [summary, recentMemories] = await Promise.all([
  operatorMemoryService.getLearningSummary(),
  operatorMemoryService.getTrustedMemoriesForReasoning({
    limit: 10,
  }),
]);

    return {
      loaded: true,
      totalMemories: summary.totalMemories,
      reusablePlaybooks: summary.reusablePlaybooks,
      successfulStrategies: summary.successfulStrategies,
      averageOutcomeScore: summary.averageOutcomeScore,
      recentMemories: recentMemories as Array<Record<string, unknown>>,
      error: null,
    };
  } catch (error) {
    console.error("AI Kernel memory load failed:", error);

    return {
      loaded: false,
      totalMemories: 0,
      reusablePlaybooks: 0,
      successfulStrategies: 0,
      averageOutcomeScore: null,
      recentMemories: [],
      error:
        error instanceof Error
          ? error.message
          : "Operator Memory could not be loaded.",
    };
  }
}

function getSimilarityContext(
  states: Awaited<ReturnType<typeof getRestaurantStates>>,
) {
  const highestRiskState = [...states].sort(
    (a, b) => a.overallScore - b.overallScore,
  )[0];

  if (!highestRiskState) {
    return null;
  }
  
  return {
    locationName: highestRiskState.locationName,
    operations: highestRiskState.scores.operations,
    profitability: highestRiskState.scores.profitability,
    demand: highestRiskState.scores.demand,
    staffing: highestRiskState.scores.staffing,
    marketing: highestRiskState.scores.marketing,
    service: highestRiskState.scores.service,
    refunds: highestRiskState.metrics.refunds ?? 0,
    rating: highestRiskState.metrics.avgRating ?? 5,
  };
}
function buildCognitionSnapshot(
  context: BrainContext,
  forceProvenanceFailure = false,
): AIKernelCognition {
  return {
    metadata:
      context.metadata,

    objective:
      context.reasoning
        .objective ??
      null,

    hypotheses:
      context.reasoning
        .hypotheses ??
      null,

    beliefs:
      context.reasoning
        .beliefs ??
      null,

    internalDialogue:
      context.reasoning
        .internalDialogue ??
      null,

    decisionEvaluation:
      context.reasoning
        .decisionEvaluation ??
      null,

    candidateStrategies:
      context.reasoning
        .candidateStrategies ??
      null,

    rankedStrategies:
      context.reasoning
        .rankedStrategies ??
      null,

    selectedStrategy:
      context.reasoning
        .selectedStrategy ??
      null,

    futureSimulations:
      context.reasoning
        .futureSimulations ??
      null,

    futureComparison:
      context.reasoning
        .futureComparison ??
      null,

      selfCritique:
  context.reasoning
    .selfCritique ??
  null,
  
  deliberationGate:
  context.reasoning
    .deliberationGate ??
  null,

  decisionArbitration:
  context.reasoning
    .decisionArbitration ??
  null,
  
  decisionStability:
  context.reasoning
    .decisionStability ??
  null,

    decisionAuthority:
  context.reasoning
    .decisionAuthority ??
  null,
    authorityPolicy:
  context.reasoning
    .authorityPolicy ??
  null,


      decisionProvenance:
  buildProductionDecisionProvenance(
    context.reasoning
      .futureComparison,
    forceProvenanceFailure,
  ),

    strategy:
      context.reasoning
        .strategy ??
      null,

    confidence:
      context.reasoning
        .confidence ??
      null,
  };
}
/**
 * Runs the complete TurnTableAI Cognitive OS pipeline.
 *
 * Restaurant State
 * → Operator Memory
 * → Planning / Causal Analysis / Prediction / World Model
 * → Cognitive Brain reasoning
 * → Brain-selected strategy
 * → Cognitive action
 * → Operator Workflow
 * → Measured learning readiness
 *
 * Legacy Executive AI and Execution Plan outputs remain
 * only as compatibility support for existing consumers.
 */
export async function runAIKernel(
  input: AIKernelInput,
): Promise<AIKernelResult> {

  const planningHorizon =
    input.planningHorizon ??
    "next_7_days";

  const predictionHorizon =
    input.predictionHorizon ??
    "next_14_days";

  const {
    context: brainContext,
    mode,
    restaurantStates,
  } = await initializeBrain(
    input,
  );

  const planningContexts =
    buildPlanningContexts(
      restaurantStates,
    );

  const intelligenceContexts =
    buildCausalAndPredictionContexts(
      restaurantStates,
    );

  const worldContexts =
    buildWorldContexts(
      restaurantStates,
    );

  /*
   * Load external memory and build the legacy intelligence
   * outputs before the cognitive Brain reasons.
   *
   * This gives the Hypothesis Engine access to current state,
   * historical learning, causal explanations, predictions,
   * planning, and the World Model during the same cycle.
   */
  let memory =
  await loadMemoryContext();

  const situationAssessment =
    buildSituationAssessment(
      restaurantStates,
    );

  const planning =
    planningContexts.length === 1
      ? createPlanningResult({
          context:
            planningContexts[0],

          horizon:
            planningHorizon,
        })
      : createNetworkPlanningResult({
          contexts:
            planningContexts,

          horizon:
            planningHorizon,
        });

  /*
 * Contextual memory retrieval.
 *
 * Do not treat all historical lessons equally.
 * Rank prior experience according to the situation the Brain
 * is currently trying to understand.
 *
 * Existing recentMemories is replaced with the ranked raw
 * memories so older reasoning engines automatically benefit,
 * while rankedMemories preserves the richer decision metadata
 * such as applicability, evidence quality, freshness,
 * outcome interpretation, and ranking reasons.
 */
try {
  const currentProblemType =
    situationAssessment.dominantIssue ??
    situationAssessment.dominantOpportunity ??
    "operator_signal";

  const rankedMemories =
    await operatorMemoryService.rankMemoriesForContext(
      currentProblemType,
      {
        problemType:
          situationAssessment.dominantIssue ??
          situationAssessment.dominantOpportunity ??
          currentProblemType,

        situationSummary:
          situationAssessment.summary,

        candidateStrategy:
  planning.topMove?.title ?? null,

        locationName:
          input.locationName ?? null,

        limit: 10,
      },
    );

  memory = {
    ...memory,

    recentMemories:
      rankedMemories.map(
        (rankedMemory) =>
          rankedMemory.memory,
      ),

    rankedMemories,
  };
} catch (error) {
  /*
   * Memory ranking should improve reasoning,
   * but a retrieval/ranking failure must not prevent
   * the rest of the Cognitive OS from operating.
   */
  console.warn(
    "AI Kernel contextual memory ranking failed:",
    error,
  );
}

  const causalAnalysis =
    intelligenceContexts.length === 1
      ? analyzeSingleRestaurantCausality(
          intelligenceContexts[0],
        )
      : analyzeNetworkCausality(
          intelligenceContexts,
        );

  const prediction =
    intelligenceContexts.length === 1
      ? predictRestaurantFuture({
          context:
            intelligenceContexts[0],

          horizon:
            predictionHorizon,
        })
      : predictNetworkFuture({
          contexts:
            intelligenceContexts,

          horizon:
            predictionHorizon,
        });

  const worldModel =
    buildNetworkWorldModel(
      worldContexts,
    );

  /*
   * Canonical Cognitive OS context.
   */
  brainContext.perception
    .restaurantState =
    restaurantStates;

  brainContext.perception
    .situationAssessment =
    situationAssessment;

  /*
 * Counterfactual memory diagnostic.
 *
 * Memory retrieval and ranking still happen normally so the
 * kernel can report exactly what would have been available.
 *
 * In "excluded" mode, however, Operator Memory is withheld
 * from the Cognitive Brain itself. This lets us compare the
 * same restaurant situation with and without historical
 * experience participating in reasoning.
 */
const cognitiveOperatorMemory =
  input.memoryMode === "excluded"
    ? null
    : memory;

brainContext.knowledge
  .operatorMemory =
  cognitiveOperatorMemory;

  brainContext.reasoning
    .planning =
    planning;

  brainContext.reasoning
    .causalAnalysis =
    causalAnalysis;

  brainContext.reasoning
    .prediction =
    prediction;

  brainContext.reasoning
    .worldModel =
    worldModel;

  

  /*
   * Run the complete Cognitive Operating System only after
   * its evidence sources have been hydrated.
   */
  const cognitiveContext =
    await runBrain(
      brainContext,
    );

  /*
   * Re-pin externally loaded knowledge after the Brain run.
   * This keeps the final context explicit even if a pillar
   * creates additional knowledge state during execution.
   */
  cognitiveContext.knowledge
  .operatorMemory =
  cognitiveOperatorMemory;

  

  const topWorldSignal =
    getTopWorldSignal(
      worldModel,
    );

  const similarityContext =
    getSimilarityContext(
      restaurantStates,
    );

  const executiveAI =
    buildExecutiveAI({
      mode,

      planningSummary:
        planning.summary ??
        null,

      topMove:
        planning.topMove ??
        null,

      causalSummary:
        causalAnalysis.summary ??
        null,

      topCause:
        causalAnalysis
          .topHypothesis ??
        null,

      predictionSummary:
        prediction.summary ??
        null,

      topPrediction:
        prediction
          .topPrediction ??
        null,

      worldSummary:
        worldModel.summary ??
        null,

      topWorldSignal,

      similarityContext,
    });

  const executionPlan =
    buildExecutionPlan({
      executiveAI,
    });

  const executiveDecision =
    buildExecutiveDecision({
      mode,

      planning,

      causalAnalysis,

      prediction,

      worldModel,

      executionPlan,

      operatorMemory:
        memory.recentMemories,

      restaurantState:
        restaurantStates.length ===
        1
          ? restaurantStates[0]
          : undefined,

      restaurantStates,
    });

  const operatorIntelligence =
    buildOperatorIntelligence({
      mode,

      restaurantStates,

      memory,

      planning,

      causalAnalysis,

      prediction,

      worldModel,

      executiveAI,

      executionPlan,
    });

    const operatorWorkflow =
  buildOperatorWorkflow({
    actionId:
      input.actionId ?? null,

    cognition:
      cognitiveContext.reasoning,

    operatorIntelligence,

    executionPlan,

    executiveAI,
  });

      const workflowAuthorityHandoff =
    evaluateWorkflowAuthorityHandoff(
      cognitiveContext.reasoning
        .decisionAuthority,
      operatorWorkflow,
    );

  cognitiveContext.reasoning.authorityPolicy =
    workflowAuthorityHandoff.policy;
  

  /**
 * Preserve outputs within their canonical pillars.
 
   * We intentionally do not replace action.execution here:
   * the Action pillar may already contain the Cognitive OS
   * execution produced by runBrain().
   */
  

  cognitiveContext.action
    .operatorIntelligence =
    operatorIntelligence;

  cognitiveContext.action
    .operatorWorkflow =
    operatorWorkflow;

  completeBrainRun(
    cognitiveContext,
  );

  const cognition =
  buildCognitionSnapshot(
    cognitiveContext,
    input.forceProvenanceFailure ??
      false,
  );

  return {
    ok: true,

    mode,

    locationName:
      input.locationName ??
      null,

    locationsAnalyzed:
      restaurantStates.length,

    restaurantStates,

    memory,

cognition,

action:
  cognitiveContext.action,

planning,

    causalAnalysis,

    prediction,

    worldModel,

    executiveAI,

    executionPlan,

    executiveDecision,

    operatorIntelligence,

    operatorWorkflow,

    learning: {
      status:
        "awaiting_execution_outcome",

      message:
       "Outcome Learning is ready. After this action is executed, POST its actionId to /api/operator-memory/learn so measured outcomes enrich the original Cognitive memory.",
    },

    pipeline: {
      restaurantStateLoaded:
        restaurantStates.length >
        0,

      operatorMemoryLoaded:
        memory.loaded,

      planningLoaded:
        Boolean(planning),

      causalLoaded:
        Boolean(
          causalAnalysis,
        ),

      predictionLoaded:
        Boolean(prediction),

      worldModelLoaded:
        Boolean(worldModel),

      executiveAILoaded:
        Boolean(executiveAI),

      executionPlanLoaded:
        Boolean(
          executionPlan,
        ),

      operatorIntelligenceLoaded:
        Boolean(
          operatorIntelligence,
        ),

      operatorWorkflowLoaded:
        Boolean(
          operatorWorkflow,
        ),

      cognitiveObjectiveLoaded:
        Boolean(
          cognition.objective,
        ),

      cognitiveHypothesesLoaded:
        Boolean(
          cognition.hypotheses,
        ),

      cognitiveBeliefsLoaded:
        Boolean(
          cognition.beliefs,
        ),

      cognitiveDialogueLoaded:
        Boolean(
          cognition
            .internalDialogue,
        ),

      cognitiveStrategiesLoaded:
        Boolean(
          cognition
            .candidateStrategies
            ?.length,
        ),

      cognitiveFuturesLoaded:
        Boolean(
          cognition
            .futureSimulations
            ?.length,
        ),

      cognitiveComparisonLoaded:
        Boolean(
          cognition
            .futureComparison,
        ),

      brainRunCompleted:
        cognition.metadata
          .status ===
        "completed",

      outcomeLearningReady:
        true,
    },

    generatedAt:
      new Date().toISOString(),
  };
}
