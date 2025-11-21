// src/app/api/generate-social/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

/**
 * Fetch the saved Brand Voice style_guide for the logged-in user.
 * Returns null if none is set (we'll fall back to a neutral prompt).
 */
async function getStyleGuide(): Promise<string | null> {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("user_voice_profiles")
    .select("style_guide")
    .eq("user_id", user.id)
    .single();

  return data?.style_guide || null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
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

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Please describe what you want." }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });

    // Pull the user's saved Brand Voice (if any)
    const styleGuide = await getStyleGuide();

    const lengthHints: Record<string, string> = {
      short: "Keep captions <= 80 words.",
      medium: "Keep captions <= 140 words.",
      long: "Keep captions <= 220 words.",
    };

    // System prompt now includes the style guide if it exists
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
Request: ${prompt}

Mode: ${mode} (one of captions | reels | both)
Output exactly 3 variants. For each:
- Start with "### Variant X"
- If mode is "captions" -> only caption + hashtags.
- If mode is "reels" -> Hook, Shot list, and a short caption line with hashtags.
- If mode is "both" -> Hook, Shot list, AND a caption.
- Include a natural CTA (visit, order, DM, link in bio).
- Never exceed Instagram's 2,200 character limit.`.trim();

    const resp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
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

    const text =
      data.output_text ??
      (Array.isArray(data.output)
        ? data.output
            .map((o: any) =>
              Array.isArray(o.content) ? o.content.map((c: any) => c.text).join("\n") : ""
            )
            .join("\n")
        : "");

    return NextResponse.json({ output: text });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}

