export type ExecutionResult = {
  actionId: string;
  actionTitle: string;

  locationName: string;

  executedAt: string;

  before: {
    revenue?: number | null;
    refunds?: number | null;
    laborPct?: number | null;
    avgRating?: number | null;
  };

  after: {
    revenue?: number | null;
    refunds?: number | null;
    laborPct?: number | null;
    avgRating?: number | null;
  };
};

export type LearnedOutcome = {
  successScore: number;

  confidenceDelta: number;

  lesson: string;

  shouldRepeat: boolean;

  playbook: string;

  memoryUpdate: string;
};

function delta(
  before?: number | null,
  after?: number | null,
) {
  if (before == null || after == null) return 0;

  return after - before;
}

export function calculateSuccessScore(
  execution: ExecutionResult,
): number {

  let score = 50;

  const revenueChange = delta(
    execution.before.revenue,
    execution.after.revenue,
  );

  const refundChange = delta(
    execution.before.refunds,
    execution.after.refunds,
  );

  const ratingChange = delta(
    execution.before.avgRating,
    execution.after.avgRating,
  );

  score += revenueChange * 2;

  score -= refundChange * 3;

  score += ratingChange * 20;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function extractLesson(
  execution: ExecutionResult,
  successScore: number,
): string {

  if (successScore >= 80) {
    return `${execution.actionTitle} produced a strong positive outcome.`;
  }

  if (successScore >= 60) {
    return `${execution.actionTitle} showed moderate improvement and is worth repeating.`;
  }

  if (successScore >= 40) {
    return `${execution.actionTitle} produced mixed results.`;
  }

  return `${execution.actionTitle} did not improve restaurant performance.`;
}

export function createPlaybook(
  execution: ExecutionResult,
  lesson: string,
): string {

  return `When conditions are similar at ${execution.locationName}, consider "${execution.actionTitle}". ${lesson}`;
}

export function learnFromExecution(
  execution: ExecutionResult,
): LearnedOutcome {

  const successScore =
    calculateSuccessScore(execution);

  const lesson =
    extractLesson(execution, successScore);

  return {
    successScore,

    confidenceDelta:
      successScore >= 75
        ? 10
        : successScore >= 60
        ? 5
        : -5,

    lesson,

    shouldRepeat: successScore >= 65,

    playbook: createPlaybook(
      execution,
      lesson,
    ),

    memoryUpdate:
      `Learned from "${execution.actionTitle}" with success score ${successScore}.`,
  };
}