import { NextResponse } from "next/server";
import OpenAI from "openai";

// Optional: ensure this route is always dynamic in dev
export const dynamic = "force-dynamic";

// --- Simple input guard (minimal dependency, no zod needed) ---
type Task = "recap" | "forecast";

function clean(s: unknown, max = 4000) {
  if (typeof s !== "string") return "";
  return s.trim().slice(0, max);
}

function isTask(x: unknown): x is Task {
  return x === "recap" || x === "forecast";
}

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    // 1) Parse & validate the incoming JSON
    const body = await req.json().catch(() => ({} as any));
    const task = (body?.task ?? "") as unknown;
    const period = clean(body?.period ?? "", 120);
    const data = clean(body?.data ?? "", 6000);
    const notes = clean(body?.notes ?? "", 2000);

    if (!isTask(task)) {
      return NextResponse.json(
        { ok: false, error: "Invalid task. Use 'recap' or 'forecast'." },
        { status: 400 }
      );
    }
    if (!period) {
      return NextResponse.json(
        { ok: false, error: "Missing 'period'." },
        { status: 400 }
      );
    }

    // 2) Build a tight system + user prompt
    const system =
      task === "recap"
        ? `You are an operations analyst for a small restaurant.
Return a concise sales RECAP for the specified period.
Focus on:
- Total revenue / avg ticket (if given or can be inferred)
- Daily/weekly patterns and top items (if given)
- Notable spikes/dips and plausible causes
- 3 bullet recommendations for today

Tone: crisp, practical, no fluff.`
        : `You are an operations analyst for a small restaurant.
Return a concise short-range FORECAST for the next 1–7 days using the provided context.
Include:
- A one-paragraph outlook with rationale
- A small bullet list of staffing/ordering suggestions
- 2 risks to watch

Tone: crisp, practical, no fluff.`;

    const userContent = [
      `Task: ${task.toUpperCase()}`,
      `Period: ${period}`,
      data ? `Sales/Context Data:\n${data}` : `Sales/Context Data: (none)`,
      notes ? `Owner Notes:\n${notes}` : `Owner Notes: (none)`,
      "",
      "Output format:",
      task === "recap"
        ? `# Sales Recap (${period})
- Summary:
- Patterns:
- Spikes/Dips:
- Recommendations (3 bullets):`
        : `# Sales Forecast (Next 1–7 days)
- Outlook:
- Suggestions (staffing/ordering):
- Risks:`,
    ].join("\n");

    // 3) Call OpenAI
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.5,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userContent },
      ],
    });

    const result =
      completion.choices?.[0]?.message?.content?.trim() ||
      "No response returned.";

    // 4) Send it back to the UI
    return NextResponse.json({ ok: true, result });
  } catch (err: any) {
    // Helpful error for the UI
    const msg =
      err?.response?.data?.error?.message ||
      err?.message ||
      "Unknown server error.";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

// Quick health check for curl/tests
export async function GET() {
  return NextResponse.json({ ok: true, status: "alive" });
}
