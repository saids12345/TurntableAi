import { getSupabaseRouteClient } from "@/lib/supabaseRoute";
import {
  buildProvisionalMemoryEvidence,
  getMemoryTrustState,
  getMemoryVerificationConfidenceScore,
  getVerifiedMemoryOutcomeScore,
  inferMemoryOutcomeSignal,
  isMemoryEligibleAsReusablePlaybook,
  isMemoryTrustedForReasoning,
  type MemoryOutcomeSignal,
} from "@/lib/operatorMemoryTrust";

export {
  buildProvisionalMemoryEvidence,
  getMemoryTrustState,
  getMemoryVerificationConfidenceScore,
  getOutcomeVerification,
  getVerifiedMemoryOutcomeScore,
  inferMemoryOutcomeSignal,
  isMemoryEligibleAsReusablePlaybook,
  isMemoryTrustedForReasoning,
  type MemoryOutcomeSignal,
  type MemoryTrustState,
  type OutcomeVerificationVerdict,
} from "@/lib/operatorMemoryTrust";
export interface MemorySearchFilters {
  locationName?: string;
  category?: string;
  limit?: number;
  reusableOnly?: boolean;
}

export interface CreateMemoryInput {
  locationName?: string | null;
  problemType: string;
  actionType: string;
  actionTitle: string;
  resultSummary: string;
  lesson: string;
  confidence?: "low" | "medium" | "high";
  outcomeScore?: number | null;
  success?: boolean | null;
  revenueBefore?: number | null;
  revenueAfter?: number | null;
  ratingBefore?: number | null;
  ratingAfter?: number | null;
  lessonStrength?: "weak" | "developing" | "strong";
  reuseRecommended?: boolean;
  evidence?: Record<string, unknown>;
}
export interface MemoryRelevanceContext {
  locationName?: string | null;
  problemType?: string | null;
  actionType?: string | null;
  objective?: string | null;
  situationSummary?: string | null;
  candidateStrategy?: string | null;
  limit?: number;
}


export interface RankedOperatorMemory {
  memory: Record<string, unknown>;
  applicabilityScore: number;
  evidenceScore: number;
  freshnessScore: number;
  decisionValue: number;
  outcomeSignal: MemoryOutcomeSignal;
  reasons: string[];
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function memoryString(
  memory: Record<string, unknown>,
  key: string,
): string | null {
  const value = memory[key];

  return typeof value === "string" && value.trim()
    ? value.trim()
    : null;
}

function memoryNumber(
  memory: Record<string, unknown>,
  key: string,
): number | null {
  const value = memory[key];

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);

    return Number.isFinite(parsed)
      ? parsed
      : null;
  }

  return null;
}

function memoryBoolean(
  memory: Record<string, unknown>,
  key: string,
): boolean | null {
  const value = memory[key];

  if (typeof value === "boolean") {
    return value;
  }

  return null;
}

function normalizeMemoryText(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function textTokens(value: string) {
  return new Set(
    normalizeMemoryText(value)
      .split(/\s+/)
      .filter((token) => token.length >= 3),
  );
}

function calculateTextSimilarity(
  left: string,
  right: string,
) {
  const leftTokens = textTokens(left);
  const rightTokens = textTokens(right);

  if (!leftTokens.size || !rightTokens.size) {
    return 0;
  }

  let shared = 0;

  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      shared += 1;
    }
  }

  return (
    shared /
    Math.max(
      1,
      Math.min(leftTokens.size, rightTokens.size),
    )
  );
}

function clampMemoryScore(score: number) {
  return Math.max(
    0,
    Math.min(100, Math.round(score)),
  );
}

function calculateMemoryFreshness(
  memory: Record<string, unknown>,
) {
  const rawDate =
    memoryString(memory, "updated_at") ??
    memoryString(memory, "created_at");

  if (!rawDate) {
    return 25;
  }

  const timestamp = new Date(rawDate).getTime();

  if (!Number.isFinite(timestamp)) {
    return 25;
  }

  const ageDays =
    Math.max(0, Date.now() - timestamp) /
    86_400_000;

  if (ageDays <= 7) return 100;
  if (ageDays <= 30) return 90;
  if (ageDays <= 90) return 75;
  if (ageDays <= 180) return 60;
  if (ageDays <= 365) return 45;
  if (ageDays <= 730) return 30;

  return 15;
}

function calculateMemoryEvidence(
  memory: Record<string, unknown>,
) {
  /*
   * Evidence strength measures how trustworthy
   * the verified observation is — not whether
   * the historical outcome was positive.
   *
   * A well-verified failure can therefore be
   * very strong evidence.
   */
  const verificationConfidence =
    getMemoryVerificationConfidenceScore(
      memory,
    );

  let score =
    verificationConfidence *
    0.65;

  const confidence =
    memoryString(
      memory,
      "confidence",
    );

  if (confidence === "high") {
    score += 10;
  } else if (
    confidence === "medium"
  ) {
    score += 7;
  } else if (
    confidence === "low"
  ) {
    score += 3;
  }

  const lessonStrength =
    memoryString(
      memory,
      "lesson_strength",
    );

  if (
    lessonStrength === "strong"
  ) {
    score += 15;
  } else if (
    lessonStrength ===
    "developing"
  ) {
    score += 10;
  } else if (
    lessonStrength === "weak"
  ) {
    score += 5;
  }

  /*
   * Use the verified score only.
   * Stale legacy outcome_score / success
   * fields cannot increase evidence strength.
   */
  if (
    getVerifiedMemoryOutcomeScore(
      memory,
    ) !== null
  ) {
    score += 5;
  }

  const evidence =
    memory.evidence;

  if (
    isRecord(evidence) &&
    Object.keys(evidence)
      .length > 0
  ) {
    score += 5;
  }

  return clampMemoryScore(
    score,
  );
}


export class OperatorMemoryService {
  async getUser() {
    const supabase = await getSupabaseRouteClient();

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      throw new Error(error.message);
    }

    if (!user) {
      throw new Error("Unauthorized");
    }

    return {
      supabase,
      user,
    };
  }

  async getMemories(filters: MemorySearchFilters = {}) {
    const { supabase, user } = await this.getUser();

    let query = supabase
      .from("operator_memory")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("updated_at", { ascending: false });

    if (filters.locationName) {
      query = query.eq("location_name", filters.locationName);
    }

    if (filters.category) {
      query = query.eq("problem_type", filters.category);
    }

    /*
 * When reusableOnly is requested, filtering
 * must happen through the trusted-memory gate
 * before limit is applied.
 */
if (
  typeof filters.limit ===
    "number" &&
  !filters.reusableOnly
) {
  query =
    query.limit(
      filters.limit,
    );
}

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    let memories =
  data ?? [];

if (
  filters.reusableOnly
) {
  memories =
    memories.filter(
      (memory) =>
        isMemoryEligibleAsReusablePlaybook(
          memory as Record<
            string,
            unknown
          >,
        ),
    );
}

return typeof filters.limit ===
  "number"
  ? memories.slice(
      0,
      filters.limit,
    )
  : memories;
  }
  async getTrustedMemoriesForReasoning(
  filters: MemorySearchFilters = {},
) {
  const {
    limit,
    reusableOnly,
    ...baseFilters
  } = filters;

  const memories =
    await this.getMemories(
      baseFilters,
    );

  const trusted =
    memories.filter(
      (memory) =>
        isMemoryTrustedForReasoning(
          memory as Record<
            string,
            unknown
          >,
        ),
    );

    const eligible =
    reusableOnly
      ? trusted.filter(
          (memory) =>
            isMemoryEligibleAsReusablePlaybook(
              memory as Record<
                string,
                unknown
              >,
            ),
        )
      : trusted;
  
  return typeof limit ===
    "number"
    ? eligible.slice(
        0,
        limit,
      )
    : eligible;
}

  async createMemory(input: CreateMemoryInput) {
    const { supabase, user } = await this.getUser();

    const row = {
      user_id: user.id,
      location_name: input.locationName ?? null,

      problem_type: input.problemType,
      action_type: input.actionType,
      action_title: input.actionTitle,

      result_summary: input.resultSummary,
      lesson: input.lesson,

      confidence: input.confidence ?? "medium",
      status: "active",

      evidence:
  buildProvisionalMemoryEvidence(
    {
      ...(input.evidence ?? {}),

      reportedOutcomeScore:
        input.outcomeScore ??
        null,

      reportedSuccess:
        input.success ??
        null,

      reportedReuseRecommended:
        input.reuseRecommended ??
        false,
    },

    "Memory created through OperatorMemoryService.createMemory is provisional until Decision Outcome Verification verifies the measured result.",
  ),

      outcome_score: input.outcomeScore ?? null,
      success: input.success ?? null,

      revenue_before: input.revenueBefore ?? null,
      revenue_after: input.revenueAfter ?? null,

      rating_before: input.ratingBefore ?? null,
      rating_after: input.ratingAfter ?? null,

      lesson_strength:
        input.lessonStrength ?? "developing",

        reuse_recommended:
        false,

      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("operator_memory")
      .insert(row)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }
  async rankMemoriesForContext(
    problemType: string,
    context: MemoryRelevanceContext = {},
  ): Promise<RankedOperatorMemory[]> {
    const memories =
  await this.getTrustedMemoriesForReasoning({
    limit: context.limit ?? 100,
  });
  
    const currentProblemType =
      context.problemType ??
      problemType;
  
    const currentSituationText = [
      currentProblemType,
      context.objective,
      context.situationSummary,
      context.candidateStrategy,
    ]
      .filter(
        (value): value is string =>
          typeof value === "string" &&
          value.trim().length > 0,
      )
      .join(" ");
  
    const ranked =
      memories.map((memory) => {
        let applicabilityScore = 0;
  
        const reasons: string[] = [];
  
        const memoryProblemType =
          memoryString(
            memory,
            "problem_type",
          );
  
        const memoryLocation =
          memoryString(
            memory,
            "location_name",
          );
  
        const memoryActionType =
          memoryString(
            memory,
            "action_type",
          );
  
        const memoryLesson =
          memoryString(
            memory,
            "lesson",
          );
  
        const memoryResultSummary =
          memoryString(
            memory,
            "result_summary",
          );
  
        const memoryActionTitle =
          memoryString(
            memory,
            "action_title",
          );
  
        /*
         * 1. Problem similarity
         *
         * Exact problem matches are powerful,
         * but non-identical problems may still
         * contain useful evidence.
         */
        if (
          currentProblemType &&
          memoryProblemType
        ) {
          if (
            normalizeMemoryText(
              currentProblemType,
            ) ===
            normalizeMemoryText(
              memoryProblemType,
            )
          ) {
            applicabilityScore += 35;
  
            reasons.push(
              "Same operating problem.",
            );
          } else {
            const problemSimilarity =
              calculateTextSimilarity(
                currentProblemType,
                memoryProblemType,
              );
  
            if (problemSimilarity > 0) {
              applicabilityScore +=
                Math.round(
                  problemSimilarity * 20,
                );
  
              reasons.push(
                "Related operating problem.",
              );
            }
          }
        }
  
        /*
         * 2. Location similarity
         */
        if (
          context.locationName &&
          memoryLocation
        ) {
          if (
            normalizeMemoryText(
              context.locationName,
            ) ===
            normalizeMemoryText(
              memoryLocation,
            )
          ) {
            applicabilityScore += 15;
  
            reasons.push(
              "Same restaurant/location.",
            );
          } else {
            reasons.push(
              "Different location; transferability should be judged carefully.",
            );
          }
        }
  
        /*
         * 3. Action similarity
         */
        if (
          context.actionType &&
          memoryActionType
        ) {
          if (
            normalizeMemoryText(
              context.actionType,
            ) ===
            normalizeMemoryText(
              memoryActionType,
            )
          ) {
            applicabilityScore += 15;
  
            reasons.push(
              "Same kind of operator action.",
            );
          }
        }
  
        /*
         * 4. Broader situation similarity
         *
         * This allows lessons from differently
         * named problems to still matter when
         * their underlying circumstances overlap.
         */
        const memorySituationText = [
          memoryProblemType,
          memoryActionType,
          memoryActionTitle,
          memoryLesson,
          memoryResultSummary,
        ]
          .filter(
            (value): value is string =>
              typeof value === "string" &&
              value.trim().length > 0,
          )
          .join(" ");
  
        if (
          currentSituationText &&
          memorySituationText
        ) {
          const situationSimilarity =
            calculateTextSimilarity(
              currentSituationText,
              memorySituationText,
            );
  
          if (situationSimilarity > 0) {
            applicabilityScore +=
              Math.round(
                situationSimilarity * 35,
              );
  
            if (
              situationSimilarity >= 0.35
            ) {
              reasons.push(
                "Past lesson resembles the current operating situation.",
              );
            }
          }
        }
  
        applicabilityScore =
          clampMemoryScore(
            applicabilityScore,
          );
  
        /*
         * 5. Evidence quality
         *
         * How trustworthy is this memory?
         */
        const evidenceScore =
          calculateMemoryEvidence(
            memory,
          );
  
        /*
         * 6. Freshness
         *
         * Recent evidence usually deserves
         * more influence, without deleting
         * older institutional knowledge.
         */
        const freshnessScore =
          calculateMemoryFreshness(
            memory,
          );
  
        /*
         * 7. Outcome interpretation
         *
         * Important:
         *
         * cautionary evidence is NOT bad memory.
         * A failed strategy can be extremely
         * valuable because it tells the Brain
         * what not to repeat.
         */
        const outcomeSignal =
          inferMemoryOutcomeSignal(
            memory,
          );
  
        let outcomeUtility = 0;
  
        if (
          outcomeSignal === "supporting"
        ) {
          outcomeUtility = 5;
  
          reasons.push(
            "Past outcome supports this direction.",
          );
        } else if (
          outcomeSignal === "cautionary"
        ) {
          outcomeUtility = 5;
  
          reasons.push(
            "Past outcome is cautionary evidence and should not be treated as a reusable success.",
          );
        } else if (
          outcomeSignal === "mixed"
        ) {
          outcomeUtility = 2;
  
          reasons.push(
            "Past outcome was mixed and should be interpreted with uncertainty.",
          );
        } else {
          reasons.push(
            "Past outcome is not yet well established.",
          );
        }
  
        /*
         * Decision value measures usefulness,
         * NOT whether the lesson is positive.
         *
         * This is why a highly relevant failure
         * may rank above an unrelated success.
         */
        const decisionValue =
          clampMemoryScore(
            applicabilityScore * 0.5 +
              evidenceScore * 0.3 +
              freshnessScore * 0.2 +
              outcomeUtility,
          );
  
        return {
          memory,
          applicabilityScore,
          evidenceScore,
          freshnessScore,
          decisionValue,
          outcomeSignal,
          reasons,
        } satisfies RankedOperatorMemory;
      });
  
    ranked.sort(
      (left, right) =>
        right.decisionValue -
        left.decisionValue,
    );
  
    return ranked;
  }
  async findBestPlaybook(
    problemType: string,
    context: {
      locationName?: string | null;
      actionType?: string | null;
    } = {},
  ) {
    const ranked =
      await this.rankMemoriesForContext(
        problemType,
        {
          problemType,
          locationName:
            context.locationName ??
            null,
          actionType:
            context.actionType ??
            null,
        },
      );
  
    /*
     * A playbook is different from evidence.
     *
     * Cautionary memories remain available
     * to the Brain, but they must never be
     * returned as successful reusable actions.
     */
    const bestReusable =
  ranked.find((entry) =>
    isMemoryEligibleAsReusablePlaybook(
      entry.memory,
    ),
  );
  
    return (
      bestReusable?.memory ??
      null
    );
  }

  async getLearningSummary() {
    const memories =
  await this.getTrustedMemoriesForReasoning();

    const reusable =
  memories.filter(
    (memory) =>
      isMemoryEligibleAsReusablePlaybook(
        memory as Record<
          string,
          unknown
        >,
      ),
  );

  const successful =
  memories.filter(
    (memory) =>
      getMemoryTrustState(
        memory,
      ) ===
      "verified_supporting",
  );

const verifiedOutcomeScores =
  memories
    .map((memory) =>
      getVerifiedMemoryOutcomeScore(
        memory,
      ),
    )
    .filter(
      (
        score,
      ): score is number =>
        score !== null,
    );

const averageOutcome =
  verifiedOutcomeScores.length >
  0
    ? Math.round(
        verifiedOutcomeScores.reduce(
          (
            sum,
            score,
          ) =>
            sum +
            score,
          0,
        ) /
          verifiedOutcomeScores.length,
      )
    : null;

    return {
      totalMemories: memories.length,
      reusablePlaybooks:
        reusable.length,
      successfulStrategies:
        successful.length,
      averageOutcomeScore:
        averageOutcome,
    };
  }
}

export const operatorMemoryService =
  new OperatorMemoryService();