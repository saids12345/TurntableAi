// src/app/api/review-reply/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { generateReviewReply } from "@/lib/reviewReplyGenerator";
import { getSupabaseRouteClient } from "@/lib/supabaseRoute";
import { requireProForApi } from "@/lib/requirePro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // 🔒 Pro lock (trial or paid). Prevents bypassing the UI.
  await requireProForApi();

  const body = await req.json().catch(() => ({} as any));

  // Basic input check
  const reviewText = String(body?.reviewText ?? "").trim();
  if (!reviewText) {
    return NextResponse.json(
      { error: "Please provide the review text." },
      { status: 400 }
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
  }

  // Optional: fetch the user's saved voice style if logged in
  let styleGuide: string | null = null;
  try {
    const supabase = await getSupabaseRouteClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data } = await supabase
        .from("voice_profiles")
        .select("style_guide")
        .eq("user_id", user.id)
        .single();

      if (data?.style_guide) styleGuide = data.style_guide as string;
    }
  } catch {
    // If auth fails for any reason, proceed without a style guide
  }

  const reply = await generateReviewReply({
    reviewText,
    rating: body?.rating ?? null,
    platform: body?.platform ?? null,
    tone: body?.tone ?? null,
    business: body?.business ?? null,
    city: body?.city ?? null,
    length: body?.length ?? "medium",
    policy_apologize: body?.policy_apologize ?? true,
    policy_no_admission: body?.policy_no_admission ?? true,
    policy_offer_remedy_if_low: body?.policy_offer_remedy_if_low ?? true,
    language: body?.language ?? "English",
    styleGuide,
    variantFlavor: ((): "base" | "warmer" | "shorter" | "more_professional" => {
      const flavor = String(body?.variantFlavor ?? "base");
      if (flavor === "warmer" || flavor === "shorter" || flavor === "more_professional") {
        return flavor;
      }
      return "base";
    })(),
  });

  return NextResponse.json({ reply });
}
