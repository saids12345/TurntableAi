export type OutcomeVerificationVerdict =
  | "worked"
  | "partially_worked"
  | "failed"
  | "inconclusive";

export type MemoryTrustState =
  | "verified_supporting"
  | "verified_mixed"
  | "verified_cautionary"
  | "inconclusive"
  | "provisional";

export type MemoryOutcomeSignal =
  | "supporting"
  | "cautionary"
  | "mixed"
  | "unknown";

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function memoryBoolean(
  memory: Record<string, unknown>,
  key: string,
): boolean | null {
  const value =
    memory[key];

  return typeof value === "boolean"
    ? value
    : null;
}

export function getOutcomeVerification(
  memory: unknown,
): Record<string, unknown> | null {
  if (!isRecord(memory)) {
    return null;
  }

  const evidence =
    memory.evidence;

  if (!isRecord(evidence)) {
    return null;
  }

  const verification =
    evidence.outcomeVerification;

  return isRecord(verification)
    ? verification
    : null;
}

export function getMemoryTrustState(
  memory: unknown,
): MemoryTrustState {
  const verification =
    getOutcomeVerification(memory);

  if (
    !verification ||
    verification.verified !== true
  ) {
    return "provisional";
  }

  const verdict =
    typeof verification.verdict ===
    "string"
      ? verification.verdict
      : null;

  if (
    verdict === "inconclusive" ||
    verification
      .eligibleForReasoning !== true
  ) {
    return "inconclusive";
  }

  if (verdict === "worked") {
    return "verified_supporting";
  }

  if (
    verdict ===
    "partially_worked"
  ) {
    return "verified_mixed";
  }

  if (verdict === "failed") {
    return "verified_cautionary";
  }

  return "inconclusive";
}

export function isMemoryTrustedForReasoning(
  memory: unknown,
): boolean {
  const trustState =
    getMemoryTrustState(memory);

  return (
    trustState ===
      "verified_supporting" ||
    trustState ===
      "verified_mixed" ||
    trustState ===
      "verified_cautionary"
  );
}

export function inferMemoryOutcomeSignal(
  memory: unknown,
): MemoryOutcomeSignal {
  const trustState =
    getMemoryTrustState(memory);

  if (
    trustState ===
    "verified_supporting"
  ) {
    return "supporting";
  }

  if (
    trustState ===
    "verified_cautionary"
  ) {
    return "cautionary";
  }

  if (
    trustState ===
    "verified_mixed"
  ) {
    return "mixed";
  }

  return "unknown";
}

export function isMemoryEligibleAsReusablePlaybook(
  memory: unknown,
): boolean {
  if (!isRecord(memory)) {
    return false;
  }

  return (
    getMemoryTrustState(memory) ===
      "verified_supporting" &&
    memoryBoolean(
      memory,
      "reuse_recommended",
    ) === true
  );
}

export function getVerifiedMemoryOutcomeScore(
  memory: unknown,
): number | null {
  if (
    !isMemoryTrustedForReasoning(
      memory,
    )
  ) {
    return null;
  }

  const verification =
    getOutcomeVerification(memory);

  if (!verification) {
    return null;
  }

  const score =
    verification.outcomeScore;

  return (
    typeof score === "number" &&
    Number.isFinite(score)
  )
    ? score
    : null;
}

export function getMemoryVerificationConfidenceScore(
  memory: unknown,
): number {
  if (
    !isMemoryTrustedForReasoning(
      memory,
    )
  ) {
    return 0;
  }

  const verification =
    getOutcomeVerification(memory);

  if (!verification) {
    return 0;
  }

  const evidenceQuality =
    verification.evidenceQuality;

  const attributionConfidence =
    verification
      .attributionConfidence;

  const evidenceScore =
    evidenceQuality === "high"
      ? 100
      : evidenceQuality === "medium"
        ? 80
        : evidenceQuality === "low"
          ? 50
          : 0;

  const attributionScore =
    attributionConfidence ===
    "moderate"
      ? 90
      : attributionConfidence ===
          "weak"
        ? 55
        : 0;

  return Math.round(
    (
      evidenceScore +
      attributionScore
    ) / 2,
  );
}

export function buildProvisionalMemoryEvidence(
  evidence: unknown,
  explanation:
    string =
      "Memory is provisional until Decision Outcome Verification verifies the real-world result.",
): Record<string, unknown> {
  const safeEvidence =
    isRecord(evidence)
      ? {
          ...evidence,
        }
      : {};

  delete safeEvidence
    .outcomeVerification;

  return {
    ...safeEvidence,

    outcomeVerification: {
      version: "v1",

      verified: false,

      verdict:
        "inconclusive",

      eligibleForReasoning:
        false,

      evidenceQuality:
        "insufficient",

      attributionConfidence:
        "insufficient",

      trustState:
        "provisional",

      explanation,
    },
  };
}