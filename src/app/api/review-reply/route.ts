// src/app/api/review-reply/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getSupabaseRouteClient } from "@/lib/supabaseRoute";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/** Normalize Responses API output into plain text */
function extractText(resp: any): string {
  const direct = resp?.output_text;
  if (typeof direct === "string" && direct.trim()) return direct.trim();

  const content = resp?.output?.[0]?.content ?? [];
  const node =
    content.find((p: any) => typeof p?.text === "string") ??
    content.find((p: any) => typeof p?.output_text === "string");

  const text = node?.text ?? node?.output_text;
  return typeof text === "string" ? text.trim() : "";
}

type VariantFlavor =
  | "base"
  | "warmer"
  | "shorter"
  | "more_professional";

/** Build the system/prompt text for reply generation */
function buildReplyPrompt(params: {
  reviewText: string;
  rating?: number | null;
  platform?: string | null;
  tone?: string | null;
  business?: string | null;
  city?: string | null;
  length?: "short" | "medium" | "long" | string | null;
  policy_apologize?: boolean | null;
  policy_no_admission?: boolean | null;
  policy_offer_remedy_if_low?: boolean | null;
  language?: string | null;
  styleGuide?: string | null;
  variantFlavor?: VariantFlavor;
}) {
  const {
    reviewText,
    rating,
    platform,
    tone,
    business,
    city,
    length,
    policy_apologize,
    policy_no_admission,
    policy_offer_remedy_if_low,
    language,
    styleGuide,
    variantFlavor = "base",
  } = params;

  const lenHint =
    (length || "medium") === "short"
      ? "Aim for 1–2 concise sentences."
      : (length || "medium") === "long"
      ? "You may use 3–5 sentences if helpful."
      : "Aim for 2–3 sentences.";

  const guardrails = [
    policy_apologize ? "Apologize politely if needed." : null,
    policy_no_admission ? "Do not admit fault or liability." : null,
    policy_offer_remedy_if_low
      ? "If the rating is low or there is a clear issue, offer a concrete remedy or invite them to DM/email to make it right."
      : null,
    "Stay brand-safe and friendly. No sarcasm. Avoid sounding defensive.",
  ]
    .filter(Boolean)
    .join(" ");

  let variantInstructions = "";
  switch (variantFlavor) {
    case "warmer":
      variantInstructions =
        "Lean extra warm and human. Show sincere appreciation and empathy while staying concise.";
      break;
    case "shorter":
      variantInstructions =
        "Keep the reply very short and direct (1–2 concise sentences). Do not repeat the entire complaint.";
      break;
    case "more_professional":
      variantInstructions =
        "Use a more formal, polished tone suitable for a fine-dining or corporate brand.";
      break;
    case "base":
    default:
      // no extra instructions
      break;
  }

  const sg = styleGuide
    ? `\n\nBrand Voice Style Guide (follow closely):\n${styleGuide}\n`
    : "";

  return `
You are a professional community manager for a local café${
    business ? ` called "${business}"` : ""
  }${city ? ` in ${city}` : ""}. You will write a polished, brand-safe reply to a customer ${
    platform || "review"
  }.

Constraints:
- ${lenHint}
- Reply in ${language || "English"} and a ${
    tone || "friendly, appreciative"
  } tone.
- ${guardrails}
- ${variantInstructions || "Keep it clear, human, and easy to paste as a reply."}
${sg}

Customer review (rating: ${rating ?? "n/a"}, platform: ${
    platform || "n/a"
  }):
"""
${reviewText}
"""

Now write the reply only (no preface, no quotes).
`.trim();
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any));

  // Basic input check
  const reviewText = String(body?.reviewText ?? "").trim();
  if (!reviewText) {
    return NextResponse.json(
      { error: "Please provide the review text." },
      { status: 400 }
    );
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
    // If auth fails for any reason, we just proceed without a style guide
  }

  // Normalise / validate variant flavor (fallback to base)
  const rawVariant = String(body?.variantFlavor ?? "base");
  const allowedVariants: VariantFlavor[] = [
    "base",
    "warmer",
    "shorter",
    "more_professional",
  ];
  const variantFlavor = allowedVariants.includes(
    rawVariant as VariantFlavor
  )
    ? (rawVariant as VariantFlavor)
    : "base";

  const prompt = buildReplyPrompt({
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
    variantFlavor,
  });

  // Call Responses API
  const ai = await openai.responses.create({
    model: "gpt-4.1-mini",
    input: prompt,
  });

  // ✅ Normalize output & avoid TS type errors
  const reply =
    extractText(ai) ||
    "Thanks so much for your feedback — we appreciate you!";

  return NextResponse.json({ reply });
}
