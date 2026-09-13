import type {
  BrainContext,
} from "@/lib/brain/brainContext";

export async function runAction(
  context: BrainContext,
): Promise<BrainContext> {
  const selectedStrategy =
    context.reasoning
      .selectedStrategy
      ?.strategy;

  if (selectedStrategy) {
    context.action.execution = {
      strategyId:
        selectedStrategy.id,

      title:
        selectedStrategy.title,

      reason:
        selectedStrategy.rationale ??
        selectedStrategy.description,

      priority:
        selectedStrategy.priority,

      decisionMode:
        selectedStrategy.decisionMode,

      relatedBeliefId:
        selectedStrategy.relatedBeliefId,

      relatedHypothesisId:
        selectedStrategy.relatedHypothesisId,

      sourceQuestion:
        selectedStrategy.sourceQuestion,

      status:
        "planned",

      generatedAt:
        new Date().toISOString(),
    };

    return context;
  }

  /**
   * Temporary compatibility fallback while legacy
   * reasoning.strategy remains available during migration.
   */
  const legacyStrategy =
    context.reasoning.strategy as
      | {
          title?: string;
          reason?: string;
          priority?: number;
        }
      | null
      | undefined;

  if (!legacyStrategy) {
    return context;
  }

  context.action.execution = {
    title:
      legacyStrategy.title ??
      "Maintain Operations",

    reason:
      legacyStrategy.reason ??
      "",

    priority:
      legacyStrategy.priority ??
      50,

    status:
      "planned",

    generatedAt:
      new Date().toISOString(),
  };

  return context;
}