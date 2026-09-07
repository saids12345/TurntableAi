import type {
  BrainContext,
} from "@/lib/brain/brainContext";

import {
  runReasoningPipeline,
} from "./reasoningPipeline";

export async function runReasoning(
  context: BrainContext,
): Promise<BrainContext> {
  /**
   * Execute one complete cognitive reasoning cycle.
   *
   * We intentionally do not stop when Business Understanding
   * is unavailable. The reasoning pipeline can still form an
   * uncertainty-aware diagnosis and recommend investigation.
   */
  const pipeline =
    runReasoningPipeline(
      context,
    );

  const understanding =
    context.perception
      .businessUnderstanding;

  const selectedStrategy =
    pipeline.selected?.strategy;

  const bestFuture =
    pipeline.comparison.best;

  /**
   * Explicitly preserve the complete cognitive state.
   *
   * Some of these values are already published by the pipeline,
   * but assigning them here makes the Reasoning pillar's output
   * contract clear and prevents future orchestration changes from
   * silently dropping reasoning artifacts.
   */
  context.reasoning.objective =
    pipeline.objective;

  context.reasoning.hypotheses =
    pipeline.hypotheses;

  context.reasoning.beliefs =
    pipeline.beliefs;

  context.reasoning.internalDialogue =
    pipeline.dialogue;

  context.reasoning.decisionEvaluation =
    pipeline.decision;

  context.reasoning.candidateStrategies =
    pipeline.strategies;

  context.reasoning.rankedStrategies =
    pipeline.rankedStrategies;

  context.reasoning.selectedStrategy =
    pipeline.selected;

  context.reasoning.futureSimulations =
    pipeline.futures;

  context.reasoning.futureComparison =
    pipeline.comparison;

    context.reasoning.selfCritique =
  pipeline.selfCritique;

  context.reasoning.deliberationGate =
  pipeline.deliberationGate;

  context.reasoning.decisionArbitration =
  pipeline.decisionArbitration;

  context.reasoning.decisionStability =
  pipeline.decisionStability;

  context.reasoning.decisionAuthority =
  pipeline.decisionAuthority;

  

  /**
   * Preserve the legacy strategy object while exposing richer
   * information from the new cognitive architecture.
   */
  context.reasoning.strategy = {
    id:
      selectedStrategy?.id ??
      bestFuture.strategyId,

    title:
      selectedStrategy?.title ??
      understanding?.focus?.title ??
      "Maintain Operations",

    description:
      selectedStrategy?.description ??
      bestFuture.summary,

    reason:
      pipeline.comparison.reasoning.join(
        " ",
      ),

    priority:
      selectedStrategy?.priority ??
      understanding?.focus?.priority ??
      50,

    decisionMode:
      selectedStrategy?.decisionMode ??
      pipeline.decision.decisionMode,

    recommendation:
      pipeline.decision.recommendation,

    evaluation:
      pipeline.decision,

    future:
      bestFuture,

    comparison: {
      bestScore:
        pipeline.comparison
          .bestScore,

      scoreGap:
        pipeline.comparison
          .scoreGap,

      decisionConfidence:
        pipeline.comparison
          .decisionConfidence,

      tradeoffs:
        pipeline.comparison
          .tradeoffs,

      warnings:
        pipeline.comparison
          .warnings,
    },

    generatedAt:
      new Date().toISOString(),
  };

  /**
   * Preserve a compatibility confidence object while making its
   * sources explicit.
   */
  context.reasoning.confidence = {
    decision:
      pipeline.decision.confidence,

    readiness:
      pipeline.decision
        .readinessScore,

    belief:
      pipeline.beliefs
        .overallConfidence,

    uncertainty:
      pipeline.beliefs
        .uncertainty,

    futureSelection:
      pipeline.comparison
        .decisionConfidence,

    evidenceCoverage:
      pipeline.decision
        .evidenceCoverage,
  };

  return context;
}