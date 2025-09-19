import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      periodStart,
      periodEnd,
      storeName = "",
      city = "",
      totalSales = null,
      orders = null,
      refunds = null,
      cogs = null,
      laborHours = null,
      laborCost = null,
      footTraffic = null,
      avgPrepTimeMin = null,
      notes = "",
      topItems = "",
      upcomingPromo = "",
      goalNextPeriod = "",
      rawPaste = "",
      computed = {},
      language = "English",
    } = body ?? {};

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });

    const sys = `You are an operator-minded restaurant analyst.
Write concise, practical summaries for small cafes and coffee shops.
Write the entire output in ${language}. Avoid fluff and give clear next actions.`;

    const user = `
Store: ${storeName || "N/A"}   City: ${city || "N/A"}
Period: ${periodStart || "N/A"} → ${periodEnd || "N/A"}

Raw metrics (may be partial):
- Total sales: ${val(totalSales)}
- Orders: ${val(orders)}
- Refunds: ${val(refunds)}
- COGS: ${val(cogs)}
- Labor hours: ${val(laborHours)}
- Labor cost: ${val(laborCost)}
- Foot traffic: ${val(footTraffic)}
- Avg prep time (min): ${val(avgPrepTimeMin)}

Client-computed KPIs (if available):
${JSON.stringify(computed, null, 2)}

Top items: ${topItems || "N/A"}
Notes/context: ${notes || "N/A"}
Upcoming promo: ${upcomingPromo || "N/A"}
Goal for next period: ${goalNextPeriod || "N/A"}

Optional POS paste:
${rawPaste ? "```" + rawPaste + "```" : "N/A"}

TASKS:
1) Sales Recap (3–6 bullet points): highs/lows, AOV, margin/labor signals, anomalies.
2) Simple KPI table: Net Sales, Orders, AOV, Refunds $, Gross Margin %, Labor %, any other obvious.
3) 7-Day Forecast (table): day-of-week, low/mid/high sales bands, expected orders, quick note.
4) Staffing & Ordering Tips (3–5 bullets) tied to the forecast.
5) One-line Owner Takeaway (crisp, action-oriented).`;

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
    const output: string =
      data.output_text ??
      (Array.isArray(data.output)
        ? data.output.map((o: any) => (Array.isArray(o.content) ? o.content.map((c: any) => c.text).join("\n") : "")).join("\n")
        : "");

    return NextResponse.json({ output });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}

function val(v: any) {
  if (v === null || v === undefined || v === "") return "N/A";
  return String(v);
}
