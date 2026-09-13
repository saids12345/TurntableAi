export type AutoActionStatus =
  | "pending"
  | "approved"
  | "executed"
  | "dismissed";

export function canTransitionAutoActionStatus(
  current: AutoActionStatus,
  next: AutoActionStatus,
): boolean {
  if (current === next) {
    return true;
  }

  const allowed: Record<
    AutoActionStatus,
    AutoActionStatus[]
  > = {
    pending: [
      "approved",
      "dismissed",
    ],

    approved: [
      "executed",
      "dismissed",
    ],

    executed: [],

    dismissed: [],
  };

  return allowed[current].includes(
    next,
  );
}