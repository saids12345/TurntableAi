import type { BrainContext } from "@/lib/brain/brainContext";
export interface BrainStateMetrics {
  totalRuns: number;

  successfulRuns: number;

  failedRuns: number;

  lastSuccessfulRun: string | null;
}
export interface BrainState {
  current: BrainContext;

  previous: BrainContext | null;
  metrics: BrainStateMetrics;

  runs: number;

  lastUpdated: string;
}

export function createBrainState(
  context: BrainContext,
): BrainState {
  return {
    current: context,

    previous: null,
    metrics: {
  totalRuns: 1,

  successfulRuns: 1,

  failedRuns: 0,

  lastSuccessfulRun:
    new Date().toISOString(),
},

    runs: 1,

    lastUpdated: new Date().toISOString(),
  };
}

export function updateBrainState(
  state: BrainState,
  context: BrainContext,
): BrainState {
  return {
    current: context,

    previous: state.current,

    metrics: {
  totalRuns:
    state.metrics.totalRuns + 1,

  successfulRuns:
    state.metrics.successfulRuns + 1,

  failedRuns:
    state.metrics.failedRuns,

  lastSuccessfulRun:
    new Date().toISOString(),
},

runs: state.runs + 1,

    lastUpdated: new Date().toISOString(),
  };
}