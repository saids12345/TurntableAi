export type EvidenceClassifiedAutoAction = {
  status?: string | null;
  evidenceStatus?: string | null;
};

export function selectCurrentAutoActions<
  T extends EvidenceClassifiedAutoAction,
>(items: readonly T[]): T[] {
  return items.filter(
    (item) =>
      (item.evidenceStatus === "current" ||
        item.evidenceStatus === "reconciliation_required") &&
      (item.status === "pending" || item.status === "approved"),
  );
}
