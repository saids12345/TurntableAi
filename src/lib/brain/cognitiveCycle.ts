export enum CognitiveStage {
  Observe = "observe",

  Understand = "understand",

  Question = "question",

  Hypothesize = "hypothesize",

  Plan = "plan",

  Simulate = "simulate",

  Decide = "decide",

  Execute = "execute",

  Learn = "learn",
}

export interface CognitiveCycle {
  stage: CognitiveStage;

  startedAt: string;

  completedStages: CognitiveStage[];
}

export function createCognitiveCycle(): CognitiveCycle {
  return {
    stage: CognitiveStage.Observe,

    startedAt: new Date().toISOString(),

    completedStages: [],
  };
}