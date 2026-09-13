import { NextResponse } from "next/server";
import {
  evaluateRecentExecutedActions,
  MIN_OUTCOME_VERIFICATION_AGE_HOURS,
} from "@/lib/outcomeEngine";
import { getSupabaseRouteClient } from "@/lib/supabaseRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RunOutcomeEngineBody = {
  limit?: number;
  minAgeHours?: number;
  reviewWindowDays?: number;
};

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export async function GET() {
  try {
    const supabase = await getSupabaseRouteClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      return NextResponse.json(
        { error: `Authentication failed: ${authError.message}` },
        { status: 401 }
      );
    }

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await evaluateRecentExecutedActions({
      userId: user.id,
      limit: 20,
      minAgeHours:
  MIN_OUTCOME_VERIFICATION_AGE_HOURS,
      reviewWindowDays: 7,
    });

    return NextResponse.json({
      ...result,
      mode: "manual_get",
    });
  } catch (error) {
    console.error("outcome-engine/run GET unexpected error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `Unexpected error: ${error.message}`
            : "Unexpected error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await getSupabaseRouteClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      return NextResponse.json(
        { error: `Authentication failed: ${authError.message}` },
        { status: 401 }
      );
    }

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as RunOutcomeEngineBody;

    const limit = clampNumber(body.limit, 20, 1, 50);
    const minAgeHours =
  clampNumber(
    body.minAgeHours,
    MIN_OUTCOME_VERIFICATION_AGE_HOURS,
    MIN_OUTCOME_VERIFICATION_AGE_HOURS,
    24 * 30,
  );
    const reviewWindowDays = clampNumber(body.reviewWindowDays, 7, 1, 60);

    const result = await evaluateRecentExecutedActions({
      userId: user.id,
      limit,
      minAgeHours,
      reviewWindowDays,
    });

    return NextResponse.json({
      ...result,
      mode: "manual_post",
      options: {
        limit,
        minAgeHours,
        reviewWindowDays,
      },
    });
  } catch (error) {
    console.error("outcome-engine/run POST unexpected error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `Unexpected error: ${error.message}`
            : "Unexpected error",
      },
      { status: 500 }
    );
  }
}
