export type WorldRiskLevel = "low" | "medium" | "high" | "critical";
export type WorldSignalType =
  | "calendar"
  | "seasonality"
  | "weather"
  | "local_event"
  | "demand_shift"
  | "delivery_mix"
  | "staffing_pressure"
  | "holiday"
  | "unknown";

export type WorldModelContext = {
  locationName?: string | null;
  now?: Date | string | null;
  dayOfWeek?: number | null;
  month?: number | null;
  revenue?: number | null;
  orders?: number | null;
  refunds?: number | null;
  avgRating?: number | null;
  laborPct?: number | null;
  marginPct?: number | null;
  demandScore?: number | null;
  operationsScore?: number | null;
  staffingScore?: number | null;
  serviceScore?: number | null;
  profitabilityScore?: number | null;
  reputationScore?: number | null;
};

export type WorldSignal = {
  id: string;
  type: WorldSignalType;
  label: string;
  riskLevel: WorldRiskLevel;
  confidence: number;
  summary: string;
  evidence: string[];
  operatorImplication: string;
  recommendedAdjustment: string;
};

export type WorldModelResult = {
  ok: true;
  locationName: string | null;
  summary: string;
  externalPressureScore: number;
  demandModifierPct: number;
  laborModifierPct: number;
  marginRiskModifierPct: number;
  deliveryPressure: WorldRiskLevel;
  signals: WorldSignal[];
  assumptions: string[];
  generatedAt: string;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function safeNumber(value: number | null | undefined, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toDate(value?: Date | string | null) {
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function riskFromScore(score: number): WorldRiskLevel {
  if (score >= 85) return "critical";
  if (score >= 68) return "high";
  if (score >= 42) return "medium";
  return "low";
}

function signalId(type: WorldSignalType, label: string) {
  return `${type}_${label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, "")}`;
}

function buildSignal(params: {
  type: WorldSignalType;
  label: string;
  score: number;
  confidence: number;
  summary: string;
  evidence: string[];
  operatorImplication: string;
  recommendedAdjustment: string;
}): WorldSignal {
  return {
    id: signalId(params.type, params.label),
    type: params.type,
    label: params.label,
    riskLevel: riskFromScore(params.score),
    confidence: Math.round(clamp(params.confidence, 0, 100)),
    summary: params.summary,
    evidence: params.evidence,
    operatorImplication: params.operatorImplication,
    recommendedAdjustment: params.recommendedAdjustment,
  };
}

export function buildWorldModel(context: WorldModelContext): WorldModelResult {
  const date = toDate(context.now);
  const dayOfWeek = context.dayOfWeek ?? date.getDay();
  const month = context.month ?? date.getMonth() + 1;
  const locationName = context.locationName ?? null;

  const demand = safeNumber(context.demandScore, 70);
  const operations = safeNumber(context.operationsScore, 70);
  const staffing = safeNumber(context.staffingScore, 70);
  const service = safeNumber(context.serviceScore, 70);
  const profitability = safeNumber(context.profitabilityScore, 70);
  const reputation = safeNumber(context.reputationScore, 70);

  const refunds = safeNumber(context.refunds);
  const laborPct = safeNumber(context.laborPct);
  const marginPct = safeNumber(context.marginPct, 60);
  const orders = safeNumber(context.orders);
  const revenue = safeNumber(context.revenue);

  const signals: WorldSignal[] = [];
  const assumptions: string[] = [
    "This first World Model version uses calendar, seasonality, and restaurant-state assumptions.",
    "Live weather, sports, holidays, local events, traffic, and competitor data will be connected later.",
    "World signals should adjust recommendations, not replace operator judgment.",
  ];

  const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6;
  const isMondayOrTuesday = dayOfWeek === 1 || dayOfWeek === 2;
  const isSummer = month >= 6 && month <= 8;
  const isHolidaySeason = month === 11 || month === 12;
  const isNewYearWindow = month === 1;

  if (isWeekend) {
    signals.push(
      buildSignal({
        type: "calendar",
        label: "Weekend demand pattern",
        score: demand >= 70 ? 58 : 70,
        confidence: 72,
        summary:
          "Weekend periods usually create different demand and staffing pressure than weekdays.",
        evidence: [
          `Day of week is ${dayOfWeek}.`,
          `Demand score is ${demand}/100.`,
          `Staffing score is ${staffing}/100.`,
        ],
        operatorImplication:
          "The AI should avoid treating weekend performance like a normal weekday.",
        recommendedAdjustment:
          "Compare staffing, refunds, and orders against weekend baselines before changing strategy.",
      }),
    );
  }

  if (isMondayOrTuesday) {
    signals.push(
      buildSignal({
        type: "calendar",
        label: "Early-week demand softness",
        score: demand < 65 ? 68 : 44,
        confidence: 65,
        summary:
          "Early-week periods are often softer and should not automatically trigger panic promotions.",
        evidence: [
          `Day of week is ${dayOfWeek}.`,
          `Orders are ${orders}.`,
          `Revenue is ${revenue}.`,
        ],
        operatorImplication:
          "The AI should distinguish normal weekday softness from true demand decline.",
        recommendedAdjustment:
          "Use conservative offers and avoid overcorrecting unless softness repeats across multiple weeks.",
      }),
    );
  }

  if (isSummer) {
    signals.push(
      buildSignal({
        type: "seasonality",
        label: "Summer demand shift",
        score: service < 65 || staffing < 65 ? 72 : 50,
        confidence: 58,
        summary:
          "Summer can shift dining patterns, staffing availability, and delivery/dine-in mix.",
        evidence: [
          `Month is ${month}.`,
          `Service score is ${service}/100.`,
          `Staffing score is ${staffing}/100.`,
        ],
        operatorImplication:
          "Demand may move by daypart or channel even when total weekly sales look stable.",
        recommendedAdjustment:
          "Watch daypart mix, delivery pressure, patio/dine-in demand, and staffing gaps.",
      }),
    );
  }

  if (isHolidaySeason) {
    signals.push(
      buildSignal({
        type: "holiday",
        label: "Holiday season volatility",
        score: 76,
        confidence: 62,
        summary:
          "Holiday-season demand can be volatile and may distort normal sales comparisons.",
        evidence: [
          `Month is ${month}.`,
          `Revenue is ${revenue}.`,
          `Orders are ${orders}.`,
        ],
        operatorImplication:
          "The AI should compare performance against holiday-adjusted expectations.",
        recommendedAdjustment:
          "Plan staffing and inventory around event-driven spikes rather than average weekly demand.",
      }),
    );
  }

  if (isNewYearWindow) {
    signals.push(
      buildSignal({
        type: "seasonality",
        label: "New-year reset pattern",
        score: 54,
        confidence: 50,
        summary:
          "January often changes consumer demand, pricing sensitivity, and ordering habits.",
        evidence: [`Month is ${month}.`, `Demand score is ${demand}/100.`],
        operatorImplication:
          "The AI should be careful comparing January to December without seasonality adjustment.",
        recommendedAdjustment:
          "Use lightweight promotions and monitor whether demand returns after the first two weeks.",
      }),
    );
  }

  if (refunds >= 20 && operations < 65) {
    signals.push(
      buildSignal({
        type: "delivery_mix",
        label: "Operational leakage may be channel-sensitive",
        score: clamp(55 + refunds * 0.4 + (65 - operations), 45, 92),
        confidence: 68,
        summary:
          "Refund pressure combined with weak operations may indicate a channel or throughput issue.",
        evidence: [
          `Refund count is ${refunds}.`,
          `Operations score is ${operations}/100.`,
          `Service score is ${service}/100.`,
        ],
        operatorImplication:
          "The AI should not assume all refunds have the same root cause.",
        recommendedAdjustment:
          "Separate dine-in, pickup, and delivery refunds before deciding whether to change staffing, menu, or prep.",
      }),
    );
  }

  if (laborPct >= 28 && profitability < 65) {
    signals.push(
      buildSignal({
        type: "staffing_pressure",
        label: "Labor margin tension",
        score: clamp(45 + (laborPct - 25) * 5 + (65 - profitability), 45, 90),
        confidence: 70,
        summary:
          "Labor pressure and profitability weakness may be interacting.",
        evidence: [
          `Labor percentage is ${laborPct}%.`,
          `Profitability score is ${profitability}/100.`,
          `Margin percentage is ${marginPct}%.`,
        ],
        operatorImplication:
          "The AI should avoid recommending simple labor cuts if service or refunds are already stressed.",
        recommendedAdjustment:
          "Review labor deployment by daypart instead of cutting across the board.",
      }),
    );
  }

  if (reputation < 65 || service < 65) {
    signals.push(
      buildSignal({
        type: "demand_shift",
        label: "Guest confidence risk",
        score: clamp(50 + (65 - Math.min(reputation, service)) * 1.3, 45, 88),
        confidence: 63,
        summary:
          "Weak service or reputation can reduce future demand even before revenue visibly declines.",
        evidence: [
          `Reputation score is ${reputation}/100.`,
          `Service score is ${service}/100.`,
          `Average rating is ${context.avgRating ?? "unknown"}.`,
        ],
        operatorImplication:
          "The AI should treat guest sentiment as a forward-looking demand indicator.",
        recommendedAdjustment:
          "Prioritize service recovery and review response before aggressive acquisition campaigns.",
      }),
    );
  }

  if (!signals.length) {
    signals.push(
      buildSignal({
        type: "unknown",
        label: "No dominant external pressure detected",
        score: 30,
        confidence: 45,
        summary:
          "No strong world-context modifier is visible from current assumptions.",
        evidence: [
          `Demand score is ${demand}/100.`,
          `Operations score is ${operations}/100.`,
          `Profitability score is ${profitability}/100.`,
        ],
        operatorImplication:
          "The AI should rely mostly on internal restaurant state until external data is connected.",
        recommendedAdjustment:
          "Continue monitoring and avoid over-weighting world context for this decision.",
      }),
    );
  }

  const externalPressureScore = Math.round(
    clamp(signals.reduce((sum, signal) => sum + signal.confidence * 0.35, 0) / Math.max(signals.length, 1)),
  );

  const demandModifierPct = Math.round(
    clamp(
      signals.reduce((sum, signal) => {
        if (signal.type === "calendar" && signal.label.includes("Weekend")) return sum + 3;
        if (signal.type === "calendar" && signal.label.includes("Early-week")) return sum - 2;
        if (signal.type === "holiday") return sum + 5;
        if (signal.type === "seasonality") return sum + 1;
        if (signal.type === "demand_shift") return sum - 4;
        return sum;
      }, 0),
      -12,
      12,
    ),
  );

  const laborModifierPct = Math.round(
    clamp(
      signals.reduce((sum, signal) => {
        if (signal.type === "staffing_pressure") return sum + 3;
        if (signal.type === "calendar" && signal.label.includes("Weekend")) return sum + 2;
        if (signal.type === "holiday") return sum + 4;
        return sum;
      }, 0),
      -8,
      10,
    ),
  );

  const marginRiskModifierPct = Math.round(
    clamp(
      signals.reduce((sum, signal) => {
        if (signal.type === "delivery_mix") return sum + 4;
        if (signal.type === "staffing_pressure") return sum + 3;
        if (signal.type === "demand_shift") return sum + 2;
        return sum;
      }, 0),
      0,
      15,
    ),
  );

  const deliveryPressureScore = signals.some((signal) => signal.type === "delivery_mix")
    ? 68
    : refunds >= 20
      ? 55
      : 30;

  const strongest = [...signals].sort((a, b) => b.confidence - a.confidence)[0];

  return {
    ok: true,
    locationName,
    summary: strongest
      ? `${strongest.label}: ${strongest.summary}`
      : "World Model is collecting external context.",
    externalPressureScore,
    demandModifierPct,
    laborModifierPct,
    marginRiskModifierPct,
    deliveryPressure: riskFromScore(deliveryPressureScore),
    signals,
    assumptions,
    generatedAt: new Date().toISOString(),
  };
}

export function buildNetworkWorldModel(contexts: WorldModelContext[]) {
  const results = contexts.map((context) => buildWorldModel(context));
  const topSignal = results
    .flatMap((result) => result.signals.map((signal) => ({ signal, locationName: result.locationName })))
    .sort((a, b) => b.signal.confidence - a.signal.confidence)[0];

  return {
    ok: true as const,
    mode: contexts.length > 1 ? "network" : "single_location",
    locationsModeled: contexts.length,
    summary: topSignal
      ? `${topSignal.locationName || "The restaurant"}: ${topSignal.signal.summary}`
      : "World Model is collecting external context.",
    topSignal: topSignal ?? null,
    locationModels: results,
    generatedAt: new Date().toISOString(),
  };
}