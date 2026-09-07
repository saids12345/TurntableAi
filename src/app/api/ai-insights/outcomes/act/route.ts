import { NextResponse } from "next/server";
import { getSupabaseRouteClient } from "@/lib/supabaseRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ActBody = {
  dedupeKey: string;
  actionNote?: string;
};

export async function POST(req: Request) {
  try {
    const supabase = await getSupabaseRouteClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as ActBody;
    const dedupeKey = String(body?.dedupeKey ?? "").trim();

    if (!dedupeKey) {
      return NextResponse.json({ error: "Missing dedupeKey" }, { status: 400 });
    }

    const { data: existing, error: existingError } = await supabase
      .from("ai_insight_outcomes")
      .select("id, action_status")
      .eq("user_id", user.id)
      .eq("dedupe_key", dedupeKey)
      .maybeSingle();

    if (existingError) {
      console.error("ai-insights/outcomes/act existing error:", existingError);
      return NextResponse.json({ error: "Failed to load outcome" }, { status: 500 });
    }

    if (!existing?.id) {
      return NextResponse.json({ error: "Outcome not found" }, { status: 404 });
    }

    const { error: updateError } = await supabase
      .from("ai_insight_outcomes")
      .update({
        action_status: "acted",
        action_note: body.actionNote?.trim() || "",
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (updateError) {
      console.error("ai-insights/outcomes/act update error:", updateError);
      return NextResponse.json({ error: "Failed to mark outcome as acted" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      dedupeKey,
      actionStatus: "acted",
    });
  } catch (error) {
    console.error("ai-insights/outcomes/act unexpected error:", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}