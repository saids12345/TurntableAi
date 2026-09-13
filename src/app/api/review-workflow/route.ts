import { NextRequest, NextResponse } from "next/server";
import { getSupabaseRouteClient } from "@/lib/supabaseRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReviewWorkflowStatus = "new" | "drafted" | "escalated" | "resolved";

const ALLOWED_STATUSES: ReviewWorkflowStatus[] = [
  "new",
  "drafted",
  "escalated",
  "resolved",
];

type ReviewWorkflowRow = {
  id: string;
  user_id: string;
  review_id: string;
  status: ReviewWorkflowStatus;
  note: string;
  suggested_reply: string;
  created_at: string;
  updated_at: string;
};

function normalizeStatus(value: unknown): ReviewWorkflowStatus {
  if (typeof value === "string" && ALLOWED_STATUSES.includes(value as ReviewWorkflowStatus)) {
    return value as ReviewWorkflowStatus;
  }
  return "new";
}

export async function GET() {
  try {
    const supabase = await getSupabaseRouteClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("review_workflow_states") // ✅ FIXED TABLE NAME
      .select(
        "id, user_id, review_id, status, note, suggested_reply, created_at, updated_at"
      )
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("review-workflow GET error:", error);
      return NextResponse.json(
        { error: "Failed to load review workflow state" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      items: (data ?? []) as ReviewWorkflowRow[],
      generatedAt: new Date().toISOString(),
      source: "supabase",
    });
  } catch (error) {
    console.error("review-workflow GET unexpected error:", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseRouteClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      reviewId?: string;
      status?: ReviewWorkflowStatus;
      note?: string;
      suggestedReply?: string;
    };

    const reviewId =
      typeof body.reviewId === "string" ? body.reviewId.trim() : "";

    if (!reviewId) {
      return NextResponse.json(
        { error: "reviewId is required" },
        { status: 400 }
      );
    }

    const payload = {
      user_id: user.id,
      review_id: reviewId,
      status: normalizeStatus(body.status),
      note: typeof body.note === "string" ? body.note : "",
      suggested_reply:
        typeof body.suggestedReply === "string" ? body.suggestedReply : "",
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("review_workflow_states") // ✅ FIXED TABLE NAME
      .upsert(payload, {
        onConflict: "user_id,review_id",
      })
      .select(
        "id, user_id, review_id, status, note, suggested_reply, created_at, updated_at"
      )
      .single();

    if (error) {
      console.error("review-workflow POST error:", error);
      return NextResponse.json(
        { error: "Failed to save review workflow state" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      item: data as ReviewWorkflowRow,
      ok: true,
      savedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("review-workflow POST unexpected error:", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}