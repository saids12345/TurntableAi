export function formatBillingDate(
  iso: string | null | undefined,
  timeZone: string,
): string {
  if (!iso || !timeZone) return "—";

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";

  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
        timeZone,
      timeZoneName: "short",
    }).format(date);
  } catch {
    return "—";
  }
}
