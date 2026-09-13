import type {
  BrainContext,
} from "@/lib/brain/brainContext";

export type InternalQuestionKind =
  | "objective"
  | "diagnosis"
  | "evidence"
  | "contradiction"
  | "competition"
  | "assumption"
  | "uncertainty"
  | "risk"
  | "opportunity"
  | "timing"
  | "learning"
  | "decision_threshold";

export interface InternalQuestion {
  /**
   * Existing compatibility fields.
   */
  id: string;

  question: string;

  importance: number;

  /**
   * Rich cognitive metadata.
   */
  kind?: InternalQuestionKind;

  reason?: string;

  relatedBeliefId?: string;

  relatedEvidenceIds?: string[];

  blockingDecision?: boolean;
}

export interface InternalDialogue {
  /**
   * Existing compatibility fields.
   */
  questions: InternalQuestion[];

  summary: string;

  /**
   * Rich cognitive state.
   */
  primaryQuestion?: InternalQuestion;

  primaryTension?: string;

  uncertainty?: number;

  unresolvedCount?: number;

  generatedAt?: string;
}

interface QuestionDraft {
  id?: string;

  question: string;

  importance: number;

  kind: InternalQuestionKind;

  reason?: string;

  relatedBeliefId?: string;

  relatedEvidenceIds?: string[];

  blockingDecision?: boolean;
}

const MAX_QUESTIONS = 12;

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

function cleanStatement(
  value:
    | string
    | undefined,
  fallback: string,
) {
  const normalized =
    value
      ?.replace(/\s+/g, " ")
      .trim()
      .replace(/[.!?]+$/g, "");

  return normalized || fallback;
}

function slugify(
  value: string,
) {
  const slug =
    value
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        "-",
      )
      .replace(
        /^-+|-+$/g,
        "",
      )
      .slice(
        0,
        60,
      );

  return slug || "question";
}

function getEvidenceTitle(
  context: BrainContext,
  evidenceId:
    | string
    | undefined,
) {
  if (!evidenceId) {
    return undefined;
  }

  return context.reasoning
    .hypotheses
    ?.evidence
    .find(
      (item) =>
        item.id ===
        evidenceId,
    )
    ?.title;
}

function getPrimaryTension(
  context: BrainContext,
) {
  const beliefSystem =
    context.reasoning.beliefs;

  const primaryBelief =
    beliefSystem
      ?.primaryBelief;

  const alternative =
    beliefSystem
      ?.alternativeBeliefs
      ?.find(
        (belief) =>
          belief.status !==
          "rejected",
      );

  if (
    primaryBelief &&
    alternative
  ) {
    return (
      `"${primaryBelief.statement}" versus ` +
      `"${alternative.statement}"`
    );
  }

  if (primaryBelief) {
    return cleanStatement(
      primaryBelief.statement,
      "the current diagnosis",
    );
  }

  return (
    "insufficient evidence to establish a reliable diagnosis"
  );
}

export function buildInternalDialogue(
  context: BrainContext,
): InternalDialogue {
  const objective =
    context.reasoning
      .objective;

  const hypothesisResult =
    context.reasoning
      .hypotheses;

  const beliefSystem =
    context.reasoning
      .beliefs;

  const primaryBelief =
    beliefSystem
      ?.primaryBelief;

  const alternativeBeliefs =
    beliefSystem
      ?.alternativeBeliefs ??
    beliefSystem
      ?.beliefs
      .filter(
        (belief) =>
          belief.id !==
          primaryBelief?.id,
      ) ??
    [];

  const contestedBeliefs =
    beliefSystem
      ?.contestedBeliefs ??
    beliefSystem
      ?.beliefs
      .filter(
        (belief) =>
          belief.status ===
          "contested",
      ) ??
    [];

  const uncertainty =
    clamp(
      beliefSystem
        ?.uncertainty ??
        (
          primaryBelief
            ? 1 -
              primaryBelief.confidence
            : 1
        ),
    );

  const questions: InternalQuestion[] =
    [];

  const questionKeys =
    new Set<string>();

  const addQuestion = (
    draft: QuestionDraft,
  ) => {
    const normalizedQuestion =
      draft.question
        .replace(/\s+/g, " ")
        .trim();

    if (!normalizedQuestion) {
      return;
    }

    const dedupeKey =
      normalizedQuestion
        .toLowerCase();

    if (
      questionKeys.has(
        dedupeKey,
      )
    ) {
      return;
    }

    questionKeys.add(
      dedupeKey,
    );

    questions.push({
      id:
        draft.id ??
        `${draft.kind}-${slugify(
          normalizedQuestion,
        )}`,

      question:
        normalizedQuestion,

      importance:
        round(
          clamp(
            draft.importance,
          ),
        ),

      kind:
        draft.kind,

      reason:
        draft.reason,

      relatedBeliefId:
        draft.relatedBeliefId,

      relatedEvidenceIds:
        uniqueStrings(
          draft.relatedEvidenceIds,
        ),

      blockingDecision:
        draft.blockingDecision ??
        false,
    });
  };

  /**
   * 1. Validate the current objective.
   */
  if (objective) {
    const objectiveTitle =
      cleanStatement(
        objective.title,
        "the current operating objective",
      );

    addQuestion({
      id:
        "objective-validity",

      question:
        `Is "${objectiveTitle}" still the right immediate objective given the current evidence?`,

      importance:
        0.82 +
        uncertainty * 0.1,

      kind:
        "objective",

      reason:
        objective.reason,

      blockingDecision:
        uncertainty >= 0.7,
    });
  } else {
    addQuestion({
      id:
        "objective-missing",

      question:
        "What should the Brain optimize for during this reasoning cycle?",

      importance:
        0.96,

      kind:
        "objective",

      reason:
        "No current operating objective is available.",

      blockingDecision:
        true,
    });
  }

  /**
   * 2. Interrogate the primary belief.
   */
  if (primaryBelief) {
    const primaryStatement =
      cleanStatement(
        primaryBelief.statement,
        "the current primary belief",
      );

    addQuestion({
      id:
        "primary-belief-support",

      question:
        `What is the strongest reliable evidence that "${primaryStatement}" is the correct explanation?`,

      importance:
        0.98,

      kind:
        "evidence",

      reason:
        "The primary belief should be justified by reliable and relevant evidence.",

      relatedBeliefId:
        primaryBelief.id,

      relatedEvidenceIds:
        primaryBelief
          .supportingEvidence ??
        primaryBelief.evidence,

      blockingDecision:
        (
          primaryBelief
            .evidenceCoverage ??
          0
        ) < 0.5,
    });

    const contradictingEvidence =
      uniqueStrings(
        primaryBelief
          .contradictingEvidence,
      );

    const contradictionRatio =
      primaryBelief
        .contradictionRatio ??
      0;

    if (
      contradictingEvidence.length >
        0 ||
      contradictionRatio >= 0.12
    ) {
      const strongestContradiction =
        getEvidenceTitle(
          context,
          contradictingEvidence[0],
        );

      addQuestion({
        id:
          "primary-belief-contradiction",

        question:
          strongestContradiction
            ? `How should the Brain explain "${strongestContradiction}", which contradicts the belief that "${primaryStatement}"?`
            : `What evidence contradicts the belief that "${primaryStatement}", and is that contradiction material?`,

        importance:
          0.94 +
          contradictionRatio *
            0.06,

        kind:
          "contradiction",

        reason:
          "Contradicting evidence must be explained rather than ignored.",

        relatedBeliefId:
          primaryBelief.id,

        relatedEvidenceIds:
          contradictingEvidence,

        blockingDecision:
          contradictionRatio >=
          0.35,
      });
    }

    const assumptions =
      uniqueStrings(
        primaryBelief.assumptions,
      );

    if (
      assumptions.length > 0
    ) {
      addQuestion({
        id:
          "primary-belief-assumption",

        question:
          `Which assumption behind the belief that "${primaryStatement}" is most fragile, and how can it be tested?`,

        importance:
          0.84 +
          uncertainty * 0.1,

        kind:
          "assumption",

        reason:
          assumptions
            .slice(
              0,
              3,
            )
            .join(" "),

        relatedBeliefId:
          primaryBelief.id,

        blockingDecision:
          primaryBelief.status ===
          "provisional",
      });
    }

    const changeConditions =
      uniqueStrings(
        primaryBelief
          .whatWouldChangeMyMind,
      );

    if (
      changeConditions.length > 0
    ) {
      addQuestion({
        id:
          "change-my-mind",

        question:
          `What new observation would most clearly weaken or overturn the belief that "${primaryStatement}"?`,

        importance:
          0.88,

        kind:
          "diagnosis",

        reason:
          changeConditions
            .slice(
              0,
              3,
            )
            .join(" "),

        relatedBeliefId:
          primaryBelief.id,
      });
    }
  } else {
    addQuestion({
      id:
        "diagnosis-missing",

      question:
        "What is the most likely explanation for the current restaurant situation?",

      importance:
        1,

      kind:
        "diagnosis",

      reason:
        "No primary belief has been formed.",

      blockingDecision:
        true,
    });
  }

  /**
   * 3. Compare competing explanations.
   */
  if (
    primaryBelief &&
    alternativeBeliefs.length >
      0
  ) {
    const strongestAlternative =
      alternativeBeliefs[0];

    const primaryStatement =
      cleanStatement(
        primaryBelief.statement,
        "the primary explanation",
      );

    const alternativeStatement =
      cleanStatement(
        strongestAlternative
          .statement,
        "the strongest alternative explanation",
      );

    addQuestion({
      id:
        "competing-beliefs",

      question:
        `What single observation would best distinguish "${primaryStatement}" from "${alternativeStatement}"?`,

      importance:
        contestedBeliefs.length >
          0
          ? 0.99
          : 0.9,

      kind:
        "competition",

      reason:
        "The Brain should seek discriminating evidence when multiple explanations remain plausible.",

      relatedBeliefId:
        strongestAlternative.id,

      relatedEvidenceIds:
        uniqueStrings([
          ...(
            primaryBelief
              .supportingEvidence ??
            primaryBelief
              .evidence
          ),

          ...(
            strongestAlternative
              .supportingEvidence ??
            strongestAlternative
              .evidence
          ),
        ]),

      blockingDecision:
        contestedBeliefs.length >
        0,
    });
  }

  /**
   * 4. Surface missing information.
   */
  const unknowns =
    uniqueStrings([
      ...(
        primaryBelief
          ?.unknowns ??
        []
      ),

      ...(
        hypothesisResult
          ?.unknowns ??
        []
      ),
    ]);

  unknowns
    .slice(
      0,
      3,
    )
    .forEach(
      (
        unknown,
        index,
      ) => {
        const cleanedUnknown =
          cleanStatement(
            unknown,
            "missing operational information",
          );

        addQuestion({
          id:
            `unknown-${index + 1}`,

          question:
            `How can the Brain resolve this uncertainty: ${cleanedUnknown}?`,

          importance:
            0.82 +
            uncertainty * 0.14 -
            index * 0.03,

          kind:
            "uncertainty",

          reason:
            unknown,

          blockingDecision:
            index === 0 &&
            uncertainty >= 0.65,
        });
      },
    );

  /**
   * 5. Evaluate decision risk.
   */
  if (primaryBelief) {
    const primaryStatement =
      cleanStatement(
        primaryBelief.statement,
        "the primary belief",
      );

    addQuestion({
      id:
        "wrong-belief-risk",

      question:
        `What is the operational and financial downside of acting on "${primaryStatement}" if that belief is wrong?`,

      importance:
        0.93,

      kind:
        "risk",

      reason:
        "Executive reasoning should consider the cost of diagnostic error.",

      relatedBeliefId:
        primaryBelief.id,

      blockingDecision:
        uncertainty >= 0.7,
    });
  } else {
    addQuestion({
      id:
        "action-risk",

      question:
        "What risks should be considered before taking action?",

      importance:
        0.94,

      kind:
        "risk",
    });
  }

  /**
   * 6. Decide whether to act or investigate.
   */
  addQuestion({
    id:
      "decision-threshold",

    question:
      uncertainty >= 0.6
        ? "Is confidence high enough to act, or should the next move be a low-risk information-gathering experiment?"
        : "Is the available evidence strong enough to justify action now?",

    importance:
      0.9 +
      uncertainty * 0.09,

    kind:
      "decision_threshold",

    reason:
      `Current belief-system uncertainty is ${Math.round(
        uncertainty * 100,
      )}%.`,

    relatedBeliefId:
      primaryBelief?.id,

    blockingDecision:
      uncertainty >= 0.75,
  });

  /**
   * 7. Consider the cost of waiting.
   */
  addQuestion({
    id:
      "cost-of-delay",

    question:
      "What is likely to happen if no action is taken before the next review cycle?",

    importance:
      0.86,

    kind:
      "timing",

    reason:
      "The cost of delay should be compared with the risk of acting too early.",
  });

  /**
   * 8. Preserve opportunity-seeking behavior.
   */
  addQuestion({
    id:
      "long-term-opportunity",

    question:
      objective
        ? `While pursuing "${cleanStatement(
            objective.title,
            "the current objective",
          )}", what opportunity could create the greatest long-term value without increasing unacceptable risk?`
        : "What opportunity could create the greatest long-term value without increasing unacceptable risk?",

    importance:
      0.78,

    kind:
      "opportunity",

    reason:
      "The Brain should balance defensive problem-solving with controlled growth.",
  });

  /**
   * 9. Ask whether past outcomes can inform the decision.
   */
  const hasOperatorMemory =
    context.knowledge
      .operatorMemory !==
      undefined &&
    context.knowledge
      .operatorMemory !==
      null;

  if (!hasOperatorMemory) {
    addQuestion({
      id:
        "missing-operator-memory",

      question:
        "Have similar restaurant situations occurred before, and what outcomes followed the actions taken?",

      importance:
        0.79,

      kind:
        "learning",

      reason:
        "Comparable historical outcomes are not currently available in Knowledge Context.",
    });
  }

  const prioritizedQuestions =
    questions
      .sort(
        (
          left,
          right,
        ) =>
          right.importance -
          left.importance,
      )
      .slice(
        0,
        MAX_QUESTIONS,
      );

  const primaryQuestion =
    prioritizedQuestions[0];

  const unresolvedCount =
    prioritizedQuestions.filter(
      (question) =>
        question.blockingDecision,
    ).length;

  const primaryTension =
    getPrimaryTension(
      context,
    );

  return {
    questions:
      prioritizedQuestions,

    primaryQuestion,

    primaryTension,

    uncertainty:
      round(
        uncertainty,
      ),

    unresolvedCount,

    summary:
      `Generated ${prioritizedQuestions.length} prioritized executive questions. The primary reasoning tension is ${primaryTension}. ${unresolvedCount} question${unresolvedCount === 1 ? "" : "s"} may block a high-confidence decision.`,

    generatedAt:
      new Date().toISOString(),
  };
}