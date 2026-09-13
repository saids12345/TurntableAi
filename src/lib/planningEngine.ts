export type PlanningUrgency = "low" | "medium" | "high" | "critical";
export type PlanningImpact = "low" | "medium" | "high";
export type PlanningRisk = "low" | "medium" | "high";
export type PlanningHorizon = "today" | "next_24_hours" | "next_7_days";

export type RestaurantStateScores = {
  demand?: number | null;
  operations?: number | null;
  staffing?: number | null;
  service?: number | null;
  marketing?: number | null;
  profitability?: number | null;
  reputation?: number | null;
  execution?: number | null;
};

export type PlanningContext = {
  locationName?: string | null;
  health?: "healthy" | "watch" | "risk" | "critical" | string | null;
  scores?: RestaurantStateScores | null;
  revenue?: number | null;
  orders?: number | null;
  refunds?: number | null;
  avgRating?: number | null;
  reviewIssueCount?: number | null;
  laborPct?: number | null;
  marginPct?: number | null;
  openAlerts?: number | null;
  topIssue?: string | null;
  operatorMemoryLessons?: number | null;
  averageOutcomeScore?: number | null;
  reusableLessons?: number | null;
};

export type PlannedMove = {
  id: string;
  title: string;
  actionType: string;
  locationName: string | null;
  urgency: PlanningUrgency;
  impact: PlanningImpact;
  risk: PlanningRisk;
  confidence: number;
  roiScore: number;
  priorityScore: number;
  reason: string;
  expectedOutcome: string;
  executionWindow: string;
  checklist: string[];
  successMetric: string;
};

export type PlanningResult = {
  ok: true;
  horizon: PlanningHorizon;
  locationName: string | null;
  summary: string;
  topMove: PlannedMove | null;
  moves: PlannedMove[];
  generatedAt: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function safeNumber(value: number | null | undefined, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/(^_|_$)/g, "");
}

function titleLocation(locationName?: string | null) {
  return locationName ? ` at ${locationName}` : "";
}

function urgencyFromScore(score: number): PlanningUrgency {
  if (score >= 85) return "critical";
  if (score >= 70) return "high";
  if (score >= 45) return "medium";
  return "low";
}

function impactFromScore(score: number): PlanningImpact {
  if (score >= 75) return "high";
  if (score >= 45) return "medium";
  return "low";
}

function riskFromScore(score: number): PlanningRisk {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function confidenceFromContext(context: PlanningContext, base = 0.58) {
  const lessons = safeNumber(context.operatorMemoryLessons);
  const reusable = safeNumber(context.reusableLessons);
  const outcome = context.averageOutcomeScore;

  let confidence = base;

  if (lessons > 0) confidence += Math.min(lessons * 0.015, 0.12);
  if (reusable > 0) confidence += Math.min(reusable * 0.04, 0.18);
  if (typeof outcome === "number") {
    if (outcome >= 75) confidence += 0.14;
    else if (outcome >= 60) confidence += 0.07;
    else if (outcome < 50) confidence -= 0.08;
  }

  return clamp(confidence, 0.25, 0.94);
}

function buildMove(params: {
  context: PlanningContext;
  actionType: string;
  title: string;
  urgencyScore: number;
  impactScore: number;
  riskScore: number;
  roiScore: number;
  reason: string;
  expectedOutcome: string;
  executionWindow: string;
  checklist: string[];
  successMetric: string;
  confidenceBase?: number;
}): PlannedMove {
  const confidence = confidenceFromContext(params.context, params.confidenceBase ?? 0.58);

  const priorityScore = Math.round(
    clamp(
      params.urgencyScore * 0.34 +
        params.impactScore * 0.32 +
        params.roiScore * 0.24 +
        confidence * 100 * 0.1 -
        params.riskScore * 0.12,
      0,
      100,
    ),
  );

  return {
    id: `${params.actionType}_${slugify(params.context.locationName || "global")}_${Date.now()}`,
    title: params.title,
    actionType: params.actionType,
    locationName: params.context.locationName ?? null,
    urgency: urgencyFromScore(params.urgencyScore),
    impact: impactFromScore(params.impactScore),
    risk: riskFromScore(params.riskScore),
    confidence,
    roiScore: Math.round(clamp(params.roiScore, 0, 100)),
    priorityScore,
    reason: params.reason,
    expectedOutcome: params.expectedOutcome,
    executionWindow: params.executionWindow,
    checklist: params.checklist,
    successMetric: params.successMetric,
  };
}

export function buildPlanningCandidates(context: PlanningContext): PlannedMove[] {
  const scores = context.scores ?? {};
  const location = titleLocation(context.locationName);

  const profitability = safeNumber(scores.profitability, 65);
  const operations = safeNumber(scores.operations, 65);
  const staffing = safeNumber(scores.staffing, 65);
  const service = safeNumber(scores.service, 70);
  const reputation = safeNumber(scores.reputation, 70);
  const marketing = safeNumber(scores.marketing, 65);
  const demand = safeNumber(scores.demand, 65);
  const execution = safeNumber(scores.execution, 65);

  const refunds = safeNumber(context.refunds);
  const reviewIssues = safeNumber(context.reviewIssueCount);
  const openAlerts = safeNumber(context.openAlerts);
  const laborPct = safeNumber(context.laborPct);
  const avgRating = context.avgRating;

  const moves: PlannedMove[] = [];

  const refundPressure =
    refunds >= 20 || profitability < 58 || String(context.topIssue || "").toLowerCase().includes("refund");

  if (refundPressure) {
    moves.push(
      buildMove({
        context,
        actionType: "margin_protection",
        title: `Protect margins${location}`,
        urgencyScore: clamp(100 - profitability + refunds * 0.35, 45, 95),
        impactScore: clamp(100 - profitability + 15, 45, 92),
        riskScore: 34,
        roiScore: clamp(100 - profitability + refunds * 0.25, 50, 94),
        reason:
          "Refund pressure or weak profitability suggests leakage that should be reviewed before it compounds.",
        expectedOutcome:
          "Reduce refund leakage, protect contribution margin, and identify operational waste.",
        executionWindow: "Today",
        checklist: [
          "Audit refund reasons by shift and item.",
          "Compare refund-heavy orders against staffing and ticket volume.",
          "Identify whether the issue is food quality, speed, delivery, or expectation mismatch.",
          "Create one corrective action and measure refund movement after execution.",
        ],
        successMetric: "Refunds decrease without hurting revenue or rating.",
        confidenceBase: 0.66,
      }),
    );
  }

  if (operations < 65 || execution < 65 || openAlerts >= 2) {
    moves.push(
      buildMove({
        context,
        actionType: "operator_review",
        title: `Run operator review${location}`,
        urgencyScore: clamp(100 - Math.min(operations, execution) + openAlerts * 5, 40, 90),
        impactScore: clamp(100 - Math.min(operations, execution) + 10, 45, 88),
        riskScore: 22,
        roiScore: clamp(100 - Math.min(operations, execution) + 8, 45, 86),
        reason:
          "Operational health is soft enough that the safest move is to inspect the root cause before automating a fix.",
        expectedOutcome:
          "Clarify the bottleneck and prevent the AI from repeating a weak playbook blindly.",
        executionWindow: "Today",
        checklist: [
          "Review the top issue and source signals.",
          "Check whether the problem is demand, staffing, service, or profitability.",
          "Assign the smallest corrective action that can be measured.",
          "Record the outcome so future recommendations improve.",
        ],
        successMetric: "Root cause identified and next action selected.",
        confidenceBase: 0.72,
      }),
    );
  }

  if (staffing < 62 || laborPct >= 28) {
    moves.push(
      buildMove({
        context,
        actionType: "labor_adjustment",
        title: `Review labor deployment${location}`,
        urgencyScore: clamp(100 - staffing + laborPct, 45, 88),
        impactScore: clamp(100 - staffing + 8, 45, 85),
        riskScore: 52,
        roiScore: clamp(100 - staffing + 4, 42, 82),
        reason:
          "Staffing pressure may be affecting speed, refunds, or margin. Labor changes should be reviewed carefully before execution.",
        expectedOutcome:
          "Improve labor efficiency without reducing service quality.",
        executionWindow: "Next 24 hours",
        checklist: [
          "Compare labor percentage against sales volume.",
          "Find shifts with high refunds or slow service.",
          "Adjust staffing only where demand supports it.",
          "Measure refunds, rating, and revenue after the adjustment.",
        ],
        successMetric: "Labor percentage improves while rating and revenue remain stable.",
        confidenceBase: 0.55,
      }),
    );
  }

  if (
  service < 65 ||
  reputation < 65 ||
  reviewIssues >= 2 ||
  (typeof avgRating === "number" &&
    avgRating < 4.2)
) {
    moves.push(
      buildMove({
        context,
        actionType: "service_recovery",
        title: `Stabilize guest sentiment${location}`,
        urgencyScore: clamp(100 - Math.min(service, reputation) + reviewIssues * 6, 45, 92),
        impactScore: clamp(100 - reputation + 12, 45, 90),
        riskScore: 28,
        roiScore: clamp(100 - reputation + reviewIssues * 4, 42, 88),
        reason:
          "Guest sentiment is vulnerable. Service recovery should happen before negative feedback becomes a reputation pattern.",
        expectedOutcome:
          "Protect rating, reduce repeat complaints, and recover dissatisfied guests.",
        executionWindow: "Today",
        checklist: [
          "Identify the most common review complaint.",
          "Respond to affected guests with a specific recovery message.",
          "Fix the operational cause behind the complaint.",
          "Track rating and issue count after the recovery action.",
        ],
        successMetric: "Negative review issue count decreases and rating stabilizes.",
        confidenceBase: 0.64,
      }),
    );
  }

  if (marketing < 60 && demand < 70) {
    moves.push(
      buildMove({
        context,
        actionType: "traffic_reactivation",
        title: `Reactivate demand${location}`,
        urgencyScore: clamp(100 - demand + 6, 35, 78),
        impactScore: clamp(100 - marketing + 8, 40, 84),
        riskScore: 61,
        roiScore: clamp(100 - marketing, 35, 80),
        reason:
          "Demand and marketing momentum are both soft, but this should be tested only if operations can handle more traffic.",
        expectedOutcome:
          "Recover order volume while protecting margin and service quality.",
        executionWindow: "Next 7 days",
        checklist: [
          "Confirm operations can handle additional demand.",
          "Choose a narrow offer rather than a broad discount.",
          "Target a specific customer segment or daypart.",
          "Measure revenue lift, order lift, and margin impact.",
        ],
        successMetric: "Orders increase without margin deterioration.",
        confidenceBase: 0.5,
      }),
    );
  }

  if (moves.length === 0) {
    moves.push(
      buildMove({
        context,
        actionType: "monitoring",
        title: `Monitor current state${location}`,
        urgencyScore: 30,
        impactScore: 35,
        riskScore: 10,
        roiScore: 35,
        reason:
          "The restaurant appears stable. The best operator move is to keep monitoring and avoid unnecessary intervention.",
        expectedOutcome:
          "Preserve stability while collecting more evidence for future decisions.",
        executionWindow: "Next 24 hours",
        checklist: [
          "Monitor revenue, refunds, labor, and review changes.",
          "Avoid launching unnecessary actions.",
          "Wait for a stronger signal before intervening.",
        ],
        successMetric: "No deterioration in state scores or core metrics.",
        confidenceBase: 0.62,
      }),
    );
  }

  return moves.sort((a, b) => b.priorityScore - a.priorityScore);
}

export function createPlanningResult(params: {
  context: PlanningContext;
  horizon?: PlanningHorizon;
}): PlanningResult {
  const horizon = params.horizon ?? "next_7_days";
  const moves = buildPlanningCandidates(params.context);
  const topMove = moves[0] ?? null;

  const locationText = params.context.locationName
    ? `${params.context.locationName}`
    : "the restaurant";

  const summary = topMove
    ? `The highest-priority move for ${locationText} is "${topMove.title}" with ${Math.round(
        topMove.confidence * 100,
      )}% confidence and a priority score of ${topMove.priorityScore}/100.`
    : `No operator move is recommended for ${locationText} right now.`;

  return {
    ok: true,
    horizon,
    locationName: params.context.locationName ?? null,
    summary,
    topMove,
    moves,
    generatedAt: new Date().toISOString(),
  };
}

export function createNetworkPlanningResult(params: {
  contexts: PlanningContext[];
  horizon?: PlanningHorizon;
}) {
  const horizon = params.horizon ?? "next_7_days";

  const locationPlans = params.contexts.map((context) =>
    createPlanningResult({ context, horizon }),
  );

  const allMoves = locationPlans
    .flatMap((plan) => plan.moves)
    .sort((a, b) => b.priorityScore - a.priorityScore);

  const topMove = allMoves[0] ?? null;

  return {
    ok: true as const,
    horizon,
    locationsPlanned: params.contexts.length,
    summary: topMove
      ? `The highest-priority move across the restaurant network is "${topMove.title}" with a priority score of ${topMove.priorityScore}/100.`
      : "No urgent network-wide move is recommended right now.",
    topMove,
    moves: allMoves,
    locationPlans,
    generatedAt: new Date().toISOString(),
  };
}