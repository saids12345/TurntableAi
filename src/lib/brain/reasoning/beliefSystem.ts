import type {
  Evidence,
  Hypothesis,
  HypothesisCategory,
  HypothesisResult,
} from "./hypothesisEngine";

export type BeliefStatus =
  | "active"
  | "provisional"
  | "contested"
  | "rejected";

export interface Belief {
  /**
   * Existing compatibility fields.
   */
  id: string;

  statement: string;

  confidence: number;

  evidence: string[];

  updatedAt: string;

  /**
   * Rich cognitive state.
   */
  sourceHypothesisId?: string;

  category?: HypothesisCategory;

  description?: string;

  status?: BeliefStatus;

  supportingEvidence?: string[];

  contradictingEvidence?: string[];

  evidenceCoverage?: number;

  evidenceReliability?: number;

  contradictionRatio?: number;

  previousConfidence?: number;

  confidenceDelta?: number;

  revisionCount?: number;

  assumptions?: string[];

  unknowns?: string[];

  whatWouldChangeMyMind?: string[];

  reasoning?: string[];

  createdAt?: string;
}

export interface BeliefRevisionSummary {
  created: number;

  strengthened: number;

  weakened: number;

  unchanged: number;

  contested: number;

  rejected: number;
}

export interface BeliefSystem {
  beliefs: Belief[];

  primaryBelief?: Belief;

  alternativeBeliefs?: Belief[];

  contestedBeliefs?: Belief[];

  overallConfidence?: number;

  evidenceCoverage?: number;

  uncertainty?: number;

  revisionSummary?: BeliefRevisionSummary;

  generatedAt?: string;
}

interface ConfidenceAssessment {
  confidence: number;

  evidenceCoverage: number;

  evidenceReliability: number;

  contradictionRatio: number;
}

const MIN_CONFIDENCE = 0.05;

const MAX_CONFIDENCE = 0.97;

function clamp(
  value: number,
  minimum = 0,
  maximum = 1,
) {
  return Math.min(
    maximum,
    Math.max(
      minimum,
      value,
    ),
  );
}

function round(
  value: number,
  decimals = 4,
) {
  const multiplier =
    10 ** decimals;

  return (
    Math.round(
      value * multiplier,
    ) / multiplier
  );
}

function average(
  values: number[],
  fallback = 0,
) {
  if (values.length === 0) {
    return fallback;
  }

  return (
    values.reduce(
      (total, value) =>
        total + value,
      0,
    ) / values.length
  );
}

function uniqueStrings(
  values:
    | string[]
    | undefined,
) {
  return Array.from(
    new Set(
      values ?? [],
    ),
  );
}

function getEvidenceMap(
  result: HypothesisResult,
) {
  return new Map(
    result.evidence.map(
      (item) =>
        [
          item.id,
          item,
        ] as const,
    ),
  );
}

function getEvidenceItems(
  ids: string[],
  evidenceById: Map<
    string,
    Evidence
  >,
) {
  return ids
    .map(
      (id) =>
        evidenceById.get(id),
    )
    .filter(
      (
        item,
      ): item is Evidence =>
        Boolean(item),
    );
}

function getEvidenceWeight(
  evidence: Evidence[],
) {
  return evidence.reduce(
    (total, item) =>
      total +
      clamp(
        item.confidence,
      ),
    0,
  );
}

function calculateConfidence(
  hypothesis: Hypothesis,
  evidenceById: Map<
    string,
    Evidence
  >,
): ConfidenceAssessment {
  const supportingIds =
    uniqueStrings(
      hypothesis.supportingEvidence,
    );

  const contradictingIds =
    uniqueStrings(
      hypothesis
        .contradictingEvidence,
    );

  const supportingEvidence =
    getEvidenceItems(
      supportingIds,
      evidenceById,
    );

  const contradictingEvidence =
    getEvidenceItems(
      contradictingIds,
      evidenceById,
    );

  const supportWeight =
    getEvidenceWeight(
      supportingEvidence,
    );

  const contradictionWeight =
    getEvidenceWeight(
      contradictingEvidence,
    );

  const totalWeight =
    supportWeight +
    contradictionWeight;

  const evidenceReliability =
    average(
      supportingEvidence.map(
        (item) =>
          clamp(
            item.confidence,
          ),
      ),
      clamp(
        hypothesis.confidence *
          0.8,
      ),
    );

  const contradictionRatio =
    totalWeight > 0
      ? contradictionWeight /
        totalWeight
      : 0;

  const evidenceBalance =
    totalWeight > 0
      ? supportWeight /
        totalWeight
      : 0.5;

  const evidenceCoverage =
    clamp(
      hypothesis
        .evidenceCoverage ??
        (
          supportingIds.length +
          contradictingIds.length
        ) /
          6,
    );

  const unknownCount =
    hypothesis.unknowns
      ?.length ?? 0;

  const assumptionCount =
    hypothesis.assumptions
      ?.length ?? 0;

  const unknownPenalty =
    clamp(
      unknownCount * 0.018,
      0,
      0.12,
    );

  const assumptionPenalty =
    clamp(
      assumptionCount * 0.008,
      0,
      0.05,
    );

  const contradictionPenalty =
    contradictionRatio *
    0.2;

  const confidence =
    clamp(
      hypothesis.confidence *
        0.5 +
        evidenceReliability *
          0.2 +
        evidenceCoverage *
          0.15 +
        evidenceBalance *
          0.15 -
        contradictionPenalty -
        unknownPenalty -
        assumptionPenalty,
      MIN_CONFIDENCE,
      MAX_CONFIDENCE,
    );

  return {
    confidence:
      round(confidence),

    evidenceCoverage:
      round(evidenceCoverage),

    evidenceReliability:
      round(evidenceReliability),

    contradictionRatio:
      round(contradictionRatio),
  };
}

function findPreviousBelief(
  hypothesis: Hypothesis,
  previousSystem:
    | BeliefSystem
    | undefined,
) {
  if (!previousSystem) {
    return undefined;
  }

  return previousSystem
    .beliefs
    .find(
      (belief) =>
        belief.sourceHypothesisId ===
          hypothesis.id ||
        belief.id ===
          `belief-${hypothesis.id}` ||
        (
          Boolean(
            belief.category,
          ) &&
          belief.category ===
            hypothesis.category
        ),
    );
}

function reviseConfidence(
  currentConfidence: number,
  assessment: ConfidenceAssessment,
  previousBelief:
    | Belief
    | undefined,
) {
  if (!previousBelief) {
    return currentConfidence;
  }

  const priorConfidence =
    clamp(
      previousBelief.confidence,
    );

  /**
   * Stronger evidence coverage gives the current cycle
   * more influence over the revised belief.
   */
  const newEvidenceWeight =
    clamp(
      0.55 +
        assessment
          .evidenceCoverage *
          0.25 +
        assessment
          .contradictionRatio *
          0.1,
      0.55,
      0.9,
    );

  const priorWeight =
    1 -
    newEvidenceWeight;

  return round(
    clamp(
      currentConfidence *
        newEvidenceWeight +
        priorConfidence *
          priorWeight,
      MIN_CONFIDENCE,
      MAX_CONFIDENCE,
    ),
  );
}

function determineStatus(
  confidence: number,
  contradictionRatio: number,
): BeliefStatus {
  if (
    confidence < 0.3
  ) {
    return "rejected";
  }

  if (
    contradictionRatio >= 0.38
  ) {
    return "contested";
  }

  if (
    confidence >= 0.67
  ) {
    return "active";
  }

  return "provisional";
}

function buildBelief(
  hypothesis: Hypothesis,
  result: HypothesisResult,
  previousSystem:
    | BeliefSystem
    | undefined,
  now: string,
): Belief {
  const evidenceById =
    getEvidenceMap(
      result,
    );

  const assessment =
    calculateConfidence(
      hypothesis,
      evidenceById,
    );

  const previousBelief =
    findPreviousBelief(
      hypothesis,
      previousSystem,
    );

  const revisedConfidence =
    reviseConfidence(
      assessment.confidence,
      assessment,
      previousBelief,
    );

  const previousConfidence =
    previousBelief
      ? clamp(
          previousBelief.confidence,
        )
      : undefined;

  const confidenceDelta =
    previousConfidence !==
    undefined
      ? round(
          revisedConfidence -
            previousConfidence,
        )
      : undefined;

  const supportingEvidence =
    uniqueStrings(
      hypothesis
        .supportingEvidence,
    );

  const contradictingEvidence =
    uniqueStrings(
      hypothesis
        .contradictingEvidence,
    );

  return {
    id:
      `belief-${hypothesis.id}`,

    sourceHypothesisId:
      hypothesis.id,

    category:
      hypothesis.category,

    statement:
      hypothesis.title,

    description:
      hypothesis.description,

    confidence:
      revisedConfidence,

    evidence:
      supportingEvidence,

    supportingEvidence,

    contradictingEvidence,

    evidenceCoverage:
      assessment
        .evidenceCoverage,

    evidenceReliability:
      assessment
        .evidenceReliability,

    contradictionRatio:
      assessment
        .contradictionRatio,

    status:
      determineStatus(
        revisedConfidence,
        assessment
          .contradictionRatio,
      ),

    previousConfidence,

    confidenceDelta,

    revisionCount:
      (
        previousBelief
          ?.revisionCount ??
        0
      ) + 1,

    assumptions:
      uniqueStrings(
        hypothesis.assumptions,
      ),

    unknowns:
      uniqueStrings([
        ...(
          hypothesis.unknowns ??
          []
        ),
        ...(
          result.unknowns ??
          []
        ),
      ]),

    whatWouldChangeMyMind:
      uniqueStrings(
        hypothesis
          .whatWouldChangeMyMind,
      ),

    reasoning:
      uniqueStrings(
        hypothesis.reasoning,
      ),

    createdAt:
      previousBelief
        ?.createdAt ??
      now,

    updatedAt:
      now,
  };
}

function beliefRankingScore(
  belief: Belief,
) {
  const coverage =
    belief.evidenceCoverage ??
    0;

  const contradictionRatio =
    belief
      .contradictionRatio ??
    0;

  const statusPenalty =
    belief.status ===
    "rejected"
      ? 0.25
      : belief.status ===
          "contested"
        ? 0.08
        : 0;

  return (
    belief.confidence *
      (
        0.72 +
        coverage * 0.28
      ) -
    contradictionRatio *
      0.12 -
    statusPenalty
  );
}

function markCompetingBeliefs(
  beliefs: Belief[],
) {
  if (
    beliefs.length < 2
  ) {
    return;
  }

  const first =
    beliefs[0];

  const second =
    beliefs[1];

  const confidenceGap =
    Math.abs(
      first.confidence -
        second.confidence,
    );

  /**
   * When the two strongest explanations are too close,
   * the Brain should explicitly preserve uncertainty
   * instead of pretending one explanation is settled.
   */
  if (
    confidenceGap <= 0.08
  ) {
    if (
      first.status !==
      "rejected"
    ) {
      first.status =
        "contested";
    }

    if (
      second.status !==
      "rejected"
    ) {
      second.status =
        "contested";
    }
  }
}

function buildRevisionSummary(
  beliefs: Belief[],
): BeliefRevisionSummary {
  let created = 0;

  let strengthened = 0;

  let weakened = 0;

  let unchanged = 0;

  for (
    const belief of beliefs
  ) {
    if (
      belief.previousConfidence ===
      undefined
    ) {
      created += 1;
      continue;
    }

    const delta =
      belief.confidenceDelta ??
      0;

    if (delta >= 0.02) {
      strengthened += 1;
    } else if (
      delta <= -0.02
    ) {
      weakened += 1;
    } else {
      unchanged += 1;
    }
  }

  return {
    created,

    strengthened,

    weakened,

    unchanged,

    contested:
      beliefs.filter(
        (belief) =>
          belief.status ===
          "contested",
      ).length,

    rejected:
      beliefs.filter(
        (belief) =>
          belief.status ===
          "rejected",
      ).length,
  };
}

function calculateSystemCoverage(
  beliefs: Belief[],
) {
  return round(
    average(
      beliefs.map(
        (belief) =>
          belief
            .evidenceCoverage ??
          0,
      ),
      0,
    ),
  );
}

function calculateSystemConfidence(
  primaryBelief:
    | Belief
    | undefined,
  beliefs: Belief[],
) {
  if (!primaryBelief) {
    return 0;
  }

  const topBeliefs =
    beliefs.slice(
      0,
      3,
    );

  const averageConfidence =
    average(
      topBeliefs.map(
        (belief) =>
          belief.confidence,
      ),
      primaryBelief
        .confidence,
    );

  return round(
    clamp(
      primaryBelief.confidence *
        0.7 +
        averageConfidence *
          0.3,
    ),
  );
}

function calculateUncertainty(
  primaryBelief:
    | Belief
    | undefined,
  beliefs: Belief[],
  evidenceCoverage: number,
) {
  if (!primaryBelief) {
    return 1;
  }

  const secondBelief =
    beliefs[1];

  const competitionPenalty =
    secondBelief
      ? clamp(
          1 -
            Math.abs(
              primaryBelief
                .confidence -
                secondBelief
                  .confidence,
            ),
        ) * 0.18
      : 0;

  const contradictionPenalty =
    (
      primaryBelief
        .contradictionRatio ??
      0
    ) * 0.3;

  const coveragePenalty =
    (
      1 -
      evidenceCoverage
    ) * 0.3;

  const confidencePenalty =
    (
      1 -
      primaryBelief
        .confidence
    ) * 0.4;

  return round(
    clamp(
      confidencePenalty +
        coveragePenalty +
        contradictionPenalty +
        competitionPenalty,
    ),
  );
}

/**
 * Creates or revises the Brain's current belief system.
 *
 * Calling this function without arguments remains supported
 * for compatibility with the existing reasoning pipeline.
 *
 * Passing a HypothesisResult forms calibrated beliefs.
 * Passing a previous BeliefSystem also enables belief revision.
 */
export function createBeliefSystem(
  hypothesisResult?:
    | HypothesisResult,
  previousSystem?:
    | BeliefSystem,
): BeliefSystem {
  const now =
    new Date().toISOString();

  if (
    !hypothesisResult ||
    hypothesisResult
      .hypotheses.length === 0
  ) {
    return {
      beliefs: [],

      alternativeBeliefs:
        [],

      contestedBeliefs:
        [],

      overallConfidence:
        0,

      evidenceCoverage:
        0,

      uncertainty:
        1,

      revisionSummary: {
        created:
          0,

        strengthened:
          0,

        weakened:
          0,

        unchanged:
          0,

        contested:
          0,

        rejected:
          0,
      },

      generatedAt:
        now,
    };
  }

  const beliefs =
    hypothesisResult
      .hypotheses
      .map(
        (hypothesis) =>
          buildBelief(
            hypothesis,
            hypothesisResult,
            previousSystem,
            now,
          ),
      )
      .sort(
        (left, right) =>
          beliefRankingScore(
            right,
          ) -
          beliefRankingScore(
            left,
          ),
      );

  markCompetingBeliefs(
    beliefs,
  );

  const primaryBelief =
    beliefs.find(
      (belief) =>
        belief.status !==
        "rejected",
    ) ??
    beliefs[0];

  const alternativeBeliefs =
    beliefs.filter(
      (belief) =>
        belief.id !==
        primaryBelief?.id,
    );

  const contestedBeliefs =
    beliefs.filter(
      (belief) =>
        belief.status ===
        "contested",
    );

  const evidenceCoverage =
    calculateSystemCoverage(
      beliefs,
    );

  const overallConfidence =
    calculateSystemConfidence(
      primaryBelief,
      beliefs,
    );

  return {
    beliefs,

    primaryBelief,

    alternativeBeliefs,

    contestedBeliefs,

    overallConfidence,

    evidenceCoverage,

    uncertainty:
      calculateUncertainty(
        primaryBelief,
        beliefs,
        evidenceCoverage,
      ),

    revisionSummary:
      buildRevisionSummary(
        beliefs,
      ),

    generatedAt:
      now,
  };
}