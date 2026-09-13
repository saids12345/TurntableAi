import { NextResponse } from "next/server";
import { getSupabaseRouteClient } from "@/lib/supabaseRoute";
import { getRestaurantStates } from "@/lib/restaurantState";
import { createNetworkPlanningResult, createPlanningResult } from "@/lib/planningEngine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const supabase = await getSupabaseRouteClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      return NextResponse.json(
        { error: `Authentication failed: ${authError.message}` },
        { status: 401 },
      );
    }

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const locationName = url.searchParams.get("location");
    const horizon =
      url.searchParams.get("horizon") === "today"
        ? "today"
        : url.searchParams.get("horizon") === "next_24_hours"
          ? "next_24_hours"
          : "next_7_days";

    const states = await getRestaurantStates({
      userId: user.id,
      locationName,
      lookbackDays: 45,
    });

    const contexts = states.map((state) => ({
      locationName: state.locationName,
      health: state.level,
      scores: state.scores,
      revenue: state.metrics.revenue,
      orders: state.metrics.orders,
      refunds: state.metrics.refunds,
      avgRating: state.metrics.avgRating,
      reviewIssueCount: state.metrics.reviewIssueCount,
      laborPct: state.metrics.laborPct,
      marginPct: state.metrics.marginPct,
      openAlerts: state.metrics.openAlerts,
      topIssue: state.primaryRisk,
      operatorMemoryLessons: state.metrics.memoryLessons,
      averageOutcomeScore: state.metrics.avgOutcomeScore,
      reusableLessons: state.metrics.reusableLessons,
    }));

    if (contexts.length === 1) {
      const plan = createPlanningResult({
        context: contexts[0],
        horizon,
      });

      return NextResponse.json({
        ok: true,
        mode: "single_location",
        restaurantState: states[0],
        planning: plan,
        generatedAt: new Date().toISOString(),
      });
    }

    const networkPlan = createNetworkPlanningResult({
      contexts,
      horizon,
    });

    return NextResponse.json({
      ok: true,
      mode: "network",
      restaurantStates: states,
      planning: networkPlan,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("planning-engine/run error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `Planning engine failed: ${error.message}`
            : "Planning engine failed",
      },
      { status: 500 },
    );
  }
}