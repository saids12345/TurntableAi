/**
 * Presentation-only onboarding checkpoints.
 *
 * A saved provider snapshot is NOT proof of active OAuth, physical ownership,
 * live ingestion, or trustworthy AI evidence. This helper never grants access.
 */
export type ProviderRecordState = "present" | "absent" | "unavailable";

export type OnboardingStatus = {
  restaurantName: string | null;
  expectedLocationCount: number;
  savedLocationCount: number;
  google: ProviderRecordState;
  square: ProviderRecordState;
};

export function assessOnboardingStatus(status: OnboardingStatus) {
  const restaurantSaved = Boolean(status.restaurantName?.trim());
  const locationCountValid =
    Number.isInteger(status.expectedLocationCount) &&
    status.expectedLocationCount >= 1 &&
    status.expectedLocationCount <= 100 &&
    Number.isInteger(status.savedLocationCount) &&
    status.savedLocationCount >= 0 &&
    status.savedLocationCount <= 100;
  const locationsEntered = restaurantSaved && locationCountValid &&
    status.savedLocationCount >= status.expectedLocationCount;

  return {
    restaurantSaved,
    locationsEntered,
    providerRecordPresent: status.google === "present" || status.square === "present",
    providerStateUnavailable: status.google === "unavailable" || status.square === "unavailable",
    // Neither provider record existence nor location names establish live-data readiness.
    trustedAiDataVerified: false as const,
  };
}
