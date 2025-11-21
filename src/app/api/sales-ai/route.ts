import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

type Inputs = {
  totalSales: number | null;
  orders: number | null;
  refunds: number | null;
  cogs: number | null;
  labor: number | null;
  avgPrepMinutes: number | null;
  traffic: number | null;
  topItems?: string;
  goal?: string;
  city?: string;
  upcomingPromo?: string;
  notes?: string;
};

type Body = {
  startDate: string;
  endDate: string;
  store?: string;
  language?: string;
  inputs: Inputs;
  posText?: string;
};

function parsePOS(text?: string) {
  if (!text) return { rows: [] as any[], totals: { sales: 0, orders: 0, refunds: 0, cogs: 0, labor: 0, traffic: 0 } };
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return { rows: [], totals: { sales: 0, orders: 0, refunds: 0, cogs: 0, labor: 0, traffic: 0 } };

  const first = lines[0];
  const hasHeader = /date/i.test(first) && /(sales|revenue|gross|net)/i.test(first);
  const header = hasHeader ? first.split(",").map((h) => h.trim().toLowerCase()) : [];
  const rowsRaw = hasHeader ? lines.slice(1) : lines;

  const idx = (keys: string[]) =>
    header.length ? header.findIndex((h) => keys.some((k) => h.includes(k))) : -1;

  const iDate = header.length ? idx(["date"]) : 0;
  const iSales = header.length ? idx(["sales", "revenue", "gross", "net"]) : 1;
  const iOrders = header.length ? idx(["orders"]) : 2;
  const iRefunds = header.length ? idx(["refund"]) : 3;
  const iCogs = header.length ? idx(["cogs"]) : 4;
  const iLabor = header.length ? idx(["labor"]) : 5;
  const iTraffic = header.length ? idx(["traffic"]) : 6;

  const rows = rowsRaw.map((line) => {
    const parts = line.split(",").map((s) => s.trim());
    const num = (i: number) => (i >= 0 && i < parts.length ? Number(String(parts[i]).replace(/[,$]/g, "")) : NaN);
    return {
      date: iDate >= 0 ? parts[iDate] : parts[0] ?? "",
      sales: Number.isFinite(num(iSales)) ? num(iSales) : NaN,
      orders: Number.isFinite(num(iOrders)) ? num(iOrders) : NaN,
      refunds: Number.isFinite(num(iRefunds)) ? num(iRefunds) : NaN,
      cogs: Number.isFinite(num(iCogs)) ? num(iCogs) : NaN,
      labor: Number.isFinite(num(iLabor)) ? num(iLabor) : NaN,
      traffic: Number.isFinite(num(iTraffic)) ? num(iTraffic) : NaN,
    };
  });

  const totals = rows.reduce(
    (acc, r: any) => {
      acc.sales += isNaN(r.sales) ? 0 : r.sales;
      acc.orders += isNaN(r.orders) ? 0 : r.orders;
      acc.refunds += isNaN(r.refunds) ? 0 : r.refunds;
      acc.cogs += isNaN(r.cogs) ? 0 : r.cogs;
      acc.labor += isNaN(r.labor) ? 0 : r.labor;
      acc.traffic += isNaN(r.traffic) ? 0 : r.traffic;
      return acc;
    },
    { sales: 0, orders: 0, refunds: 0, cogs: 0, labor: 0, traffic: 0 }
  );

  return { rows, totals };
}

function usd(n: number | null | undefined) {
  return typeof n === "number" && isFinite(n)
    ? n.toLocaleString("en-US", { style: "currency", currency: "USD" })
    : "—";
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function movingAverage(arr: number[], win = 3) {
  if (!arr.length) return [];
  const out: number[] = [];
  for (let i = 0; i < arr.length; i++) {
    const s = arr.slice(Math.max(0, i - win + 1), i + 1);
    out.push(s.reduce((a, b) => a + b, 0) / s.length);
  }
  return out;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    if (!body?.startDate || !body?.endDate || !body?.inputs) {
      return NextResponse.json({ error: "Missing required fields (startDate, endDate, inputs)" }, { status: 400 });
    }

    // 1) Derive numbers from inputs + optional POS paste
    const pos = parsePOS(body.posText);
    const totalSales = (body.inputs.totalSales ?? null) || (pos.totals.sales || null);
    const orders = (body.inputs.orders ?? null) || (pos.totals.orders || null);
    const refunds = (body.inputs.refunds ?? null) || (pos.totals.refunds || 0);
    const cogs = (body.inputs.cogs ?? null) || (pos.totals.cogs || null);
    const labor = (body.inputs.labor ?? null) || (pos.totals.labor || null);

    const avgTicket = orders && orders > 0 && totalSales ? totalSales / orders : null;
    const grossMarginPct = totalSales && cogs != null ? (1 - (cogs / totalSales)) * 100 : null;
    const laborPct = totalSales && labor != null ? (labor / totalSales) * 100 : null;

    // 2) Build a basic 7-day forecast from daily sales if POS exists; else from totals
    let dailySales: number[] = [];
    if (pos.rows.length) {
      dailySales = pos.rows
        .map((r: any) => (Number.isFinite(r.sales) ? Number(r.sales) : 0))
        .filter((n) => n > 0);
    } else if (totalSales && totalSales > 0) {
      // If only an overall range total exists, assume ~7-day evenly spread baseline
      const days = 7;
      dailySales = Array.from({ length: days }).map(() => totalSales / days);
    }

    const histMA = movingAverage(dailySales, 3);
    const last = histMA.length ? histMA[histMA.length - 1] : (totalSales ? totalSales / 7 : 0);
    // Simple seasonality bump using last 3 deltas
    const deltas = dailySales.slice(-3).map((v, i, a) => (i ? v - a[i - 1] : 0));
    const avgDelta = deltas.length ? deltas.reduce((a, b) => a + b, 0) / deltas.length : 0;

    const forecast: { day: number; sales: number }[] = Array.from({ length: 7 }).map((_, i) => {
      const val = Math.max(0, last + avgDelta * (i / 2)); // gentle trend
      return { day: i + 1, sales: Math.round(val) };
    });

    // 3) Build the object the UI expects
    const kpis = {
      revenue: usd(totalSales),
      orders: orders != null ? String(orders) : "—",
      avgTicket: usd(avgTicket ?? null),
      refunds: usd(refunds ?? 0),
      cogs: usd(cogs ?? null),
      labor: usd(labor ?? null),
      laborPct: laborPct != null && isFinite(laborPct) ? `${Math.round(laborPct)}%` : "—",
      grossMargin: grossMarginPct != null && isFinite(grossMarginPct) ? `${Math.round(grossMarginPct)}%` : "—",
      range: { start: body.startDate, end: body.endDate },
      store: body.store || null,
    };

    // 4) Ask OpenAI for a tidy summary + actions
    const sys = `You are a concise restaurant analytics assistant. Output short, actionable insights.`;
    const user = `
Date range: ${body.startDate} → ${body.endDate}
Store: ${body.store ?? "—"}
City: ${body.inputs.city ?? "—"}
Top items: ${body.inputs.topItems ?? "—"}
Goal: ${body.inputs.goal ?? "—"}
Upcoming promo: ${body.inputs.upcomingPromo ?? "—"}
Notes: ${body.inputs.notes ?? "—"}

Numbers:
- Revenue: ${usd(totalSales)}
- Orders: ${orders ?? "—"}
- Avg Ticket: ${usd(avgTicket ?? null)}
- Refunds: ${usd(refunds ?? 0)}
- COGS: ${usd(cogs ?? null)}
- Labor: ${usd(labor ?? null)}
- Labor %: ${kpis.laborPct}
- Gross Margin: ${kpis.grossMargin}
- POS rows: ${pos.rows.length}

Please provide:
1) A 2–4 sentence summary.
2) 3–5 short, concrete recommended actions focused on lift (pricing, mix, staffing, promos, ops).
Return plain text (no JSON).`;

    let aiSummary = "";
    let aiActions: string[] = [];

    if (process.env.OPENAI_API_KEY) {
      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        temperature: 0.4,
      });

      const text = completion.choices[0]?.message?.content?.trim() || "";
      aiSummary = text.split("\n").slice(0, 5).join("\n").trim();

      // extract bullets if any
      const bullets = text
        .split("\n")
        .filter((l) => /^\s*[-*•]\s+/.test(l))
        .map((l) => l.replace(/^\s*[-*•]\s+/, "").trim())
        .slice(0, 5);
      aiActions = bullets.length
        ? bullets
        : [
            "Feature 2 top-margin items on menu boards + social today.",
            "Test +$0.25 on best-seller; watch AOV and conversion.",
            "Align staffing to peak hours to keep labor% ≤ target.",
          ];
    } else {
      aiSummary =
        "AI disabled (no OPENAI_API_KEY). Showing baseline KPIs and a naive 7-day forecast.";
      aiActions = [
        "Add your OPENAI_API_KEY to enable AI summaries.",
        "Paste POS rows for a better forecast baseline.",
        "Enter COGS & Labor for accurate margin and labor%.",
      ];
    }

    const result = {
      kpis,
      forecast, // [{ day, sales }]
      summary: aiSummary,
      actions: aiActions,
      debug: {
        usedPOSRows: pos.rows.length,
        computedFrom: {
          totals: !!body.inputs.totalSales || !!pos.rows.length,
          cogs: !!(body.inputs.cogs ?? pos.totals.cogs),
          labor: !!(body.inputs.labor ?? pos.totals.labor),
        },
      },
    };

    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    console.error("sales-ai error:", err);
    return NextResponse.json({ error: err?.message || "Failed to analyze sales." }, { status: 500 });
  }
}
