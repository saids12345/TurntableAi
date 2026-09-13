import type {
  WorldState,
} from "@/lib/brain/perception/worldState";

export type SituationSeverity =
  | "healthy"
  | "watch"
  | "risk"
  | "critical";

export interface FocusArea {
  id: string;

  title: string;

  priority: number;

  reason: string;
}

export interface SituationAssessment {
  severity: SituationSeverity;

  dominantIssue: string | null;

  dominantOpportunity: string | null;

  confidence: number;

  summary: string;

  generatedAt: string;
}

export interface BusinessUnderstanding {
  situation: SituationAssessment;

  focus: FocusArea | null;

  generatedAt: string;
}

/**
 * Converts the current situation into the Brain's
 * highest-priority operating focus.
 *
 * This must remain at module scope so it can be used by
 * buildBusinessUnderstanding().
 */
function buildPrimaryFocus(
  situation: SituationAssessment,
): FocusArea | null {
  if (situation.dominantIssue) {
    return {
      id:
        "primary-risk-focus",

      title:
        situation.dominantIssue,

      priority:
        situation.severity ===
        "critical"
          ? 100
          : situation.severity ===
              "risk"
            ? 80
            : situation.severity ===
                "watch"
              ? 60
              : 40,

      reason:
        "Highest-impact issue identified during perception.",
    };
  }

  if (
    situation.dominantOpportunity
  ) {
    return {
      id:
        "primary-opportunity-focus",

      title:
        situation
          .dominantOpportunity,

      priority:
        situation.severity ===
        "healthy"
          ? 70
          : situation.severity ===
              "watch"
            ? 55
            : 40,

      reason:
        "Highest-value opportunity identified during perception.",
    };
  }

  return null;
}

export function buildSituationAssessment(
  restaurantStates: Array<{
    overallScore: number;

    primaryRisk:
      | string
      | null;

    primaryOpportunity:
      | string
      | null;
  }>,
): SituationAssessment {
  if (
    restaurantStates.length === 0
  ) {
    return {
      severity:
        "watch",

      dominantIssue:
        null,

      dominantOpportunity:
        null,

      confidence:
        0,

      summary:
        "The current business situation could not be assessed because no restaurant states were available.",

      generatedAt:
        new Date().toISOString(),
    };
  }

  const averageScore =
    restaurantStates.reduce(
      (
        sum,
        state,
      ) =>
        sum +
        state.overallScore,
      0,
    ) /
    restaurantStates.length;

  const severity: SituationSeverity =
    averageScore >= 85
      ? "healthy"
      : averageScore >= 70
        ? "watch"
        : averageScore >= 50
          ? "risk"
          : "critical";

  const dominantState =
    [...restaurantStates].sort(
      (
        left,
        right,
      ) =>
        left.overallScore -
        right.overallScore,
    )[0];

  return {
    severity,

    dominantIssue:
      dominantState
        ?.primaryRisk ??
      null,

    dominantOpportunity:
      dominantState
        ?.primaryOpportunity ??
      null,

    confidence:
      90,

    summary:
      `Current business status is ${severity} with an average health score of ${Math.round(
        averageScore,
      )}.`,

    generatedAt:
      new Date().toISOString(),
  };
}

export function buildBusinessUnderstanding(
  restaurantStates: Parameters<
    typeof buildSituationAssessment
  >[0],
): BusinessUnderstanding {
  const situation =
    buildSituationAssessment(
      restaurantStates,
    );

  return {
    situation,

    focus:
      buildPrimaryFocus(
        situation,
      ),

    generatedAt:
      new Date().toISOString(),
  };
}

export function buildSituationAssessmentFromWorldState(
  worldState: WorldState,
): SituationAssessment {
  return buildSituationAssessment(
    worldState.operations
      .restaurantStates as Array<{
      overallScore: number;

      primaryRisk:
        | string
        | null;

      primaryOpportunity:
        | string
        | null;
    }>,
  );
}