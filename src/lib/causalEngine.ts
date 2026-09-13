export type CausalConfidence = "low" | "medium" | "high";
export type CausalSeverity = "watch" | "risk" | "critical";
export type CausalCategory =
  | "profitability"
  | "operations"
  | "staffing"
  | "service"
  | "demand"
  | "marketing"
  | "reputation"
  | "execution";

export type CausalMetricSnapshot = {
  locationName?: string | null;
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

export type CausalStateScores = {
  demand?: number | null;
  operations?: number | null;
  staffing?: number | null;
  service?: number | null;
  marketing?: number | null;
  profitability?: number | null;
  reputation?: number | null;
  execution?: number | null;
};

export type CausalContext = {
  locationName?: string | null;
  overallScore?: number | null;
  level?: string | null;
  scores?: CausalStateScores | null;
  metrics?: CausalMetricSnapshot | null;
  primaryRisk?: string | null;
  primaryOpportunity?: string | null;
};

export type CausalHypothesis = {
  id: string;
  locationName: string | null;
  category: CausalCategory;
  severity: CausalSeverity;
  confidence: CausalConfidence;
  confidenceScore: number;
  cause: string;
  explanation: string;
  evidence: string[];
  affectedMetrics: string[];
  recommendedActions: string[];
  whatWouldChangeMyMind: string[];
  generatedAt: string;
};

export type CausalAnalysisResult = {
  ok: true;
  mode: "single_location" | "network";
  summary: string;
  topHypothesis: CausalHypothesis | null;
  hypotheses: CausalHypothesis[];
  generatedAt: string;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function safeNumber(value: number | null | undefined, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function formatPct(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "unknown";
  const sign = value > 0 ? "+" : "";
  return `${sign}${Math.round(value)}%`;
}

function titleCase(value: string | null | undefined) {
  if (!value) return "Unknown";
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/(^_|_$)/g, "");
}

function confidenceFromScore(score: number): CausalConfidence {
  if (score >= 78) return "high";
  if (score >= 55) return "medium";
  return "low";
}

function severityFromScore(score: number): CausalSeverity {
  if (score >= 82) return "critical";
  if (score >= 62) return "risk";
  return "watch";
}

function makeHypothesis(params: {
  context: CausalContext;
  category: CausalCategory;
  score: number;
  cause: string;
  explanation: string;
  evidence: string[];
  affectedMetrics: string[];
  recommendedActions: string[];
  whatWouldChangeMyMind: string[];
}): CausalHypothesis {
  const locationName = params.context.locationName ?? null;
  const confidenceScore = Math.round(clamp(params.score));

  return {
    id: `${params.category}_${slug(locationName || "global")}_${slug(params.cause)}`,
    locationName,
    category: params.category,
    severity: severityFromScore(confidenceScore),
    confidence: confidenceFromScore(confidenceScore),
    confidenceScore,
    cause: params.cause,
    explanation: params.explanation,
    evidence: params.evidence.filter(Boolean),
    affectedMetrics: params.affectedMetrics,
    recommendedActions: params.recommendedActions,
    whatWouldChangeMyMind: params.whatWouldChangeMyMind,
    generatedAt: new Date().toISOString(),
  };
}

export function analyzeRestaurantCausality(context: CausalContext): CausalHypothesis[] {
  const metrics = context.metrics ?? {};
  const scores = context.scores ?? {};
  const locationName = context.locationName ?? "this restaurant";

  const revenueDelta = metrics.revenueDeltaPct;
  const ordersDelta = metrics.ordersDeltaPct;
  const refunds = safeNumber(metrics.refunds);
  const laborPct = safeNumber(metrics.laborPct);
  const marginPct = safeNumber(metrics.marginPct);
  const reviewIssues = safeNumber(metrics.reviewIssueCount);
  const openAlerts = safeNumber(metrics.openAlerts);
  const pendingActions = safeNumber(metrics.pendingActions);
  const avgOutcome = metrics.avgOutcomeScore;

  const operations = safeNumber(scores.operations, 70);
  const staffing = safeNumber(scores.staffing, 70);
  const service = safeNumber(scores.service, 70);
  const profitability = safeNumber(scores.profitability, 70);
  const demand = safeNumber(scores.demand, 70);
  const marketing = safeNumber(scores.marketing, 70);
  const reputation = safeNumber(scores.reputation, 70);
  const execution = safeNumber(scores.execution, 70);

  const hypotheses: CausalHypothesis[] = [];

  if (refunds >= 20 || profitability < 60) {
    const score = clamp(
      45 +
        refunds * 0.45 +
        (100 - profitability) * 0.35 +
        (100 - operations) * 0.2,
      45,
      94,
    );

    hypotheses.push(
      makeHypothesis({
        context,
        category: "profitability",
        score,
        cause: "Refund pressure is likely creating margin leakage.",
        explanation: `${locationName} appears to be losing margin through operational leakage rather than pure demand weakness. The AI should treat refunds as a profitability signal, not just a service issue.`,
        evidence: [
          `Refund count is ${refunds}.`,
          `Profitability score is ${profitability}/100.`,
          `Operations score is ${operations}/100.`,
          revenueDelta !== null ? `Revenue changed ${formatPct(revenueDelta)}.` : "Revenue movement is not yet available.",
        ],
        affectedMetrics: ["Refunds", "Profitability", "Revenue", "Guest Experience"],
        recommendedActions: [
          "Audit refund reasons by shift, channel, and menu item.",
          "Compare refund-heavy periods against staffing and ticket volume.",
          "Separate food-quality refunds from delivery, wait-time, and expectation mismatch.",
          "Use margin protection as operator-reviewed action until outcome evidence improves.",
        ],
        whatWouldChangeMyMind: [
          "Refunds decline while profitability remains weak.",
          "Revenue drops without any refund or labor change.",
          "Review text shows price sensitivity rather than operational mistakes.",
        ],
      }),
    );
  }

  if (staffing < 62 || laborPct >= 28) {
    const score = clamp(
      40 +
        (100 - staffing) * 0.45 +
        Math.max(0, laborPct - 24) * 2.2 +
        reviewIssues * 4,
      40,
      92,
    );

    hypotheses.push(
      makeHypothesis({
        context,
        category: "staffing",
        score,
        cause: "Labor deployment may be creating operational strain.",
        explanation: `${locationName} may be experiencing a staffing mismatch. The issue may not be total labor alone, but whether labor is deployed during the right demand windows.`,
        evidence: [
          `Staffing score is ${staffing}/100.`,
          laborPct ? `Labor is running at ${laborPct}%.` : "Labor percentage is not available yet.",
          `Review issue count is ${reviewIssues}.`,
          `Refund count is ${refunds}.`,
        ],
        affectedMetrics: ["Labor", "Refunds", "Service", "Operations"],
        recommendedActions: [
          "Compare labor deployment against peak demand windows.",
          "Review refund spikes by hour and shift.",
          "Avoid broad labor cuts until service and refund impact is understood.",
          "Test one staffing adjustment and measure refund/rating movement afterward.",
        ],
        whatWouldChangeMyMind: [
          "Labor remains stable while refunds rise.",
          "Refunds cluster around delivery channels rather than in-store operations.",
          "Reviews cite product quality instead of speed or accuracy.",
        ],
      }),
    );
  }

  if (service < 65 || reputation < 65 || reviewIssues >= 2) {
    const score = clamp(
      42 +
        (100 - service) * 0.35 +
        (100 - reputation) * 0.3 +
        reviewIssues * 7,
      42,
      90,
    );

    hypotheses.push(
      makeHypothesis({
        context,
        category: "service",
        score,
        cause: "Guest experience may be degrading before it becomes a rating problem.",
        explanation: `${locationName} is showing signs that service quality could be slipping. The AI should treat negative reviews and issue count as early-warning signals.`,
        evidence: [
          `Service score is ${service}/100.`,
          `Reputation score is ${reputation}/100.`,
          `Review issue count is ${reviewIssues}.`,
          metrics.avgRating !== null && metrics.avgRating !== undefined
            ? `Average rating is ${metrics.avgRating}.`
            : "Average rating is not available yet.",
        ],
        affectedMetrics: ["Rating", "Reviews", "Repeat Visits", "Refunds"],
        recommendedActions: [
          "Identify the most repeated complaint theme.",
          "Respond to negative reviews with specific recovery language.",
          "Connect review complaints to operational causes.",
          "Measure whether the issue count falls after action.",
        ],
        whatWouldChangeMyMind: [
          "Review issue count falls while refunds remain high.",
          "Ratings remain stable despite operational alerts.",
          "Complaints are isolated to one unusual event.",
        ],
      }),
    );
  }

  if (demand < 62 && marketing < 62) {
    const score = clamp(
      38 +
        (100 - demand) * 0.35 +
        (100 - marketing) * 0.35 +
        Math.max(0, -(ordersDelta ?? 0)) * 0.8,
      38,
      86,
    );

    hypotheses.push(
      makeHypothesis({
        context,
        category: "demand",
        score,
        cause: "Demand softness may be caused by weak marketing momentum.",
        explanation: `${locationName} may need demand reactivation, but the AI should confirm operations can handle added traffic before recommending promotions.`,
        evidence: [
          `Demand score is ${demand}/100.`,
          `Marketing score is ${marketing}/100.`,
          ordersDelta !== null ? `Orders changed ${formatPct(ordersDelta)}.` : "Order trend is not available yet.",
          revenueDelta !== null ? `Revenue changed ${formatPct(revenueDelta)}.` : "Revenue trend is not available yet.",
        ],
        affectedMetrics: ["Orders", "Revenue", "Marketing", "Demand"],
        recommendedActions: [
          "Test a narrow campaign before broad discounts.",
          "Target a specific daypart or customer segment.",
          "Avoid discounting if margin or service is already weak.",
          "Measure orders, revenue, and margin after the campaign.",
        ],
        whatWouldChangeMyMind: [
          "Demand is stable but revenue falls from lower average ticket.",
          "Operations are weak enough that more traffic would worsen service.",
          "External events explain the demand dip.",
        ],
      }),
    );
  }

  if (execution < 62 || pendingActions >= 5) {
    const score = clamp(
      40 +
        (100 - execution) * 0.45 +
        pendingActions * 4 +
        openAlerts * 5,
      40,
      88,
    );

    hypotheses.push(
      makeHypothesis({
        context,
        category: "execution",
        score,
        cause: "The restaurant may have an execution backlog.",
        explanation: `${locationName} has enough open or pending operator work that follow-through may be the limiting factor. The AI should prioritize fewer, higher-confidence actions.`,
        evidence: [
          `Execution score is ${execution}/100.`,
          `Pending actions: ${pendingActions}.`,
          `Open alerts: ${openAlerts}.`,
          avgOutcome !== null && avgOutcome !== undefined
            ? `Average measured outcome is ${Math.round(avgOutcome)}/100.`
            : "Measured outcome quality is still being collected.",
        ],
        affectedMetrics: ["Execution", "Operator Focus", "Outcome Quality"],
        recommendedActions: [
          "Reduce the action list to the top one or two moves.",
          "Execute only actions with clear success metrics.",
          "Close the loop by measuring outcomes after execution.",
          "Archive or dismiss stale low-confidence actions.",
        ],
        whatWouldChangeMyMind: [
          "Pending actions drop while performance remains weak.",
          "Outcome scores improve after fewer actions are executed.",
          "Open alerts are stale and not tied to current operating risk.",
        ],
      }),
    );
  }

  if (hypotheses.length === 0) {
    hypotheses.push(
      makeHypothesis({
        context,
        category: "operations",
        score: 52,
        cause: "No dominant cause is clear yet.",
        explanation: `${locationName} looks stable enough that the AI should keep observing rather than overreacting. More before/after outcome data will sharpen causal reasoning.`,
        evidence: [
          `Overall score is ${safeNumber(context.overallScore, 0)}/100.`,
          `Primary risk is ${titleCase(context.primaryRisk)}.`,
          `Primary opportunity is ${titleCase(context.primaryOpportunity)}.`,
        ],
        affectedMetrics: ["Operations", "Learning", "Planning"],
        recommendedActions: [
          "Continue monitoring core operating metrics.",
          "Avoid unnecessary intervention.",
          "Run the Outcome Engine after future executions.",
        ],
        whatWouldChangeMyMind: [
          "Refunds, labor, ratings, or revenue move sharply.",
          "A recurring problem appears across multiple actions.",
          "Outcome evidence confirms one playbook is consistently working.",
        ],
      }),
    );
  }

  return hypotheses.sort((a, b) => b.confidenceScore - a.confidenceScore);
}

export function analyzeNetworkCausality(contexts: CausalContext[]): CausalAnalysisResult {
  const all = contexts.flatMap((context) => analyzeRestaurantCausality(context));
  const sorted = all.sort((a, b) => b.confidenceScore - a.confidenceScore);
  const top = sorted[0] ?? null;

  const repeatedCategories = sorted.reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] ?? 0) + 1;
    return acc;
  }, {});

  const topCategory = Object.entries(repeatedCategories).sort((a, b) => b[1] - a[1])[0];

  return {
    ok: true,
    mode: contexts.length > 1 ? "network" : "single_location",
    summary: top
      ? contexts.length > 1
        ? `The strongest network-level causal hypothesis is ${top.cause} The most repeated causal category is ${titleCase(topCategory?.[0])}.`
        : `The strongest causal hypothesis is ${top.cause}`
      : "No causal hypothesis is strong enough yet.",
    topHypothesis: top,
    hypotheses: sorted,
    generatedAt: new Date().toISOString(),
  };
}

export function analyzeSingleRestaurantCausality(context: CausalContext): CausalAnalysisResult {
  const hypotheses = analyzeRestaurantCausality(context);
  const top = hypotheses[0] ?? null;

  return {
    ok: true,
    mode: "single_location",
    summary: top
      ? `The strongest causal hypothesis is ${top.cause}`
      : "No causal hypothesis is strong enough yet.",
    topHypothesis: top,
    hypotheses,
    generatedAt: new Date().toISOString(),
  };
}