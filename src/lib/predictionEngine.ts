export type PredictionRiskLevel = "low" | "medium" | "high" | "critical";
export type PredictionHorizon = "next_24_hours" | "next_7_days" | "next_14_days";

export type PredictionStateScores = {
  demand?: number | null;
  operations?: number | null;
  staffing?: number | null;
  service?: number | null;
  marketing?: number | null;
  profitability?: number | null;
  reputation?: number | null;
  execution?: number | null;
};

export type PredictionMetrics = {
  revenue?: number | null;
  previousRevenue?: number | null;
  revenueDeltaPct?: number | null;
  orders?: number | null;
  previousOrders?: number | null;
  ordersDeltaPct?: number | null;
  refunds?: number | null;
  avgRating?: number | null;
  reviewIssueCount?: number | null;
  laborPct?: number | null;
  marginPct?: number | null;
  openAlerts?: number | null;
  pendingActions?: number | null;
  avgOutcomeScore?: number | null;
};

export type PredictionContext = {
  locationName?: string | null;
  overallScore?: number | null;
  level?: string | null;
  scores?: PredictionStateScores | null;
  metrics?: PredictionMetrics | null;
  primaryRisk?: string | null;
  primaryOpportunity?: string | null;
};

export type RestaurantPrediction = {
  id: string;
  locationName: string | null;
  horizon: PredictionHorizon;
  riskLevel: PredictionRiskLevel;
  confidence: number;
  prediction: string;
  expectedChange: string;
  estimatedBusinessImpact: string;
  leadingIndicators: string[];
  ifIgnored: string[];
  bestIntervention: string[];
  metricsForecast: {
    revenueChangePct: number | null;
    refundChangePct: number | null;
    ratingChange: number | null;
    marginChangePct: number | null;
    laborChangePct: number | null;
  };
  generatedAt: string;
};

export type PredictionResult = {
  ok: true;
  mode: "single_location" | "network";
  horizon: PredictionHorizon;
  summary: string;
  topPrediction: RestaurantPrediction | null;
  predictions: RestaurantPrediction[];
  generatedAt: string;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function safeNumber(value: number | null | undefined, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function round(value: number, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function titleCase(value: string | null | undefined) {
  if (!value) return "Unknown";
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/(^_|_$)/g, "");
}

function riskFromScore(score: number): PredictionRiskLevel {
  if (score >= 85) return "critical";
  if (score >= 68) return "high";
  if (score >= 42) return "medium";
  return "low";
}

function formatPct(value: number | null) {
  if (value === null || Number.isNaN(value)) return "unknown";
  const sign = value > 0 ? "+" : "";
  return `${sign}${round(value, 1)}%`;
}

function formatRating(value: number | null) {
  if (value === null || Number.isNaN(value)) return "unknown";
  const sign = value > 0 ? "+" : "";
  return `${sign}${round(value, 2)}`;
}

function predictRevenueChange(context: PredictionContext, horizon: PredictionHorizon) {
  const scores = context.scores ?? {};
  const metrics = context.metrics ?? {};

  const demand = safeNumber(scores.demand, 70);
  const operations = safeNumber(scores.operations, 70);
  const marketing = safeNumber(scores.marketing, 70);
  const revenueTrend = metrics.revenueDeltaPct;

  let forecast = revenueTrend !== null && revenueTrend !== undefined ? revenueTrend * 0.55 : 0;

  if (demand < 60) forecast -= (60 - demand) * 0.18;
  if (marketing < 60) forecast -= (60 - marketing) * 0.12;
  if (operations < 60) forecast -= (60 - operations) * 0.1;

  if (demand > 75) forecast += (demand - 75) * 0.08;
  if (marketing > 75) forecast += (marketing - 75) * 0.06;

  if (horizon === "next_14_days") forecast *= 1.35;
  if (horizon === "next_24_hours") forecast *= 0.35;

  return round(forecast, 1);
}

function predictRefundChange(context: PredictionContext, horizon: PredictionHorizon) {
  const scores = context.scores ?? {};
  const metrics = context.metrics ?? {};

  const operations = safeNumber(scores.operations, 70);
  const staffing = safeNumber(scores.staffing, 70);
  const service = safeNumber(scores.service, 70);
  const refunds = safeNumber(metrics.refunds);
  const reviewIssues = safeNumber(metrics.reviewIssueCount);

  let forecast = 0;

  if (refunds >= 50) forecast += 14;
  else if (refunds >= 25) forecast += 8;
  else if (refunds >= 10) forecast += 3;

  if (operations < 60) forecast += (60 - operations) * 0.35;
  if (staffing < 60) forecast += (60 - staffing) * 0.22;
  if (service < 65) forecast += (65 - service) * 0.18;
  if (reviewIssues > 0) forecast += reviewIssues * 2;

  if (operations > 75 && service > 75) forecast -= 4;

  if (horizon === "next_14_days") forecast *= 1.4;
  if (horizon === "next_24_hours") forecast *= 0.45;

  return round(forecast, 1);
}

function predictRatingChange(context: PredictionContext, horizon: PredictionHorizon) {
  const scores = context.scores ?? {};
  const metrics = context.metrics ?? {};

  const service = safeNumber(scores.service, 70);
  const reputation = safeNumber(scores.reputation, 70);
  const refunds = safeNumber(metrics.refunds);
  const reviewIssues = safeNumber(metrics.reviewIssueCount);

  let forecast = 0;

  if (service < 60) forecast -= (60 - service) * 0.006;
  if (reputation < 60) forecast -= (60 - reputation) * 0.005;
  if (refunds >= 30) forecast -= 0.05;
  if (refunds >= 60) forecast -= 0.08;
  if (reviewIssues > 0) forecast -= reviewIssues * 0.025;

  if (service > 78 && reputation > 78) forecast += 0.03;

  if (horizon === "next_14_days") forecast *= 1.35;
  if (horizon === "next_24_hours") forecast *= 0.35;

  return round(forecast, 2);
}

function predictMarginChange(context: PredictionContext, horizon: PredictionHorizon) {
  const scores = context.scores ?? {};
  const metrics = context.metrics ?? {};

  const profitability = safeNumber(scores.profitability, 70);
  const operations = safeNumber(scores.operations, 70);
  const laborPct = safeNumber(metrics.laborPct);
  const refunds = safeNumber(metrics.refunds);

  let forecast = 0;

  if (profitability < 60) forecast -= (60 - profitability) * 0.12;
  if (operations < 60) forecast -= (60 - operations) * 0.08;
  if (laborPct >= 28) forecast -= (laborPct - 27) * 0.18;
  if (refunds >= 25) forecast -= refunds * 0.025;

  if (profitability > 78 && operations > 72) forecast += 0.8;

  if (horizon === "next_14_days") forecast *= 1.3;
  if (horizon === "next_24_hours") forecast *= 0.4;

  return round(forecast, 1);
}

function predictLaborChange(context: PredictionContext, horizon: PredictionHorizon) {
  const scores = context.scores ?? {};
  const metrics = context.metrics ?? {};

  const staffing = safeNumber(scores.staffing, 70);
  const operations = safeNumber(scores.operations, 70);
  const refunds = safeNumber(metrics.refunds);
  const laborPct = safeNumber(metrics.laborPct);

  let forecast = 0;

  if (staffing < 60) forecast += (60 - staffing) * 0.08;
  if (operations < 58 && refunds > 20) forecast += 1.2;
  if (laborPct >= 30) forecast += 0.7;

  if (horizon === "next_14_days") forecast *= 1.2;
  if (horizon === "next_24_hours") forecast *= 0.35;

  return round(forecast, 1);
}

function buildPrediction(context: PredictionContext, horizon: PredictionHorizon): RestaurantPrediction {
  const scores = context.scores ?? {};
  const metrics = context.metrics ?? {};
  const locationName = context.locationName ?? null;
  const locationText = locationName || "this restaurant";

  const operations = safeNumber(scores.operations, 70);
  const profitability = safeNumber(scores.profitability, 70);
  const staffing = safeNumber(scores.staffing, 70);
  const service = safeNumber(scores.service, 70);
  const reputation = safeNumber(scores.reputation, 70);
  const execution = safeNumber(scores.execution, 70);

  const refunds = safeNumber(metrics.refunds);
  const pendingActions = safeNumber(metrics.pendingActions);
  const openAlerts = safeNumber(metrics.openAlerts);

  const revenueChangePct = predictRevenueChange(context, horizon);
  const refundChangePct = predictRefundChange(context, horizon);
  const ratingChange = predictRatingChange(context, horizon);
  const marginChangePct = predictMarginChange(context, horizon);
  const laborChangePct = predictLaborChange(context, horizon);

  const operatingWeakness =
    (100 - operations) * 0.22 +
    (100 - profitability) * 0.24 +
    (100 - staffing) * 0.12 +
    (100 - service) * 0.12 +
    (100 - reputation) * 0.08 +
    (100 - execution) * 0.08 +
    refunds * 0.18 +
    pendingActions * 1.8 +
    openAlerts * 3;

  const riskScore = Math.round(clamp(operatingWeakness, 12, 96));
  const confidence = Math.round(
    clamp(
      48 +
        (metrics.revenue !== null && metrics.revenue !== undefined ? 8 : 0) +
        (metrics.refunds !== null && metrics.refunds !== undefined ? 8 : 0) +
        (metrics.laborPct !== null && metrics.laborPct !== undefined ? 7 : 0) +
        (metrics.avgOutcomeScore !== null && metrics.avgOutcomeScore !== undefined ? 8 : 0) +
        Math.min(safeNumber(metrics.pendingActions), 8),
      35,
      91,
    ),
  );

  let prediction = `${locationText} is likely to remain in a watch state unless the current operating pressure is reduced.`;
  let expectedChange = `Expected movement: revenue ${formatPct(revenueChangePct)}, refunds ${formatPct(refundChangePct)}, margin ${formatPct(marginChangePct)}, rating ${formatRating(ratingChange)}.`;
  let estimatedBusinessImpact =
    "The largest near-term impact is likely to come from preventing leakage rather than chasing new demand.";

  if (refundChangePct >= 10 || refunds >= 40) {
    prediction = `${locationText} is likely to see refund pressure continue if no corrective action is taken.`;
    estimatedBusinessImpact =
      "Margin leakage may compound through refunds, remake time, service recovery, and lower guest confidence.";
  } else if (revenueChangePct < -4) {
    prediction = `${locationText} may experience near-term revenue softness if current demand and execution signals do not improve.`;
    estimatedBusinessImpact =
      "The business risk is lower traffic efficiency and weaker revenue per operating hour.";
  } else if (marginChangePct < -2) {
    prediction = `${locationText} may face margin compression even if revenue remains stable.`;
    estimatedBusinessImpact =
      "Profitability risk is likely higher than demand risk.";
  }

  return {
    id: `prediction_${slug(locationName || "global")}_${horizon}`,
    locationName,
    horizon,
    riskLevel: riskFromScore(riskScore),
    confidence,
    prediction,
    expectedChange,
    estimatedBusinessImpact,
    leadingIndicators: [
      `Operations score: ${operations}/100.`,
      `Profitability score: ${profitability}/100.`,
      `Staffing score: ${staffing}/100.`,
      `Refund count: ${refunds}.`,
      `Pending actions: ${pendingActions}.`,
    ],
    ifIgnored: [
      refundChangePct > 0
        ? `Refunds may increase approximately ${formatPct(refundChangePct)}.`
        : "Refund pressure is not expected to rise sharply.",
      marginChangePct < 0
        ? `Margin may compress approximately ${formatPct(marginChangePct)}.`
        : "Margin is not forecasted to decline sharply.",
      ratingChange < 0
        ? `Rating may soften by about ${formatRating(ratingChange)}.`
        : "Rating is not forecasted to decline sharply.",
    ],
    bestIntervention: [
      "Prioritize the highest-ranked Planning Engine move.",
      "Measure before/after revenue, refunds, labor, and rating.",
      "Avoid broad promotions until operational leakage is understood.",
      "Run the Outcome Engine after execution to update the Brain.",
    ],
    metricsForecast: {
      revenueChangePct,
      refundChangePct,
      ratingChange,
      marginChangePct,
      laborChangePct,
    },
    generatedAt: new Date().toISOString(),
  };
}

export function predictRestaurantFuture(params: {
  context: PredictionContext;
  horizon?: PredictionHorizon;
}): PredictionResult {
  const horizon = params.horizon ?? "next_14_days";
  const prediction = buildPrediction(params.context, horizon);

  return {
    ok: true,
    mode: "single_location",
    horizon,
    summary: prediction.prediction,
    topPrediction: prediction,
    predictions: [prediction],
    generatedAt: new Date().toISOString(),
  };
}

export function predictNetworkFuture(params: {
  contexts: PredictionContext[];
  horizon?: PredictionHorizon;
}): PredictionResult {
  const horizon = params.horizon ?? "next_14_days";
  const predictions = params.contexts
    .map((context) => buildPrediction(context, horizon))
    .sort((a, b) => {
      const riskOrder: Record<PredictionRiskLevel, number> = {
        critical: 4,
        high: 3,
        medium: 2,
        low: 1,
      };

      if (riskOrder[b.riskLevel] !== riskOrder[a.riskLevel]) {
        return riskOrder[b.riskLevel] - riskOrder[a.riskLevel];
      }

      return b.confidence - a.confidence;
    });

  const topPrediction = predictions[0] ?? null;

  return {
    ok: true,
    mode: params.contexts.length > 1 ? "network" : "single_location",
    horizon,
    summary: topPrediction
      ? `The highest forecasted risk is at ${topPrediction.locationName || "the restaurant"}: ${topPrediction.prediction}`
      : "No forecasted risk is strong enough yet.",
    topPrediction,
    predictions,
    generatedAt: new Date().toISOString(),
  };
}