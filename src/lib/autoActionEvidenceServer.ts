import "server-only";
import { resolveUniqueConnectedGoogleLocation } from "@/lib/connectedGoogleReviewEvidence";

import {
  getAutoActionEvidenceRequirement,
  isAutoActionEvidenceSatisfied,
} from "@/lib/autoActionEvidence";
import { getRestaurantStates } from "@/lib/restaurantState";
import { loadSquareProductionConnections } from "@/lib/squareConnectionReader";
import { getSupabaseRouteClient } from "@/lib/supabaseRoute";

type ActionEvidenceInput = {
  userId: string;
  locationName: string;
  createdAt: string;
  sourceSignal: unknown;
};

function record(value: unknown): Record<string, unknown> | null {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function recent(value: unknown, hours: number): boolean {
  const stamp = Date.parse(text(value));
  const age = Date.now() - stamp;
  return Number.isFinite(stamp) &&
    age >= 0 &&
    age <= hours * 60 * 60 * 1000;
}

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

async function verifyPerformance(
  input: ActionEvidenceInput,
): Promise<boolean> {
  const source = record(input.sourceSignal);
  const provenance = record(source?.performanceProvenance);
  const claimedLatest = record(provenance?.latest);
  const claimedPrevious = record(provenance?.previous);

  if (!claimedLatest || !claimedPrevious) return false;

  const states = await getRestaurantStates({
    userId: input.userId,
    locationName: input.locationName,
    lookbackDays: 45,
  });

  const ready = states.filter(
    (state) =>
      sameName(state.locationName, input.locationName) &&
      state.dataReadiness.status === "ready",
  );

  if (ready.length !== 1) return false;

  const metrics = ready[0].metrics;
  const latest = metrics.latestPerformanceProvenance;
  const previous = metrics.previousPerformanceProvenance;

  if (!latest || !previous) return false;
  if (latest.sourceSystem !== "square" ||
      previous.sourceSystem !== "square") return false;

  if (!recent(latest.capturedAt, 72)) return false;

  // The action must refer to the actual, current database snapshots.
  for (const [claimed, actual] of [
    [claimedLatest, latest],
    [claimedPrevious, previous],
  ] as const) {
    if (text(claimed.rowId) !== actual.rowId ||
        text(claimed.sourceRecordId) !== actual.sourceRecordId ||
        text(claimed.sourceSystem) !== actual.sourceSystem) {
      return false;
    }
  }

  // Confirm that the source records belong to the user's
  // existing production Square merchant and active location.
  const connections = await loadSquareProductionConnections(
    input.userId,
  );

  const owned = connections.some((connection) =>
    connection.locations.some((location) => {
      if (location.status?.toUpperCase() !== "ACTIVE" ||
          !sameName(location.name, input.locationName)) {
        return false;
      }

      const prefix = [
        "square",
        "daily",
        "production",
        connection.merchantId,
        location.providerLocationId,
      ].join(":") + ":";

      return [latest.sourceRecordId, previous.sourceRecordId]
        .every((sourceId) => {
          if (!sourceId.startsWith(prefix)) return false;
          return /^\\d{4}-\\d{2}-\\d{2}$/.test(
            sourceId.slice(prefix.length),
          );
        });
    }),
  );

  if (!owned) return false;

  return isAutoActionEvidenceSatisfied({
    sourceSignal: input.sourceSignal,
    hasFreshOwnedPerformanceEvidence: true,
    hasFreshOwnedReviewEvidence: false,
    verifiedSignals: {
      salesDeltaPct:
        metrics.revenueDeltaPct === null
          ? null
          : Math.round(metrics.revenueDeltaPct),
      refunds: metrics.refunds,
      laborPct: metrics.laborPct,
    },
  });
}

async function verifyReviews(
  input: ActionEvidenceInput,
): Promise<boolean> {
  const supabase = await getSupabaseRouteClient();

  const { data: connections, error: connectionError } =
    await supabase
      .from("review_connections")
      .select("review_locations(name,title)")
      .eq("user_id", input.userId)
      .eq("provider", "google");

  if (connectionError) {
    throw new Error("Review connection evidence unavailable");
  }

  const locations = (connections ?? []).flatMap((connection) =>
    Array.isArray(connection.review_locations)
      ? connection.review_locations
      : [],
  );

  // Require one unique owner-connected resource ID, never a guessed label.
  const googleLocationId = resolveUniqueConnectedGoogleLocation(
    locations, input.locationName,
  );
  if (!googleLocationId) return false;

  const since = new Date(
    Date.now() - 45 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: reviews, error: reviewError } =
    await supabase
      .from("reviews")
      .select("provider_review_id,rating,text,update_time")
      .eq("user_id", input.userId)
      .eq("provider", "google")
      .eq("location_name", googleLocationId)
      .gte("update_time", since);

  if (reviewError) {
    throw new Error("Review evidence unavailable");
  }

  const verified = (reviews ?? []).filter(
    (review) =>
      text(review.provider_review_id).length > 0 &&
      recent(review.update_time, 45 * 24),
  );

  const rated = verified
    .map((review) => Number(review.rating))
    .filter(
      (rating) =>
        Number.isFinite(rating) &&
        rating >= 1 &&
        rating <= 5,
    );

  if (!rated.length) return false;

  const negativeCount = rated.filter((rating) => rating <= 3).length;
  const avgRating =
    rated.reduce((sum, rating) => sum + rating, 0) /
    rated.length;

  const hasServiceIssue = verified.some(
    (review) =>
      /wait|service|slow|delay|line|late/i.test(
        text(review.text),
      ),
  );

  return isAutoActionEvidenceSatisfied({
    sourceSignal: input.sourceSignal,
    hasFreshOwnedPerformanceEvidence: false,
    hasFreshOwnedReviewEvidence: true,
    verifiedSignals: {
      negativeReviewCount: negativeCount,
      avgRating,
      reviewIssues: hasServiceIssue ? ["wait or service issue"] : [],
    },
  });
}

export async function verifyAutoActionEvidence(
  input: ActionEvidenceInput,
): Promise<boolean> {
  if (!text(input.userId) ||
      !text(input.locationName) ||
      !recent(input.createdAt, 72)) {
    return false;
  }

  const requirement = getAutoActionEvidenceRequirement(
    input.sourceSignal,
  );

  if (requirement === "performance") {
    return verifyPerformance(input);
  }

  if (requirement === "reviews") {
    return verifyReviews(input);
  }

  return false;
}
