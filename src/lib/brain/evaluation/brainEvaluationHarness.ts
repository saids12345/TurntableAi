import {
    runAIKernel,
    type AIKernelInput,
    type AIKernelResult,
  } from "@/lib/aiKernel";

  import {
  FUTURE_COMPARATOR_SCORE_WEIGHTS,
} from "@/lib/brain/reasoning/futureComparator";
  
  /**
   * TurnTableAI Brain Evaluation Harness
   * ====================================
   *
   * Purpose:
   * Measure whether a Cognitive Brain capability materially changes
   * reasoning or decision-making under a controlled counterfactual.
   *
   * Version 1 evaluates Operator Memory:
   *
   *   A: same restaurant context + Operator Memory enabled
   *   B: same restaurant context + Operator Memory excluded
   *
   * The harness does NOT write memories, execute actions, or mutate
   * restaurant state. It runs the AI Kernel as a reasoning diagnostic.
   *
   * Future extensions can add:
   * - exact-memory ablation
   * - causal reasoning ablation
   * - prediction ablation
   * - world-model ablation
   * - benchmark scenarios
   * - calibration
   * - decision regret
   * - outcome accuracy
   * - regression detection
   */
  
  type UnknownRecord =
    Record<string, unknown>;
  
  export type BrainEvaluationInput =
  Omit<
    AIKernelInput,
    "memoryMode"
  > & {
    /**
     * Development/evaluation-only fault injection.
     *
     * Used to prove Decision Provenance fails closed
     * when mathematical integrity cannot be verified.
     *
     * This must never alter the underlying Brain runs.
     */
    forceProvenanceFailure?:
      boolean;
  };
  
  export type BrainEvaluationVerdict =
  | "invalid_comparison"
  | "winner_changed"
  | "reasoning_changed"
  | "no_material_change";

/**
 * Normalized view of one strategy after the
 * Cognitive Brain has evaluated it.
 *
 * These fields intentionally mirror the important
 * parts of EvaluatedStrategy without coupling the
 * evaluation report to the complete runtime object.
 */
export type BrainStrategyEvaluationSnapshot = {
  id:
    string;

  title:
    string | null;

  kind:
    string | null;

  decisionMode:
    string | null;

  rank:
    number | null;

  score:
    number;

  status:
    string | null;

  relatedBeliefId:
    string | null;

  relatedHypothesisId:
    string | null;

  breakdown: {
    basePriority:
      number | null;

    objectiveAlignment:
      number | null;

    missionAlignment:
      number | null;

    principleAlignment:
      number | null;

    beliefSupport:
      number | null;

    decisionModeFit:
      number | null;

    expectedImpact:
      number | null;

    reversibility:
      number | null;

    urgency:
      number | null;

    evidenceReadiness:
      number | null;

    riskPenalty:
      number | null;

    uncertaintyPenalty:
      number | null;

    blockingPenalty:
      number | null;

    prematureActionPenalty:
      number | null;

    assumptionPenalty:
      number | null;

    total:
      number | null;
  };

  strengths:
    string[];

  concerns:
    string[];

  reasoning:
    string[];
};

/**
 * Normalized view of one strategy's simulated future.
 *
 * This lets the Evaluation Harness distinguish:
 *
 * strategy evaluation
 * from
 * future projection
 * from
 * final future comparison.
 */
export type BrainFutureEvaluationSnapshot = {
  strategyId:
    string;

  strategyTitle:
    string | null;

  strategyKind:
    string | null;

  decisionMode:
    string | null;

  rank:
    number | null;

  score:
    number | null;

  status:
    string | null;

  confidence:
    number;

  expectedRevenueImpact:
    number;

  expectedGuestExperienceImpact:
    number;

  expectedOperationalImpact:
    number;

  expectedRisk:
    number;

  evidenceCoverage:
    number | null;

  uncertainty:
    number | null;

  decisionModeFit:
    number | null;

  comparisonBreakdown: {
    expectedValue:
      number | null;

    confidenceAdjustedImpact:
      number | null;

    downsideProtection:
      number | null;

    robustness:
      number | null;

    impactBalance:
      number | null;

    evidenceQuality:
      number | null;

    decisionModeFit:
      number | null;

    riskPenalty:
      number | null;

    scenarioPenalty:
      number | null;

    unknownPenalty:
      number | null;

    assumptionPenalty:
      number | null;

    total:
      number | null;
  };

  assumptions:
    string[];

  unknowns:
    string[];

  strengths:
    string[];

  tradeoffs:
    string[];
};

/**
 * Same-strategy counterfactual attribution.
 *
 * IMPORTANT:
 *
 * scoreDelta:
 *   MEMORY ON - MEMORY OFF
 *
 * rankDelta:
 *   MEMORY OFF rank - MEMORY ON rank
 *
 * Therefore a positive rankDelta means historical
 * memory improved that strategy's position.
 *
 * Example:
 *
 * Memory OFF rank = 3
 * Memory ON  rank = 1
 *
 * rankDelta = +2
 */
export type BrainStrategyAttribution = {
  strategyId:
    string;

  title:
    string | null;

  memoryOn:
    BrainStrategyEvaluationSnapshot | null;

  memoryOff:
    BrainStrategyEvaluationSnapshot | null;

  presentInBothRuns:
    boolean;

  scoreDelta:
    number | null;

  rankDelta:
    number | null;

  beliefSupportDelta:
    number | null;

  evidenceReadinessDelta:
    number | null;

  expectedImpactDelta:
    number | null;

  uncertaintyPenaltyDelta:
    number | null;

  riskPenaltyDelta:
    number | null;
};

/**
 * One production-scoring factor that materially
 * contributed to a future score movement.
 */
export type BrainFutureScoreDriverKey =
  | "confidenceAdjustedImpact"
  | "confidence"
  | "evidenceQuality"
  | "decisionModeFit"
  | "robustness"
  | "impactBalance"
  | "downsideProtection"
  | "riskPenalty"
  | "scenarioPenalty"
  | "unknownPenalty"
  | "assumptionPenalty";

export type BrainFutureScoreDriver = {
  /**
   * Stable machine-readable identifier.
   */
  key:
    BrainFutureScoreDriverKey;

  /**
   * Human-readable name for provenance/UI use.
   */
  label:
    string;

  /**
   * Actual signed number of Comparator points
   * this factor contributed to the score movement.
   */
  contribution:
    number;

  /**
   * Signed percentage of the observed score
   * movement explained by this factor.
   */
  percent:
    number;
};

/**
 * Same-strategy future counterfactual attribution.
 *
 * This measures whether memory changed the future
 * TurnTableAI projected for the same action.
 */
export type BrainFutureAttribution = {
  strategyId:
    string;

  title:
    string | null;

  memoryOn:
    BrainFutureEvaluationSnapshot | null;

  memoryOff:
    BrainFutureEvaluationSnapshot | null;

  presentInBothRuns:
    boolean;

  futureScoreDelta:
    number | null;

  futureRankDelta:
    number | null;

  confidenceDelta:
    number | null;

  revenueImpactDelta:
    number | null;

  guestExperienceImpactDelta:
    number | null;

  operationalImpactDelta:
    number | null;

  riskDelta:
    number | null;

  evidenceCoverageDelta:
    number | null;

  uncertaintyDelta:
    number | null;

    /**
 * Attribution for the risk-adjusted
 * Future Comparator itself.
 *
 * Every delta uses:
 *
 * MEMORY ON - MEMORY OFF
 */
comparisonBreakdownDelta: {
  expectedValue:
    number | null;

  confidenceAdjustedImpact:
    number | null;

  downsideProtection:
    number | null;

  robustness:
    number | null;

  impactBalance:
    number | null;

  evidenceQuality:
    number | null;

  decisionModeFit:
    number | null;

  riskPenalty:
    number | null;

  scenarioPenalty:
    number | null;

  unknownPenalty:
    number | null;

  assumptionPenalty:
    number | null;

  total:
  number | null;
};

/**
 * Actual signed contribution each Comparator term
 * made to the Memory ON - Memory OFF score movement.
 *
 * These values use the SAME production weights as
 * the live Future Comparator.
 *
 * Positive = helped the future score.
 * Negative = hurt the future score.
 *
 * expectedValue is intentionally not included here
 * because it already flows through
 * confidenceAdjustedImpact and must not be double-counted.
 */
scoreContributionDelta: {
  confidenceAdjustedImpact:
    number | null;

  confidence:
    number | null;

  evidenceQuality:
    number | null;

  decisionModeFit:
    number | null;

  robustness:
    number | null;

  impactBalance:
    number | null;

  downsideProtection:
    number | null;

  riskPenalty:
    number | null;

  scenarioPenalty:
    number | null;

  unknownPenalty:
    number | null;

  assumptionPenalty:
    number | null;

  /**
   * Sum of all weighted contribution deltas.
   */
  explainedTotal:
    number | null;

  /**
   * Actual Comparator total movement.
   */
  observedTotalDelta:
    number | null;

  /**
   * observedTotalDelta - explainedTotal
   *
   * Should normally be extremely close to zero.
   * A meaningful residual would flag attribution drift.
   */
  residual:
    number | null;

    /**
 * Maximum acceptable absolute residual before
 * attribution is considered out of sync with
 * the production Future Comparator.
 */
integrityTolerance:
  number;

/**
 * True when the weighted explanation reconciles
 * with the observed production score movement.
 *
 * Null means the comparison could not be evaluated,
 * usually because the future did not exist in both runs.
 */
integrityPassed:
  boolean | null;
  /**
 * Signed percentage of the observed Comparator
 * score movement explained by each term.
 *
 * Formula:
 *
 * contribution / observedTotalDelta * 100
 *
 * Positive = moved the score in the same direction
 * as the observed total movement.
 *
 * Negative = pushed against the observed movement.
 *
 * Null means percentage attribution is not meaningful,
 * such as when there is no comparable future or the
 * observed score movement is effectively zero.
 *
 * expectedValue is intentionally excluded because it
 * already flows through confidenceAdjustedImpact.
 */
scoreContributionPercent: {
  confidenceAdjustedImpact:
    number | null;

  confidence:
    number | null;

  evidenceQuality:
    number | null;

  decisionModeFit:
    number | null;

  robustness:
    number | null;

  impactBalance:
    number | null;

  downsideProtection:
    number | null;

  riskPenalty:
    number | null;

  scenarioPenalty:
    number | null;

  unknownPenalty:
    number | null;

  assumptionPenalty:
    number | null;
};
};
/**
 * Human-usable summary of the strongest mathematical
 * drivers behind the future score movement.
 *
 * primaryDriver:
 * strongest factor moving with the observed score change.
 *
 * secondaryDriver:
 * second-strongest factor moving with the observed change.
 *
 * countervailingDriver:
 * strongest factor pushing against the observed change.
 */
dominantDriverSummary: {
  primaryDriver:
    BrainFutureScoreDriver | null;

  secondaryDriver:
    BrainFutureScoreDriver | null;

  countervailingDriver:
    BrainFutureScoreDriver | null;
};

/**
 * Deterministic Decision Provenance explanation.
 *
 * This converts the verified mathematical attribution
 * into language suitable for the Brain UI and audit trail.
 *
 * It must describe what the scoring math actually showed.
 * It must not invent causes that are absent from attribution.
 */
decisionProvenance: {
  /**
   * Overall direction memory moved this projected future.
   */
  direction:
  | "strengthened"
  | "weakened"
  | "unchanged"
  | "not_comparable"
  | "unverified";

  /**
   * Short human-readable explanation of the
   * dominant mathematical reason for the movement.
   */
  summary:
    string | null;

  /**
   * Explanation of the strongest supporting driver.
   */
  primaryReason:
    string | null;

  /**
   * Explanation of the second-strongest supporting driver.
   */
  secondaryReason:
    string | null;

  /**
   * Strongest factor that pushed against the
   * overall score movement.
   */
  countervailingReason:
    string | null;

  /**
   * Whether the underlying attribution reconciled
   * with the production Comparator mathematics.
   */
  integrityPassed:
    boolean | null;
};
};



export type BrainDecisionSnapshot = {
    mode:
      AIKernelResult["mode"];
  
    locationName:
      string | null;
  
    locationsAnalyzed:
      number;
  
    memory: {
      loaded:
        boolean;
  
      retrievedCount:
        number;
  
      retrievedMemoryKeys:
        string[];
  
      topMemory: {
        key:
          string | null;
  
        id:
          string | null;
  
        sourceActionId:
          string | null;
  
        title:
          string | null;
      } | null;
  
      operatorMemoryEvidenceCount:
        number;
    };
  
    hypothesis: {
      id:
        string | null;
  
      title:
        string | null;
  
      confidence:
        number | null;
  
      score:
        number | null;
  
      evidenceCoverage:
        number | null;
    };
  
    belief: {
      id:
        string | null;
  
      statement:
        string | null;
  
      category:
        string | null;
  
      confidence:
        number | null;
  
      evidenceCoverage:
        number | null;
    };
  
    decision: {
      confidence:
        number | null;
  
      readinessScore:
        number | null;
  
      decisionMode:
        string | null;
  
      recommendation:
        string | null;
  
      evidenceCoverage:
        number | null;
  
      uncertainty:
        number | null;
    };
  
    cognition: {
      uncertainty:
        number | null;
  
      overallConfidence:
        number | null;
    };
  
      strategy: {
    id:
      string | null;

    title:
      string | null;

    score:
      number | null;

    beliefSupport:
      number | null;

    relatedBeliefId:
      string | null;

    relatedHypothesisId:
      string | null;
  };

  /**
   * Complete strategy evaluator leaderboard.
   *
   * Unlike `strategy`, which represents only the
   * final selected strategy, this preserves every
   * strategy evaluated by the Cognitive Brain.
   *
   * This allows Memory ON and Memory OFF runs to be
   * aligned by strategy ID for true counterfactual
   * score and rank attribution.
   */
  strategyLeaderboard:
  BrainStrategyEvaluationSnapshot[];

/**
 * Complete risk-adjusted future leaderboard.
 *
 * Each entry combines:
 *
 * SimulatedFuture
 * +
 * RankedFuture
 *
 * so the Evaluation Harness can distinguish raw
 * strategy scoring from downstream future selection.
 */
futureLeaderboard:
  BrainFutureEvaluationSnapshot[];
};
  
  export type BrainCounterfactualComparison = {
    /**
     * These must remain true for the A/B result to be considered
     * a trustworthy counterfactual comparison.
     */
    validity: {
      sameMode:
        boolean;
  
      sameLocation:
        boolean;
  
      sameLocationsAnalyzed:
        boolean;
  
      retrievalHeldConstant:
        boolean;
  
      evidenceIsolationWorked:
        boolean;
  
      valid:
        boolean;
    };
  
    changes: {
  hypothesisChanged:
    boolean;

  beliefChanged:
    boolean;

  decisionModeChanged:
    boolean;

  strategyWinnerChanged:
    boolean;

  /**
   * True when the two counterfactual runs
   * generated different candidate strategy sets.
   *
   * Example:
   *
   * Memory OFF generates:
   * "Resolve the Highest-Impact Unknown"
   *
   * while Memory ON does not.
   */
  strategySetChanged:
  boolean;

/**
 * True when memory changed at least one
 * same-strategy score, rank, or score component.
 */
strategyAttributionChanged:
  boolean;

/**
 * True when the two counterfactual runs
 * produced different simulated-future sets.
 *
 * This can happen when memory changes which
 * strategies are generated upstream.
 */
futureSetChanged:
  boolean;

/**
 * True when memory changed at least one
 * same-strategy projected future or its
 * risk-adjusted Future Comparator result.
 */
futureAttributionChanged:
  boolean;

operatorMemoryEvidenceChanged:
  boolean;
};
  
    /**
     * All numeric deltas use:
     *
     *   MEMORY ON - MEMORY OFF
     *
     * Therefore:
     *
     * positive confidence delta
     * = memory increased confidence
     *
     * negative uncertainty delta
     * = memory reduced uncertainty
     */
    deltas: {
      hypothesisConfidence:
        number | null;
  
      beliefConfidence:
        number | null;
  
      decisionConfidence:
        number | null;
  
      readinessScore:
        number | null;
  
      uncertainty:
        number | null;
  
      selectedStrategyScore:
        number | null;
  
      beliefSupport:
        number | null;
  
      operatorMemoryEvidenceCount:
        number;
    };

    /**
 * True same-strategy attribution.
 *
 * Strategies are aligned by stable strategy ID,
 * never by array position and never merely by
 * whichever strategy happened to win.
 */
    strategyAttribution:
    BrainStrategyAttribution[];
  
  /**
   * True same-future attribution.
   *
   * Futures are aligned by the strategy that
   * generated them, never by array position.
   */
  futureAttribution:
    BrainFutureAttribution[];
  
  materialEffects: {
      confidenceMoved:
        boolean;
  
      uncertaintyMoved:
        boolean;
  
      readinessMoved:
        boolean;
  
      selectedStrategyScoreMoved:
        boolean;
  
      beliefSupportMoved:
        boolean;
  
      reasoningChanged:
        boolean;
    };
  
    verdict:
      BrainEvaluationVerdict;
  };
  
  export type MemoryCounterfactualEvaluation = {
    ok:
      true;
  
    evaluationType:
      "operator_memory_counterfactual";
  
    generatedAt:
      string;
  
    input: {
      userId:
        string;
  
      actionId:
        string | null;
  
      locationName:
        string | null;
  
      lookbackDays:
        number | null;
  
      planningHorizon:
        AIKernelInput["planningHorizon"] | null;
  
      predictionHorizon:
        AIKernelInput["predictionHorizon"] | null;
    };
  
    memoryOn:
      BrainDecisionSnapshot;
  
    memoryOff:
      BrainDecisionSnapshot;
  
    comparison:
      BrainCounterfactualComparison;
  };
  
  /**
   * A probability-like value must move by at least one percentage point
   * before Version 1 labels the movement "material".
   *
   * This does NOT mean smaller changes are meaningless.
   * The raw delta is always preserved.
   */
  const PROBABILITY_MATERIALITY_THRESHOLD =
    0.01;
  
  /**
   * Strategy scores use a larger scale than confidence values.
   */
  const STRATEGY_SCORE_MATERIALITY_THRESHOLD =
    1;
  
  function asRecord(
    value: unknown,
  ): UnknownRecord | null {
    if (
      typeof value !== "object" ||
      value === null ||
      Array.isArray(value)
    ) {
      return null;
    }
  
    return value as UnknownRecord;
  }
  
  function asArray(
    value: unknown,
  ): unknown[] {
    return Array.isArray(value)
      ? value
      : [];
  }
  
  function asString(
    value: unknown,
  ): string | null {
    return typeof value === "string"
      ? value
      : null;
  }
  
  function asNumber(
    value: unknown,
  ): number | null {
    return typeof value === "number" &&
      Number.isFinite(value)
      ? value
      : null;
  }
  
  function round(
    value: number,
    places = 6,
  ): number {
    const multiplier =
      10 ** places;
  
    return Math.round(
      value * multiplier,
    ) / multiplier;
  }
  
  function numericDelta(
    memoryOn: number | null,
    memoryOff: number | null,
  ): number | null {
    if (
      memoryOn === null ||
      memoryOff === null
    ) {
      return null;
    }
  
    return round(
      memoryOn - memoryOff,
    );
  }
  
  function hasMaterialMovement(
    delta: number | null,
    threshold:
      number,
  ): boolean {
    return (
      delta !== null &&
      Math.abs(delta) >= threshold
    );
  }
  
  function identityChanged(
    onId: string | null,
    onFallback: string | null,
    offId: string | null,
    offFallback: string | null,
  ): boolean {
    const onIdentity =
      onId ??
      onFallback;
  
    const offIdentity =
      offId ??
      offFallback;
  
    return (
      onIdentity !==
      offIdentity
    );
  }
  
  function getMemoryKey(
    value: unknown,
    index: number,
  ): string {
    const ranked =
      asRecord(value);
  
    const memory =
      asRecord(
        ranked?.["memory"],
      );
  
    const id =
      asString(
        memory?.["id"],
      );
  
    const sourceActionId =
      asString(
        memory?.["source_action_id"],
      );
  
    const title =
      asString(
        memory?.["action_title"],
      ) ??
      asString(
        memory?.["title"],
      );
  
    return (
      id ??
      sourceActionId ??
      title ??
      `rank-${index}`
    );
  }
  
  function getTopMemory(
    rankedMemories: unknown[],
  ): BrainDecisionSnapshot["memory"]["topMemory"] {
    const first =
      asRecord(
        rankedMemories[0],
      );
  
    if (!first) {
      return null;
    }
  
    const memory =
      asRecord(
        first["memory"],
      );
  
    if (!memory) {
      return null;
    }
  
    const id =
      asString(
        memory["id"],
      );
  
    const sourceActionId =
      asString(
        memory["source_action_id"],
      );
  
    const title =
      asString(
        memory["action_title"],
      ) ??
      asString(
        memory["title"],
      );
  
    return {
      key:
        id ??
        sourceActionId ??
        title,
  
      id,
  
      sourceActionId,
  
      title,
    };
  }
  function asStringArray(
  value: unknown,
): string[] {
  return asArray(value).filter(
    (item): item is string =>
      typeof item === "string",
  );
}

/**
 * Normalize one EvaluatedStrategy into the stable
 * representation used by the Evaluation Harness.
 *
 * We intentionally extract only evaluation-relevant
 * fields instead of returning the entire Brain
 * runtime object.
 */
function buildStrategyEvaluationSnapshot(
  value: unknown,
  fallbackRank: number,
): BrainStrategyEvaluationSnapshot | null {
  const evaluated =
    asRecord(value);

  if (!evaluated) {
    return null;
  }

  const strategy =
    asRecord(
      evaluated["strategy"],
    );

  if (!strategy) {
    return null;
  }

  const id =
    asString(
      strategy["id"],
    );

  const score =
    asNumber(
      evaluated["score"],
    );

  /**
   * A strategy without a stable ID or evaluator
   * score cannot safely participate in aligned
   * counterfactual attribution.
   */
  if (
    !id ||
    score === null
  ) {
    return null;
  }

  const breakdown =
    asRecord(
      evaluated["breakdown"],
    );

  return {
    id,

    title:
      asString(
        strategy["title"],
      ),

    kind:
      asString(
        strategy["kind"],
      ),

    decisionMode:
      asString(
        strategy[
          "decisionMode"
        ],
      ),

    /**
     * EvaluatedStrategy normally exposes rank.
     *
     * If an older Brain result omits it, preserve
     * leaderboard ordering as the fallback rank.
     */
    rank:
      asNumber(
        evaluated["rank"],
      ) ??
      fallbackRank,

    score,

    status:
      asString(
        evaluated["status"],
      ),

    relatedBeliefId:
      asString(
        strategy[
          "relatedBeliefId"
        ],
      ),

    relatedHypothesisId:
      asString(
        strategy[
          "relatedHypothesisId"
        ],
      ),

    breakdown: {
      basePriority:
        asNumber(
          breakdown?.[
            "basePriority"
          ],
        ),

      objectiveAlignment:
        asNumber(
          breakdown?.[
            "objectiveAlignment"
          ],
        ),

      missionAlignment:
        asNumber(
          breakdown?.[
            "missionAlignment"
          ],
        ),

      principleAlignment:
        asNumber(
          breakdown?.[
            "principleAlignment"
          ],
        ),

      beliefSupport:
        asNumber(
          breakdown?.[
            "beliefSupport"
          ],
        ),

      decisionModeFit:
        asNumber(
          breakdown?.[
            "decisionModeFit"
          ],
        ),

      expectedImpact:
        asNumber(
          breakdown?.[
            "expectedImpact"
          ],
        ),

      reversibility:
        asNumber(
          breakdown?.[
            "reversibility"
          ],
        ),

      urgency:
        asNumber(
          breakdown?.[
            "urgency"
          ],
        ),

      evidenceReadiness:
        asNumber(
          breakdown?.[
            "evidenceReadiness"
          ],
        ),

      riskPenalty:
        asNumber(
          breakdown?.[
            "riskPenalty"
          ],
        ),

      uncertaintyPenalty:
        asNumber(
          breakdown?.[
            "uncertaintyPenalty"
          ],
        ),

      blockingPenalty:
        asNumber(
          breakdown?.[
            "blockingPenalty"
          ],
        ),

      prematureActionPenalty:
        asNumber(
          breakdown?.[
            "prematureActionPenalty"
          ],
        ),

      assumptionPenalty:
        asNumber(
          breakdown?.[
            "assumptionPenalty"
          ],
        ),

      total:
        asNumber(
          breakdown?.["total"],
        ),
    },

    strengths:
      asStringArray(
        evaluated["strengths"],
      ),

    concerns:
      asStringArray(
        evaluated["concerns"],
      ),

    reasoning:
      asStringArray(
        evaluated["reasoning"],
      ),
  };
}
/**
 * Normalize one simulated future together with its
 * optional risk-adjusted Future Comparator result.
 *
 * A future may exist even when rich comparison data
 * is unavailable, so comparator-specific fields are
 * intentionally nullable.
 */
function buildFutureEvaluationSnapshot(
  futureValue: unknown,
  rankedFutureValue: unknown,
  fallbackRank: number,
): BrainFutureEvaluationSnapshot | null {
  const future =
    asRecord(
      futureValue,
    );

  if (!future) {
    return null;
  }

  const strategyId =
    asString(
      future["strategyId"],
    );

  const confidence =
    asNumber(
      future["confidence"],
    );

  const expectedRevenueImpact =
    asNumber(
      future[
        "expectedRevenueImpact"
      ],
    );

  const expectedGuestExperienceImpact =
    asNumber(
      future[
        "expectedGuestExperienceImpact"
      ],
    );

  const expectedOperationalImpact =
    asNumber(
      future[
        "expectedOperationalImpact"
      ],
    );

  const expectedRisk =
    asNumber(
      future["expectedRisk"],
    );

  /**
   * These are required SimulatedFuture fields.
   *
   * If they are missing, do not manufacture
   * evaluation data.
   */
  if (
    !strategyId ||
    confidence === null ||
    expectedRevenueImpact === null ||
    expectedGuestExperienceImpact === null ||
    expectedOperationalImpact === null ||
    expectedRisk === null
  ) {
    return null;
  }

  const rankedFuture =
    asRecord(
      rankedFutureValue,
    );

  const breakdown =
    asRecord(
      rankedFuture?.[
        "breakdown"
      ],
    );

  return {
    strategyId,

    strategyTitle:
      asString(
        future[
          "strategyTitle"
        ],
      ),

    strategyKind:
      asString(
        future[
          "strategyKind"
        ],
      ),

    decisionMode:
      asString(
        future[
          "decisionMode"
        ],
      ),

    rank:
      asNumber(
        rankedFuture?.[
          "rank"
        ],
      ) ??
      fallbackRank,

    score:
      asNumber(
        rankedFuture?.[
          "score"
        ],
      ),

    status:
      asString(
        rankedFuture?.[
          "status"
        ],
      ),

    confidence,

    expectedRevenueImpact,

    expectedGuestExperienceImpact,

    expectedOperationalImpact,

    expectedRisk,

    evidenceCoverage:
      asNumber(
        future[
          "evidenceCoverage"
        ],
      ),

    uncertainty:
      asNumber(
        future[
          "uncertainty"
        ],
      ),

    decisionModeFit:
      asNumber(
        future[
          "decisionModeFit"
        ],
      ),

    comparisonBreakdown: {
      expectedValue:
        asNumber(
          breakdown?.[
            "expectedValue"
          ],
        ),

      confidenceAdjustedImpact:
        asNumber(
          breakdown?.[
            "confidenceAdjustedImpact"
          ],
        ),

      downsideProtection:
        asNumber(
          breakdown?.[
            "downsideProtection"
          ],
        ),

      robustness:
        asNumber(
          breakdown?.[
            "robustness"
          ],
        ),

      impactBalance:
        asNumber(
          breakdown?.[
            "impactBalance"
          ],
        ),

      evidenceQuality:
        asNumber(
          breakdown?.[
            "evidenceQuality"
          ],
        ),

      decisionModeFit:
        asNumber(
          breakdown?.[
            "decisionModeFit"
          ],
        ),

      riskPenalty:
        asNumber(
          breakdown?.[
            "riskPenalty"
          ],
        ),

      scenarioPenalty:
        asNumber(
          breakdown?.[
            "scenarioPenalty"
          ],
        ),

      unknownPenalty:
        asNumber(
          breakdown?.[
            "unknownPenalty"
          ],
        ),

      assumptionPenalty:
        asNumber(
          breakdown?.[
            "assumptionPenalty"
          ],
        ),

      total:
        asNumber(
          breakdown?.[
            "total"
          ],
        ),
    },

    assumptions:
      asStringArray(
        future[
          "assumptions"
        ],
      ),

    unknowns:
      asStringArray(
        future[
          "unknowns"
        ],
      ),

    strengths:
      asStringArray(
        rankedFuture?.[
          "strengths"
        ],
      ),

    tradeoffs:
      asStringArray(
        rankedFuture?.[
          "tradeoffs"
        ],
      ),
  };
}

  
  function buildDecisionSnapshot(
    kernel: AIKernelResult,
  ): BrainDecisionSnapshot {
    const cognition =
      asRecord(
        kernel.cognition,
      );
  
    const hypotheses =
      asRecord(
        cognition?.["hypotheses"],
      );
  
    const primaryHypothesis =
      asRecord(
        hypotheses?.[
          "primaryHypothesis"
        ],
      );
  
    const hypothesisEvidence =
      asArray(
        hypotheses?.["evidence"],
      );
  
    const operatorMemoryEvidenceCount =
      hypothesisEvidence.filter(
        (item) => {
          const evidence =
            asRecord(item);
  
          return (
            asString(
              evidence?.["source"],
            ) ===
            "operator_memory"
          );
        },
      ).length;
  
    const beliefs =
      asRecord(
        cognition?.["beliefs"],
      );
  
    const primaryBelief =
      asRecord(
        beliefs?.[
          "primaryBelief"
        ],
      );
  
    const decision =
      asRecord(
        cognition?.[
          "decisionEvaluation"
        ],
      );
  
    const selectedStrategy =
  asRecord(
    cognition?.[
      "selectedStrategy"
    ],
  );

const strategy =
  asRecord(
    selectedStrategy?.[
      "strategy"
    ],
  );

const strategyBreakdown =
  asRecord(
    selectedStrategy?.[
      "breakdown"
    ],
  );

/**
 * Preserve the complete strategy evaluator
 * leaderboard for counterfactual attribution.
 */
const rankedStrategies =
  asArray(
    cognition?.[
      "rankedStrategies"
    ],
  );

const strategyLeaderboard =
  rankedStrategies
    .map(
      (
        evaluatedStrategy,
        index,
      ) =>
        buildStrategyEvaluationSnapshot(
          evaluatedStrategy,
          index + 1,
        ),
    )
    .filter(
      (
        evaluatedStrategy,
      ): evaluatedStrategy is BrainStrategyEvaluationSnapshot =>
        evaluatedStrategy !== null,
    );

/**
 * Preserve the complete future-simulation and
 * Future Comparator leaderboard.
 */
const futureSimulations =
  asArray(
    cognition?.[
      "futureSimulations"
    ],
  );

const futureComparison =
  asRecord(
    cognition?.[
      "futureComparison"
    ],
  );

const rankedFutures =
  asArray(
    futureComparison?.[
      "rankedFutures"
    ],
  );

/**
 * Rich Future Comparator output is preferred because
 * RankedFuture already contains the corresponding
 * SimulatedFuture.
 *
 * If rich comparison output is unavailable, fall back
 * to the raw futureSimulations array.
 */
const futureLeaderboard =
  rankedFutures.length >
  0
    ? rankedFutures
        .map(
          (
            rankedFutureValue,
            index,
          ) => {
            const rankedFuture =
              asRecord(
                rankedFutureValue,
              );

            return buildFutureEvaluationSnapshot(
              rankedFuture?.[
                "future"
              ],
              rankedFutureValue,
              index + 1,
            );
          },
        )
        .filter(
          (
            future,
          ): future is BrainFutureEvaluationSnapshot =>
            future !== null,
        )
    : futureSimulations
        .map(
          (
            futureValue,
            index,
          ) =>
            buildFutureEvaluationSnapshot(
              futureValue,
              null,
              index + 1,
            ),
        )
        .filter(
          (
            future,
          ): future is BrainFutureEvaluationSnapshot =>
            future !== null,
        );

const rankedMemories =
  asArray(
        kernel.memory
          .rankedMemories,
      );
  
    const retrievedMemoryKeys =
      rankedMemories.map(
        (memory, index) =>
          getMemoryKey(
            memory,
            index,
          ),
      );
  
    return {
      mode:
        kernel.mode,
  
      locationName:
        kernel.locationName,
  
      locationsAnalyzed:
        kernel.locationsAnalyzed,
  
      memory: {
        loaded:
          kernel.memory.loaded,
  
        retrievedCount:
          rankedMemories.length,
  
        retrievedMemoryKeys,
  
        topMemory:
          getTopMemory(
            rankedMemories,
          ),
  
        operatorMemoryEvidenceCount,
      },
  
      hypothesis: {
        id:
          asString(
            primaryHypothesis?.["id"],
          ),
  
        title:
          asString(
            primaryHypothesis?.[
              "title"
            ],
          ),
  
        confidence:
          asNumber(
            primaryHypothesis?.[
              "confidence"
            ],
          ),
  
        score:
          asNumber(
            primaryHypothesis?.[
              "score"
            ],
          ),
  
        evidenceCoverage:
          asNumber(
            primaryHypothesis?.[
              "evidenceCoverage"
            ],
          ),
      },
  
      belief: {
        id:
          asString(
            primaryBelief?.["id"],
          ),
  
        statement:
          asString(
            primaryBelief?.[
              "statement"
            ],
          ),
  
        category:
          asString(
            primaryBelief?.[
              "category"
            ],
          ),
  
        confidence:
          asNumber(
            primaryBelief?.[
              "confidence"
            ],
          ),
  
        evidenceCoverage:
          asNumber(
            primaryBelief?.[
              "evidenceCoverage"
            ],
          ),
      },
  
      decision: {
        confidence:
          asNumber(
            decision?.[
              "confidence"
            ],
          ),
  
        readinessScore:
          asNumber(
            decision?.[
              "readinessScore"
            ],
          ),
  
        decisionMode:
          asString(
            decision?.[
              "decisionMode"
            ],
          ),
  
        recommendation:
          asString(
            decision?.[
              "recommendation"
            ],
          ),
  
        evidenceCoverage:
          asNumber(
            decision?.[
              "evidenceCoverage"
            ],
          ),
  
        uncertainty:
          asNumber(
            decision?.[
              "uncertainty"
            ],
          ),
      },
  
      cognition: {
        uncertainty:
          asNumber(
            beliefs?.[
              "uncertainty"
            ],
          ),
  
        overallConfidence:
          asNumber(
            beliefs?.[
              "overallConfidence"
            ],
          ),
      },
  
      strategy: {
        id:
          asString(
            strategy?.["id"],
          ),
  
        title:
          asString(
            strategy?.["title"],
          ),
  
        score:
          asNumber(
            selectedStrategy?.[
              "score"
            ],
          ),
  
        beliefSupport:
          asNumber(
            strategyBreakdown?.[
              "beliefSupport"
            ],
          ),
  
        relatedBeliefId:
          asString(
            strategy?.[
              "relatedBeliefId"
            ],
          ),
  
        relatedHypothesisId:
          asString(
            strategy?.[
              "relatedHypothesisId"
            ],
          ),
      },
      strategyLeaderboard,

futureLeaderboard,
};
  }
  
  function sameStringArray(
    left: string[],
    right: string[],
  ): boolean {
    if (
      left.length !==
      right.length
    ) {
      return false;
    }
  
    return left.every(
      (value, index) =>
        value === right[index],
    );
  }

  /**
 * Return true when a counterfactual delta contains
 * a real numeric movement after our rounding rules.
 */
function hasCounterfactualDelta(
  value: number | null,
): boolean {
  return (
    value !== null &&
    Math.abs(value) >
      0.000001
  );
}

/**
 * Align Memory ON and Memory OFF strategy
 * leaderboards by stable strategy ID.
 *
 * This is the important scientific distinction:
 *
 * We compare:
 *
 *   Growth Test ON
 *   vs
 *   Growth Test OFF
 *
 * NOT:
 *
 *   winning strategy ON
 *   vs
 *   winning strategy OFF
 */
function buildStrategyAttribution(
  memoryOn:
    BrainDecisionSnapshot,

  memoryOff:
    BrainDecisionSnapshot,
): BrainStrategyAttribution[] {
  const memoryOnById =
    new Map<
      string,
      BrainStrategyEvaluationSnapshot
    >(
      memoryOn
        .strategyLeaderboard
        .map(
          (strategy) => [
            strategy.id,
            strategy,
          ],
        ),
    );

  const memoryOffById =
    new Map<
      string,
      BrainStrategyEvaluationSnapshot
    >(
      memoryOff
        .strategyLeaderboard
        .map(
          (strategy) => [
            strategy.id,
            strategy,
          ],
        ),
    );

  /**
   * Preserve Memory ON ordering first.
   *
   * Then append strategies that existed only
   * in Memory OFF.
   */
  const strategyIds =
    Array.from(
      new Set([
        ...memoryOn
          .strategyLeaderboard
          .map(
            (strategy) =>
              strategy.id,
          ),

        ...memoryOff
          .strategyLeaderboard
          .map(
            (strategy) =>
              strategy.id,
          ),
      ]),
    );

  return strategyIds.map(
    (strategyId) => {
      const on =
        memoryOnById.get(
          strategyId,
        ) ??
        null;

      const off =
        memoryOffById.get(
          strategyId,
        ) ??
        null;

      const presentInBothRuns =
        Boolean(
          on &&
          off,
        );

      const rankDelta =
        on?.rank !== null &&
        on?.rank !== undefined &&
        off?.rank !== null &&
        off?.rank !== undefined
          ? round(
              off.rank -
                on.rank,
            )
          : null;

      return {
        strategyId,

        title:
          on?.title ??
          off?.title ??
          null,

        memoryOn:
          on,

        memoryOff:
          off,

        presentInBothRuns,

        /**
         * Numeric score deltas always use:
         *
         * MEMORY ON - MEMORY OFF
         */
        scoreDelta:
          numericDelta(
            on?.score ??
              null,

            off?.score ??
              null,
          ),

        /**
         * Rank is reversed because rank #1 is better.
         *
         * MEMORY OFF rank - MEMORY ON rank
         *
         * Positive value means memory improved rank.
         */
        rankDelta,

        beliefSupportDelta:
          numericDelta(
            on?.breakdown
              .beliefSupport ??
              null,

            off?.breakdown
              .beliefSupport ??
              null,
          ),

        evidenceReadinessDelta:
          numericDelta(
            on?.breakdown
              .evidenceReadiness ??
              null,

            off?.breakdown
              .evidenceReadiness ??
              null,
          ),

        expectedImpactDelta:
          numericDelta(
            on?.breakdown
              .expectedImpact ??
              null,

            off?.breakdown
              .expectedImpact ??
              null,
          ),

        uncertaintyPenaltyDelta:
          numericDelta(
            on?.breakdown
              .uncertaintyPenalty ??
              null,

            off?.breakdown
              .uncertaintyPenalty ??
              null,
          ),

        riskPenaltyDelta:
          numericDelta(
            on?.breakdown
              .riskPenalty ??
              null,

            off?.breakdown
              .riskPenalty ??
              null,
          ),
      };
    },
  );
}

/**
 * Align Memory ON and Memory OFF projected futures
 * by the stable ID of the strategy that created them.
 *
 * This lets TurnTableAI distinguish:
 *
 *   Growth Test future WITH memory
 *
 * from
 *
 *   Growth Test future WITHOUT memory
 *
 * rather than incorrectly comparing whichever
 * projected future happened to rank first.
 */

/**
 * Convert the complete weighted attribution into
 * the strongest human-usable decision drivers.
 *
 * scoreContributionPercent is signed relative to
 * the observed Comparator score movement:
 *
 * positive = helped move the score in its observed direction
 * negative = pushed against the observed direction
 */
function buildDominantDriverSummary(
  scoreContributionDelta:
    BrainFutureAttribution[
      "scoreContributionDelta"
    ],
): BrainFutureAttribution[
  "dominantDriverSummary"
] {
  const labels:
    Record<
      BrainFutureScoreDriverKey,
      string
    > = {
      confidenceAdjustedImpact:
        "Confidence-adjusted impact",

      confidence:
        "Confidence",

      evidenceQuality:
        "Evidence quality",

      decisionModeFit:
        "Decision-mode fit",

      robustness:
        "Robustness",

      impactBalance:
        "Impact balance",

      downsideProtection:
        "Downside protection",

      riskPenalty:
        "Risk penalty",

      scenarioPenalty:
        "Scenario penalty",

      unknownPenalty:
        "Unknown penalty",

      assumptionPenalty:
        "Assumption penalty",
    };

  const keys:
    BrainFutureScoreDriverKey[] = [
      "confidenceAdjustedImpact",
      "confidence",
      "evidenceQuality",
      "decisionModeFit",
      "robustness",
      "impactBalance",
      "downsideProtection",
      "riskPenalty",
      "scenarioPenalty",
      "unknownPenalty",
      "assumptionPenalty",
    ];

  const drivers:
    BrainFutureScoreDriver[] =
    keys
      .map((key) => {
        const contribution =
          scoreContributionDelta[
            key
          ];

        const percent =
          scoreContributionDelta
            .scoreContributionPercent[
              key
            ];

        if (
          contribution === null ||
          percent === null
        ) {
          return null;
        }

        return {
          key,
          label:
            labels[key],
          contribution,
          percent,
        };
      })
      .filter(
        (
          driver,
        ): driver is BrainFutureScoreDriver =>
          driver !== null,
      );

  /**
   * Positive percentages moved WITH the observed
   * score movement.
   *
   * Sort strongest first.
   */
  const supportingDrivers =
    drivers
      .filter(
        (driver) =>
          driver.percent >
          0.000001,
      )
      .sort(
        (left, right) =>
          right.percent -
          left.percent,
      );

  /**
   * Negative percentages pushed AGAINST the
   * observed score movement.
   *
   * Sort by absolute opposing strength.
   */
  const countervailingDrivers =
    drivers
      .filter(
        (driver) =>
          driver.percent <
          -0.000001,
      )
      .sort(
        (left, right) =>
          Math.abs(
            right.percent,
          ) -
          Math.abs(
            left.percent,
          ),
      );

  return {
    primaryDriver:
      supportingDrivers[0] ??
      null,

    secondaryDriver:
      supportingDrivers[1] ??
      null,

    countervailingDriver:
      countervailingDrivers[0] ??
      null,
  };
}

/**
 * Convert verified Future Comparator attribution into
 * deterministic human-readable Decision Provenance.
 *
 * IMPORTANT:
 *
 * This function does not invent causal explanations.
 * It only describes score movement already proven by
 * the Evaluation Harness.
 */
function buildDecisionProvenance(
  strategyTitle:
    string | null,

  futureScoreDelta:
    number | null,

  dominantDriverSummary:
    BrainFutureAttribution[
      "dominantDriverSummary"
    ],

  integrityPassed:
    boolean | null,
): BrainFutureAttribution[
  "decisionProvenance"
] {
  /**
   * A future that does not exist in both runs cannot
   * support a valid same-future provenance explanation.
   */
  if (
    futureScoreDelta === null
  ) {
    return {
      direction:
        "not_comparable",

      summary:
        null,

      primaryReason:
        null,

      secondaryReason:
        null,

      countervailingReason:
        null,

      integrityPassed,
    };
  }

  /**
 * A comparable future must also pass mathematical
 * reconciliation before we are willing to surface
 * its provenance explanation as verified.
 *
 * If attribution no longer matches the production
 * Comparator, fail closed instead of generating a
 * persuasive but mathematically unsupported reason.
 */
if (
  integrityPassed !== true
) {
  return {
    direction:
      "unverified",

    summary:
      null,

    primaryReason:
      null,

    secondaryReason:
      null,

    countervailingReason:
      null,

    integrityPassed,
  };
}

  const EPSILON =
    0.000001;

  const direction:
    BrainFutureAttribution[
      "decisionProvenance"
    ]["direction"] =
    futureScoreDelta >
    EPSILON
      ? "strengthened"
      : futureScoreDelta <
          -EPSILON
        ? "weakened"
        : "unchanged";

  const formatSignedNumber = (
    value: number,
  ): string => {
    if (value > 0) {
      return `+${value}`;
    }

    return `${value}`;
  };

  const formatDriverReason = (
    driver:
      BrainFutureScoreDriver | null,
    rankLabel:
      | "largest"
      | "second-largest"
      | "countervailing",
  ): string | null => {
    if (!driver) {
      return null;
    }

    if (
      rankLabel ===
      "countervailing"
    ) {
      return `${driver.label} was the strongest countervailing factor, contributing ${formatSignedNumber(
        driver.contribution,
      )} points and accounting for ${driver.percent}% of the observed score movement.`;
    }

    return `${driver.label} was the ${rankLabel} driver, contributing ${formatSignedNumber(
      driver.contribution,
    )} points and accounting for ${driver.percent}% of the observed score movement.`;
  };

  const title =
    strategyTitle ??
    "this projected future";

  const summary =
    direction ===
    "strengthened"
      ? `Memory strengthened the projected future for "${title}" by ${formatSignedNumber(
          futureScoreDelta,
        )} points.`
      : direction ===
          "weakened"
        ? `Memory weakened the projected future for "${title}" by ${Math.abs(
            futureScoreDelta,
          )} points.`
        : `Memory did not materially change the projected future for "${title}".`;

  return {
    direction,

    summary,

    primaryReason:
      formatDriverReason(
        dominantDriverSummary
          .primaryDriver,
        "largest",
      ),

    secondaryReason:
      formatDriverReason(
        dominantDriverSummary
          .secondaryDriver,
        "second-largest",
      ),

    countervailingReason:
      formatDriverReason(
        dominantDriverSummary
          .countervailingDriver,
        "countervailing",
      ),

    integrityPassed,
  };
}
function buildFutureAttribution(
  memoryOn:
    BrainDecisionSnapshot,

  memoryOff:
    BrainDecisionSnapshot,

  /**
   * Evaluation-only fault injection.
   *
   * This does NOT change the future score,
   * Comparator math, or integrity calculation.
   * It only forces provenance verification to fail.
   */
  forceProvenanceFailure =
    false,
): BrainFutureAttribution[] {
    const memoryOnByStrategyId =
      new Map<
        string,
        BrainFutureEvaluationSnapshot
      >(
        memoryOn
          .futureLeaderboard
          .map(
            (future) => [
              future.strategyId,
              future,
            ],
          ),
      );
  
    const memoryOffByStrategyId =
      new Map<
        string,
        BrainFutureEvaluationSnapshot
      >(
        memoryOff
          .futureLeaderboard
          .map(
            (future) => [
              future.strategyId,
              future,
            ],
          ),
      );
  
    /**
     * Preserve Memory ON ordering first.
     *
     * Futures that exist only in Memory OFF
     * are appended afterward.
     */
    const strategyIds =
      Array.from(
        new Set([
          ...memoryOn
            .futureLeaderboard
            .map(
              (future) =>
                future.strategyId,
            ),
  
          ...memoryOff
            .futureLeaderboard
            .map(
              (future) =>
                future.strategyId,
            ),
        ]),
      );
  
    return strategyIds.map(
      (strategyId) => {
        const on =
          memoryOnByStrategyId.get(
            strategyId,
          ) ??
          null;
  
        const off =
          memoryOffByStrategyId.get(
            strategyId,
          ) ??
          null;
  
        const presentInBothRuns =
          Boolean(
            on &&
            off,
          );
  
        /**
         * Rank #1 is better than rank #2.
         *
         * Therefore:
         *
         * MEMORY OFF rank - MEMORY ON rank
         *
         * Positive means memory improved
         * the future's ranking.
         */
        const futureRankDelta =
          on?.rank !== null &&
          on?.rank !== undefined &&
          off?.rank !== null &&
          off?.rank !== undefined
            ? round(
                off.rank -
                  on.rank,
              )
            : null;
  
        const attribution: BrainFutureAttribution = {
          strategyId,
  
          title:
            on?.strategyTitle ??
            off?.strategyTitle ??
            null,
  
          memoryOn:
            on,
  
          memoryOff:
            off,
  
          presentInBothRuns,
  
          /**
           * Numeric future deltas use:
           *
           * MEMORY ON - MEMORY OFF
           */
          futureScoreDelta:
            numericDelta(
              on?.score ??
                null,
  
              off?.score ??
                null,
            ),
  
          futureRankDelta,
  
          confidenceDelta:
            numericDelta(
              on?.confidence ??
                null,
  
              off?.confidence ??
                null,
            ),
  
          revenueImpactDelta:
            numericDelta(
              on
                ?.expectedRevenueImpact ??
                null,
  
              off
                ?.expectedRevenueImpact ??
                null,
            ),
  
          guestExperienceImpactDelta:
            numericDelta(
              on
                ?.expectedGuestExperienceImpact ??
                null,
  
              off
                ?.expectedGuestExperienceImpact ??
                null,
            ),
  
          operationalImpactDelta:
            numericDelta(
              on
                ?.expectedOperationalImpact ??
                null,
  
              off
                ?.expectedOperationalImpact ??
                null,
            ),
  
          riskDelta:
            numericDelta(
              on?.expectedRisk ??
                null,
  
              off?.expectedRisk ??
                null,
            ),
  
          evidenceCoverageDelta:
            numericDelta(
              on?.evidenceCoverage ??
                null,
  
              off?.evidenceCoverage ??
                null,
            ),
  
          uncertaintyDelta:
            numericDelta(
              on?.uncertainty ??
                null,
  
              off?.uncertainty ??
                null,
            ),
            comparisonBreakdownDelta: {
  expectedValue:
    numericDelta(
      on?.comparisonBreakdown
        .expectedValue ??
        null,

      off?.comparisonBreakdown
        .expectedValue ??
        null,
    ),

  confidenceAdjustedImpact:
    numericDelta(
      on?.comparisonBreakdown
        .confidenceAdjustedImpact ??
        null,

      off?.comparisonBreakdown
        .confidenceAdjustedImpact ??
        null,
    ),

  downsideProtection:
    numericDelta(
      on?.comparisonBreakdown
        .downsideProtection ??
        null,

      off?.comparisonBreakdown
        .downsideProtection ??
        null,
    ),

  robustness:
    numericDelta(
      on?.comparisonBreakdown
        .robustness ??
        null,

      off?.comparisonBreakdown
        .robustness ??
        null,
    ),

  impactBalance:
    numericDelta(
      on?.comparisonBreakdown
        .impactBalance ??
        null,

      off?.comparisonBreakdown
        .impactBalance ??
        null,
    ),

  evidenceQuality:
    numericDelta(
      on?.comparisonBreakdown
        .evidenceQuality ??
        null,

      off?.comparisonBreakdown
        .evidenceQuality ??
        null,
    ),

  decisionModeFit:
    numericDelta(
      on?.comparisonBreakdown
        .decisionModeFit ??
        null,

      off?.comparisonBreakdown
        .decisionModeFit ??
        null,
    ),

  riskPenalty:
    numericDelta(
      on?.comparisonBreakdown
        .riskPenalty ??
        null,

      off?.comparisonBreakdown
        .riskPenalty ??
        null,
    ),

  scenarioPenalty:
    numericDelta(
      on?.comparisonBreakdown
        .scenarioPenalty ??
        null,

      off?.comparisonBreakdown
        .scenarioPenalty ??
        null,
    ),

  unknownPenalty:
    numericDelta(
      on?.comparisonBreakdown
        .unknownPenalty ??
        null,

      off?.comparisonBreakdown
        .unknownPenalty ??
        null,
    ),

  assumptionPenalty:
    numericDelta(
      on?.comparisonBreakdown
        .assumptionPenalty ??
        null,

      off?.comparisonBreakdown
        .assumptionPenalty ??
        null,
    ),

  total:
    numericDelta(
      on?.comparisonBreakdown
        .total ??
        null,

      off?.comparisonBreakdown
        .total ??
        null,
    ),
},

scoreContributionDelta: (() => {
  /**
   * Convert one raw counterfactual delta into
   * its actual signed contribution to the
   * production Future Comparator score.
   */
  const weightedContribution = (
    delta: number | null,
    weight: number,
  ): number | null => {
    if (delta === null) {
      return null;
    }

    return round(
      delta * weight,
    );
  };

  const confidenceAdjustedImpact =
    weightedContribution(
      numericDelta(
        on?.comparisonBreakdown
          .confidenceAdjustedImpact ??
          null,

        off?.comparisonBreakdown
          .confidenceAdjustedImpact ??
          null,
      ),

      FUTURE_COMPARATOR_SCORE_WEIGHTS
        .confidenceAdjustedImpact,
    );

  const confidence =
    weightedContribution(
      numericDelta(
        on?.confidence ??
          null,

        off?.confidence ??
          null,
      ),

      FUTURE_COMPARATOR_SCORE_WEIGHTS
        .confidence,
    );

  const evidenceQuality =
    weightedContribution(
      numericDelta(
        on?.comparisonBreakdown
          .evidenceQuality ??
          null,

        off?.comparisonBreakdown
          .evidenceQuality ??
          null,
      ),

      FUTURE_COMPARATOR_SCORE_WEIGHTS
        .evidenceQuality,
    );

  const decisionModeFit =
    weightedContribution(
      numericDelta(
        on?.comparisonBreakdown
          .decisionModeFit ??
          null,

        off?.comparisonBreakdown
          .decisionModeFit ??
          null,
      ),

      FUTURE_COMPARATOR_SCORE_WEIGHTS
        .decisionModeFit,
    );

  const robustness =
    weightedContribution(
      numericDelta(
        on?.comparisonBreakdown
          .robustness ??
          null,

        off?.comparisonBreakdown
          .robustness ??
          null,
      ),

      FUTURE_COMPARATOR_SCORE_WEIGHTS
        .robustness,
    );

  const impactBalance =
    weightedContribution(
      numericDelta(
        on?.comparisonBreakdown
          .impactBalance ??
          null,

        off?.comparisonBreakdown
          .impactBalance ??
          null,
      ),

      FUTURE_COMPARATOR_SCORE_WEIGHTS
        .impactBalance,
    );

  const downsideProtection =
    weightedContribution(
      numericDelta(
        on?.comparisonBreakdown
          .downsideProtection ??
          null,

        off?.comparisonBreakdown
          .downsideProtection ??
          null,
      ),

      FUTURE_COMPARATOR_SCORE_WEIGHTS
        .downsideProtection,
    );

  const riskPenalty =
    weightedContribution(
      numericDelta(
        on?.comparisonBreakdown
          .riskPenalty ??
          null,

        off?.comparisonBreakdown
          .riskPenalty ??
          null,
      ),

      FUTURE_COMPARATOR_SCORE_WEIGHTS
        .riskPenalty,
    );

  const scenarioPenalty =
    weightedContribution(
      numericDelta(
        on?.comparisonBreakdown
          .scenarioPenalty ??
          null,

        off?.comparisonBreakdown
          .scenarioPenalty ??
          null,
      ),

      FUTURE_COMPARATOR_SCORE_WEIGHTS
        .scenarioPenalty,
    );

  const unknownPenalty =
    weightedContribution(
      numericDelta(
        on?.comparisonBreakdown
          .unknownPenalty ??
          null,

        off?.comparisonBreakdown
          .unknownPenalty ??
          null,
      ),

      FUTURE_COMPARATOR_SCORE_WEIGHTS
        .unknownPenalty,
    );

  const assumptionPenalty =
    weightedContribution(
      numericDelta(
        on?.comparisonBreakdown
          .assumptionPenalty ??
          null,

        off?.comparisonBreakdown
          .assumptionPenalty ??
          null,
      ),

      FUTURE_COMPARATOR_SCORE_WEIGHTS
        .assumptionPenalty,
    );

  const contributionValues = [
  confidenceAdjustedImpact,
  confidence,
  evidenceQuality,
  decisionModeFit,
  robustness,
  impactBalance,
  downsideProtection,
  riskPenalty,
  scenarioPenalty,
  unknownPenalty,
  assumptionPenalty,
];

const explainedTotal =
  contributionValues.some(
    (value) =>
      value === null,
  )
    ? null
    : round(
        contributionValues.reduce<number>(
          (sum, value) =>
            sum +
            (value ?? 0),
          0,
        ),
      );

  const observedTotalDelta =
    numericDelta(
      on?.comparisonBreakdown
        .total ??
        null,

      off?.comparisonBreakdown
        .total ??
        null,
    );

  const residual =
    explainedTotal !== null &&
    observedTotalDelta !== null
      ? round(
          observedTotalDelta -
            explainedTotal,
        )
      : null;

      const integrityTolerance =
  0.01;

const integrityPassed =
  residual === null
    ? null
    : Math.abs(
        residual,
      ) <=
      integrityTolerance;

      const percentageContribution = (
  contribution: number | null,
): number | null => {
  if (
    contribution === null ||
    observedTotalDelta === null ||
    Math.abs(
      observedTotalDelta,
    ) <= 0.000001
  ) {
    return null;
  }

  return round(
    (
      contribution /
      observedTotalDelta
    ) * 100,
    2,
  );
};

const scoreContributionPercent = {
  confidenceAdjustedImpact:
    percentageContribution(
      confidenceAdjustedImpact,
    ),

  confidence:
    percentageContribution(
      confidence,
    ),

  evidenceQuality:
    percentageContribution(
      evidenceQuality,
    ),

  decisionModeFit:
    percentageContribution(
      decisionModeFit,
    ),

  robustness:
    percentageContribution(
      robustness,
    ),

  impactBalance:
    percentageContribution(
      impactBalance,
    ),

  downsideProtection:
    percentageContribution(
      downsideProtection,
    ),

  riskPenalty:
    percentageContribution(
      riskPenalty,
    ),

  scenarioPenalty:
    percentageContribution(
      scenarioPenalty,
    ),

  unknownPenalty:
    percentageContribution(
      unknownPenalty,
    ),

  assumptionPenalty:
    percentageContribution(
      assumptionPenalty,
    ),
};

  return {
    confidenceAdjustedImpact,
    confidence,
    evidenceQuality,
    decisionModeFit,
    robustness,
    impactBalance,
    downsideProtection,
    riskPenalty,
    scenarioPenalty,
    unknownPenalty,
    assumptionPenalty,
    explainedTotal,
    observedTotalDelta,
    residual,
    integrityTolerance,
integrityPassed,
scoreContributionPercent,
  };
})(),
dominantDriverSummary: {
  primaryDriver:
    null,

  secondaryDriver:
    null,

  countervailingDriver:
    null,
},
decisionProvenance: {
  direction:
    "not_comparable",

  summary:
    null,

  primaryReason:
    null,

  secondaryReason:
    null,

  countervailingReason:
    null,

  integrityPassed:
    null,
},
        };
        attribution.dominantDriverSummary =
  buildDominantDriverSummary(
    attribution
      .scoreContributionDelta,
  );

attribution.decisionProvenance =
  buildDecisionProvenance(
    attribution.title,

    attribution
      .futureScoreDelta,

    attribution
      .dominantDriverSummary,

    forceProvenanceFailure
  ? false
  : attribution
      .scoreContributionDelta
      .integrityPassed,
  );

return attribution;
      },
    );
  }
  
  function compareSnapshots(
  memoryOn:
    BrainDecisionSnapshot,

  memoryOff:
    BrainDecisionSnapshot,

  /**
   * Evaluation-only provenance fault injection.
   *
   * Defaults to false so normal evaluation behavior
   * remains completely unchanged.
   */
  forceProvenanceFailure =
    false,
): BrainCounterfactualComparison {
    const hypothesisChanged =
      identityChanged(
        memoryOn.hypothesis.id,
        memoryOn.hypothesis.title,
        memoryOff.hypothesis.id,
        memoryOff.hypothesis.title,
      );
  
    const beliefChanged =
      identityChanged(
        memoryOn.belief.id,
        memoryOn.belief.statement,
        memoryOff.belief.id,
        memoryOff.belief.statement,
      );
  
    const strategyWinnerChanged =
  identityChanged(
    memoryOn.strategy.id,
    memoryOn.strategy.title,
    memoryOff.strategy.id,
    memoryOff.strategy.title,
  );

/**
 * Align the complete strategy leaderboards before
 * interpreting any score or rank movement.
 */
const strategyAttribution =
  buildStrategyAttribution(
    memoryOn,
    memoryOff,
  );

const strategySetChanged =
  strategyAttribution.some(
    (strategy) =>
      !strategy
        .presentInBothRuns,
  );

const strategyAttributionChanged =
  strategyAttribution.some(
    (strategy) =>
      !strategy
        .presentInBothRuns ||
      hasCounterfactualDelta(
        strategy.scoreDelta,
      ) ||
      hasCounterfactualDelta(
        strategy.rankDelta,
      ) ||
      hasCounterfactualDelta(
        strategy
          .beliefSupportDelta,
      ) ||
      hasCounterfactualDelta(
        strategy
          .evidenceReadinessDelta,
      ) ||
      hasCounterfactualDelta(
        strategy
          .expectedImpactDelta,
      ) ||
      hasCounterfactualDelta(
        strategy
          .uncertaintyPenaltyDelta,
      ) ||
      hasCounterfactualDelta(
        strategy
          .riskPenaltyDelta,
      ),
  );

  /**
 * Align the complete projected-future leaderboards
 * using the strategy that generated each future.
 */
const futureAttribution =
  buildFutureAttribution(
    memoryOn,
    memoryOff,
    forceProvenanceFailure,
);
const futureSetChanged =
futureAttribution.some(
  (future) =>
    !future
      .presentInBothRuns,
);

const futureAttributionChanged =
futureAttribution.some(
  (future) =>
    !future
      .presentInBothRuns ||
    hasCounterfactualDelta(
      future
        .futureScoreDelta,
    ) ||
    hasCounterfactualDelta(
      future
        .futureRankDelta,
    ) ||
    hasCounterfactualDelta(
      future
        .confidenceDelta,
    ) ||
    hasCounterfactualDelta(
      future
        .revenueImpactDelta,
    ) ||
    hasCounterfactualDelta(
      future
        .guestExperienceImpactDelta,
    ) ||
    hasCounterfactualDelta(
      future
        .operationalImpactDelta,
    ) ||
    hasCounterfactualDelta(
      future
        .riskDelta,
    ) ||
    hasCounterfactualDelta(
  future
    .evidenceCoverageDelta,
) ||
hasCounterfactualDelta(
  future
    .uncertaintyDelta,
) ||
hasCounterfactualDelta(
  future
    .comparisonBreakdownDelta
    .expectedValue,
) ||
hasCounterfactualDelta(
  future
    .comparisonBreakdownDelta
    .confidenceAdjustedImpact,
) ||
hasCounterfactualDelta(
  future
    .comparisonBreakdownDelta
    .downsideProtection,
) ||
hasCounterfactualDelta(
  future
    .comparisonBreakdownDelta
    .robustness,
) ||
hasCounterfactualDelta(
  future
    .comparisonBreakdownDelta
    .impactBalance,
) ||
hasCounterfactualDelta(
  future
    .comparisonBreakdownDelta
    .evidenceQuality,
) ||
hasCounterfactualDelta(
  future
    .comparisonBreakdownDelta
    .decisionModeFit,
) ||
hasCounterfactualDelta(
  future
    .comparisonBreakdownDelta
    .riskPenalty,
) ||
hasCounterfactualDelta(
  future
    .comparisonBreakdownDelta
    .scenarioPenalty,
) ||
hasCounterfactualDelta(
  future
    .comparisonBreakdownDelta
    .unknownPenalty,
) ||
hasCounterfactualDelta(
  future
    .comparisonBreakdownDelta
    .assumptionPenalty,
) ||
hasCounterfactualDelta(
  future
    .comparisonBreakdownDelta
    .total,
),
);

const decisionModeChanged =
      memoryOn.decision
        .decisionMode !==
      memoryOff.decision
        .decisionMode;
  
    const hypothesisConfidenceDelta =
      numericDelta(
        memoryOn.hypothesis
          .confidence,
        memoryOff.hypothesis
          .confidence,
      );
  
    const beliefConfidenceDelta =
      numericDelta(
        memoryOn.belief
          .confidence,
        memoryOff.belief
          .confidence,
      );
  
    const decisionConfidenceDelta =
      numericDelta(
        memoryOn.decision
          .confidence,
        memoryOff.decision
          .confidence,
      );
  
    const readinessDelta =
      numericDelta(
        memoryOn.decision
          .readinessScore,
        memoryOff.decision
          .readinessScore,
      );
  
    const memoryOnUncertainty =
      memoryOn.cognition
        .uncertainty ??
      memoryOn.decision
        .uncertainty;
  
    const memoryOffUncertainty =
      memoryOff.cognition
        .uncertainty ??
      memoryOff.decision
        .uncertainty;
  
    const uncertaintyDelta =
      numericDelta(
        memoryOnUncertainty,
        memoryOffUncertainty,
      );
  
    /**
 * Only compare selected-strategy values when
 * both runs selected the SAME strategy.
 *
 * If the winner changed, subtracting the two
 * winning scores would compare different actions
 * and would therefore be misleading.
 *
 * True same-strategy comparisons now live in
 * `strategyAttribution`.
 */
const selectedStrategyScoreDelta =
  strategyWinnerChanged
    ? null
    : numericDelta(
        memoryOn.strategy
          .score,

        memoryOff.strategy
          .score,
      );

const beliefSupportDelta =
  strategyWinnerChanged
    ? null
    : numericDelta(
        memoryOn.strategy
          .beliefSupport,

        memoryOff.strategy
          .beliefSupport,
      );
  
    const operatorMemoryEvidenceDelta =
      memoryOn.memory
        .operatorMemoryEvidenceCount -
      memoryOff.memory
        .operatorMemoryEvidenceCount;
  
    const sameMode =
      memoryOn.mode ===
      memoryOff.mode;
  
    const sameLocation =
      memoryOn.locationName ===
      memoryOff.locationName;
  
    const sameLocationsAnalyzed =
      memoryOn.locationsAnalyzed ===
      memoryOff.locationsAnalyzed;
  
    const retrievalHeldConstant =
      sameStringArray(
        memoryOn.memory
          .retrievedMemoryKeys,
        memoryOff.memory
          .retrievedMemoryKeys,
      );
  
    const evidenceIsolationWorked =
      memoryOn.memory
        .operatorMemoryEvidenceCount >
        0 &&
      memoryOff.memory
        .operatorMemoryEvidenceCount ===
        0;
  
    const valid =
      sameMode &&
      sameLocation &&
      sameLocationsAnalyzed &&
      retrievalHeldConstant &&
      evidenceIsolationWorked;
  
    const confidenceMoved =
      hasMaterialMovement(
        decisionConfidenceDelta,
        PROBABILITY_MATERIALITY_THRESHOLD,
      ) ||
      hasMaterialMovement(
        beliefConfidenceDelta,
        PROBABILITY_MATERIALITY_THRESHOLD,
      ) ||
      hasMaterialMovement(
        hypothesisConfidenceDelta,
        PROBABILITY_MATERIALITY_THRESHOLD,
      );
  
    const uncertaintyMoved =
      hasMaterialMovement(
        uncertaintyDelta,
        PROBABILITY_MATERIALITY_THRESHOLD,
      );
  
    const readinessMoved =
      hasMaterialMovement(
        readinessDelta,
        PROBABILITY_MATERIALITY_THRESHOLD,
      );
  
    const selectedStrategyScoreMoved =
      hasMaterialMovement(
        selectedStrategyScoreDelta,
        STRATEGY_SCORE_MATERIALITY_THRESHOLD,
      );
  
    const beliefSupportMoved =
      hasMaterialMovement(
        beliefSupportDelta,
        STRATEGY_SCORE_MATERIALITY_THRESHOLD,
      );
  
    const operatorMemoryEvidenceChanged =
      operatorMemoryEvidenceDelta !==
      0;
  
      const reasoningChanged =
      hypothesisChanged ||
      beliefChanged ||
      decisionModeChanged ||
      strategyWinnerChanged ||
      strategySetChanged ||
      strategyAttributionChanged ||
      futureSetChanged ||
      futureAttributionChanged ||
      operatorMemoryEvidenceChanged ||
      confidenceMoved ||
      uncertaintyMoved ||
      readinessMoved ||
      selectedStrategyScoreMoved ||
      beliefSupportMoved;
  
    let verdict:
      BrainEvaluationVerdict;
  
    if (!valid) {
      verdict =
        "invalid_comparison";
    } else if (
      strategyWinnerChanged
    ) {
      verdict =
        "winner_changed";
    } else if (
      reasoningChanged
    ) {
      verdict =
        "reasoning_changed";
    } else {
      verdict =
        "no_material_change";
    }
  
    return {
      validity: {
        sameMode,
        sameLocation,
        sameLocationsAnalyzed,
        retrievalHeldConstant,
        evidenceIsolationWorked,
        valid,
      },
  
      changes: {
  hypothesisChanged,
  beliefChanged,
  decisionModeChanged,
  strategyWinnerChanged,
  strategySetChanged,
  strategyAttributionChanged,
  futureSetChanged,
futureAttributionChanged,
  operatorMemoryEvidenceChanged,
},
  
      deltas: {
        hypothesisConfidence:
          hypothesisConfidenceDelta,
  
        beliefConfidence:
          beliefConfidenceDelta,
  
        decisionConfidence:
          decisionConfidenceDelta,
  
        readinessScore:
          readinessDelta,
  
        uncertainty:
          uncertaintyDelta,
  
        selectedStrategyScore:
          selectedStrategyScoreDelta,
  
        beliefSupport:
          beliefSupportDelta,
  
        operatorMemoryEvidenceCount:
          operatorMemoryEvidenceDelta,
      },

      strategyAttribution,

futureAttribution,

materialEffects: {
        confidenceMoved,
        uncertaintyMoved,
        readinessMoved,
        selectedStrategyScoreMoved,
        beliefSupportMoved,
        reasoningChanged,
      },
  
      verdict,
    };
  }
  
  /**
   * Run a controlled Operator Memory counterfactual.
   *
   * Both Brain runs receive identical input.
   *
   * The only intended Cognitive difference is:
   *
   *   memoryOn  -> memoryMode: "normal"
   *   memoryOff -> memoryMode: "excluded"
   *
   * Both runs still retrieve/rank memory so the harness can verify
   * that memory retrieval itself remained constant.
   */
  export async function runMemoryCounterfactualEvaluation(
    input:
      BrainEvaluationInput,
  ): Promise<MemoryCounterfactualEvaluation> {
    /**
 * Evaluation-only controls must never enter
 * either production Brain run.
 *
 * Both kernels receive identical real inputs.
 */
const {
  forceProvenanceFailure,
  ...kernelInput
} = input;
    const [
      memoryOnKernel,
      memoryOffKernel,
    ] = await Promise.all([
      runAIKernel({
        ...kernelInput,
        memoryMode:
          "normal",
      }),
  
      runAIKernel({
        ...kernelInput,
        memoryMode:
          "excluded",
      }),
    ]);
  
    const memoryOn =
      buildDecisionSnapshot(
        memoryOnKernel,
      );
  
    const memoryOff =
      buildDecisionSnapshot(
        memoryOffKernel,
      );
  
    const comparison =
  compareSnapshots(
    memoryOn,
    memoryOff,
    forceProvenanceFailure ??
      false,
  );
  
    return {
      ok:
        true,
  
      evaluationType:
        "operator_memory_counterfactual",
  
      generatedAt:
        new Date().toISOString(),
  
      input: {
        userId:
          input.userId,
  
        actionId:
          input.actionId ??
          null,
  
        locationName:
          input.locationName ??
          null,
  
        lookbackDays:
          input.lookbackDays ??
          null,
  
        planningHorizon:
          input.planningHorizon ??
          null,
  
        predictionHorizon:
          input.predictionHorizon ??
          null,
      },
  
      memoryOn,
  
      memoryOff,
  
      comparison,
    };
  }