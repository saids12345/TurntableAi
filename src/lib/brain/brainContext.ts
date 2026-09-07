import type {
  CurrentObjective,
} from "@/lib/brain/reasoning/objectiveEngine";

import type {
  BeliefSystem,
} from "@/lib/brain/reasoning/beliefSystem";

import type {
  HypothesisResult,
} from "@/lib/brain/reasoning/hypothesisEngine";
import type {
  InternalDialogue,
} from "@/lib/brain/reasoning/internalDialogue";

import type {
  StrategyCandidate,
} from "@/lib/brain/reasoning/strategyGenerator";

import type {
  SimulatedFuture,
} from "@/lib/brain/reasoning/futureSimulator";

import type {
  FutureComparison,
} from "@/lib/brain/reasoning/futureComparator";

import type {
  BrainSelfCritique,
} from "@/lib/brain/reasoning/selfCritique";

import type {
  DeliberationGateResult,
} from "@/lib/brain/reasoning/deliberationGate";

import type {
  DecisionArbitrationResult,
} from "@/lib/brain/reasoning/decisionArbitrator";

import type {
  DecisionStabilityResult,
} from "@/lib/brain/reasoning/decisionStability";

import type {
  DecisionAuthorityResult,
} from "@/lib/brain/reasoning/decisionAuthority";

import type {
  AuthorityPolicyResult,
} from "@/lib/brain/reasoning/authorityPolicy";

import type {
  BusinessGoal,
  GoalAssessment,
} from "@/lib/brain/goalEngine";

import type {
  DecisionPrinciple,
} from "@/lib/brain/decisionPrinciples";

import type {
  BrainMission,
} from "@/lib/brain/mission";

import type {
  ObservationSet,
} from "@/lib/brain/observationModel";

import type {
  SituationAssessment,
  BusinessUnderstanding,
} from "@/lib/brain/situationAssessment";

import type {
  KnowledgeModel,
} from "@/lib/brain/knowledgeModel";
import type {
  WorkingMemory,
} from "@/lib/brain/workingMemory";
import type {
  WorldState,
} from "@/lib/brain/perception/worldState";
import type {
  EvaluatedStrategy,
} from "@/lib/brain/reasoning/strategyEvaluator";

import type {
  DecisionEvaluation,
} from "@/lib/brain/reasoning/decisionFramework";
export interface PerceptionContext {
  /**
   * Raw restaurant state loaded from integrations.
   * Temporary compatibility during migration.
   */
  restaurantState?: unknown;

  /**
   * Unified representation of everything the Brain currently
   * believes about the business and its environment.
   */
  worldState?: WorldState;

  /**
   * Important signals extracted from the world state.
   */
  observations?: ObservationSet;

  /**
   * High-level interpretation of the current business state.
   */
  situationAssessment?: SituationAssessment;

  businessUnderstanding?: BusinessUnderstanding;
}

export interface KnowledgeContext {
  knowledgeModel?: KnowledgeModel;

  operatorMemory?: unknown;
}

export interface ReasoningContext {
  mission?: BrainMission;
  principles?: DecisionPrinciple[];
  objective?: CurrentObjective;

hypotheses?: HypothesisResult;

beliefs?: BeliefSystem;
  internalDialogue?: InternalDialogue;

  candidateStrategies?: StrategyCandidate[];

  rankedStrategies?: EvaluatedStrategy[];
  
  selectedStrategy?: EvaluatedStrategy;
  
  decisionEvaluation?: DecisionEvaluation;
  
  futureSimulations?: SimulatedFuture[];

futureComparison?: FutureComparison;

selfCritique?: BrainSelfCritique;

deliberationGate?: DeliberationGateResult;

decisionAuthority?: DecisionAuthorityResult;

authorityPolicy?: AuthorityPolicyResult;

decisionArbitration?: DecisionArbitrationResult;

decisionStability?: DecisionStabilityResult;

  goalAssessment?: GoalAssessment;

  primaryGoal?: BusinessGoal;

  planning?: unknown;

  causalAnalysis?: unknown;

  prediction?: unknown;

  worldModel?: unknown;

  executiveDecision?: unknown;

  strategy?: unknown;

  confidence?: unknown;
}

export interface ActionContext {
  execution?: unknown;

  operatorWorkflow?: unknown;

  operatorIntelligence?: unknown;
}

export interface LearningContext {
  learning?: unknown;
}
export type BrainPhase =
  | "initialization"
  | "perception"
  | "reasoning"
  | "action"
  | "learning"
  | "completed"
  | "failed";

export type BrainRunStatus =
  | "idle"
  | "running"
  | "completed"
  | "failed";

export interface BrainRunError {
  phase: BrainPhase;

  engine: string;

  message: string;

  occurredAt: string;
}

export interface BrainRunMetadata {
  runId: string;

  status: BrainRunStatus;

  currentPhase: BrainPhase;

  startedAt: string;

  completedAt: string | null;

  errors: BrainRunError[];
}
export interface BrainContext {
  metadata: BrainRunMetadata;
  workingMemory: WorkingMemory;
  // ==========================================================
  // Cognitive Operating System (New Architecture)
  // ==========================================================

  perception: PerceptionContext;

  knowledge: KnowledgeContext;

  reasoning: ReasoningContext;

  action: ActionContext;

  learningState: LearningContext;

  
}