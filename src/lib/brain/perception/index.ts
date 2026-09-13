import type {
    BrainContext,
  } from "@/lib/brain/brainContext";
  
  import {
    runObservationEngine,
  } from "./observationEngine";
  import {
    buildSituationAssessmentFromWorldState,
  } from "@/lib/brain/situationAssessment";
  import {
    buildBusinessUnderstanding,
  } from "@/lib/brain/situationAssessment";
  export async function runPerception(
    context: BrainContext,
  ): Promise<BrainContext> {
    let updatedContext = context;
  
    updatedContext =
      await runObservationEngine(
        updatedContext,
      );
  
    const worldState =
      updatedContext.perception
        .worldState;
  
    if (worldState) {
      updatedContext.perception
        .situationAssessment =
        buildSituationAssessmentFromWorldState(
          worldState,
        );
        updatedContext.perception
  .businessUnderstanding =
  buildBusinessUnderstanding(
  worldState.operations.restaurantStates,
);
    }
  
    return updatedContext;
  }
  
  export {
    runObservationEngine,
  };