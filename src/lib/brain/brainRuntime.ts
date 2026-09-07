import {
  createBrainState,
} from "@/lib/brain/brainState";
import type {
  BrainContext,
  BrainPhase,
} from "@/lib/brain/brainContext";

import {
  runPerception,
} from "@/lib/brain/perception";

import {
  runKnowledge,
} from "@/lib/brain/knowledge";

import {
  runReasoning,
} from "@/lib/brain/reasoning";

import {
  runAction,
} from "@/lib/brain/action";

export function setBrainPhase(
  context: BrainContext,
  phase: BrainPhase,
): void {
  context.metadata.currentPhase = phase;
}

export function completeBrainRun(
  context: BrainContext,
): void {
  context.metadata.status = "completed";
  context.metadata.currentPhase = "completed";
  context.metadata.completedAt =
    new Date().toISOString();
}

export function failBrainRun(
  context: BrainContext,
  error: Error,
): void {
  context.metadata.status = "failed";
  context.metadata.currentPhase = "failed";
  context.metadata.completedAt =
    new Date().toISOString();

  context.metadata.errors.push({
    phase:
      context.metadata.currentPhase,
    engine: "brainRuntime",
    message: error.message,
    occurredAt:
      new Date().toISOString(),
  });
}

export async function runBrain(
  context: BrainContext,
): Promise<BrainContext> {
  let current = context;
  let state =
  createBrainState(
    current,
  );

  setBrainPhase(
    current,
    "perception",
  );

  current =
    await runPerception(
      current,
    );

  setBrainPhase(
    current,
    "reasoning",
  );

  current =
    await runKnowledge(
      current,
    );

  current =
    await runReasoning(
      current,
    );

  setBrainPhase(
    current,
    "action",
  );

  current =
    await runAction(
      current,
    );

    state.current = current;

    return state.current;
}
