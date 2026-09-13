import { NextResponse } from "next/server";

import {
  runMemoryCounterfactualEvaluation,
} from "@/lib/brain/evaluation/brainEvaluationHarness";

import {
  getSupabaseRouteClient,
} from "@/lib/supabaseRoute";

import type {
  PlanningHorizon,
} from "@/lib/planningEngine";

import type {
  PredictionHorizon,
} from "@/lib/predictionEngine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Internal Brain Evaluation API
 * =============================
 *
 * Development-only endpoint used to evaluate whether
 * Operator Memory materially changes Cognitive Brain reasoning.
 *
 * This route:
 *
 * 1. authenticates the current user
 * 2. verifies source Auto Action ownership
 * 3. anchors the evaluation to the action's real restaurant
 * 4. runs Memory ON vs Memory OFF
 * 5. validates the counterfactual comparison
 * 6. reports reasoning and strategy differences
 *
 * Production access is intentionally disabled.
 */

function getPlanningHorizon(
  value: string | null,
): PlanningHorizon {
  if (value === "today") {
    return "today";
  }

  if (
    value ===
    "next_24_hours"
  ) {
    return "next_24_hours";
  }

  return "next_7_days";
}

function getPredictionHorizon(
  value: string | null,
): PredictionHorizon {
  if (
    value ===
    "next_24_hours"
  ) {
    return "next_24_hours";
  }

  if (
    value ===
    "next_7_days"
  ) {
    return "next_7_days";
  }

  return "next_14_days";
}

function getLookbackDays(
  value: string | null,
) {
  if (!value) {
    return 45;
  }

  const parsed =
    Number(value);

  if (
    !Number.isFinite(parsed)
  ) {
    return 45;
  }

  return Math.min(
    365,
    Math.max(
      7,
      Math.round(parsed),
    ),
  );
}

export async function GET(
  request: Request,
) {
  try {
    /**
     * The evaluation harness is an internal
     * TurnTableAI development tool.
     *
     * Do not expose counterfactual controls
     * through the production application.
     */
    if (
      process.env.NODE_ENV ===
      "production"
    ) {
      return NextResponse.json(
        {
          error:
            "Not found",
        },
        {
          status: 404,
        },
      );
    }

    const supabase =
      await getSupabaseRouteClient();

    const {
      data: {
        user,
      },

      error:
        authError,
    } =
      await supabase.auth.getUser();

    if (authError) {
      return NextResponse.json(
        {
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
          error:
            "Unauthorized",
        },
        {
          status: 401,
        },
      );
    }

    const url =
      new URL(request.url);

    const actionId =
      url.searchParams
        .get("actionId")
        ?.trim() ||
      null;

    const requestedLocationName =
      url.searchParams
        .get("location")
        ?.trim() ||
      null;

    const lookbackDays =
      getLookbackDays(
        url.searchParams.get(
          "lookbackDays",
        ),
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

      /**
 * Development-only provenance fault injection.
 *
 * This does not alter either Brain run.
 * It only tests whether provenance fails closed
 * when mathematical verification is forced to fail.
 */
const forceProvenanceFailure =
  url.searchParams.get(
    "forceProvenanceFailure",
  ) === "true";

    /**
     * Resolve the Brain's true restaurant
     * context before running the experiment.
     *
     * If an Auto Action starts the evaluation,
     * that action's restaurant is the source
     * of truth.
     */
    let effectiveLocationName =
      requestedLocationName;

    if (actionId) {
      const {
        data:
          sourceAction,

        error:
          sourceActionError,
      } =
        await supabase
          .from(
            "auto_actions",
          )
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
          "brain/evaluation/memory source action lookup error:",
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
        typeof sourceAction
          .location_name ===
          "string" &&
        sourceAction
          .location_name
          .trim()
          ? sourceAction
              .location_name
              .trim()
          : null;

      if (
        !sourceActionLocation
      ) {
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

      /**
       * Never allow an action belonging to
       * one restaurant to be evaluated against
       * another restaurant's context.
       */
      if (
        requestedLocationName &&
        requestedLocationName
          .toLowerCase() !==
          sourceActionLocation
            .toLowerCase()
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

    /**
     * Require an explicit restaurant context.
     *
     * This prevents an accidental evaluation
     * from silently becoming a network-wide
     * experiment.
     */
    if (
      !actionId &&
      !effectiveLocationName
    ) {
      return NextResponse.json(
        {
          error:
            "A source actionId or restaurant location is required for Brain evaluation.",
        },
        {
          status: 400,
        },
      );
    }

    const evaluation =
      await runMemoryCounterfactualEvaluation(
        {
          userId:
            user.id,

          actionId,

          locationName:
            effectiveLocationName,

          lookbackDays,

          planningHorizon,

          predictionHorizon,

          forceProvenanceFailure,
        },
      );

    return NextResponse.json(
      evaluation,
      {
        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );
  } catch (error) {
    console.error(
      "brain/evaluation/memory error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `Brain evaluation failed: ${error.message}`
            : "Brain evaluation failed.",
      },
      {
        status: 500,
      },
    );
  }
}