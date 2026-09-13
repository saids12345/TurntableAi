import type {
  OutcomeDelta,
  OutcomeEvaluation,
} from "@/lib/outcomeEngine";

import type {
    OutcomeVerificationVerdict,
  } from "@/lib/operatorMemoryTrust";

export type VerificationEvidenceQuality =
  | "insufficient"
  | "low"
  | "medium"
  | "high";

export type VerificationAttributionConfidence =
  | "insufficient"
  | "weak"
  | "moderate";

export type VerifiableOutcomeMetric =
  | "revenue"
  | "orders"
  | "avgTicket"
  | "labor"
  | "margin"
  | "refunds"
  | "rating"
  | "reviewIssues";

export type OutcomeSignalDirection =
  | "supporting"
  | "conflicting"
  | "neutral"
  | "unmeasured";

export type OutcomeSignalAssessment = {
  metric: VerifiableOutcomeMetric;
  direction: OutcomeSignalDirection;
  value: number | null;
  summary: string;
};

export type DecisionOutcomeVerification = {
  version: "v1";

  /**
   * True when the verifier was able to make a
   * directional judgment about the outcome.
   *
   * This does NOT automatically mean the memory
   * is trusted for future reasoning.
   */
  verified: boolean;

  verdict: OutcomeVerificationVerdict;

  /**
   * Only true when the result has enough measured
   * evidence and attribution support to influence
   * future Brain reasoning.
   */
  eligibleForReasoning: boolean;

  evidenceQuality:
    VerificationEvidenceQuality;

  attributionConfidence:
    VerificationAttributionConfidence;

  expectedOutcome: string | null;
  successMetric: string | null;

  failureConditions: string[];

  targetMetrics:
    VerifiableOutcomeMetric[];

  measuredTargetMetrics:
    VerifiableOutcomeMetric[];

  signals:
    OutcomeSignalAssessment[];

  supportingSignals: string[];
  conflictingSignals: string[];
  neutralSignals: string[];

  sideEffects: string[];

  measuredFields: number;

  outcomeScore: number;
  rawSuccess: boolean | null;

  explanation: string;

  verifiedAt: string;
};

export type VerifyDecisionOutcomeInput = {
  evaluation: OutcomeEvaluation;

  expectedOutcome?: string | null;

  successMetric?: string | null;

  failureConditions?: string[] | null;

  /**
   * Optional deterministic timestamp for tests.
   */
  now?: string;
};

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function normalizeText(
  value: string | null | undefined,
) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9%]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique<T>(
  values: T[],
): T[] {
  return Array.from(
    new Set(values),
  );
}

function getMeasuredFields(
  evaluation: OutcomeEvaluation,
) {
  const evidence =
    evaluation.evidence;

  if (!isRecord(evidence)) {
    return 0;
  }

  const value =
    evidence.measuredFields;

  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return Math.max(
      0,
      Math.round(value),
    );
  }

  return 0;
}

function inferEvidenceQuality(
  measuredFields: number,
): VerificationEvidenceQuality {
  if (measuredFields >= 5) {
    return "high";
  }

  if (measuredFields >= 3) {
    return "medium";
  }

  if (measuredFields >= 2) {
    return "low";
  }

  return "insufficient";
}

/**
 * Converts the Brain's written outcome contract
 * into the restaurant metrics we can actually
 * measure today.
 *
 * If the contract does not map to measurable
 * restaurant data, verification fails closed.
 */
function inferTargetMetrics(
  expectedOutcome: string | null,
  successMetric: string | null,
  failureConditions: string[],
): VerifiableOutcomeMetric[] {
  const text = normalizeText(
    [
      expectedOutcome,
      successMetric,
      ...failureConditions,
    ]
      .filter(
        (value): value is string =>
          typeof value === "string" &&
          value.trim().length > 0,
      )
      .join(" "),
  );

  const metrics:
    VerifiableOutcomeMetric[] = [];

  if (
    /\brevenue\b|\bsales\b|\bgrowth\b|\bincremental demand\b/.test(
      text,
    )
  ) {
    metrics.push("revenue");
  }

  if (
    /\border\b|\borders\b|\btraffic\b|\bdemand\b|\btransaction\b|\btransactions\b|\bvolume\b/.test(
      text,
    )
  ) {
    metrics.push("orders");
  }

  if (
    /\baverage ticket\b|\bavg ticket\b|\bticket size\b|\bupsell\b|\bbasket\b/.test(
      text,
    )
  ) {
    metrics.push("avgTicket");
  }

  if (
    /\blabor\b|\bstaff\b|\bstaffing\b|\bovertime\b|\bproductivity\b/.test(
      text,
    )
  ) {
    metrics.push("labor");
  }

  if (
    /\bmargin\b|\bprofit\b|\bprofitable\b|\bprofitability\b|\bcontribution\b/.test(
      text,
    )
  ) {
    metrics.push("margin");
  }

  if (
    /\brefund\b|\brefunds\b|\bchargeback\b|\bchargebacks\b|\bcomp\b|\bcomps\b/.test(
      text,
    )
  ) {
    metrics.push("refunds");
  }

  if (
    /\brating\b|\bratings\b|\breputation\b|\bsentiment\b|\bguest satisfaction\b|\bguest experience\b/.test(
      text,
    )
  ) {
    metrics.push("rating");
  }

  if (
    /\bcomplaint\b|\bcomplaints\b|\breview issue\b|\breview issues\b|\bservice failure\b|\bservice failures\b|\bguest issue\b|\bguest issues\b|\breputation\b|\bsentiment\b/.test(
      text,
    )
  ) {
    metrics.push(
      "reviewIssues",
    );
  }

  return unique(metrics);
}

function metricValue(
  metric: VerifiableOutcomeMetric,
  delta: OutcomeDelta,
): number | null {
  switch (metric) {
    case "revenue":
      return delta.revenueDeltaPct;

    case "orders":
      return delta.ordersDeltaPct;

    case "avgTicket":
      return delta.avgTicketDeltaPct;

    case "labor":
      return delta.laborDeltaPct;

    case "margin":
      return delta.marginDeltaPct;

    case "refunds":
      return delta.refundDeltaPct;

    case "rating":
      return delta.ratingDelta;

    case "reviewIssues":
      return delta.reviewIssueDelta;

    default:
      return null;
  }
}

function assessMetric(
  metric: VerifiableOutcomeMetric,
  delta: OutcomeDelta,
): OutcomeSignalAssessment {
  const value =
    metricValue(
      metric,
      delta,
    );

  if (value === null) {
    return {
      metric,
      direction: "unmeasured",
      value: null,
      summary:
        `${metric} was part of the expected outcome but was not measured.`,
    };
  }

  switch (metric) {
    case "revenue":
    case "orders":
    case "avgTicket": {
      if (value >= 1) {
        return {
          metric,
          direction: "supporting",
          value,
          summary:
            `${metric} improved ${value.toFixed(1)}%.`,
        };
      }

      if (value <= -1) {
        return {
          metric,
          direction: "conflicting",
          value,
          summary:
            `${metric} declined ${Math.abs(value).toFixed(1)}%.`,
        };
      }

      break;
    }

    case "margin": {
      if (value >= 0.5) {
        return {
          metric,
          direction: "supporting",
          value,
          summary:
            `Margin improved ${value.toFixed(2)} points.`,
        };
      }

      if (value <= -0.5) {
        return {
          metric,
          direction: "conflicting",
          value,
          summary:
            `Margin declined ${Math.abs(value).toFixed(2)} points.`,
        };
      }

      break;
    }

    case "labor": {
      if (value <= -0.5) {
        return {
          metric,
          direction: "supporting",
          value,
          summary:
            `Labor percentage improved by ${Math.abs(value).toFixed(2)} points.`,
        };
      }

      if (value >= 0.5) {
        return {
          metric,
          direction: "conflicting",
          value,
          summary:
            `Labor percentage worsened by ${value.toFixed(2)} points.`,
        };
      }

      break;
    }

    case "refunds": {
      if (value <= -5) {
        return {
          metric,
          direction: "supporting",
          value,
          summary:
            `Refunds declined ${Math.abs(value).toFixed(1)}%.`,
        };
      }

      if (value >= 5) {
        return {
          metric,
          direction: "conflicting",
          value,
          summary:
            `Refunds increased ${value.toFixed(1)}%.`,
        };
      }

      break;
    }

    case "rating": {
      if (value >= 0.05) {
        return {
          metric,
          direction: "supporting",
          value,
          summary:
            `Average rating improved ${value.toFixed(2)} points.`,
        };
      }

      if (value <= -0.05) {
        return {
          metric,
          direction: "conflicting",
          value,
          summary:
            `Average rating declined ${Math.abs(value).toFixed(2)} points.`,
        };
      }

      break;
    }

    case "reviewIssues": {
      if (value < 0) {
        return {
          metric,
          direction: "supporting",
          value,
          summary:
            `Negative review issues declined by ${Math.abs(value).toFixed(0)}.`,
        };
      }

      if (value > 0) {
        return {
          metric,
          direction: "conflicting",
          value,
          summary:
            `Negative review issues increased by ${value.toFixed(0)}.`,
        };
      }

      break;
    }
  }

  return {
    metric,
    direction: "neutral",
    value,
    summary:
      `${metric} did not change materially.`,
  };
}

/**
 * Detects meaningful downside outside the
 * action's intended target metrics.
 *
 * These thresholds are intentionally stronger
 * than the ordinary signal thresholds so normal
 * restaurant noise is not treated as a major
 * side effect.
 */
function detectMaterialSideEffects(
  delta: OutcomeDelta,
  targetMetrics:
    VerifiableOutcomeMetric[],
): string[] {
  const targets =
    new Set(targetMetrics);

  const sideEffects: string[] =
    [];

  if (
    !targets.has("revenue") &&
    delta.revenueDeltaPct !== null &&
    delta.revenueDeltaPct <= -5
  ) {
    sideEffects.push(
      `Revenue declined ${Math.abs(delta.revenueDeltaPct).toFixed(1)}%.`,
    );
  }

  if (
    !targets.has("orders") &&
    delta.ordersDeltaPct !== null &&
    delta.ordersDeltaPct <= -5
  ) {
    sideEffects.push(
      `Orders declined ${Math.abs(delta.ordersDeltaPct).toFixed(1)}%.`,
    );
  }

  if (
    !targets.has("avgTicket") &&
    delta.avgTicketDeltaPct !== null &&
    delta.avgTicketDeltaPct <= -5
  ) {
    sideEffects.push(
      `Average ticket declined ${Math.abs(delta.avgTicketDeltaPct).toFixed(1)}%.`,
    );
  }

  if (
    !targets.has("margin") &&
    delta.marginDeltaPct !== null &&
    delta.marginDeltaPct <= -1.5
  ) {
    sideEffects.push(
      `Margin declined ${Math.abs(delta.marginDeltaPct).toFixed(2)} points.`,
    );
  }

  if (
    !targets.has("labor") &&
    delta.laborDeltaPct !== null &&
    delta.laborDeltaPct >= 2
  ) {
    sideEffects.push(
      `Labor percentage worsened ${delta.laborDeltaPct.toFixed(2)} points.`,
    );
  }

  if (
    !targets.has("refunds") &&
    delta.refundDeltaPct !== null &&
    delta.refundDeltaPct >= 10
  ) {
    sideEffects.push(
      `Refunds increased ${delta.refundDeltaPct.toFixed(1)}%.`,
    );
  }

  if (
    !targets.has("rating") &&
    delta.ratingDelta !== null &&
    delta.ratingDelta <= -0.1
  ) {
    sideEffects.push(
      `Average rating declined ${Math.abs(delta.ratingDelta).toFixed(2)} points.`,
    );
  }

  if (
    !targets.has("reviewIssues") &&
    delta.reviewIssueDelta !== null &&
    delta.reviewIssueDelta >= 2
  ) {
    sideEffects.push(
      `Negative review issues increased by ${delta.reviewIssueDelta.toFixed(0)}.`,
    );
  }

  return sideEffects;
}

/**
 * V1 deliberately caps attribution at "moderate".
 *
 * Before TurnTableAI has control groups,
 * matched-location comparisons, stronger
 * counterfactual baselines, or causal experiment
 * evidence, we should NOT call correlation
 * definitive causation.
 */
function inferAttributionConfidence(params: {
  evidenceQuality:
    VerificationEvidenceQuality;
  measuredTargetCount: number;
  sourceActionId: string | null;
  executedAtPresent: boolean;
}): VerificationAttributionConfidence {
  const {
    evidenceQuality,
    measuredTargetCount,
    sourceActionId,
    executedAtPresent,
  } = params;

  if (
    evidenceQuality ===
      "insufficient" ||
    measuredTargetCount === 0
  ) {
    return "insufficient";
  }

  if (
    (evidenceQuality === "high" ||
      evidenceQuality === "medium") &&
    measuredTargetCount >= 1 &&
    Boolean(sourceActionId) &&
    executedAtPresent
  ) {
    return "moderate";
  }

  return "weak";
}

function buildExplanation(params: {
  verdict:
    OutcomeVerificationVerdict;
  supportingCount: number;
  conflictingCount: number;
  neutralCount: number;
  unmeasuredCount: number;
  sideEffectCount: number;
  evidenceQuality:
    VerificationEvidenceQuality;
  attributionConfidence:
    VerificationAttributionConfidence;
}) {
  const {
    verdict,
    supportingCount,
    conflictingCount,
    neutralCount,
    unmeasuredCount,
    sideEffectCount,
    evidenceQuality,
    attributionConfidence,
  } = params;

  return (
    `Outcome verification classified this decision as ${verdict}. ` +
    `${supportingCount} target signal(s) supported the expected result, ` +
    `${conflictingCount} conflicted, ` +
    `${neutralCount} were neutral, and ` +
    `${unmeasuredCount} were unavailable. ` +
    `${sideEffectCount} material side effect(s) were detected. ` +
    `Evidence quality is ${evidenceQuality}; ` +
    `attribution confidence is ${attributionConfidence}.`
  );
}

export function verifyDecisionOutcome(
  input: VerifyDecisionOutcomeInput,
): DecisionOutcomeVerification {
  const {
    evaluation,
    expectedOutcome = null,
    successMetric = null,
    failureConditions = [],
  } = input;

  const normalizedFailureConditions =
    Array.isArray(failureConditions)
      ? failureConditions.filter(
          (value): value is string =>
            typeof value === "string" &&
            value.trim().length > 0,
        )
      : [];

  const measuredFields =
    getMeasuredFields(
      evaluation,
    );

  const evidenceQuality =
    inferEvidenceQuality(
      measuredFields,
    );

  const targetMetrics =
    inferTargetMetrics(
      expectedOutcome,
      successMetric,
      normalizedFailureConditions,
    );

  const signals =
    targetMetrics.map(
      (metric) =>
        assessMetric(
          metric,
          evaluation.delta,
        ),
    );

  const measuredTargetMetrics =
    signals
      .filter(
        (signal) =>
          signal.direction !==
          "unmeasured",
      )
      .map(
        (signal) =>
          signal.metric,
      );

  const supportingSignals =
    signals
      .filter(
        (signal) =>
          signal.direction ===
          "supporting",
      )
      .map(
        (signal) =>
          signal.summary,
      );

  const conflictingSignals =
    signals
      .filter(
        (signal) =>
          signal.direction ===
          "conflicting",
      )
      .map(
        (signal) =>
          signal.summary,
      );

  const neutralSignals =
    signals
      .filter(
        (signal) =>
          signal.direction ===
          "neutral",
      )
      .map(
        (signal) =>
          signal.summary,
      );

  const unmeasuredCount =
    signals.filter(
      (signal) =>
        signal.direction ===
        "unmeasured",
    ).length;

  const sideEffects =
    detectMaterialSideEffects(
      evaluation.delta,
      targetMetrics,
    );

  const evidence =
    evaluation.evidence;

  const executedAtPresent =
    isRecord(evidence) &&
    typeof evidence.executedAt ===
      "string" &&
    evidence.executedAt.trim()
      .length > 0;

  const attributionConfidence =
    inferAttributionConfidence({
      evidenceQuality,
      measuredTargetCount:
        measuredTargetMetrics.length,
      sourceActionId:
        evaluation.sourceActionId,
      executedAtPresent,
    });

  let verdict:
    OutcomeVerificationVerdict =
      "inconclusive";

  /**
   * Fail closed when we do not have:
   *
   * - enough before/after evidence,
   * - a measurable original outcome contract,
   * - or any measured target metric.
   */
  if (
    evaluation.status ===
      "not_ready" ||
    evaluation.status ===
      "failed" ||
    measuredFields < 2 ||
    targetMetrics.length === 0 ||
    measuredTargetMetrics.length === 0
  ) {
    verdict =
      "inconclusive";
  } else if (
    conflictingSignals.length >
      supportingSignals.length &&
    conflictingSignals.length > 0
  ) {
    verdict =
      "failed";
  } else if (
    evaluation.success === false &&
    conflictingSignals.length > 0
  ) {
    verdict =
      "failed";
  } else if (
    supportingSignals.length > 0 &&
    conflictingSignals.length === 0 &&
    sideEffects.length === 0 &&
    evaluation.outcomeScore >= 60
  ) {
    verdict =
      "worked";
  } else if (
    supportingSignals.length > 0 &&
    (
      conflictingSignals.length > 0 ||
      sideEffects.length > 0 ||
      evaluation.outcomeScore < 60
    )
  ) {
    verdict =
      "partially_worked";
  } else if (
    evaluation.outcomeScore <= 40 &&
    conflictingSignals.length > 0
  ) {
    verdict =
      "failed";
  } else {
    verdict =
      "inconclusive";
  }

  const verified =
    verdict !==
    "inconclusive";

  /**
   * A directional verdict is not enough.
   *
   * Trusted Brain learning requires:
   *
   * 1. a real directional verification,
   * 2. medium/high measurement quality,
   * 3. moderate attribution support.
   *
   * This is intentionally conservative.
   */
  const eligibleForReasoning =
    verified &&
    (
      evidenceQuality ===
        "medium" ||
      evidenceQuality ===
        "high"
    ) &&
    attributionConfidence ===
      "moderate";

  const explanation =
    buildExplanation({
      verdict,
      supportingCount:
        supportingSignals.length,
      conflictingCount:
        conflictingSignals.length,
      neutralCount:
        neutralSignals.length,
      unmeasuredCount,
      sideEffectCount:
        sideEffects.length,
      evidenceQuality,
      attributionConfidence,
    });

  return {
    version: "v1",

    verified,
    verdict,

    eligibleForReasoning,

    evidenceQuality,
    attributionConfidence,

    expectedOutcome,
    successMetric,

    failureConditions:
      normalizedFailureConditions,

    targetMetrics,
    measuredTargetMetrics,

    signals,

    supportingSignals,
    conflictingSignals,
    neutralSignals,

    sideEffects,

    measuredFields,

    outcomeScore:
      evaluation.outcomeScore,

    rawSuccess:
      evaluation.success,

    explanation,

    verifiedAt:
      input.now ??
      new Date().toISOString(),
  };
}