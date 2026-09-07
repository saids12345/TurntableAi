import { NextResponse } from "next/server";
import { getSupabaseRouteClient } from "@/lib/supabaseRoute";
import { buildExecutiveAI } from "@/lib/executiveAI";
import { buildExecutionPlan } from "@/lib/executionEngine";
import { getRestaurantStates } from "@/lib/restaurantState";
import { createNetworkPlanningResult, createPlanningResult } from "@/lib/planningEngine";
import { analyzeNetworkCausality, analyzeSingleRestaurantCausality } from "@/lib/causalEngine";
import { predictNetworkFuture, predictRestaurantFuture } from "@/lib/predictionEngine";
import { buildNetworkWorldModel } from "@/lib/worldModel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getTopWorldSignal(worldModel: any) {
  return worldModel?.topSignal?.signal
    ? {
        ...worldModel.topSignal.signal,
        locationName: worldModel.topSignal.locationName ?? null,
      }
    : null;
}

export async function GET(request: Request) {
  try {
    const supabase = await getSupabaseRouteClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 401 });
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

    const planning =
      contexts.length === 1
        ? createPlanningResult({ context: contexts[0], horizon: "next_7_days" })
        : createNetworkPlanningResult({ contexts, horizon: "next_7_days" });

    const causalAnalysis =
      contexts.length === 1
        ? analyzeSingleRestaurantCausality(contexts[0])
        : analyzeNetworkCausality(contexts);

    const prediction =
      contexts.length === 1
        ? predictRestaurantFuture({ context: contexts[0], horizon: "next_14_days" })
        : predictNetworkFuture({ contexts, horizon: "next_14_days" });

    const worldModel = buildNetworkWorldModel(
      states.map((state) => ({
        locationName: state.locationName,
        revenue: state.metrics.revenue,
        orders: state.metrics.orders,
        refunds: state.metrics.refunds,
        avgRating: state.metrics.avgRating,
        laborPct: state.metrics.laborPct,
        marginPct: state.metrics.marginPct,
        demandScore: state.scores.demand,
        operationsScore: state.scores.operations,
        staffingScore: state.scores.staffing,
        serviceScore: state.scores.service,
        profitabilityScore: state.scores.profitability,
        reputationScore: state.scores.reputation,
      })),
    );

    const executiveAI = buildExecutiveAI({
      mode: contexts.length === 1 ? "single_location" : "network",
      planningSummary: planning.summary ?? null,
      topMove: planning.topMove ?? null,
      causalSummary: causalAnalysis.summary ?? null,
      topCause: causalAnalysis.topHypothesis ?? null,
      predictionSummary: prediction.summary ?? null,
      topPrediction: prediction.topPrediction ?? null,
      worldSummary: worldModel.summary ?? null,
      topWorldSignal: getTopWorldSignal(worldModel),
    });

    const executionPlan = buildExecutionPlan({ executiveAI });

    return NextResponse.json({
      ok: true,
      mode: contexts.length === 1 ? "single_location" : "network",
      executionPlan,
      executiveAI,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("execution-engine/run error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `Execution Engine failed: ${error.message}`
            : "Execution Engine failed",
      },
      { status: 500 },
    );
  }
}