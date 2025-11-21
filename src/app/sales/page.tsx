'use client';

import React, { useMemo, useState, useEffect } from 'react';

/* =============================== helpers =============================== */

function cx(...cls: (string | false | null | undefined)[]) {
  return cls.filter(Boolean).join(' ');
}
// pin locale to avoid SSR/CSR differences
const money = (n: number | null | undefined) =>
  typeof n === 'number' && !Number.isNaN(n)
    ? n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
    : '—';

type Totals = {
  sales: number;
  orders: number;
  refunds: number;
  cogs: number;
  labor: number;
  traffic: number;
};

function fmtISO(d: Date) {
  return d.toISOString().slice(0, 10);
}
function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function parsePOS(text: string) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length)
    return {
      rows: [] as Array<Record<string, unknown>>,
      totals: { sales: 0, orders: 0, refunds: 0, cogs: 0, labor: 0, traffic: 0 } as Totals,
    };

  const first = lines[0];
  const hasHeader = /date/i.test(first) && /(sales|revenue|gross|net)/i.test(first);
  const header = hasHeader ? first.split(',').map((h) => h.trim().toLowerCase()) : [];
  const rowsRaw = hasHeader ? lines.slice(1) : lines;

  const idx = (keys: string[]) =>
    header.length ? header.findIndex((h) => keys.some((k) => h.includes(k))) : -1;

  const iDate = header.length ? idx(['date']) : 0;
  const iSales = header.length ? idx(['sales', 'revenue', 'gross', 'net']) : 1;
  const iOrders = header.length ? idx(['orders']) : 2;
  const iRefunds = header.length ? idx(['refund']) : 3;
  const iCogs = header.length ? idx(['cogs']) : 4;
  const iLabor = header.length ? idx(['labor']) : 5;
  const iTraffic = header.length ? idx(['traffic']) : 6;

  const rows = rowsRaw.map((line) => {
    const parts = line.split(',').map((s) => s.trim());
    const num = (i: number) =>
      i >= 0 && i < parts.length ? Number(String(parts[i]).replace(/[,$]/g, '')) : NaN;
    return {
      date: iDate >= 0 ? parts[iDate] : parts[0] ?? '',
      sales: Number.isFinite(num(iSales)) ? num(iSales) : NaN,
      orders: Number.isFinite(num(iOrders)) ? num(iOrders) : NaN,
      refunds: Number.isFinite(num(iRefunds)) ? num(iRefunds) : NaN,
      cogs: Number.isFinite(num(iCogs)) ? num(iCogs) : NaN,
      labor: Number.isFinite(num(iLabor)) ? num(iLabor) : NaN,
      traffic: Number.isFinite(num(iTraffic)) ? num(iTraffic) : NaN,
    };
  });

  const totals = rows.reduce<Totals>(
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

/* ============================ Menu profit engine ============================ */

type MenuRow = {
  item: string;
  price: number;
  cost: number;
  qty?: number;
};
type MenuClass = 'STAR' | 'PLOWHORSE' | 'PUZZLE' | 'DOG';

function parseMenuCSV(text: string): MenuRow[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const header = /item/i.test(lines[0]) ? lines[0].split(',').map((s) => s.trim().toLowerCase()) : [];
  const rows = (header.length ? lines.slice(1) : lines).map((l) => l.split(',').map((s) => s.trim()));
  const idx = (k: string) => (header.length ? header.findIndex((h) => h.includes(k)) : -1);

  const iItem = header.length ? idx('item') : 0;
  const iPrice = header.length ? idx('price') : 1;
  const iCost = header.length ? idx('cost') : 2;

  return rows
    .map((cols) => ({
      item: iItem >= 0 ? cols[iItem] : cols[0],
      price: Number((iPrice >= 0 ? cols[iPrice] : cols[1]).replace(/[,$]/g, '')),
      cost: Number((iCost >= 0 ? cols[iCost] : cols[2]).replace(/[,$]/g, '')),
    }))
    .filter((r) => r.item && Number.isFinite(r.price) && Number.isFinite(r.cost));
}

function median(nums: number[]) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function classifyMenu(
  items: MenuRow[],
  posRows: Array<Record<string, unknown>>
): Array<MenuRow & { margin: number; contrib: number; cls: MenuClass; advice: string }> {
  const avgQty = 50;
  const enriched = items.map((r) => ({
    ...r,
    qty: r.qty ?? avgQty,
    margin: r.price - r.cost,
    contrib: (r.price - r.cost) * (r.qty ?? avgQty),
  }));
  const marginCut = median(enriched.map((x) => x.margin));
  const qtyCut = median(enriched.map((x) => x.qty ?? avgQty));
  return enriched
    .map((r) => {
      const highMargin = r.margin >= marginCut;
      const highQty = (r.qty ?? avgQty) >= qtyCut;
      const cls: MenuClass = highMargin && highQty ? 'STAR' : highQty ? 'PLOWHORSE' : highMargin ? 'PUZZLE' : 'DOG';
      const advice =
        cls === 'STAR'
          ? 'Feature prominently; small $0.25–$0.50 price tests are safe.'
          : cls === 'PLOWHORSE'
          ? 'Popular but low margin; nudge price +$0.25–$0.50 or reduce portion.'
          : cls === 'PUZZLE'
          ? 'Great margin but low volume; bundle or rename to improve pull.'
          : 'Low volume & margin; consider rotating off-menu.';
      return { ...r, cls, advice };
    })
    .sort((a, b) => b.contrib - a.contrib);
}

/* =============================== Component =============================== */

export default function SalesPage() {
  /* ---------- hydration sanity ---------- */
  useEffect(() => {
    document.documentElement.setAttribute('data-js', 'ready');
    // quick visual/log signal while we debug clicks
    // console.log('SalesPage hydrated');
  }, []);

  /* ---------- collapsible + basic states ---------- */
  const [step2Open, setStep2Open] = useState(false);

  // Overview
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [store, setStore] = useState('TurnTable Cafe');
  const [language, setLanguage] = useState('English');

  // Key inputs
  const [totalSales, setTotalSales] = useState('');
  const [orders, setOrders] = useState('');
  const [refunds, setRefunds] = useState('');
  const [cogs, setCogs] = useState('');
  const [laborCost, setLaborCost] = useState('');
  const [footTraffic, setFootTraffic] = useState('');
  const [avgPrep, setAvgPrep] = useState('');

  // Context & goals
  const [city, setCity] = useState('San Diego');
  const [upcomingPromo, setUpcomingPromo] = useState('');
  const [topItems, setTopItems] = useState('Latte x120, Cold Brew x88, Baklava x40');
  const [goal, setGoal] = useState('Increase AOV to $22, cut wait time to ≤ 6 min');
  const [notes, setNotes] = useState('');

  // POS text
  const [posText, setPosText] = useState('');

  // API result
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiResult, setApiResult] = useState<Record<string, unknown> | null>(null);

  // Derived from POS
  const pos = useMemo(() => parsePOS(posText), [posText]);

  const grossSalesNum = useMemo(() => {
    const typed = Number(totalSales);
    return Number.isFinite(typed) && typed > 0 ? typed : pos.totals.sales || 0;
  }, [totalSales, pos.totals.sales]);

  const totalOrdersNum = useMemo(() => {
    const typed = Number(orders);
    return Number.isFinite(typed) && typed > 0 ? typed : pos.totals.orders || 0;
  }, [orders, pos.totals.orders]);

  const totalRefundsNum = useMemo(() => {
    const typed = Number(refunds);
    return Number.isFinite(typed) && typed >= 0 ? typed : pos.totals.refunds || 0;
  }, [refunds, pos.totals.refunds]);

  const totalCogsNum = useMemo(() => {
    const typed = Number(cogs);
    return Number.isFinite(typed) && typed >= 0 ? typed : pos.totals.cogs || 0;
  }, [cogs, pos.totals.cogs]);

  const totalLaborNum = useMemo(() => {
    const typed = Number(laborCost);
    return Number.isFinite(typed) && typed >= 0 ? typed : pos.totals.labor || 0;
  }, [laborCost, pos.totals.labor]);

  const aov = totalOrdersNum > 0 ? grossSalesNum / totalOrdersNum : null;
  const grossMarginPct = grossSalesNum > 0 ? (1 - totalCogsNum / grossSalesNum) * 100 : null;
  const laborPct = grossSalesNum > 0 ? (totalLaborNum / grossSalesNum) * 100 : null;

  const formLooksReady = !!startDate && !!endDate && (grossSalesNum > 0 || pos.rows.length > 0);

  // Date presets
  function applyPreset(preset: '7' | '14' | 'this' | 'last') {
    const today = new Date();
    if (preset === '7') {
      setEndDate(fmtISO(today));
      setStartDate(fmtISO(addDays(today, -6)));
    } else if (preset === '14') {
      setEndDate(fmtISO(today));
      setStartDate(fmtISO(addDays(today, -13)));
    } else if (preset === 'this') {
      setStartDate(fmtISO(startOfMonth(today)));
      setEndDate(fmtISO(endOfMonth(today)));
    } else {
      const firstThis = startOfMonth(today);
      const lastLast = addDays(firstThis, -1);
      setStartDate(fmtISO(startOfMonth(lastLast)));
      setEndDate(fmtISO(endOfMonth(lastLast)));
    }
  }

  // Sample data
  function loadSample() {
    setPosText(
`date,sales,orders,refunds,cogs,labor,traffic
2025-08-01,4280,210,36,1420,860,260
2025-08-02,4460,222,0,1460,900,270
2025-08-03,3920,196,0,1280,790,240
2025-08-04,4105,205,18,1360,840,250
2025-08-05,4730,238,0,1520,940,280
2025-08-06,4890,246,0,1560,960,292
2025-08-07,5120,255,24,1620,980,305`
    );
  }

  /* ============================= Daily Alerts ============================= */

  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [alertEmail, setAlertEmail] = useState('owner@turntableai.net');
  const [aovDipPct, setAovDipPct] = useState(5);
  const [laborCapPct, setLaborCapPct] = useState(22);

  const aovTrend = useMemo(() => {
    const rows = pos.rows as Array<{ sales: number; orders: number }>;
    if (!rows || rows.length < 4) return null;
    const mid = Math.floor(rows.length / 2);
    const s = (arr: number[]) => arr.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
    const aov1 = s(rows.slice(0, mid).map((r) => r.sales)) / Math.max(1, s(rows.slice(0, mid).map((r) => r.orders)));
    const aov2 = s(rows.slice(mid).map((r) => r.sales)) / Math.max(1, s(rows.slice(mid).map((r) => r.orders)));
    if (!isFinite(aov1) || !isFinite(aov2)) return null;
    const change = ((aov2 - aov1) / (aov1 || 1)) * 100;
    return { aov1, aov2, change };
  }, [pos.rows]);

  async function maybeSendAlerts(summaryHtml: string, summaryText: string) {
    if (!alertsEnabled) return;

    const issues: string[] = [];
    if (aovTrend && aovTrend.change < -aovDipPct) {
      issues.push(`AOV dropped ${Math.abs(aovTrend.change).toFixed(1)}% (from ${money(aovTrend.aov1)} to ${money(aovTrend.aov2)}).`);
    }
    if (laborPct !== null && laborPct > laborCapPct) {
      issues.push(`Labor is ${laborPct.toFixed(1)}% (target ≤ ${laborCapPct}%).`);
    }
    if (!issues.length) return;

    const html =
      `<h3>TurnTable AI – Daily Alert</h3>
       <p>${issues.join(' ')}</p>
       <hr/>${summaryHtml}`;

    try {
      await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: alertEmail,
          subject: 'TurnTable AI – KPI Alert',
          html,
          text: `${issues.join(' ')}\n\n${summaryText}`,
        }),
      });
    } catch {
      // non-blocking
    }
  }

  /* ============================== Shift planner ============================== */

  const [serviceRate, setServiceRate] = useState(22);
  const [targetLaborPct, setTargetLaborPct] = useState(20);
  const [avgWage, setAvgWage] = useState(18);

  type DayOrders = { date: string; orders: number; sales: number };
  const dailyOrders: DayOrders[] = useMemo(() => {
    const rows = pos.rows as Array<{ date: string; orders: number; sales: number }>;
    if (!rows?.length) return [];
    return rows.map((r) => ({ date: r.date, orders: Number(r.orders) || 0, sales: Number(r.sales) || 0 }));
  }, [pos.rows]);

  const staffingPlan = useMemo(() => {
    const hoursOpen = 10;
    return dailyOrders.map((d) => {
      const ordersPerHour = (d.orders || 0) / hoursOpen;
      const staffNeeded = Math.max(1, Math.ceil(ordersPerHour / Math.max(1, serviceRate)));
      const laborCostDay = staffNeeded * avgWage * hoursOpen;
      const laborPctDay = d.sales > 0 ? (laborCostDay / d.sales) * 100 : 0;
      return { date: d.date, staffNeeded, laborCostDay, laborPctDay };
    });
  }, [dailyOrders, serviceRate, avgWage]);

  /* ============================== Menu engine ============================== */

  const [menuCSV, setMenuCSV] = useState('');
  const menuRows = useMemo(() => parseMenuCSV(menuCSV), [menuCSV]);
  const menuClasses = useMemo(() => classifyMenu(menuRows, pos.rows), [menuRows, pos.rows]);

  /* ================================ Submit ================================ */

  function escapeHtml(s: string) {
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
  }

  async function handleGenerate() {
    setLoading(true);
    setApiError(null);
    setApiResult(null);
    try {
      const payload = {
        startDate,
        endDate,
        store,
        language,
        inputs: {
          totalSales: grossSalesNum,
          orders: totalOrdersNum,
          refunds: totalRefundsNum,
          cogs: totalCogsNum,
          labor: totalLaborNum,
          avgPrepMinutes: Number(avgPrep) || null,
          traffic: Number(footTraffic) || pos.totals.traffic || null,
          topItems,
          goal,
          city,
          upcomingPromo,
          notes,
        },
        posText,
      };
      const res = await fetch('/api/sales-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as Record<string, unknown>;
      setApiResult(json);

      const summaryHtml = `<pre style="font-family:Inter, ui-sans-serif; white-space:pre-wrap">${escapeHtml(
        JSON.stringify((json as any).kpis ?? json, null, 2)
      )}</pre>`;
      const summaryText = JSON.stringify((json as any).kpis ?? json, null, 2);
      await maybeSendAlerts(summaryHtml, summaryText);

      requestAnimationFrame(() => {
        document.getElementById('results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    } catch (err) {
      const e = err as Error;
      setApiError(e.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  // Sticky bar spacing
  useEffect(() => {
    document.body.style.paddingBottom = '84px';
    return () => {
      document.body.style.paddingBottom = '';
    };
  }, []);

  /* ================================ UI Bits ================================ */

  function Section(props: { title: string; subtitle?: string; children: React.ReactNode; right?: React.ReactNode }) {
    return (
      <section className="rounded-2xl border border-white/10 bg-neutral-900/40 p-5 md:p-6 shadow-sm backdrop-blur">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-white">{props.title}</h3>
            {props.subtitle && <p className="mt-1 text-sm text-neutral-400">{props.subtitle}</p>}
          </div>
          {props.right ? <div className="shrink-0">{props.right}</div> : null}
        </div>
        {props.children}
      </section>
    );
  }

  function Field(props: {
    label: string;
    placeholder?: string;
    value: string;
    onChange: (v: string) => void;
    type?: string;
    hint?: string;
    rightEl?: React.ReactNode;
  }) {
    return (
      <label className="block">
        <div className="mb-1.5 flex items-center justify-between">
          <div className="text-xs font-medium text-neutral-300">{props.label}</div>
          {props.rightEl ? <div className="text-xs text-neutral-400">{props.rightEl}</div> : null}
        </div>
        <input
          type={props.type || 'text'}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          placeholder={props.placeholder}
          className="w-full rounded-lg border border-white/10 bg-neutral-800/60 px-3 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:ring-2 focus:ring-violet-500/60"
        />
        {props.hint && <div className="mt-1 text-xs text-neutral-500">{props.hint}</div>}
      </label>
    );
  }

  function Stat(props: { label: string; value: string; sub?: string }) {
    return (
      <div className="rounded-xl border border-white/10 bg-neutral-900/40 px-4 py-3 text-center">
        <div className="text-[11px] uppercase tracking-wide text-neutral-400">{props.label}</div>
        <div className="mt-1 text-base font-semibold text-white">{props.value}</div>
        {props.sub && <div className="mt-0.5 text-xs text-neutral-500">{props.sub}</div>}
      </div>
    );
  }

  /* ================================= Render ================================ */

  return (
    <div className="relative z-10 mx-auto max-w-6xl px-4 pb-32 pt-8">
      {/* Header */}
      <header className="mb-6">
        <div className="mb-2 flex items-center gap-2 text-xs text-neutral-400">
          <span className="rounded-full bg-neutral-800 px-2 py-0.5">Step 1</span>
          <span className="rounded-full bg-neutral-800 px-2 py-0.5">Step 2</span>
          <span className="rounded-full bg-neutral-800 px-2 py-0.5">Step 3</span>
        </div>
        <h1 className="text-3xl font-bold text-white">
          Sales Recap <span className="text-neutral-400">&</span>{' '}
          <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">Forecast</span>
          <span className="ml-2">📈</span>
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-neutral-400">
          Summarize performance, see KPIs, and generate a 7-day forecast. Paste your POS export to auto-fill totals.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* LEFT */}
        <div className="lg:col-span-2 space-y-6">
          {/* Step 1: Overview */}
          <Section
            title="Step 1 · Overview"
            subtitle="Pick your date range and basic details."
            right={
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => applyPreset('7')} className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-neutral-300 hover:bg-neutral-800/60">Last 7 days</button>
                <button type="button" onClick={() => applyPreset('14')} className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-neutral-300 hover:bg-neutral-800/60">Last 14</button>
                <button type="button" onClick={() => applyPreset('this')} className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-neutral-300 hover:bg-neutral-800/60">This month</button>
                <button type="button" onClick={() => applyPreset('last')} className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-neutral-300 hover:bg-neutral-800/60">Last month</button>
              </div>
            }
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Start date" type="date" value={startDate} onChange={setStartDate} />
              <Field label="End date" type="date" value={endDate} onChange={setEndDate} />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Store (optional)" value={store} onChange={setStore} placeholder="e.g., Mira Mesa Cafe" />
              <label className="block">
                <div className="mb-1.5 text-xs font-medium text-neutral-300">Language</div>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-neutral-800/60 px-3 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-violet-500/60"
                >
                  <option>English</option>
                  <option>Spanish</option>
                  <option>Arabic</option>
                </select>
              </label>
            </div>
          </Section>

          {/* Step 1: Key inputs */}
          <Section title="Step 1 · Key Inputs" subtitle="Enter totals or paste your POS in Step 3 to auto-fill. You can mix and match.">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label="Total sales ($)" value={totalSales} onChange={setTotalSales} placeholder="e.g., 4280.75"
                rightEl={!totalSales && pos.totals.sales > 0 ? <span className="text-[10px] text-violet-300">auto-filled from POS</span> : null} />
              <Field label="Orders" value={orders} onChange={setOrders} placeholder="e.g., 210"
                rightEl={!orders && pos.totals.orders > 0 ? <span className="text-[10px] text-violet-300">auto-filled from POS</span> : null} />
              <Field label="Refunds ($)" value={refunds} onChange={setRefunds} placeholder="optional"
                rightEl={!refunds && pos.totals.refunds > 0 ? <span className="text-[10px] text-violet-300">auto-filled from POS</span> : null} />
              <Field label="COGS ($)" value={cogs} onChange={setCogs} placeholder="optional" />
              <Field label="Labor cost ($)" value={laborCost} onChange={setLaborCost} placeholder="optional" />
              <Field label="Foot traffic" value={footTraffic} onChange={setFootTraffic} placeholder="optional" />
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-neutral-400">
              {!cogs && (
                <div className="rounded-md border border-yellow-500/20 bg-yellow-500/5 px-3 py-2">
                  💡 Add <strong>COGS</strong> to improve margin accuracy (typical cafés: ~32% of sales).
                </div>
              )}
              {!laborCost && (
                <div className="rounded-md border border-blue-500/20 bg-blue-500/5 px-3 py-2">
                  💡 Add <strong>Labor</strong> to track labor % (many shops target ~18–22%).
                </div>
              )}
            </div>
          </Section>

          {/* Step 2: Context */}
          <Section
            title="Step 2 · Context & Goals (optional)"
            subtitle="Open if you want AI to factor in promos, location, and goals."
            right={
              <button type="button" onClick={() => setStep2Open((v) => !v)} className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-neutral-300 hover:bg-neutral-800/60">
                {step2Open ? 'Hide' : 'Show'}
              </button>
            }
          >
            {step2Open && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <Field label="City" value={city} onChange={setCity} />
                  <Field label="Upcoming promo" value={upcomingPromo} onChange={setUpcomingPromo} placeholder="e.g., BOGO Fri 3–6pm" />
                  <Field label="Avg. prep time (min)" value={avgPrep} onChange={setAvgPrep} placeholder="optional" />
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <Field label="Top items (comma-separated)" value={topItems} onChange={setTopItems} />
                  <Field label="Goal for next period" value={goal} onChange={setGoal} />
                  <label className="block">
                    <div className="mb-1.5 text-xs font-medium text-neutral-300">Notes / context</div>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={4}
                      placeholder="Weather, staffing, equipment, events, supply issues…"
                      className="w-full rounded-lg border border-white/10 bg-neutral-800/60 px-3 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:ring-2 focus:ring-violet-500/60"
                    />
                  </label>
                </div>
              </div>
            )}
          </Section>

          {/* Step 3: POS paste */}
          <Section
            title="Step 3 · POS Paste (optional) & Generate"
            subtitle="Paste daily summary lines; headers help but aren’t required."
            right={<button type="button" onClick={loadSample} className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-neutral-300 hover:bg-neutral-800/60">Load sample data</button>}
          >
            <textarea
              value={posText}
              onChange={(e) => setPosText(e.target.value)}
              rows={6}
              placeholder={`date,sales,orders,refunds,cogs,labor,traffic
2025-08-01,4280,210,36,1420,860,260
2025-08-02,4460,222,0,1460,900,270
...`}
              className="w-full rounded-lg border border-dashed border-white/10 bg-neutral-800/50 px-3 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:ring-2 focus:ring-violet-500/60"
            />
            {pos.rows.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-6">
                <Stat label="Rows" value={String(pos.rows.length)} />
                <Stat label="Gross Sales" value={money(pos.totals.sales)} />
                <Stat label="Orders" value={String(pos.totals.orders)} />
                <Stat label="Refunds" value={money(pos.totals.refunds)} />
                <Stat label="COGS" value={money(pos.totals.cogs)} />
                <Stat label="Labor $" value={money(pos.totals.labor)} />
              </div>
            )}

            {/* Results */}
            <div id="results" className="mt-6 rounded-lg border border-white/10 bg-neutral-900/40 p-4">
              {!apiError && !apiResult && (
                <div className="text-sm text-neutral-500">
                  Click <span className="text-neutral-200">Generate</span> to get an AI recap & forecast. Your inputs + any POS paste will be sent.
                </div>
              )}
              {apiError && <div className="text-sm text-red-400">Error: {apiError}</div>}
              {apiResult && (
                <div className="space-y-4">
                  <h4 className="text-white font-semibold">AI Summary</h4>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="rounded-lg border border-white/10 bg-neutral-900/60 p-3">
                      <div className="text-xs text-neutral-400">Revenue</div>
                      <div className="text-lg font-semibold text-white">{(apiResult as any)?.kpis?.revenue ?? '—'}</div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-neutral-900/60 p-3">
                      <div className="text-xs text-neutral-400">Orders</div>
                      <div className="text-lg font-semibold text-white">{(apiResult as any)?.kpis?.orders ?? '—'}</div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-neutral-900/60 p-3">
                      <div className="text-xs text-neutral-400">Avg Ticket</div>
                      <div className="text-lg font-semibold text-white">{(apiResult as any)?.kpis?.avgTicket ?? '—'}</div>
                    </div>
                  </div>

                  {Array.isArray((apiResult as any)?.actions) && (apiResult as any).actions.length > 0 && (
                    <div>
                      <div className="mb-2 text-white font-semibold">Suggested actions</div>
                      <ul className="list-disc pl-5 text-sm text-neutral-200">
                        {(apiResult as any).actions.map((a: string, i: number) => <li key={i}>{a}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Section>

          {/* ===== Menu Profit Engine ===== */}
          <Section
            title="Menu Profit Engine"
            subtitle="Paste a simple CSV: item,price,cost. Get classes and quick advice."
            right={<span className="text-xs text-neutral-400">Ex: Latte,5.50,1.25</span>}
          >
            <textarea
              value={menuCSV}
              onChange={(e) => setMenuCSV(e.target.value)}
              rows={5}
              placeholder={`item,price,cost
Latte,5.50,1.25
Cold Brew,5.25,1.10
Baklava,4.00,1.20`}
              className="w-full rounded-lg border border-dashed border-white/10 bg-neutral-800/50 px-3 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:ring-2 focus:ring-violet-500/60"
            />
            {menuClasses.length > 0 && (
              <div className="mt-4 overflow-x-auto rounded-lg border border-white/10">
                <table className="min-w-full text-sm">
                  <thead className="bg-neutral-900/60 text-neutral-300">
                    <tr>
                      <th className="px-3 py-2 text-left">Item</th>
                      <th className="px-3 py-2 text-right">Price</th>
                      <th className="px-3 py-2 text-right">Cost</th>
                      <th className="px-3 py-2 text-right">Margin</th>
                      <th className="px-3 py-2 text-center">Class</th>
                      <th className="px-3 py-2 text-left">Advice</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {menuClasses.map((m, i) => (
                      <tr key={i} className="text-neutral-200">
                        <td className="px-3 py-2">{m.item}</td>
                        <td className="px-3 py-2 text-right">{money(m.price)}</td>
                        <td className="px-3 py-2 text-right">{money(m.cost)}</td>
                        <td className="px-3 py-2 text-right">{money(m.margin)}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={cx(
                            'rounded px-2 py-0.5 text-xs',
                            m.cls === 'STAR' && 'bg-emerald-500/15 text-emerald-300',
                            m.cls === 'PLOWHORSE' && 'bg-yellow-500/15 text-yellow-300',
                            m.cls === 'PUZZLE' && 'bg-blue-500/15 text-blue-300',
                            m.cls === 'DOG' && 'bg-rose-500/15 text-rose-300'
                          )}>
                            {m.cls}
                          </span>
                        </td>
                        <td className="px-3 py-2">{m.advice}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {/* ===== Shift Planner ===== */}
          <Section
            title="Shift Planner"
            subtitle="From your POS trend, estimate staffing to hit labor% targets."
            right={<span className="text-xs text-neutral-400">Assumes ~10 open hours/day</span>}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label="Service rate (orders per staff / hour)" value={String(serviceRate)} onChange={(v) => setServiceRate(Number(v) || 1)} />
              <Field label="Avg wage ($/hr)" value={String(avgWage)} onChange={(v) => setAvgWage(Number(v) || 1)} />
              <Field label="Target labor %" value={String(targetLaborPct)} onChange={(v) => setTargetLaborPct(Number(v) || 1)} />
            </div>

            {staffingPlan.length > 0 ? (
              <div className="mt-4 overflow-x-auto rounded-lg border border-white/10">
                <table className="min-w-full text-sm">
                  <thead className="bg-neutral-900/60 text-neutral-300">
                    <tr>
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-right">Staff Needed</th>
                      <th className="px-3 py-2 text-right">Est. Labor $</th>
                      <th className="px-3 py-2 text-right">Labor %</th>
                      <th className="px-3 py-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {staffingPlan.map((d, i) => (
                      <tr key={i} className="text-neutral-200">
                        <td className="px-3 py-2">{d.date}</td>
                        <td className="px-3 py-2 text-right">{d.staffNeeded}</td>
                        <td className="px-3 py-2 text-right">{money(d.laborCostDay)}</td>
                        <td className="px-3 py-2 text-right">{d.laborPctDay.toFixed(1)}%</td>
                        <td className="px-3 py-2 text-right">
                          <span className={cx(
                            'rounded px-2 py-0.5 text-xs',
                            d.laborPctDay <= targetLaborPct ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'
                          )}>
                            {d.laborPctDay <= targetLaborPct ? 'On target' : 'High'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-sm text-neutral-400 mt-2">Paste POS (Step 3) to see staffing suggestions.</div>
            )}
          </Section>

          {/* ===== Alerts settings ===== */}
          <Section title="Daily Alerts" subtitle="Email alerts when KPIs slip so you can react the same day.">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <label className="flex items-center gap-2 text-sm text-neutral-200">
                <input type="checkbox" checked={alertsEnabled} onChange={(e) => setAlertsEnabled(e.target.checked)} />
                Enable alerts
              </label>
              <Field label="Send to (email)" value={alertEmail} onChange={setAlertEmail} />
              <div className="grid grid-cols-2 gap-4">
                <Field label="AOV drop trigger (%)" value={String(aovDipPct)} onChange={(v) => setAovDipPct(Number(v) || 1)} />
                <Field label="Max labor % target" value={String(laborCapPct)} onChange={(v) => setLaborCapPct(Number(v) || 1)} />
              </div>
            </div>
            {aovTrend && (
              <div className="mt-3 text-xs text-neutral-400">
                Current AOV change across range:{' '}
                <span className={aovTrend.change < 0 ? 'text-rose-300' : 'text-emerald-300'}>
                  {aovTrend.change.toFixed(1)}%
                </span>
                {aovTrend.change < -aovDipPct && <span className="ml-2 text-rose-300">— would trigger alert</span>}
              </div>
            )}
          </Section>
        </div>

        {/* RIGHT (KPIs) */}
        <div className="space-y-6">
          <div className="lg:sticky lg:top-6 space-y-6">
            <Section title="Key KPIs" subtitle="Live as you type.">
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Gross Sales" value={money(grossSalesNum)} />
                <Stat label="Orders" value={String(totalOrdersNum || 0)} />
                <Stat label="AOV" value={aov ? money(aov) : '—'} />
                <Stat label="Refunds" value={money(totalRefundsNum)} />
                <Stat label="COGS" value={money(totalCogsNum)} />
                <Stat label="Labor $" value={money(totalLaborNum)} />
                <Stat label="Labor %" value={laborPct !== null ? `${Math.round(laborPct)}%` : '—'} />
                <Stat label="Gross Margin" value={grossMarginPct !== null ? `${Math.round(grossMarginPct)}%` : '—'} />
              </div>
            </Section>

            <Section title="Tips" subtitle="Quick pointers for new users.">
              <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-400">
                <li>Use date chips for fast ranges (Last 7, This month).</li>
                <li>Paste POS to auto-fill totals; override any field manually.</li>
                <li>Add COGS/Labor to unlock margin & labor % accuracy.</li>
                <li>Generate to see AI recap & 7-day forecast.</li>
              </ul>
            </Section>
          </div>
        </div>
      </div>

      {/* Sticky bottom action bar */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-neutral-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <div className="hidden flex-1 items-center gap-3 md:flex">
            <div className="rounded-lg border border-white/10 bg-neutral-900/60 px-3 py-2 text-xs text-neutral-300">
              {startDate && endDate
                ? <>Range: <span className="text-neutral-100">{startDate}</span> → <span className="text-neutral-100">{endDate}</span></>
                : <>Pick a date range to enable Generate</>}
            </div>
            <div className="rounded-lg border border-white/10 bg-neutral-900/60 px-3 py-2 text-xs text-neutral-300">
              {grossSalesNum > 0 || (pos.rows?.length ?? 0) > 0
                ? <>Inputs OK</>
                : <>Add sales or paste POS</>}
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setApiError(null);
                setApiResult(null);
              }}
              className="rounded-lg border border-white/10 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800/60"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!formLooksReady || loading}
              className={cx(
                'rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2.5 text-sm font-semibold text-white shadow',
                (!formLooksReady || loading) && 'opacity-60 cursor-not-allowed'
              )}
            >
              {loading ? 'Working…' : 'Generate Recap & 7-Day Forecast'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


