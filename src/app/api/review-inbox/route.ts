// src/app/api/review-inbox/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseRouteClient } from "@/lib/supabaseRoute";
import { requireProForApi } from "@/lib/requirePro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReviewInboxItem = {
  id: string;
  platform: string; // "Google" | "Yelp" | etc.
  reviewerName: string | null;
  rating: number | null;
  reviewText: string;
  sourceUrl: string | null;
  reviewCreatedAt: string | null; // ISO timestamp
};

/**
 * GET /api/review-inbox
 *
 * Query params:
 *   platform = "Google" | "Yelp" | "all" (optional)
 *   q        = free-text search in review_text (optional)
 *   limit    = max rows (1–50, default 20)
 */
export async function GET(req: NextRequest) {
  // 🔒 Pro lock (trial or paid). Prevents bypassing the UI.
  await requireProForApi();

  try {
    const supabase = await getSupabaseRouteClient();

    // 1) Make sure user is signed in
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("review-inbox auth error", authError);
    }

    if (!user) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    // 2) Read filters from query string
    const { searchParams } = new URL(req.url);
    const platformRaw = searchParams.get("platform"); // "Google" | "Yelp" | "all" | null
    const qRaw = searchParams.get("q");
    const limitParam = searchParams.get("limit");

    const platform = platformRaw?.trim() || null;
    const q = qRaw?.trim() || null;

    const parsedLimit = Number(limitParam);
    const limit =
      Number.isFinite(parsedLimit) && parsedLimit > 0
        ? Math.min(50, Math.max(1, parsedLimit))
        : 20;

    // 3) Build Supabase query
    let query = supabase
      .from("review_inbox")
      .select(
        "id, platform, reviewer_name, rating, review_text, source_url, review_created_at"
      )
      .eq("user_id", user.id)
      .order("review_created_at", { ascending: false })
      .limit(limit);

    if (platform && platform.toLowerCase() !== "all") {
      query = query.eq("platform", platform);
    }

    if (q) {
      // simple ILIKE search in the review text
      query = query.ilike("review_text", `%${q}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error("review-inbox query error", error);
      return NextResponse.json({ error: "Failed to load reviews" }, { status: 500 });
    }

    const items: ReviewInboxItem[] =
      data?.map((row: any) => ({
        id: row.id,
        platform: row.platform,
        reviewerName: row.reviewer_name ?? null,
        rating:
          typeof row.rating === "number"
            ? row.rating
            : row.rating != null
            ? Number(row.rating)
            : null,
        reviewText: row.review_text ?? "",
        sourceUrl: row.source_url ?? null,
        reviewCreatedAt: row.review_created_at,
      })) ?? [];

    return NextResponse.json({ items });
  } catch (err) {
    console.error("review-inbox unexpected error", err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
