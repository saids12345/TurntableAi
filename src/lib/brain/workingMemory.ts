import type {
  BrainObservation,
  ObservationSet,
} from "@/lib/brain/observationModel";

import type {
  SituationAssessment,
} from "@/lib/brain/situationAssessment";

import type {
  BusinessGoal,
  GoalAssessment,
} from "@/lib/brain/goalEngine";

export type WorkingMemoryItemStatus =
  | "active"
  | "resolved"
  | "dismissed";

export type WorkingMemoryPriority =
  | "low"
  | "medium"
  | "high"
  | "critical";

export interface WorkingMemoryHypothesis {
  id: string;

  statement: string;

  supportingObservationIds: string[];

  contradictingObservationIds: string[];

  confidence: number;

  status: WorkingMemoryItemStatus;

  createdAt: string;
}

export interface WorkingMemoryStrategy {
  id: string;

  title: string;

  description: string;

  expectedImpact: string | null;

  risk: string | null;

  confidence: number;

  priority: WorkingMemoryPriority;

  status: WorkingMemoryItemStatus;

  createdAt: string;
}

export interface WorkingMemoryQuestion {
  id: string;

  question: string;

  reason: string;

  priority: WorkingMemoryPriority;

  resolved: boolean;

  answer: string | null;

  createdAt: string;

  resolvedAt: string | null;
}

export interface WorkingMemoryDecision {
  id: string;

  title: string;

  rationale: string;

  confidence: number;

  status: WorkingMemoryItemStatus;

  createdAt: string;

  resolvedAt: string | null;
}

export interface WorkingMemory {
  observationSet: ObservationSet | null;

  activeObservations: BrainObservation[];

  situationAssessment: SituationAssessment | null;

  goalAssessment: GoalAssessment | null;

  primaryGoal: BusinessGoal | null;

  hypotheses: WorkingMemoryHypothesis[];

  strategies: WorkingMemoryStrategy[];

  selectedStrategy: WorkingMemoryStrategy | null;

  unresolvedQuestions: WorkingMemoryQuestion[];

  pendingDecisions: WorkingMemoryDecision[];

  overallConfidence: number | null;

  createdAt: string;

  updatedAt: string;
}

function clampConfidence(
  confidence: number,
): number {
  return Math.min(
    1,
    Math.max(0, confidence),
  );
}

export function createWorkingMemory(): WorkingMemory {
  const now = new Date().toISOString();

  return {
    observationSet: null,

    activeObservations: [],

    situationAssessment: null,

    goalAssessment: null,

    primaryGoal: null,

    hypotheses: [],

    strategies: [],

    selectedStrategy: null,

    unresolvedQuestions: [],

    pendingDecisions: [],

    overallConfidence: null,

    createdAt: now,

    updatedAt: now,
  };
}

export function updateWorkingMemory(
  memory: WorkingMemory,
  updates: Partial<
    Omit<
      WorkingMemory,
      "createdAt" | "updatedAt"
    >
  >,
): WorkingMemory {
  return {
    ...memory,

    ...updates,

    overallConfidence:
      updates.overallConfidence === undefined
        ? memory.overallConfidence
        : updates.overallConfidence === null
        ? null
        : clampConfidence(
            updates.overallConfidence,
          ),

    updatedAt:
      new Date().toISOString(),
  };
}