import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      reviewText,
      rating = null,
      platform = "Google",
      tone = "Friendly",
      business = "",
      city = "",
      length = "medium",
      policy_apologize = true,
      policy_no_admission = true,
      policy_offer_remedy_if_low = true,
      language = "English",
    } = body ?? {};

    if (!reviewText || typeof reviewText !== "string") {
      return NextResponse.json({ error: "Please provide the review text." }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });

    const lengthHint =
      length === "short" ? "Aim ≤ 60 words." : length === "medium" ? "Aim ≤ 120 words." : "Aim ≤ 180 words.";

    const policyLines = [
      policy_apologize ? "Offer a brief apology if anything went wrong." : "",
      policy_no_admission ? "Avoid legal admissions of fault; keep language careful and professional." : "",
      policy_offer_remedy_if_low
        ? "If rating ≤ 3★ (or review appears negative), include a remedy and invite to continue offline."
        : "",
    ]
      .filter(Boolean)
      .join("\n- ");

    const sys = `You write public review responses for small restaurants & coffee shops.
Write the entire reply in ${language}. If input language differs, prefer ${language}.
- Platform: ${platform}
- Tone: ${tone}
- Business: ${business || "N/A"}
- City: ${city || "N/A"}
- ${lengthHint}
- Keep brand-safe, courteous, and human. Avoid canned phrases.
- Do not include hashtags or emojis unless natural.
- ${policyLines ? `Policies:\n- ${policyLines}` : ""}`;

    const user = `
Customer review (verbatim):
"""
${reviewText}
"""

Given an explicit star rating (if provided): ${rating ?? "auto-detect from text"}.

Write ONE public reply. 
- If positive, amplify gratitude and mention a specific detail.
- If mixed/negative, acknowledge succinctly, outline a remedy, and invite them to reach out at the shop (do not invent numbers).
- Keep it concise and natural for ${platform}.`;

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
    const reply: string =
      data.output_text ??
      (Array.isArray(data.output)
        ? data.output.map((o: any) => (Array.isArray(o.content) ? o.content.map((c: any) => c.text).join("\n") : "")).join("\n")
        : "");

    return NextResponse.json({ reply });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}

