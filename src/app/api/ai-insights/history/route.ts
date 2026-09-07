import { NextRequest, NextResponse } from "next/server";
import { getSupabaseRouteClient } from "@/lib/supabaseRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type InsightSeverity = "low" | "medium" | "high";
type InsightType = "reputation" | "revenue" | "ops" | "growth";

type InsightItem = {
  id: string;
  type: InsightType;
  severity: InsightSeverity;
  title: string;
  summary: string;
  reason: string;
  recommendedAction: string;
  expectedImpact: string;
  href: string;
  cta: string;
};

type InsightSnapshotPayload = {
  generatedAt: string;
  source: "openai" | "fallback";
  signalSource?: "live" | "fallback";
  insights: InsightItem[];
  locationsAnalyzed?: number;
};

export async function GET(req: NextRequest) {
  try {
    const supabase = await getSupabaseRouteClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limitParam = Number(new URL(req.url).searchParams.get("limit"));
    const limit =
      Number.isFinite(limitParam) && limitParam > 0
        ? Math.min(20, Math.max(1, limitParam))
        : 6;

    const { data, error } = await supabase
      .from("ai_insight_history")
      .select("id, source, signal_source, locations_analyzed, insight_count, payload, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("ai-insights/history GET error:", error);
      return NextResponse.json({ error: "Failed to load insight history" }, { status: 500 });
    }

    return NextResponse.json({
      items: data ?? [],
    });
  } catch (error) {
    console.error("ai-insights/history GET unexpected error:", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await getSupabaseRouteClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as InsightSnapshotPayload;

    if (!body || !Array.isArray(body.insights)) {
      return NextResponse.json({ error: "Invalid insight payload" }, { status: 400 });
    }

    const payload: InsightSnapshotPayload = {
      generatedAt: typeof body.generatedAt === "string" ? body.generatedAt : new Date().toISOString(),
      source: body.source === "openai" ? "openai" : "fallback",
      signalSource: body.signalSource === "live" ? "live" : "fallback",
      locationsAnalyzed:
        typeof body.locationsAnalyzed === "number" && Number.isFinite(body.locationsAnalyzed)
          ? body.locationsAnalyzed
          : 0,
      insights: body.insights.slice(0, 6),
    };

    const { error } = await supabase.from("ai_insight_history").insert({
      user_id: user.id,
      source: payload.source,
      signal_source: payload.signalSource,
      locations_analyzed: payload.locationsAnalyzed,
      insight_count: payload.insights.length,
      payload,
    });

    if (error) {
      console.error("ai-insights/history POST error:", error);
      return NextResponse.json({ error: "Failed to save insight snapshot" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("ai-insights/history POST unexpected error:", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}