import { getRestaurantStates } from "@/lib/restaurantState";
import {
  createDefaultMission,
} from "@/lib/brain/mission";
import {
  getDecisionPrinciples,
} from "@/lib/brain/decisionPrinciples";
import type {
  AIKernelInput,
  AIKernelMode,
  AIKernelMemoryContext,
} from "@/lib/aiKernel";
import type { BrainContext } from "@/lib/brain/brainContext";
import {
    buildWorldState,
  } from "@/lib/brain/perception/worldState";
import {
    createWorkingMemory,
  } from "@/lib/brain/workingMemory";
export interface BrainInitializationResult {
  context: BrainContext;

  mode: AIKernelMode;

  restaurantStates: Awaited<
    ReturnType<typeof getRestaurantStates>
  >;


  memory: AIKernelMemoryContext;
}

export async function initializeBrain(
  input: AIKernelInput,
): Promise<BrainInitializationResult> {
  const restaurantStates =
    await getRestaurantStates({
      userId: input.userId,
      locationName:
        input.locationName ?? null,
      lookbackDays:
        input.lookbackDays ?? 45,
    });

  if (!restaurantStates.length) {
    throw new Error(
      "AI Kernel could not run because no restaurant states were available.",
    );
  }

  const mode: AIKernelMode =
    restaurantStates.length === 1
      ? "single_location"
      : "network";

      const context: BrainContext = {
        metadata: {
          runId: crypto.randomUUID(),
          status: "running",
          currentPhase: "initialization",
          startedAt: new Date().toISOString(),
          completedAt: null,
          errors: [],
        },
        workingMemory:
        createWorkingMemory(),
        // ==========================================================
        // Cognitive Operating System
        // ==========================================================
      
        perception: {
            restaurantState: restaurantStates,
          
            worldState: buildWorldState({
              restaurantStates,
          
              locationNames:
                restaurantStates.map(
                  (state) =>
                    state.locationName,
                ),
          
              mode,
            }),
          },
      
        knowledge: {
  knowledgeModel: undefined,

  operatorMemory: undefined,
},
      
reasoning: {
  mission:
    createDefaultMission(),
    principles:
  getDecisionPrinciples(),
  goalAssessment: undefined,

  primaryGoal: undefined,

  planning: undefined,

  causalAnalysis: undefined,

  prediction: undefined,

  worldModel: undefined,

  executiveDecision: undefined,

  strategy: undefined,

  confidence: undefined,
},
      
        action: {
  execution: undefined,

  operatorWorkflow: undefined,

  operatorIntelligence: undefined,
},
      
        learningState: {
  learning: undefined,
},
      
       
      };
  return {
    context,

    mode,

    restaurantStates,

    

    memory: {
      loaded: false,
      totalMemories: 0,
      reusablePlaybooks: 0,
      successfulStrategies: 0,
      averageOutcomeScore: null,
      recentMemories: [],
      error: null,
    },
  };
}