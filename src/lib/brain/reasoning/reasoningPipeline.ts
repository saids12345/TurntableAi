import type {
  BrainContext,
} from "@/lib/brain/brainContext";

import {
  generateStrategies,
} from "./strategyGenerator";

import {
  evaluateDecision,
} from "./decisionFramework";

import {
  evaluateStrategies,
} from "./strategyEvaluator";

import {
  simulateFuture,
} from "./futureSimulator";

import {
  compareFutures,
} from "./futureComparator";

import {
  determineObjective,
} from "./objectiveEngine";

import {
  buildHypotheses,
} from "./hypothesisEngine";

import {
  createBeliefSystem,
} from "./beliefSystem";

import {
  buildInternalDialogue,
} from "./internalDialogue";

import {
  critiqueFutureDecision,
} from "./selfCritique";

import {
  runDeliberationGate,
} from "./deliberationGate";

import {
  arbitrateDecision,
} from "./decisionArbitrator";

import {
  testDecisionStability,
} from "./decisionStability";

import {
  evaluateDecisionAuthority,
} from "./decisionAuthority";

export function runReasoningPipeline(
  context: BrainContext,
) {
  //
  // 1. Determine the current operating objective.
  //
  const objective =
    determineObjective(
      context,
    );

  //
  // 2. Extract evidence and generate
  //    competing hypotheses.
  //
  const hypotheses =
    buildHypotheses(
      context,
    );

  //
  // 3. Form or revise the Brain's beliefs.
  //
  // The existing belief system is supplied as prior state,
  // allowing beliefs to strengthen, weaken, or become contested
  // across multiple cognitive cycles.
  //
  const beliefs =
    createBeliefSystem(
      hypotheses,
      context.reasoning.beliefs,
    );

  //
  // Publish the current cognitive state before downstream
  // reasoning engines run.
  //
  // This ensures Internal Dialogue and the Decision Framework
  // operate on this cycle's objective, hypotheses, and beliefs
  // rather than stale reasoning state.
  //
  context.reasoning.objective =
    objective;

  context.reasoning.hypotheses =
    hypotheses;

  context.reasoning.beliefs =
    beliefs;

  //
  // 4. Build executive internal dialogue.
  //
  const dialogue =
    buildInternalDialogue(
      context,
    );

  context.reasoning.internalDialogue =
    dialogue;

  //
  // 5. Generate candidate strategies.
  //
  const strategies =
  generateStrategies(
    context,
  );

  //
  // 6. Evaluate the situation against
  //    mission and decision principles.
  //
  const decision =
    evaluateDecision(
      context,
    );

  //
  // 7. Rank candidate strategies.
  //
  const rankedStrategies =
    evaluateStrategies(
      strategies,
      decision,
    );

  //
  // 8. Simulate the future created
  //    by each strategy.
  //
  const futures =
    rankedStrategies.map(
      ({ strategy }) =>
        simulateFuture(
          context,
          strategy,
        ),
    );

  //
  // 9. Compare the simulated futures.
  //
  const comparison =
    compareFutures(
      futures,
    );

    const selfCritique =
  critiqueFutureDecision(
    comparison,
  );

  const deliberationGate =
  runDeliberationGate(
    comparison,
    selfCritique,
  );

  const decisionArbitration =
  arbitrateDecision(
    comparison,
    selfCritique,
    deliberationGate,
  );

  const decisionStability =
  testDecisionStability(
    futures,
  );

    const decisionAuthority =
    evaluateDecisionAuthority(
      decisionArbitration,
      decisionStability,
    );

      

  //
  // 10. Select the strategy associated
  //     with the strongest future.
  //
  const selected =
    rankedStrategies.find(
      ({ strategy }) =>
        strategy.id ===
        comparison.best.strategyId,
    );

  return {
    objective,

    hypotheses,

    beliefs,

    dialogue,

    decision,

    strategies,

    rankedStrategies,

    futures,

    comparison,

    selfCritique,

    deliberationGate,

    decisionArbitration,

    decisionStability,

          decisionAuthority,
              

    selected,
  };
}