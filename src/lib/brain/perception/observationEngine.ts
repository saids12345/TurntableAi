import type {
    BrainContext,
  } from "@/lib/brain/brainContext";
  
  import {
    buildObservationSet,
    createObservation,
  } from "@/lib/brain/observationModel";
  
  import {
    updateWorkingMemory,
  } from "@/lib/brain/workingMemory";
  
  export async function runObservationEngine(
    context: BrainContext,
  ): Promise<BrainContext> {
    const worldState =
  context.perception.worldState;

const restaurantStates =
  worldState?.operations
    .restaurantStates ?? [];
  
    if (
      !restaurantStates ||
      !Array.isArray(
        restaurantStates,
      )
    ) {
      return context;
    }
  
    const observations = [];
  
    for (const state of restaurantStates) {
      if (
        state.primaryRisk
      ) {
        observations.push(
          createObservation({
            id: `${state.locationName}-risk`,
  
            category:
              "operations",
  
            title:
              state.primaryRisk,
  
            description:
              state.primaryRisk,
  
            direction:
              "unknown",
  
            severity:
              "risk",
  
            confidence: 0.9,
  
            source:
              "restaurant_state",
  
            locationName:
              state.locationName,
  
            evidence: [],
          }),
        );
      }
  
      if (
        state.primaryOpportunity
      ) {
        observations.push(
          createObservation({
            id: `${state.locationName}-opportunity`,
  
            category:
              "operations",
  
            title:
              state.primaryOpportunity,
  
            description:
              state.primaryOpportunity,
  
            direction:
              "unknown",
  
            severity:
              "positive",
  
            confidence: 0.85,
  
            source:
              "restaurant_state",
  
            locationName:
              state.locationName,
  
            evidence: [],
          }),
        );
      }
    }
  
    const observationSet =
      buildObservationSet(
        observations,
      );
  
    context.perception.observations =
      observationSet;
  
    context.workingMemory =
  updateWorkingMemory(
    context.workingMemory,
    {
      observationSet,

      situationAssessment:
        context.perception
          .situationAssessment,

      activeObservations:
        observationSet.observations,
    },
  );
  
    return context;
  }