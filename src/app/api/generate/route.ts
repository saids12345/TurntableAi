import { openai } from "@/lib/openai";
import { ok, error } from "@/lib/http";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { request, platform = "Instagram", style = "Friendly" } = body || {};

    if (!request || typeof request !== "string" || !request.trim()) {
      return error('Please include a non-empty "request" string.', 400);
    }

    const system = `You are a social media assistant. Platform: ${platform}. Tone: ${style}.
Be short, punchy, 1–2 emojis, up to 3 relevant hashtags.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: request },
      ],
      temperature: 0.7,
    });

    const result = completion.choices?.[0]?.message?.content?.trim() || "No response.";
    return ok({ result });
  } catch (e: any) {
    return error(e?.message || "Server error", 500);
  }
}

// Optional simple GET health check
export function GET() {
  return ok({ status: "alive" });
}


