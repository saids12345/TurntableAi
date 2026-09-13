// src/app/api/generate-social/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { requireProForApi } from "@/lib/requirePro";
import { getSupabaseRouteClient } from "@/lib/supabaseRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Fetch the saved Brand Voice style_guide for the logged-in user.
 * Returns null if none is set (we'll fall back to a neutral prompt).
 *
 * NOTE: Uses the same table as /api/voice-profile: "voice_profiles".
 */
async function getStyleGuide(): Promise<string | null> {
  const supabase = await getSupabaseRouteClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return null;

  const { data, error } = await supabase
    .from("voice_profiles")
    .select("style_guide")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("generate-social getStyleGuide error:", error);
    return null;
  }

  return (data?.style_guide ?? null) as string | null;
}

export async function POST(req: NextRequest) {
  // 🔒 Pro lock (trial or paid). Prevents bypassing the UI.
  await requireProForApi();

  try {
    const body = (await req.json().catch(() => ({}))) as any;

    const {
      prompt,
      mode = "both",
      tone = "Friendly",
      platform = "Instagram",
      city = "San Diego",
      length = "medium",
      brand = "",
      cuisine = "",
      special = "",
      language = "English",
    } = body ?? {};

    const cleanPrompt = typeof prompt === "string" ? prompt.trim() : "";

    if (!cleanPrompt) {
      return NextResponse.json(
        { error: "Please describe what you want." },
        { status: 400 }
      );
    }

    // simple guard so someone doesn’t paste a book
    if (cleanPrompt.length > 3000) {
      return NextResponse.json(
        { error: "Prompt is too long (max ~3000 characters)." },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
    }

    // Pull the user's saved Brand Voice (if any)
    const styleGuide = await getStyleGuide();

    const lengthHints: Record<string, string> = {
      short: "Keep captions <= 80 words.",
      medium: "Keep captions <= 140 words.",
      long: "Keep captions <= 220 words.",
    };

    const sys = `
You are an expert social media marketer for small restaurants and coffee shops.
Write the entire output in ${language}. If input language differs, prefer ${language}.
- Write ${platform} content with a ${tone} tone.
- Always make it brand-safe and conversion-minded.
- Localize hashtags to "${city}" (5–9 per variant, mix broad + local).
- Use clean formatting, no markdown headings except "### Variant 1/2/3".
- When giving Reel ideas, include: Hook (<= 8 words), Shot list (3–5 quick cuts).
- ${lengthHints[length] ?? ""}
${styleGuide ? `\n=== BRAND VOICE STYLE GUIDE ===\n${styleGuide}\n=== END STYLE GUIDE ===\n` : ""}
`.trim();

    const user = `
Business: ${brand || "N/A"}
Cuisine: ${cuisine || "N/A"}
Special/Promo: ${special || "N/A"}
Request: ${cleanPrompt}

Mode: ${mode} (one of captions | reels | both)
Output exactly 3 variants. For each:
- Start with "### Variant X"
- If mode is "captions" -> only caption + hashtags.
- If mode is "reels" -> Hook, Shot list, and a short caption line with hashtags.
- If mode is "both" -> Hook, Shot list, AND a caption.
- Include a natural CTA (visit, order, DM, link in bio).
- Never exceed Instagram's 2,200 character limit.
`.trim();

    const resp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return NextResponse.json({ error: text }, { status: 500 });
    }

    const data = await resp.json();

    const text: string =
      data.output_text ??
      (Array.isArray(data.output)
        ? data.output
            .map((o: any) =>
              Array.isArray(o.content)
                ? o.content.map((c: any) => c.text).join("\n")
                : ""
            )
            .join("\n")
        : "");

    return NextResponse.json({ output: text });
  } catch (err: unknown) {
  if (err instanceof Response) {
    return err;
  }

  console.error("generate-social error:", err);

  return NextResponse.json(
    {
      error:
        err instanceof Error
          ? err.message
          : "Server error",
    },
    { status: 500 }
  );
}
}
