import { NextResponse } from "next/server";
import { getSupabaseRouteClient } from "@/lib/supabaseRoute";
import { getRestaurantStates } from "@/lib/restaurantState";
import { buildNetworkWorldModel } from "@/lib/worldModel";

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
    }));

    const worldModel = buildNetworkWorldModel(contexts);

    return NextResponse.json({
      ok: true,
      mode: contexts.length === 1 ? "single_location" : "network",
      restaurantStates: states,
      worldModel,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("world-model/run error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `World model failed: ${error.message}`
            : "World model failed",
      },
      { status: 500 },
    );
  }
}