/**
 * Pure evidence check for Square daily production rows.
 * This deliberately does not assert data freshness, POS sync success, or full restaurant readiness.
 */
export type SquarePerformanceSourceRow = {
  source_system: string | null;
  source_record_id: string | null;
  location_name: string | null;
};

type SquareProductionLocationEvidence = {
  providerLocationId: string;
  name: string;
  status: string | null;
};

export type SquareProductionConnectionEvidence = {
  userId: string;
  merchantId: string;
  locations: SquareProductionLocationEvidence[];
};

export type VerifiedSquarePerformanceRow<T> = {
  row: T;
  connectionKey: string;
  locationName: string;
  sourceDay: string;
};

function validCalendarDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value;
}

export function verifySquarePerformanceRow<T extends SquarePerformanceSourceRow>(
  row: T,
  userId: string,
  connections: readonly SquareProductionConnectionEvidence[],
): VerifiedSquarePerformanceRow<T> | null {
  if (!userId.trim() || row.source_system !== "square" || !row.source_record_id) {
    return null;
  }

  const fields = row.source_record_id.split(":");
  if (fields.length !== 6 || fields[0] !== "square" ||
      fields[1] !== "daily" || fields[2] !== "production") {
    return null;
  }

  const merchantId = fields[3];
  const providerLocationId = fields[4];
  const sourceDay = fields[5];
  if (!merchantId || !providerLocationId || !validCalendarDay(sourceDay)) {
    return null;
  }

  // Exact identity matching is intentional: aliases or name collisions cannot
  // authorize a financial record for the wrong merchant or restaurant.
  const matches = connections
    .filter((connection) =>
      connection.userId === userId && connection.merchantId === merchantId)
    .flatMap((connection) => connection.locations
      .filter((location) =>
        location.providerLocationId === providerLocationId &&
        location.name.trim().length > 0 &&
        location.name === row.location_name &&
        location.status?.trim().toUpperCase() !== "INACTIVE")
      .map((location) => ({ connection, location })));

  // Duplicate/ambiguous active connection mappings fail closed.
  if (matches.length !== 1) return null;

  return {
    row,
    connectionKey: JSON.stringify([merchantId, providerLocationId]),
    locationName: matches[0].location.name,
    sourceDay,
  };
}
