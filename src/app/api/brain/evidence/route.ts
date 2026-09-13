import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { runAIKernel } from "@/lib/aiKernel";
import { getSupabaseRouteClient } from "@/lib/supabaseRoute";
import {
  buildProvisionalMemoryEvidence,
} from "@/lib/operatorMemoryTrust";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EVIDENCE_SOURCES = [
  "operator",
  "pos",
  "reviews",
  "labor",
  "inventory",
  "reservations",
  "other",
] as const;

type EvidenceSource =
  (typeof EVIDENCE_SOURCES)[number];

type EvidenceContext = {
  workflowId?: string | null;
  decisionMode?: string | null;
  primaryHypothesis?: string | null;
  recommendation?: string | null;
  previousKernelGeneratedAt?: string | null;
};

type EvidenceRequestBody = {
  question?: unknown;
  source?: unknown;
  value?: unknown;
  confidence?: unknown;
  observedAt?: unknown;
  locationName?: unknown;
  notes?: unknown;
  context?: unknown;
};

type EvidenceHistoryItem = {
  id: string;
  question: string;
  source: EvidenceSource;
  value: string;
  confidence: number;
  observedAt: string;
  submittedAt: string;
  locationName: string | null;
  notes: string | null;
  context: EvidenceContext;
};

type ExistingMemoryRow = {
  id: string;
  evidence:
    | Record<string, unknown>
    | null;
};

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function cleanText(
  value: unknown,
  maxLength: number,
) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanOptionalText(
  value: unknown,
  maxLength: number,
) {
  const cleaned = cleanText(
    value,
    maxLength,
  );

  return cleaned || null;
}

function clamp(
  value: number,
  min = 0,
  max = 100,
) {
  return Math.min(
    max,
    Math.max(min, value),
  );
}

function normalizeConfidence(
  value: unknown,
) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(parsed)) {
    return 50;
  }

  return Math.round(
    clamp(parsed),
  );
}

function memoryConfidence(
  confidence: number,
): "low" | "medium" | "high" {
  if (confidence >= 80) {
    return "high";
  }

  if (confidence >= 55) {
    return "medium";
  }

  return "low";
}

function normalizeSource(
  value: unknown,
): EvidenceSource | null {
  if (
    typeof value !== "string"
  ) {
    return null;
  }

  return EVIDENCE_SOURCES.includes(
    value as EvidenceSource,
  )
    ? (value as EvidenceSource)
    : null;
}

function normalizeObservedAt(
  value: unknown,
) {
  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const date = new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    return null;
  }

  return date.toISOString();
}

function normalizeContext(
  value: unknown,
): EvidenceContext {
  if (!isRecord(value)) {
    return {};
  }

  return {
    workflowId:
      cleanOptionalText(
        value.workflowId,
        200,
      ),

    decisionMode:
      cleanOptionalText(
        value.decisionMode,
        100,
      ),

    primaryHypothesis:
      cleanOptionalText(
        value.primaryHypothesis,
        1_000,
      ),

    recommendation:
      cleanOptionalText(
        value.recommendation,
        1_000,
      ),

    previousKernelGeneratedAt:
      cleanOptionalText(
        value.previousKernelGeneratedAt,
        100,
      ),
  };
}

function hashText(
  value: string,
) {
  let hash = 5381;

  for (
    let index = 0;
    index < value.length;
    index += 1
  ) {
    hash =
      (hash * 33) ^
      value.charCodeAt(index);
  }

  return (
    hash >>> 0
  ).toString(36);
}

function actionTypeForQuestion(
  question: string,
) {
  return `operator_evidence_${hashText(
    question.toLowerCase(),
  )}`;
}

function getEvidenceHistory(
  evidence:
    | Record<string, unknown>
    | null,
): EvidenceHistoryItem[] {
  if (
    !evidence ||
    !Array.isArray(evidence.history)
  ) {
    return [];
  }

  return evidence.history.filter(
    (
      item,
    ): item is EvidenceHistoryItem =>
      isRecord(item) &&
      typeof item.id === "string" &&
      typeof item.question ===
        "string" &&
      typeof item.value === "string",
  );
}

export async function POST(
  request: Request,
) {
  try {
    const supabase =
      await getSupabaseRouteClient();

    const {
      data: { user },
      error: authError,
    } =
      await supabase.auth.getUser();

    if (authError) {
      return NextResponse.json(
        {
          ok: false,

          error:
            `Authentication failed: ${authError.message}`,
        },
        {
          status: 401,
        },
      );
    }

    if (!user) {
      return NextResponse.json(
        {
          ok: false,
          error: "Unauthorized",
        },
        {
          status: 401,
        },
      );
    }

    const body = (
      await request
        .json()
        .catch(() => null)
    ) as
      | EvidenceRequestBody
      | null;

    if (!body) {
      return NextResponse.json(
        {
          ok: false,

          error:
            "A valid JSON request body is required.",
        },
        {
          status: 400,
        },
      );
    }

    const question = cleanText(
      body.question,
      1_000,
    );

    const source =
      normalizeSource(body.source);

    const evidenceValue =
      cleanText(
        body.value,
        10_000,
      );

    const confidence =
      normalizeConfidence(
        body.confidence,
      );

    const observedAt =
      normalizeObservedAt(
        body.observedAt,
      );

    const locationName =
      cleanOptionalText(
        body.locationName,
        200,
      );

    const notes =
      cleanOptionalText(
        body.notes,
        5_000,
      );

    const context =
      normalizeContext(
        body.context,
      );

    if (!question) {
      return NextResponse.json(
        {
          ok: false,

          error:
            "The evidence question is required.",
        },
        {
          status: 400,
        },
      );
    }

    if (!source) {
      return NextResponse.json(
        {
          ok: false,

          error:
            "A valid evidence source is required.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      evidenceValue.length < 3
    ) {
      return NextResponse.json(
        {
          ok: false,

          error:
            "Evidence must contain at least three characters.",
        },
        {
          status: 400,
        },
      );
    }

    if (!observedAt) {
      return NextResponse.json(
        {
          ok: false,

          error:
            "A valid observation date and time is required.",
        },
        {
          status: 400,
        },
      );
    }

    const submittedAt =
      new Date().toISOString();

    const actionType =
      actionTypeForQuestion(
        question,
      );

    const {
      data: existingMemory,
      error: existingMemoryError,
    } = await supabase
      .from("operator_memory")
      .select("id, evidence")
      .eq("user_id", user.id)
      .eq(
        "problem_type",
        "evidence_gap",
      )
      .eq(
        "action_type",
        actionType,
      )
      .eq("status", "active")
      .maybeSingle();

    if (existingMemoryError) {
      console.error(
        "brain evidence memory lookup failed:",
        existingMemoryError,
      );

      return NextResponse.json(
        {
          ok: false,

          error:
            "TurnTableAI could not inspect the existing evidence record.",

          details:
            existingMemoryError.message,
        },
        {
          status: 500,
        },
      );
    }

    const existing =
      existingMemory as
        | ExistingMemoryRow
        | null;

    const previousEvidence =
      isRecord(existing?.evidence)
        ? existing.evidence
        : {};

    const history =
      getEvidenceHistory(
        previousEvidence,
      );

    const evidenceEntry:
      EvidenceHistoryItem = {
      id: randomUUID(),

      question,

      source,

      value:
        evidenceValue,

      confidence,

      observedAt,

      submittedAt,

      locationName,

      notes,

      context,
    };

    const updatedHistory = [
      ...history,
      evidenceEntry,
    ].slice(-50);

    const memoryPayload = {
      user_id:
        user.id,

      location_name:
        locationName,

      problem_type:
        "evidence_gap",

      action_type:
        actionType,

      action_title:
        question,

      result_summary:
        evidenceValue,

      lesson:
        notes ??
        `Operator-supplied ${source} evidence was recorded to resolve the current decision gap.`,

      confidence:
        memoryConfidence(
          confidence,
        ),

      status:
        "active",

      source_outcome_id:
        null,

      evidence:
  buildProvisionalMemoryEvidence(
    {
      ...previousEvidence,

      source:
        "brain_evidence_review",

      question,

      latest:
        evidenceEntry,

      history:
        updatedHistory,

      submissionCount:
        updatedHistory.length,

      lastSubmittedAt:
        submittedAt,

      workflowId:
        context.workflowId ??
        null,

      decisionMode:
        context.decisionMode ??
        null,

      primaryHypothesis:
        context.primaryHypothesis ??
        null,

      recommendation:
        context.recommendation ??
        null,

      previousKernelGeneratedAt:
        context.previousKernelGeneratedAt ??
        null,
    },

    "Brain evidence submissions are factual observations, not verified action outcomes. They remain provisional until Decision Outcome Verification measures an executed action.",
  ),

      updated_at:
        submittedAt,
    };

    let savedMemory:
      | Record<string, unknown>
      | null = null;

    if (existing?.id) {
      const {
        data,
        error,
      } = await supabase
        .from("operator_memory")
        .update(memoryPayload)
        .eq(
          "id",
          existing.id,
        )
        .eq(
          "user_id",
          user.id,
        )
        .select(
          "id, user_id, location_name, problem_type, action_type, action_title, result_summary, lesson, confidence, status, evidence, created_at, updated_at",
        )
        .single();

      if (error) {
        console.error(
          "brain evidence memory update failed:",
          error,
        );

        return NextResponse.json(
          {
            ok: false,

            error:
              "TurnTableAI could not update the evidence record.",

            details:
              error.message,
          },
          {
            status: 500,
          },
        );
      }

      savedMemory =
        data as Record<
          string,
          unknown
        >;
    } else {
      const {
        data,
        error,
      } = await supabase
        .from("operator_memory")
        .insert(memoryPayload)
        .select(
          "id, user_id, location_name, problem_type, action_type, action_title, result_summary, lesson, confidence, status, evidence, created_at, updated_at",
        )
        .single();

      if (error) {
        console.error(
          "brain evidence memory insert failed:",
          error,
        );

        return NextResponse.json(
          {
            ok: false,

            error:
              "TurnTableAI could not save the evidence record.",

            details:
              error.message,
          },
          {
            status: 500,
          },
        );
      }

      savedMemory =
        data as Record<
          string,
          unknown
        >;
    }

    /*
     * The evidence is persisted before the Kernel runs.
     * This allows the new cognitive cycle to load the
     * latest Operator Memory state.
     */
    const kernel =
      await runAIKernel({
        userId:
          user.id,

        locationName,
      });

    return NextResponse.json({
      ok: true,

      kernel,

      evidence: {
        id:
          evidenceEntry.id,

        savedMemoryId:
          typeof savedMemory?.id ===
          "string"
            ? savedMemory.id
            : null,

        source,

        question,

        confidence,

        observedAt,

        submittedAt,

        locationName,

        submissionCount:
          updatedHistory.length,
      },

      message:
        "Evidence saved and Cognitive Brain rerun completed.",

      generatedAt:
        new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "brain evidence POST unexpected error:",
      error,
    );

    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : "TurnTableAI could not save the evidence or rerun the Brain.",
      },
      {
        status: 500,
      },
    );
  }
}