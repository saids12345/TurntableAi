import type {
  GoalAssessment,
} from "@/lib/brain/goalEngine";

export interface BrainPerception {
  restaurantState?: unknown;

  operatorMemory?: unknown;

  planningContexts?: unknown;

  intelligenceContexts?: unknown;

  worldContexts?: unknown;

  goalAssessment?: GoalAssessment;
}

export interface BrainReasoning {
  planning?: unknown;

  causalAnalysis?: unknown;

  prediction?: unknown;

  worldModel?: unknown;

  executiveAI?: unknown;
}

export interface BrainAction {
  execution?: unknown;

  executiveDecision?: unknown;

  operatorIntelligence?: unknown;

  operatorWorkflow?: unknown;

  learning?: unknown;
}