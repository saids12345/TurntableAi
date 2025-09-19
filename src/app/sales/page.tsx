"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "../../components/Toast"; // global provider is in layout.tsx
import Shimmer from "../../components/Shimmer";
import { useDraft } from "../../lib/useDraft";
import { track } from "../../lib/track";

type Inputs = {
  periodStart: string;
  periodEnd: string;
  storeName?: string;
  city?: string;
  totalSales?: number | null;
  orders?: number | null;
  refunds?: number | null;
  cogs?: number | null;
  laborHours?: number | null;
  laborCost?: number | null;
  footTraffic?: number | null;
  avgPrepTimeMin?: number | null;
  notes?: string;
  topItems?: string;
  upcomingPromo?: string;
  goalNextPeriod?: string;
  rawPaste?: string;
  language?: "English" | "Spanish" | "Arabic";
};

type HistoryItem = { ts: number; inputs: Inputs; output: string };

const currency = (n: number | null | undefined) =>
  typeof n === "number" && !isNaN(n) ? n.toLocaleString(undefined, { style: "currency", currency: "USD" }) : "—";

export default function SalesPage() {
  const { push } = useToast();
  const today = new Date();

  const [inputs, setInputs] = useState<Inputs>({
    periodStart: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7).toISOString().slice(0, 10),
    periodEnd: today.toISOString().slice(0, 10),
    storeName: "TurnTable Cafe",
    city: "San Diego",
    totalSales: null,
    orders: null,
    refunds: null,
    cogs: null,
    laborHours: null,
    laborCost: null,
    footTraffic: null,
    avgPrepTimeMin: null,
    notes: "",
    topItems: "",
    upcomingPromo: "",
    goalNextPeriod: "",
    rawPaste: "",
    language: "English",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [result, setResult] = useState<string>("");
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Offline drafts + online indicator
  const { isOnline } = useDraft<Inputs>("draft:sales", inputs, (v) => setInputs(v));

  // history load/save (local, last 5)
  useEffect(() => {
    try {
      const raw = localStorage.getItem("salesRecapHistory");
      if (raw) setHistory(JSON.parse(raw));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("salesRecapHistory", JSON.stringify(history.slice(0, 5)));
    } catch {}
  }, [history]);

  function update<K extends keyof Inputs>(key: K, value: Inputs[K]) {
    setInputs((s) => ({ ...s, [key]: value }));
  }

  // KPIs
  const kpis = useMemo(() => {
    const sales = Number(inputs.totalSales) || 0;
    const orders = Number(inputs.orders) || 0;
    const refunds = Number(inputs.refunds) || 0;
    const cogs = Number(inputs.cogs) || 0;
    const labor = Number(inputs.laborCost) || 0;

    const netSales = Math.max(sales - refunds, 0);
    const aov = orders > 0 ? netSales / orders : NaN;
    const grossMargin$ = netSales - cogs;
    const grossMarginPct = netSales > 0 ? (grossMargin$ / netSales) * 100 : NaN;
    const laborPct = netSales > 0 ? (labor / netSales) * 100 : NaN;

    return { sales, netSales, orders, aov, refunds, cogs, grossMargin$, grossMarginPct, labor, laborPct };
  }, [inputs]);

  // Cmd/Ctrl + Enter
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "enter" && !loading) {
        const form = document.querySelector("form");
        (form as HTMLFormElement | null)?.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [loading]);

  async function onGenerate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult("");

    try {
      const res = await fetch("/api/sales-recap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...inputs, computed: kpis }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to generate");
      const out = (data?.output as string) || "";
      setResult(out);
      setHistory((h) => [{ ts: Date.now(), inputs, output: out }, ...h].slice(0, 5));
      track({ ts: Date.now(), type: "sales_generated" });
      push({ msg: "Recap generated", type: "success" });
    } catch (err: any) {
      push({ msg: err.message || "Something went wrong", type: "error" });
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      push({ msg: "Copied to clipboard", type: "success" });
    } catch {
      push({ msg: "Couldn’t copy—select manually.", type: "error" });
    }
  }

  // export helpers
  function download(filename: string, data: string, mime: string) {
    const blob = new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  function exportCSV() {
    const rows: [string, any][] = [
      ["Period Start", inputs.periodStart],
      ["Period End", inputs.periodEnd],
      ["Store", inputs.storeName ?? ""],
      ["City", inputs.city ?? ""],
      ["Total Sales", inputs.totalSales ?? ""],
      ["Orders", inputs.orders ?? ""],
      ["Refunds", inputs.refunds ?? ""],
      ["COGS", inputs.cogs ?? ""],
      ["Labor Hours", inputs.laborHours ?? ""],
      ["Labor Cost", inputs.laborCost ?? ""],
      ["Foot Traffic", inputs.footTraffic ?? ""],
      ["Avg Prep (min)", inputs.avgPrepTimeMin ?? ""],
      ["Net Sales", kpis.netSales],
      ["AOV", isFinite(kpis.aov) ? kpis.aov.toFixed(2) : ""],
      ["Gross Margin $", isFinite(kpis.grossMargin$) ? kpis.grossMargin$.toFixed(2) : ""],
      ["Gross Margin %", isFinite(kpis.grossMarginPct) ? kpis.grossMarginPct.toFixed(1) : ""],
      ["Labor %", isFinite(kpis.laborPct) ? kpis.laborPct.toFixed(1) : ""],
      ["Top Items", inputs.topItems ?? ""],
      ["Upcoming Promo", inputs.upcomingPromo ?? ""],
      ["Goal Next Period", inputs.goalNextPeriod ?? ""],
      ["Notes", inputs.notes ?? ""],
    ];
    const csv = "Field,Value\n" + rows.map(([k, v]) => `"${k}","${String(v).replace(/"/g, '""')}"`).join("\n");
    download(`sales_recap_${inputs.periodStart}_${inputs.periodEnd}.csv`, csv, "text/csv");
  }
  function exportTXT() {
    const txt = result || "";
    download(`sales_recap_${inputs.periodStart}_${inputs.periodEnd}.txt`, txt, "text/plain");
  }

  function loadFromHistory(item: HistoryItem) {
    setInputs(item.inputs);
    setResult(item.output);
    setError("");
  }

  return (
    <div className="min-h-screen w-full px-3 pb-12 pt-10 sm:px-4 md:px-8">
      <div className="mx-auto max-w-4xl rounded-2xl border border-white/10 bg-black/30 p-6 shadow-2xl backdrop-blur">
        <h1 className="text-center text-3xl font-semibold tracking-tight">Sales Recap & Forecast 📈</h1>
        <p className="mt-2 text-center text-sm text-white/70">
          Summarize performance, see quick KPIs, and get a 7-day forecast + staffing/ordering tips.
        </p>
        {!isOnline && <div className="mt-2 text-center text-xs text-amber-300">Offline — drafts auto-saved locally.</div>}

        <form onSubmit={onGenerate} className="mt-6 grid gap-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <label className="block text-sm text-white/80">Start date</label>
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
                value={inputs.periodStart}
                onChange={(e) => update("periodStart", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm text-white/80">End date</label>
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
                value={inputs.periodEnd}
                onChange={(e) => update("periodEnd", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm text-white/80">Store (optional)</label>
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
                value={inputs.storeName || ""}
                onChange={(e) => update("storeName", e.target.value)}
                placeholder="TurnTable Cafe"
              />
            </div>
            <div>
              <label className="block text-sm text-white/80">Language</label>
              <select
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
                value={inputs.language}
                onChange={(e) => update("language", e.target.value as Inputs["language"])}
              >
                <option>English</option>
                <option>Spanish</option>
                <option>Arabic</option>
              </select>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="block text-sm text-white/80">Total sales ($)</label>
              <input
                type="number"
                step="0.01"
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
                value={inputs.totalSales ?? ""}
                onChange={(e) => update("totalSales", e.target.value === "" ? null : Number(e.target.value))}
                placeholder="e.g., 4280.75"
              />
            </div>
            <div>
              <label className="block text-sm text-white/80">Orders</label>
              <input
                type="number"
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
                value={inputs.orders ?? ""}
                onChange={(e) => update("orders", e.target.value === "" ? null : Number(e.target.value))}
                placeholder="e.g., 210"
              />
            </div>
            <div>
              <label className="block text-sm text-white/80">Refunds ($)</label>
              <input
                type="number"
                step="0.01"
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
                value={inputs.refunds ?? ""}
                onChange={(e) => update("refunds", e.target.value === "" ? null : Number(e.target.value))}
                placeholder="e.g., 35.50"
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <label className="block text-sm text-white/80">COGS ($)</label>
              <input
                type="number"
                step="0.01"
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
                value={inputs.cogs ?? ""}
                onChange={(e) => update("cogs", e.target.value === "" ? null : Number(e.target.value))}
                placeholder="optional"
              />
            </div>
            <div>
              <label className="block text-sm text-white/80">Labor hours</label>
              <input
                type="number"
                step="0.1"
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
                value={inputs.laborHours ?? ""}
                onChange={(e) => update("laborHours", e.target.value === "" ? null : Number(e.target.value))}
                placeholder="optional"
              />
            </div>
            <div>
              <label className="block text-sm text-white/80">Labor cost ($)</label>
              <input
                type="number"
                step="0.01"
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
                value={inputs.laborCost ?? ""}
                onChange={(e) => update("laborCost", e.target.value === "" ? null : Number(e.target.value))}
                placeholder="optional"
              />
            </div>
            <div>
              <label className="block text-sm text-white/80">Foot traffic</label>
              <input
                type="number"
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
                value={inputs.footTraffic ?? ""}
                onChange={(e) => update("footTraffic", e.target.value === "" ? null : Number(e.target.value))}
                placeholder="optional"
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="block text-sm text-white/80">Avg. prep time (min)</label>
              <input
                type="number"
                step="0.1"
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
                value={inputs.avgPrepTimeMin ?? ""}
                onChange={(e) => update("avgPrepTimeMin", e.target.value === "" ? null : Number(e.target.value))}
                placeholder="optional"
              />
            </div>
            <div>
              <label className="block text-sm text-white/80">City (optional)</label>
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
                value={inputs.city || ""}
                onChange={(e) => update("city", e.target.value)}
                placeholder="San Diego"
              />
            </div>
            <div>
              <label className="block text-sm text-white/80">Upcoming promo (optional)</label>
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
                value={inputs.upcomingPromo || ""}
                onChange={(e) => update("upcomingPromo", e.target.value)}
                placeholder="e.g., BOGO Friday 3–6pm"
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="block text-sm text-white/80">Top items (comma-separated)</label>
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
                value={inputs.topItems || ""}
                onChange={(e) => update("topItems", e.target.value)}
                placeholder="Latte x120, Cold Brew x88, Baklava x40"
              />
            </div>
            <div>
              <label className="block text-sm text-white/80">Goal for next period</label>
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
                value={inputs.goalNextPeriod || ""}
                onChange={(e) => update("goalNextPeriod", e.target.value)}
                placeholder="Increase AOV to $22, cut wait time to ≤ 6 min"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-white/80">Notes / context</label>
            <textarea
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-sm leading-6"
              rows={3}
              value={inputs.notes || ""}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="Weather, events, staffing, equipment issues, supply shortages, etc."
            />
          </div>

          <div>
            <label className="block text-sm text-white/80">Optional: paste POS export (CSV/text)</label>
            <textarea
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-sm leading-6"
              rows={4}
              value={inputs.rawPaste || ""}
              onChange={(e) => update("rawPaste", e.target.value)}
              placeholder="Paste daily summary lines here; the model will parse signals."
            />
          </div>

          {/* KPI preview */}
          <div className="grid gap-3 md:grid-cols-5">
            <KPI label="Gross Sales" value={currency(kpis.sales)} />
            <KPI label="Net Sales" value={currency(kpis.netSales)} />
            <KPI label="Orders" value={kpis.orders || 0} />
            <KPI label="AOV" value={isFinite(kpis.aov) ? currency(kpis.aov) : "—"} />
            <KPI
              label="Gross Margin"
              value={isFinite(kpis.grossMarginPct) ? `${kpis.grossMarginPct.toFixed(1)}%` : "—"}
              sub={isFinite(kpis.grossMargin$) ? currency(kpis.grossMargin$) : ""}
            />
          </div>
          <div className="grid gap-3 md:grid-cols-5">
            <KPI label="Refunds" value={currency(kpis.refunds)} />
            <KPI label="COGS" value={currency(kpis.cogs)} />
            <KPI label="Labor $" value={currency(kpis.labor)} />
            <KPI label="Labor %" value={isFinite(kpis.laborPct) ? `${kpis.laborPct.toFixed(1)}%` : "—"} />
            <KPI label="Traffic" value={inputs.footTraffic ?? "—"} />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-1 w-full rounded-xl bg-gradient-to-r from-fuchsia-500 to-purple-600 px-5 py-3 text-sm font-medium text-white transition hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? "Generating…" : "Generate Recap & 7-Day Forecast"}
          </button>
        </form>

        {loading && (
          <div className="mt-4">
            <Shimmer className="h-24" />
            <div className="mt-2 grid gap-2 md:grid-cols-3">
              <Shimmer className="h-20" />
              <Shimmer className="h-20" />
              <Shimmer className="h-20" />
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-950/30 p-3 text-sm text-red-200">{error}</div>
        )}

        {result && (
          <div className="mt-6 rounded-xl border border-white/10 bg-black/30 p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Recap & Forecast</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => copy(result)}
                  className="rounded-md border border-white/10 px-3 py-1 text-xs text-white/80 hover:bg-white/5 transition hover:scale-[1.02] active:scale-[0.98]"
                >
                  Copy
                </button>
                <button
                  onClick={exportCSV}
                  className="rounded-md border border-white/10 px-3 py-1 text-xs text-white/80 hover:bg-white/5 transition hover:scale-[1.02] active:scale-[0.98]"
                >
                  Export CSV
                </button>
                <button
                  onClick={exportTXT}
                  className="rounded-md border border-white/10 px-3 py-1 text-xs text-white/80 hover:bg-white/5 transition hover:scale-[1.02] active:scale-[0.98]"
                >
                  Export .txt
                </button>
              </div>
            </div>
            <pre className="whitespace-pre-wrap text-sm text-white/90">{result}</pre>
          </div>
        )}

        {history.length > 0 && (
          <div className="mt-8">
            <div className="mb-2 text-sm font-semibold text-white/80">Recent (last 5)</div>
            <div className="grid gap-3">
              {history.map((h) => (
                <button
                  key={h.ts}
                  onClick={() => loadFromHistory(h)}
                  className="w-full rounded-lg border border-white/10 bg-black/30 p-3 text-left text-xs text-white/80 transition hover:bg-white/5 hover:scale-[1.01] active:scale-[0.99]"
                >
                  <div className="line-clamp-1">
                    {new Date(h.ts).toLocaleString()} — {h.inputs.periodStart} → {h.inputs.periodEnd}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function KPI({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/40 p-3 transition hover:scale-[1.02] active:scale-[0.98]">
      <div className="text-xs text-white/60">{label}</div>
      <div className="text-base font-semibold">{value}</div>
      {sub ? <div className="text-[11px] text-white/50">{sub}</div> : null}
    </div>
  );
}





