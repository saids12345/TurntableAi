import { NextResponse } from "next/server";
import { getSupabaseRouteClient } from "@/lib/supabaseRoute";
import { getRestaurantStates } from "@/lib/restaurantState";
import {
  analyzeNetworkCausality,
  analyzeSingleRestaurantCausality,
} from "@/lib/causalEngine";

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

    const states = await getRestaurantStates({
      userId: user.id,
      locationName,
      lookbackDays: 45,
    });

    const contexts = states.map((state) => ({
      locationName: state.locationName,
      overallScore: state.overallScore,
      level: state.level,
      scores: state.scores,
      metrics: {
        locationName: state.locationName,
        revenue: state.metrics.revenue,
        previousRevenue: state.metrics.previousRevenue,
        revenueDeltaPct: state.metrics.revenueDeltaPct,
        orders: state.metrics.orders,
        previousOrders: state.metrics.previousOrders,
        ordersDeltaPct: state.metrics.ordersDeltaPct,
        refunds: state.metrics.refunds,
        avgRating: state.metrics.avgRating,
        reviewIssueCount: state.metrics.reviewIssueCount,
        laborPct: state.metrics.laborPct,
        marginPct: state.metrics.marginPct,
        openAlerts: state.metrics.openAlerts,
        pendingActions: state.metrics.pendingActions,
        avgOutcomeScore: state.metrics.avgOutcomeScore,
      },
      primaryRisk: state.primaryRisk,
      primaryOpportunity: state.primaryOpportunity,
    }));

    const analysis =
      contexts.length === 1
        ? analyzeSingleRestaurantCausality(contexts[0])
        : analyzeNetworkCausality(contexts);

    return NextResponse.json({
      ok: true,
      mode: contexts.length === 1 ? "single_location" : "network",
      restaurantStates: states,
      causalAnalysis: analysis,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("causal-engine/run error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `Causal engine failed: ${error.message}`
            : "Causal engine failed",
      },
      { status: 500 },
    );
  }
}