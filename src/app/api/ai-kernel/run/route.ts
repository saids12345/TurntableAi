import { NextResponse } from "next/server";
import { getSupabaseRouteClient } from "@/lib/supabaseRoute";
import { runAIKernel } from "@/lib/aiKernel";
import type { PlanningHorizon } from "@/lib/planningEngine";
import type { PredictionHorizon } from "@/lib/predictionEngine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getPlanningHorizon(value: string | null): PlanningHorizon {
  if (value === "today") return "today";
  if (value === "next_24_hours") return "next_24_hours";
  return "next_7_days";
}

function getPredictionHorizon(value: string | null): PredictionHorizon {
  if (value === "next_24_hours") return "next_24_hours";
  if (value === "next_7_days") return "next_7_days";
  return "next_14_days";
}

function getLookbackDays(value: string | null) {
  if (!value) return 45;

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) return 45;

  return Math.min(365, Math.max(7, Math.round(parsed)));
}

export async function GET(request: Request) {
  try {
    const supabase = await getSupabaseRouteClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      return NextResponse.json(
        {
          error: `Authentication failed: ${authError.message}`,
        },
        { status: 401 },
      );
    }

    if (!user) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        { status: 401 },
      );
    }

    const url = new URL(request.url);

const actionId =
  url.searchParams
    .get("actionId")
    ?.trim() || null;

const requestedLocationName =
  url.searchParams
    .get("location")
    ?.trim() || null;

const lookbackDays = getLookbackDays(
  url.searchParams.get("lookbackDays"),
);

const planningHorizon =
  getPlanningHorizon(
    url.searchParams.get(
      "planningHorizon",
    ),
  );

  const predictionHorizon =
  getPredictionHorizon(
    url.searchParams.get(
      "predictionHorizon",
    ),
  );

/*
 * Development-only counterfactual memory diagnostic.
 *
 * Local development may explicitly exclude Operator Memory
 * from Cognitive Brain reasoning so we can compare the same
 * restaurant situation with and without learned experience.
 *
 * Production always uses normal memory behavior.
 */
const requestedMemoryMode =
  url.searchParams
    .get("memoryMode")
    ?.trim()
    .toLowerCase();

const memoryMode:
  "normal" | "excluded" =
  process.env.NODE_ENV !== "production" &&
  requestedMemoryMode === "excluded"
    ? "excluded"
    : "normal";

    const forceProvenanceFailure =
  process.env.NODE_ENV !== "production" &&
  url.searchParams.get(
    "forceProvenanceFailure",
  ) === "true";

/*
 * Resolve the Brain's real operating location.
 *
 * When a specific Auto Action starts a Brain run,
 * that action becomes the source of truth for the
 * restaurant location.
 *
 * This prevents an action from one restaurant from
 * accidentally producing reasoning or a workflow
 * for another restaurant.
 */
let effectiveLocationName =
  requestedLocationName;

if (actionId) {
  const {
    data: sourceAction,
    error: sourceActionError,
  } = await supabase
    .from("auto_actions")
    .select(
      "id, location_name",
    )
    .eq(
      "id",
      actionId,
    )
    .eq(
      "user_id",
      user.id,
    )
    .single();

  if (
    sourceActionError ||
    !sourceAction
  ) {
    console.error(
      "ai-kernel/run source action lookup error:",
      sourceActionError,
    );

    return NextResponse.json(
      {
        error:
          "The source Auto Action could not be found.",
      },
      {
        status: 404,
      },
    );
  }

  const sourceActionLocation =
    typeof sourceAction.location_name ===
      "string" &&
    sourceAction.location_name.trim()
      ? sourceAction.location_name.trim()
      : null;

  if (!sourceActionLocation) {
    return NextResponse.json(
      {
        error:
          "The source Auto Action does not have a restaurant location.",
      },
      {
        status: 422,
      },
    );
  }

  /*
   * If somebody explicitly supplies both an action
   * and a different restaurant, fail safely instead
   * of mixing two restaurant contexts.
   */
  if (
    requestedLocationName &&
    requestedLocationName.toLowerCase() !==
      sourceActionLocation.toLowerCase()
  ) {
    return NextResponse.json(
      {
        error:
          "The requested restaurant does not match the source Auto Action.",
        requestedLocationName,
        sourceActionLocation,
      },
      {
        status: 400,
      },
    );
  }

  effectiveLocationName =
    sourceActionLocation;
}

const kernel = await runAIKernel({
  userId: user.id,
  actionId,

  locationName:
    effectiveLocationName,

  lookbackDays,
  planningHorizon,
  predictionHorizon,
  memoryMode,
  forceProvenanceFailure,
});

    return NextResponse.json({
      ok: true,
      kernel,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("ai-kernel/run error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `AI Kernel failed: ${error.message}`
            : "AI Kernel failed",
      },
      { status: 500 },
    );
  }
}