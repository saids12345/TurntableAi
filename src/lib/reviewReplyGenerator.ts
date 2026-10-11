// Shared server-side review reply generation.
// The public API still enforces requireProForApi; only trusted server jobs
// should import this module directly.
import "server-only";
import OpenAI from "openai";

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

type VariantFlavor = "base" | "warmer" | "shorter" | "more_professional";

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
- Reply in ${language || "English"} and a ${tone || "friendly, appreciative"} tone.
- ${guardrails}
- ${variantInstructions || "Keep it clear, human, and easy to paste as a reply."}
${sg}

Customer review (rating: ${rating ?? "n/a"}, platform: ${platform || "n/a"}):
"""
${reviewText}
"""

Now write the reply only (no preface, no quotes).
`.trim();
}

export type ReviewReplyInput = Parameters<typeof buildReplyPrompt>[0];

export async function generateReviewReply(input: ReviewReplyInput): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

  const openai = new OpenAI({ apiKey });
  const response = await openai.responses.create({
    model: "gpt-4.1-mini",
    input: buildReplyPrompt(input),
  });
  return extractText(response) || "Thanks so much for your feedback — we appreciate you!";
}
