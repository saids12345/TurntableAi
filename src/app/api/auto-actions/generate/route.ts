import { NextResponse } from "next/server";
import { getSupabaseRouteClient } from "@/lib/supabaseRoute";
import { runAIKernel } from "@/lib/aiKernel";
import {
  buildDecisionChangeProvenance,
} from "@/lib/brain/decisionProvenance";
import {
  applyConfidenceBoost,
  getRelevantLessons,
  inferProblemTypeFromSignals,
  type RelevantLessonsResult,
} from "@/lib/operatorLearning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type HealthStatus = "healthy" | "watch" | "risk";
type AlertSeverity = "low" | "medium" | "high";
type AlertType = "sales" | "reviews" | "ops";
type AutoActionStatus = "pending" | "approved" | "executed" | "dismissed";

type ActionType =
  | "promo_launch"
  | "review_response_push"
  | "labor_adjustment"
  | "performance_push"
  | "operator_review"
  | "service_recovery"
  | "throughput_stabilization"
  | "margin_protection"
  | "traffic_reactivation";

type CommandCenterLocation = {
  id: string;
  name: string;
  city: string;
  health: HealthStatus;
  salesDeltaPct: number | null;
  reviewIssueCount: number;
  openAlerts: number;
  avgRating: number | null;
  topIssue: string | null;
  recommendedAction: string | null;
  latestRevenue: number | null;
  previousRevenue: number | null;
  latestOrders: number | null;
  previousOrders: number | null;
  latestAvgTicket: number | null;
  previousAvgTicket: number | null;
  latestLaborPct: number | null;
  latestMarginPct: number | null;
  latestRefunds: number | null;
  negativeReviewExamples: string[];
};

type CommandCenterAlert = {
  id: string;
  severity: AlertSeverity;
  locationName: string;
  type: AlertType;
  title: string;
  description: string;
};

type AutoActionRow = {
  id: string;
  user_id: string;
  location_name: string;
  action_type: string;
  title: string;
  reason: string;
  recommended_payload: Record<string, unknown>;
  source_signal: Record<string, unknown>;
  status: AutoActionStatus;
  priority_score: number;
  created_at: string;
  updated_at: string;
};

type AutoActionInsert = {
  user_id: string;
  location_name: string;
  action_type: string;
  title: string;
  reason: string;
  recommended_payload: Record<string, unknown>;
  source_signal: Record<string, unknown>;
  status: AutoActionStatus;
  priority_score: number;
  created_at: string;
  updated_at: string;
};

type ReviewRow = {
  id: string;
  location_name: string | null;
  rating: number | null;
  text: string | null;
  update_time: string | null;
};

type ReviewLocationRow = {
  id: string;
  name: string;
  title: string | null;
};

type PerformanceSignalRow = {
  id: string;
  location_name: string;
  revenue: number | null;
  orders: number | null;
  avg_ticket: number | null;
  labor_pct: number | null;
  margin_pct: number | null;
  refunds: number | null;
  captured_at: string;
};

type DecisionContext = {
  confidence: number;
  baseConfidence: number;
  confidenceBoost: number;
  urgency: "low" | "medium" | "high" | "critical";
  expectedImpact: "low" | "medium" | "high";
  likelyOutcome: string;
  reasonBullets: string[];
  trigger: {
    type: string;
    summary: string;
    detectedFrom: string[];
  };
  operatorLearning: {
    problemType: string;
    lessonsFound: number;
    reusableLessons: number;
    successfulLessons: number;
    averageOutcomeScore: number | null;
    topPlaybook: string | null;
    recommendationContext: string;
  };
};

const AUTO_ACTION_SELECT =
  "id, user_id, location_name, action_type, title, reason, recommended_payload, source_signal, status, priority_score, created_at, updated_at";

const AUTO_ACTION_COOLDOWN_MINUTES = 15;

function daysAgoIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function minutesAgoIso(minutes: number) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

async function shouldForceRegeneration(request: Request) {
  try {
    const url = new URL(request.url);
    if (url.searchParams.get("force") === "true") return true;

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) return false;

    const body = (await request.json().catch(() => null)) as {
      force?: unknown;
    } | null;

    return body?.force === true;
  } catch {
    return false;
  }
}

function numOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  return null;
}

function avg(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundTo(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function normalizeLocationName(value: string | null | undefined) {
  return (value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactText(value: string | null | undefined, max = 140) {
  const text = (value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function detectIssueBuckets(reviews: ReviewRow[]) {
  const buckets = {
    wait_time: 0,
    service: 0,
    wrong_order: 0,
    cleanliness: 0,
    pricing: 0,
    food_quality: 0,
    refunds: 0,
    general: 0,
  };

  for (const review of reviews) {
    const text = (review.text || "").toLowerCase();

    if (!text.trim()) {
      buckets.general += 1;
      continue;
    }

    let matched = false;

    if (
      text.includes("wait") ||
      text.includes("slow") ||
      text.includes("line") ||
      text.includes("delay") ||
      text.includes("late")
    ) {
      buckets.wait_time += 1;
      matched = true;
    }

    if (
      text.includes("staff") ||
      text.includes("rude") ||
      text.includes("service") ||
      text.includes("attitude") ||
      text.includes("employee")
    ) {
      buckets.service += 1;
      matched = true;
    }

    if (
      text.includes("wrong order") ||
      text.includes("incorrect") ||
      text.includes("missing") ||
      text.includes("forgot") ||
      text.includes("mixed up")
    ) {
      buckets.wrong_order += 1;
      matched = true;
    }

    if (
      text.includes("dirty") ||
      text.includes("clean") ||
      text.includes("messy") ||
      text.includes("bathroom")
    ) {
      buckets.cleanliness += 1;
      matched = true;
    }

    if (
      text.includes("expensive") ||
      text.includes("overpriced") ||
      text.includes("price") ||
      text.includes("cost")
    ) {
      buckets.pricing += 1;
      matched = true;
    }

    if (
      text.includes("cold") ||
      text.includes("stale") ||
      text.includes("burnt") ||
      text.includes("taste") ||
      text.includes("flavor") ||
      text.includes("quality")
    ) {
      buckets.food_quality += 1;
      matched = true;
    }

    if (
      text.includes("refund") ||
      text.includes("chargeback") ||
      text.includes("money back")
    ) {
      buckets.refunds += 1;
      matched = true;
    }

    if (!matched) buckets.general += 1;
  }

  return buckets;
}

function topIssueLabel(buckets: ReturnType<typeof detectIssueBuckets>) {
  const entries = Object.entries(buckets).sort((a, b) => b[1] - a[1]);
  const [topKey, topValue] = entries[0] ?? ["general", 0];

  if (!topValue) return null;

  switch (topKey) {
    case "wait_time":
      return "Wait-time complaints increasing";
    case "service":
      return "Service complaints increasing";
    case "wrong_order":
      return "Order accuracy complaints increasing";
    case "cleanliness":
      return "Cleanliness complaints increasing";
    case "pricing":
      return "Value and pricing complaints increasing";
    case "food_quality":
      return "Food or drink quality complaints increasing";
    case "refunds":
      return "Refund and compensation pressure increasing";
    default:
      return "Guest complaint pressure increasing";
  }
}

function recommendedActionForIssue(label: string | null) {
  if (!label) return "Review guest signals and prioritize follow-up";

  if (label.toLowerCase().includes("wait")) {
    return "Review queue flow, coach shift lead, and respond to delayed-service complaints";
  }

  if (label.toLowerCase().includes("service")) {
    return "Coach front-of-house execution and clear the review backlog quickly";
  }

  if (label.toLowerCase().includes("accuracy")) {
    return "Audit order handoff accuracy and follow up on complaint-heavy tickets";
  }

  if (label.toLowerCase().includes("cleanliness")) {
    return "Run a cleanliness check and escalate site standards immediately";
  }

  if (label.toLowerCase().includes("pricing")) {
    return "Review value perception and tighten the offer before changing pricing";
  }

  if (label.toLowerCase().includes("quality")) {
    return "Inspect prep consistency and review product-quality complaints with the team";
  }

  if (label.toLowerCase().includes("refund")) {
    return "Audit refund causes, retrain service recovery, and tighten execution fast";
  }

  return "Review complaints and tighten execution";
}

function deriveHealth(params: {
  avgRating: number | null;
  negativeCount: number;
  openAlerts: number;
  salesDeltaPct: number | null;
}): HealthStatus {
  const { avgRating, negativeCount, openAlerts, salesDeltaPct } = params;

  if (
    (avgRating !== null && avgRating < 4) ||
    negativeCount >= 3 ||
    openAlerts >= 3 ||
    (salesDeltaPct !== null && salesDeltaPct <= -8)
  ) {
    return "risk";
  }

  if (
    (avgRating !== null && avgRating < 4.4) ||
    negativeCount >= 1 ||
    openAlerts >= 1 ||
    (salesDeltaPct !== null && salesDeltaPct < 0)
  ) {
    return "watch";
  }

  return "healthy";
}

function severityRank(severity: AlertSeverity) {
  return { high: 30, medium: 20, low: 10 }[severity];
}

function buildLocationAlert(location: CommandCenterLocation): CommandCenterAlert | null {
  if (location.salesDeltaPct !== null && location.salesDeltaPct <= -8) {
    return {
      id: `sales-${location.id}`,
      severity: "high",
      locationName: location.name,
      type: "sales",
      title: "Revenue dip detected",
      description: `Sales trend is ${location.salesDeltaPct}% and this location needs immediate attention.`,
    };
  }

  if (location.reviewIssueCount >= 2 || (location.avgRating !== null && location.avgRating < 4)) {
    return {
      id: `reviews-${location.id}`,
      severity: location.health === "risk" ? "high" : "medium",
      locationName: location.name,
      type: "reviews",
      title: "Review pressure building",
      description:
        location.topIssue ??
        "Guest feedback is trending negatively and should be reviewed quickly.",
    };
  }

  if (location.openAlerts > 0) {
    return {
      id: `ops-${location.id}`,
      severity:
        location.health === "risk" ? "high" : location.health === "watch" ? "medium" : "low",
      locationName: location.name,
      type: "ops",
      title: "Operational watch item",
      description:
        location.recommendedAction ?? "This location has open operational signals to review.",
    };
  }

  return null;
}

function buildPriorityScore(location: CommandCenterLocation, alert: CommandCenterAlert | null) {
  let score = 0;

  if (location.health === "risk") score += 60;
  else if (location.health === "watch") score += 30;
  else score += 10;

  if (location.salesDeltaPct !== null) {
    if (location.salesDeltaPct < 0) score += Math.abs(location.salesDeltaPct) * 2;
    else score += Math.min(location.salesDeltaPct, 10);
  }

  score += location.reviewIssueCount * 12;
  score += location.openAlerts * 15;

  if (location.avgRating !== null) {
    if (location.avgRating < 4) score += 25;
    else if (location.avgRating < 4.3) score += 10;
  }

  if (location.latestRefunds !== null && location.latestRefunds > 0) {
    score += Math.min(location.latestRefunds * 4, 20);
  }

  if (location.latestLaborPct !== null && location.latestLaborPct > 35) {
    score += 8;
  }

  if (alert?.severity === "high") score += 25;
  else if (alert?.severity === "medium") score += 15;
  else if (alert?.severity === "low") score += 5;

  return Math.round(score);
}

function isActionWorthy(location: CommandCenterLocation, alert: CommandCenterAlert | null) {
  if (location.health === "risk") return true;
  if (location.health === "watch") return true;
  if (location.salesDeltaPct !== null && location.salesDeltaPct <= -5) return true;
  if (location.reviewIssueCount >= 2) return true;
  if (location.openAlerts >= 2) return true;
  if (location.avgRating !== null && location.avgRating < 4.2) return true;
  if (alert?.severity === "high") return true;
  if (location.latestRefunds !== null && location.latestRefunds >= 2) return true;

  return false;
}

function inferUrgency(priorityScore: number): DecisionContext["urgency"] {
  if (priorityScore >= 120) return "critical";
  if (priorityScore >= 90) return "high";
  if (priorityScore >= 55) return "medium";
  return "low";
}

function inferExpectedImpact(priorityScore: number): DecisionContext["expectedImpact"] {
  if (priorityScore >= 100) return "high";
  if (priorityScore >= 60) return "medium";
  return "low";
}

function computeConfidence(location: CommandCenterLocation, alert: CommandCenterAlert | null) {
  let confidence = 0.5;

  if (location.salesDeltaPct !== null) confidence += 0.12;
  if (location.avgRating !== null) confidence += 0.08;
  if (location.reviewIssueCount >= 2) confidence += 0.1;
  if (location.topIssue) confidence += 0.08;
  if (alert?.severity === "high") confidence += 0.07;
  if (location.latestRevenue !== null && location.previousRevenue !== null) confidence += 0.07;
  if (location.negativeReviewExamples.length > 0) confidence += 0.06;

  return roundTo(clamp(confidence, 0.52, 0.97), 2);
}

function buildReasonBullets(location: CommandCenterLocation, alert: CommandCenterAlert | null) {
  const bullets: string[] = [];

  if (location.salesDeltaPct !== null && location.salesDeltaPct < 0) {
    bullets.push(`Sales are down ${Math.abs(location.salesDeltaPct)}% versus the prior snapshot.`);
  }

  if (location.avgRating !== null) {
    bullets.push(`Average rating is ${location.avgRating.toFixed(1)}.`);
  }

  if (location.reviewIssueCount > 0) {
    bullets.push(`${location.reviewIssueCount} recent negative review(s) were detected.`);
  }

  if (location.topIssue) bullets.push(location.topIssue);

  if (location.latestRefunds !== null && location.latestRefunds > 0) {
    bullets.push(`Refund count is currently ${location.latestRefunds}.`);
  }

  if (location.latestLaborPct !== null && location.latestLaborPct > 35) {
    bullets.push(`Labor looks elevated at ${location.latestLaborPct}%.`);
  }

  if (alert) bullets.push(`${alert.title}: ${alert.description}`);

  return bullets.slice(0, 5);
}

function buildDecisionContext(
  location: CommandCenterLocation,
  alert: CommandCenterAlert | null,
  triggerType: string,
  likelyOutcome: string,
  learning: RelevantLessonsResult | null,
  problemType: string
): DecisionContext {
  const priorityScore = buildPriorityScore(location, alert);
  const baseConfidence = computeConfidence(location, alert);
  const confidence = learning
    ? applyConfidenceBoost(baseConfidence, learning.summary)
    : baseConfidence;

  return {
    confidence,
    baseConfidence,
    confidenceBoost: learning?.summary.confidenceBoost ?? 0,
    urgency: inferUrgency(priorityScore),
    expectedImpact: inferExpectedImpact(priorityScore),
    likelyOutcome,
    reasonBullets: buildReasonBullets(location, alert),
    trigger: {
      type: triggerType,
      summary:
        alert?.description ??
        location.topIssue ??
        location.recommendedAction ??
        "Operational signals crossed the action threshold.",
      detectedFrom: ["reviews", "performance_signal_history", "review_connections", "operator_memory"],
    },
    operatorLearning: {
      problemType,
      lessonsFound: learning?.summary.totalLessons ?? 0,
      reusableLessons: learning?.summary.reusableLessons ?? 0,
      successfulLessons: learning?.summary.successfulLessons ?? 0,
      averageOutcomeScore: learning?.summary.averageOutcomeScore ?? null,
      topPlaybook: learning?.summary.topPlaybook ?? null,
      recommendationContext:
        learning?.recommendationContext ??
        "No relevant operator memory found yet. Generate recommendation from current signals only.",
    },
  };
}

function buildLearningAwareReason(baseReason: string, learning: RelevantLessonsResult | null) {
  const totalLessons = learning?.summary.totalLessons ?? 0;

  if (!learning || totalLessons <= 0) {
    return baseReason;
  }

  const parts: string[] = [baseReason];

  if (learning.summary.topPlaybook) {
    parts.push(
      `Operator memory found ${totalLessons} similar lesson${
        totalLessons === 1 ? "" : "s"
      }; top prior playbook was ${learning.summary.topPlaybook.replace(/_/g, " ")}.`
    );
  } else {
    parts.push(
      `Operator memory found ${totalLessons} similar lesson${
        totalLessons === 1 ? "" : "s"
      } for this signal pattern.`
    );
  }

  if (learning.summary.averageOutcomeScore !== null) {
    parts.push(`Average prior outcome score: ${learning.summary.averageOutcomeScore}/100.`);
  }

  if (learning.summary.reusableLessons > 0) {
    parts.push("Reuse is supported by prior operator memory.");
  } else {
    parts.push("Prior memory suggests using caution before repeating the same playbook.");
  }

  return parts.join(" ");
}

function buildLearningChecklist(
  learning: RelevantLessonsResult | null,
  problemType: string
): string[] {
  const totalLessons = learning?.summary.totalLessons ?? 0;

  if (!learning || totalLessons <= 0) {
    return [];
  }

  const checklist: string[] = [
    `Review operator memory for ${problemType.replace(/_/g, " ")} before execution.`,
  ];

  if (learning.summary.topPlaybook) {
    checklist.push(
      `Compare this move against prior ${learning.summary.topPlaybook.replace(/_/g, " ")} outcomes.`
    );
  }

  if (learning.summary.averageOutcomeScore !== null) {
    checklist.push(`Use prior outcome score ${learning.summary.averageOutcomeScore}/100 as the baseline.`);
  }

  if (learning.summary.reusableLessons > 0) {
    checklist.push("Reuse the playbook if current signals match the successful past pattern.");
  } else {
    checklist.push("Treat this as a controlled test because past reuse evidence is weak.");
  }

  return checklist;
}

function mergeLearningIntoActionPlan(
  plan: Record<string, unknown>,
  learning: RelevantLessonsResult | null,
  problemType: string
): Record<string, unknown> {
  const learningChecklist = buildLearningChecklist(learning, problemType);

  if (!learningChecklist.length) {
    return plan;
  }

  const existingChecklist = Array.isArray(plan.checklist)
    ? plan.checklist.filter((item): item is string => typeof item === "string")
    : [];

  return {
    ...plan,
    learningMode: "operator_memory_informed",
    checklist: [...learningChecklist, ...existingChecklist],
  };
}

function buildActionPlan(
  actionType: ActionType,
  location: CommandCenterLocation
): Record<string, unknown> {
  if (actionType === "traffic_reactivation") {
    return {
      executionMode: "operator_approval",
      campaignType: "traffic_recovery",
      targetWindow:
        location.latestOrders !== null && location.latestOrders < 60
          ? "lunch_and_offpeak"
          : "next_7_days",
      channel: "in_store_social_and_email",
      suggestedOffer: "Bounce-back traffic recovery offer",
      checklist: [
        "Launch bounce-back promotion",
        "Generate social recovery campaign",
        "Push limited-time offer",
        "Track revenue recovery daily",
      ],
      successMetric: "traffic_recovery",
    };
  }

  if (actionType === "service_recovery") {
    return {
      executionMode: "semi_auto",
      escalation: "high_priority",
      targetSeverity: "high",
      suggestedWorkflow: "draft_replies_escalate_theme_notify_operator",
      checklist: [
        "Draft replies for unresolved reviews",
        "Escalate repeat complaint themes",
        "Notify operator immediately",
        "Track rating stabilization",
      ],
      successMetric: "rating_recovery",
    };
  }

  if (actionType === "throughput_stabilization") {
    return {
      executionMode: "operator_review",
      focus: "speed_and_capacity",
      targetWindow: "rush_periods",
      checklist: [
        "Review ticket times",
        "Audit staffing during rush",
        "Reduce bottlenecks",
        "Protect weekend throughput",
      ],
      successMetric: "throughput_stability",
    };
  }

  if (actionType === "margin_protection") {
    return {
      executionMode: "operator_review",
      focus: "margin_control",
      checklist: [
        "Audit refunds",
        "Review waste drivers",
        "Reduce labor inefficiency",
        "Protect contribution margin",
      ],
      successMetric: "margin_protection",
    };
  }

  if (actionType === "promo_launch") {
    return {
      executionMode: "operator_approval",
      targetWindow:
        location.latestOrders !== null && location.latestOrders < 60
          ? "lunch_and_offpeak"
          : "lunch",
      channel: "in_store_and_social",
      suggestedOffer:
        location.avgRating !== null && location.avgRating < 4
          ? "Bounce-back offer with service recovery"
          : "Traffic recovery offer",
      checklist: [
        "Generate campaign assets",
        "Generate social content",
        "Launch offer",
        "Review performance after 48h",
      ],
      successMetric: "revenue_recovery",
    };
  }

  if (actionType === "review_response_push") {
    return {
      executionMode: "semi_auto",
      targetSeverity: "high",
      suggestedWorkflow: "approve_and_post_replies",
      checklist: [
        "Generate review replies",
        "Escalate negative themes",
        "Track guest sentiment",
      ],
      successMetric: "rating_stabilization",
    };
  }

  if (actionType === "labor_adjustment") {
    return {
      executionMode: "operator_review",
      targetWindow: "slow_periods",
      checklist: [
        "Review labor by daypart",
        "Compare staffing vs traffic",
        "Reduce labor leakage",
      ],
      successMetric: "margin_protection",
    };
  }

  if (actionType === "performance_push") {
    return {
      executionMode: "operator_review",
      focus: "stability",
      checklist: [
        "Review declining metrics",
        "Prepare recovery plan",
        "Stabilize operations",
      ],
      successMetric: "trend_reversal",
    };
  }

  return {
    executionMode: "operator_review",
    checklist: ["Review signals", "Confirm root cause", "Choose next action"],
    successMetric: "operator_resolution",
  };
}

function buildAutoAction(
  location: CommandCenterLocation,
  alert: CommandCenterAlert | null,
  learning: RelevantLessonsResult | null,
  problemType: string
): Omit<AutoActionInsert, "user_id" | "status" | "created_at" | "updated_at"> {
  const priorityScore = buildPriorityScore(location, alert);

  let actionType: ActionType = "operator_review";
  let title = `Review ${location.name}`;
  let reason =
    location.recommendedAction ??
    "This location has mixed signals and should be reviewed by an operator.";
  let triggerType = "mixed_signals";
  let likelyOutcome = "Operator clarifies the issue and chooses the next best move.";

  if (location.salesDeltaPct !== null && location.salesDeltaPct <= -12) {
    actionType = "traffic_reactivation";
    title = `Recover traffic at ${location.name}`;
    reason = `Traffic and revenue softness detected. Sales declined ${Math.abs(
      location.salesDeltaPct
    )}% and recovery action is needed before momentum worsens.`;
    triggerType = "traffic_decline";
    likelyOutcome = "Traffic stabilizes and revenue decline slows over the next 7 days.";
  } else if (
    location.reviewIssueCount >= 3 ||
    (location.avgRating !== null && location.avgRating < 4)
  ) {
    actionType = "service_recovery";
    title = `Deploy service recovery at ${location.name}`;
    reason =
      location.topIssue ??
      "Negative review momentum is building and guest recovery action is needed.";
    triggerType = "guest_sentiment_risk";
    likelyOutcome = "Guest sentiment stabilizes and rating pressure is reduced.";
  } else if (location.latestRefunds !== null && location.latestRefunds >= 4) {
    actionType = "margin_protection";
    title = `Protect margins at ${location.name}`;
    reason = "Refund pressure is rising and operational leakage needs immediate review.";
    triggerType = "refund_spike";
    likelyOutcome = "Refund leakage slows and operational efficiency improves.";
  } else if (
    location.topIssue?.toLowerCase().includes("wait") ||
    location.topIssue?.toLowerCase().includes("service")
  ) {
    actionType = "throughput_stabilization";
    title = `Protect throughput at ${location.name}`;
    reason = "Service flow friction detected during guest experience analysis.";
    triggerType = "throughput_pressure";
    likelyOutcome = "Service speed improves and negative wait-time complaints decline.";
  } else if (location.health !== "healthy" && location.openAlerts >= 2) {
    actionType = "labor_adjustment";
    title = `Tighten execution at ${location.name}`;
    reason =
      location.recommendedAction ??
      "Operational pressure appears to be compressing performance.";
    triggerType = "ops_pressure";
    likelyOutcome = "Execution tightens and avoidable waste is reduced.";
  }

  const revenueRecoveryActionTypes: ActionType[] = ["promo_launch", "traffic_reactivation"];
  const ratingProtectionActionTypes: ActionType[] = ["review_response_push", "service_recovery"];
  const marginProtectionActionTypes: ActionType[] = ["labor_adjustment", "margin_protection"];
  const throughputProtectionActionTypes: ActionType[] = ["throughput_stabilization"];

  const decision = buildDecisionContext(location, alert, triggerType, likelyOutcome, learning, problemType);
  const learningReason = buildLearningAwareReason(reason, learning);
  const learningAwareActionPlan = mergeLearningIntoActionPlan(
    buildActionPlan(actionType, location),
    learning,
    problemType
  );

  return {
    location_name: location.name,
    action_type: actionType,
    title,
    reason: learningReason,
    recommended_payload: {
      version: "v3",
      type: actionType,
      title,
      reason: learningReason,
      decision,
      actionPlan: learningAwareActionPlan,
      businessContext: {
        health: location.health,
        salesDeltaPct: location.salesDeltaPct,
        avgRating: location.avgRating,
        reviewIssueCount: location.reviewIssueCount,
        openAlerts: location.openAlerts,
        topIssue: location.topIssue,
      },
      expectedMetrics: {
        revenueRecoveryPct: revenueRecoveryActionTypes.includes(actionType)
          ? clamp(Math.abs(location.salesDeltaPct ?? 0), 4, 18)
          : null,
        ratingProtection: ratingProtectionActionTypes.includes(actionType)
          ? "improve response speed and stabilize guest sentiment"
          : null,
        marginProtection: marginProtectionActionTypes.includes(actionType)
          ? "reduce leakage, refunds, labor drag, and waste"
          : null,
        throughputProtection: throughputProtectionActionTypes.includes(actionType)
          ? "reduce service bottlenecks and protect rush-hour capacity"
          : null,
      },
      operatorLearning: {
        problemType,
        lessons: learning?.lessons ?? [],
        summary: learning?.summary ?? null,
        recommendationContext: decision.operatorLearning.recommendationContext,
      },
    },
    source_signal: {
      version: "v3",
      generatedFrom: {
        reviewWindowDays: 45,
        performanceSnapshotsUsed: 2,
      },
      trigger: decision.trigger,
      health: location.health,
      salesDeltaPct: location.salesDeltaPct,
      latestRevenue: location.latestRevenue,
      previousRevenue: location.previousRevenue,
      latestOrders: location.latestOrders,
      previousOrders: location.previousOrders,
      latestAvgTicket: location.latestAvgTicket,
      previousAvgTicket: location.previousAvgTicket,
      latestLaborPct: location.latestLaborPct,
      latestMarginPct: location.latestMarginPct,
      latestRefunds: location.latestRefunds,
      reviewIssueCount: location.reviewIssueCount,
      avgRating: location.avgRating,
      openAlerts: location.openAlerts,
      topIssue: location.topIssue,
      recommendedAction: location.recommendedAction,
      negativeReviewExamples: location.negativeReviewExamples,
      alert,
      operatorLearning: {
        problemType,
        lessonsFound: learning?.summary.totalLessons ?? 0,
        reusableLessons: learning?.summary.reusableLessons ?? 0,
        successfulLessons: learning?.summary.successfulLessons ?? 0,
        confidenceBoost: learning?.summary.confidenceBoost ?? 0,
        topPlaybook: learning?.summary.topPlaybook ?? null,
      },
    },
    priority_score: priorityScore,
  };
}

export async function POST(request: Request) {
  try {
    const supabase = await getSupabaseRouteClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      return NextResponse.json(
        { error: `Authentication failed: ${authError.message}` },
        { status: 401 }
      );
    }

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url =
  new URL(request.url);

const memoryMode =
  process.env.NODE_ENV !== "production" &&
  url.searchParams.get(
    "memoryMode",
  ) === "excluded"
    ? "excluded"
    : "normal";
    const lifecycleFault =
  process.env.NODE_ENV !== "production"
    ? url.searchParams.get(
        "lifecycleFault",
      )
    : null;

const forceInsertFailure =
  lifecycleFault === "insert";

const forceSupersedeFailure =
  lifecycleFault === "supersede";

    const forceRegeneration = await shouldForceRegeneration(request);
    const cooldownIso = minutesAgoIso(AUTO_ACTION_COOLDOWN_MINUTES);

    if (!forceRegeneration) {
      const { data: activeActions, error: activeActionsError } = await supabase
        .from("auto_actions")
        .select(AUTO_ACTION_SELECT)
        .eq("user_id", user.id)
        .in("status", ["pending", "approved"])
        .order("priority_score", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(8);

      if (activeActionsError) {
        console.error("auto-actions/generate active check error:", activeActionsError);
        return NextResponse.json(
          {
            error: `Failed to check existing auto actions: ${activeActionsError.message}`,
          },
          { status: 500 }
        );
      }

      if ((activeActions?.length ?? 0) > 0) {
        return NextResponse.json({
          ok: true,
          skipped: true,
          reason: "active_actions_exist",
          message:
            "Skipped: pending or approved auto actions already exist, so autonomous mode preserved them.",
          saved: 0,
          items: (activeActions ?? []) as AutoActionRow[],
          generatedAt: new Date().toISOString(),
        });
      }

      const { data: recentActions, error: recentActionsError } = await supabase
        .from("auto_actions")
        .select(AUTO_ACTION_SELECT)
        .eq("user_id", user.id)
        .gte("created_at", cooldownIso)
        .order("created_at", { ascending: false })
        .limit(8);

      if (recentActionsError) {
        console.error("auto-actions/generate cooldown check error:", recentActionsError);
        return NextResponse.json(
          {
            error: `Failed to check auto action cooldown: ${recentActionsError.message}`,
          },
          { status: 500 }
        );
      }

      if ((recentActions?.length ?? 0) > 0) {
        return NextResponse.json({
          ok: true,
          skipped: true,
          reason: "cooldown_active",
          message: `Skipped: auto actions were generated recently. Cooldown is ${AUTO_ACTION_COOLDOWN_MINUTES} minutes.`,
          saved: 0,
          items: (recentActions ?? []) as AutoActionRow[],
          generatedAt: new Date().toISOString(),
        });
      }
    }

    const { data: locationRows, error: locationError } = await supabase
      .from("review_connections")
      .select("review_locations(id,name,title)")
      .eq("user_id", user.id)
      .eq("provider", "google");

    if (locationError) {
      console.error("auto-actions/generate location error:", locationError);
      return NextResponse.json(
        { error: `Failed to load locations: ${locationError.message}` },
        { status: 500 }
      );
    }

    const reviewLocations: ReviewLocationRow[] = (locationRows || [])
      .flatMap((row: Record<string, unknown>) => {
        const value = row.review_locations;
        return Array.isArray(value) ? (value as ReviewLocationRow[]) : [];
      })
      .filter(
        (location) =>
          location && typeof location.id === "string" && typeof location.name === "string"
      );

    const sinceReviewsIso = daysAgoIso(45);

    const { data: reviewRows, error: reviewError } = await supabase
      .from("reviews")
      .select("id, location_name, rating, text, update_time")
      .eq("user_id", user.id)
      .gte("update_time", sinceReviewsIso)
      .order("update_time", { ascending: false });

    if (reviewError) {
      console.error("auto-actions/generate review error:", reviewError);
      return NextResponse.json(
        { error: `Failed to load reviews: ${reviewError.message}` },
        { status: 500 }
      );
    }

    const { data: performanceRows, error: performanceError } = await supabase
      .from("performance_signal_history")
      .select(
        "id, location_name, revenue, orders, avg_ticket, labor_pct, margin_pct, refunds, captured_at"
      )
      .eq("user_id", user.id)
      .order("captured_at", { ascending: false });

    if (performanceError) {
      console.error("auto-actions/generate performance error:", performanceError);
      return NextResponse.json(
        { error: `Failed to load performance signals: ${performanceError.message}` },
        { status: 500 }
      );
    }

    const reviews = (reviewRows || []) as ReviewRow[];
    const perf = (performanceRows || []) as PerformanceSignalRow[];

    const locationLookup = new Map<string, { id: string; displayName: string }>();

    for (const location of reviewLocations) {
      const displayName = location.title?.trim() || location.name;
      const normalized = normalizeLocationName(displayName);

      if (normalized) {
        locationLookup.set(normalized, {
          id: location.id,
          displayName,
        });
      }
    }

    const performanceByLocation = new Map<
      string,
      { latest: PerformanceSignalRow | null; previous: PerformanceSignalRow | null }
    >();

    for (const row of perf) {
      const key = normalizeLocationName(row.location_name);
      if (!key) continue;

      const existing = performanceByLocation.get(key);

      if (!existing) {
        performanceByLocation.set(key, { latest: row, previous: null });
        continue;
      }

      if (!existing.previous) {
        performanceByLocation.set(key, { latest: existing.latest, previous: row });
      }
    }

    const allLocationNames = Array.from(
      new Set([
        ...reviewLocations.map((x) => x.title?.trim() || x.name),
        ...perf.map((x) => x.location_name),
        ...reviews
          .map((x) => x.location_name)
          .filter((x): x is string => typeof x === "string" && !!x.trim()),
      ])
    ).filter(Boolean) as string[];

    const locations: CommandCenterLocation[] = allLocationNames.map((locationName, index) => {
      const normalizedName = normalizeLocationName(locationName);
      const matchingLocation = locationLookup.get(normalizedName) ?? null;

      const locationReviews = reviews.filter(
        (review) => normalizeLocationName(review.location_name) === normalizedName
      );

      const rated = locationReviews
        .map((review) => numOrNull(review.rating))
        .filter((value): value is number => value !== null);

      const avgRatingRaw = avg(rated);
      const avgRating = avgRatingRaw !== null ? Number(avgRatingRaw.toFixed(1)) : null;

      const negativeReviews = locationReviews.filter((review) => {
        const rating = numOrNull(review.rating);
        return rating !== null && rating <= 3;
      });

      const issueBuckets = detectIssueBuckets(negativeReviews);
      const topIssue = topIssueLabel(issueBuckets);

      const perfPair = performanceByLocation.get(normalizedName);
      const latestRevenue = numOrNull(perfPair?.latest?.revenue);
      const previousRevenue = numOrNull(perfPair?.previous?.revenue);
      const latestOrders = numOrNull(perfPair?.latest?.orders);
      const previousOrders = numOrNull(perfPair?.previous?.orders);
      const latestAvgTicket = numOrNull(perfPair?.latest?.avg_ticket);
      const previousAvgTicket = numOrNull(perfPair?.previous?.avg_ticket);
      const latestLaborPct = numOrNull(perfPair?.latest?.labor_pct);
      const latestMarginPct = numOrNull(perfPair?.latest?.margin_pct);
      const latestRefunds = numOrNull(perfPair?.latest?.refunds);

      let salesDeltaPct: number | null = null;
      if (latestRevenue !== null && previousRevenue !== null && previousRevenue !== 0) {
        salesDeltaPct = Math.round(((latestRevenue - previousRevenue) / previousRevenue) * 100);
      }

      let openAlerts = 0;
      if (avgRating !== null && avgRating < 4) openAlerts += 1;
      if (negativeReviews.length >= 2) openAlerts += 1;
      if (salesDeltaPct !== null && salesDeltaPct < 0) openAlerts += 1;
      if (topIssue) openAlerts += 1;
      if (latestRefunds !== null && latestRefunds >= 2) openAlerts += 1;
      if (latestLaborPct !== null && latestLaborPct > 35) openAlerts += 1;

      const health = deriveHealth({
        avgRating,
        negativeCount: negativeReviews.length,
        openAlerts,
        salesDeltaPct,
      });

      const recommendedAction = topIssue
        ? recommendedActionForIssue(topIssue)
        : salesDeltaPct !== null && salesDeltaPct < 0
          ? "Review sales trend and tighten the recovery plan for this location"
          : latestRefunds !== null && latestRefunds >= 2
            ? "Audit refunds and service recovery immediately"
            : "No action needed";

      return {
        id: matchingLocation?.id ?? `live-${index + 1}`,
        name: matchingLocation?.displayName ?? locationName,
        city: "San Diego",
        health,
        salesDeltaPct,
        reviewIssueCount: negativeReviews.length,
        openAlerts,
        avgRating,
        topIssue,
        recommendedAction,
        latestRevenue,
        previousRevenue,
        latestOrders,
        previousOrders,
        latestAvgTicket,
        previousAvgTicket,
        latestLaborPct,
        latestMarginPct,
        latestRefunds,
        negativeReviewExamples: negativeReviews
          .map((review) => compactText(review.text, 120))
          .filter(Boolean)
          .slice(0, 3),
      };
    });

    if (locations.length === 0) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "no_locations",
        message: "Skipped: no connected locations or performance/review signals were found.",
        saved: 0,
        items: [],
        generatedAt: new Date().toISOString(),
      });
    }

    const sortedLocations = [...locations].sort((a, b) => {
      const rank: Record<HealthStatus, number> = { risk: 0, watch: 1, healthy: 2 };
      return rank[a.health] - rank[b.health];
    });

    const alerts = sortedLocations
      .map(buildLocationAlert)
      .filter((x): x is CommandCenterAlert => x !== null);

    const now = new Date().toISOString();
    const dedupedMap = new Map<string, AutoActionInsert>();

    for (const location of sortedLocations) {
      const matchingAlert =
        alerts
          .filter((alert) => alert.locationName === location.name)
          .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))[0] ?? null;

      if (!isActionWorthy(location, matchingAlert)) continue;

      const previewAction = buildAutoAction(location, matchingAlert, null, "operator_signal");
      const problemType = inferProblemTypeFromSignals({
        topIssue: location.topIssue,
        recommendedAction: location.recommendedAction,
        actionType: previewAction.action_type,
        reviewIssueCount: location.reviewIssueCount,
        avgRating: location.avgRating,
        salesDeltaPct: location.salesDeltaPct,
        latestRefunds: location.latestRefunds,
        latestLaborPct: location.latestLaborPct,
        latestMarginPct: location.latestMarginPct,
      });

      const learning = await getRelevantLessons({
        userId: user.id,
        locationName: location.name,
        problemType,
        actionType: previewAction.action_type,
        limit: 5,
      }).catch((error) => {
        console.error("auto-actions/generate operator learning lookup error:", error);
        return null;
      });

      const action: AutoActionInsert = {
        user_id: user.id,
        ...buildAutoAction(location, matchingAlert, learning, problemType),
        status: "pending",
        created_at: now,
        updated_at: now,
      };

      const key = `${action.location_name}:${action.action_type}`;
      const existing = dedupedMap.get(key);

      if (!existing || action.priority_score > existing.priority_score) {
        dedupedMap.set(key, action);
      }
    }

    let actionsToInsert = Array.from(dedupedMap.values())
      .sort((a, b) => b.priority_score - a.priority_score)
      .slice(0, 8);

    if (actionsToInsert.length === 0) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "no_action_worthy_signals",
        message: "Skipped: no action-worthy signals crossed the threshold.",
        saved: 0,
        items: [],
        generatedAt: new Date().toISOString(),
      });
    }

    /*
 * Cognitive OS primary-action migration.
 *
 * The legacy generator still supplies secondary location candidates.
 * Only the highest-priority candidate is replaced by the canonical
 * Brain-selected strategy for that same location.
 *
 * If the Cognitive OS run fails, generation safely falls back to the
 * existing legacy candidate.
 */
const primaryLegacyAction =
actionsToInsert[0];
let currentFutureComparison:
  Parameters<
    typeof buildDecisionChangeProvenance
  >[0] = null;
  try {
    const kernel =
    await runAIKernel({
      userId:
        user.id,
    
      locationName:
        primaryLegacyAction
          .location_name,
    
      memoryMode,
    });
  
    currentFutureComparison =
      kernel.cognition
        .futureComparison;

const selectedStrategy =
  kernel.cognition
    .selectedStrategy
    ?.strategy ??
  null;

const cognitiveWorkflow =
  kernel.operatorWorkflow ??
  null;

if (
  selectedStrategy &&
  cognitiveWorkflow
) {
  const cognitiveReason =
    selectedStrategy.rationale ??
    selectedStrategy.description ??
    primaryLegacyAction.reason;

  const cognitiveProvenance = {
    generatedFrom:
      "cognitive_os",

    legacyActionType:
      primaryLegacyAction
        .action_type,

        strategyId:
        selectedStrategy.id,

      strategyKind:
        selectedStrategy.kind,

      strategyTitle:
        selectedStrategy.title,

      strategyDescription:
        selectedStrategy.description ??
        null,

      strategyExpectedOutcome:
        selectedStrategy.expectedOutcome ??
        null,

      decisionMode:
        selectedStrategy
          .decisionMode,

    questionId:
      selectedStrategy
        .sourceQuestion
        ?.id ??
      null,

    questionKind:
      selectedStrategy
        .sourceQuestion
        ?.kind ??
      null,

    question:
      selectedStrategy
        .sourceQuestion
        ?.question ??
      null,

    blockingDecision:
      selectedStrategy
        .sourceQuestion
        ?.blockingDecision ??
      null,

    relatedBeliefId:
      selectedStrategy
        .sourceQuestion
        ?.relatedBeliefId ??
      selectedStrategy
        .relatedBeliefId ??
      null,

    relatedHypothesisId:
      selectedStrategy
        .relatedHypothesisId ??
      null,

    workflowId:
      cognitiveWorkflow.id,

    kernelGeneratedAt:
      kernel.generatedAt,
  };

  actionsToInsert[0] = {
    ...primaryLegacyAction,

    action_type:
      "operator_review",

    title:
      selectedStrategy.title,

    reason:
      cognitiveReason,

    priority_score:
      typeof selectedStrategy
        .priority === "number"
        ? Math.round(
            selectedStrategy
              .priority,
          )
        : primaryLegacyAction
            .priority_score,

    recommended_payload: {
      ...primaryLegacyAction
        .recommended_payload,

      type:
        "operator_review",

      title:
        selectedStrategy.title,

      reason:
        cognitiveReason,

      cognitiveProvenance,

      cognitiveWorkflow,

      actionPlan: {
        executionMode:
          "operator_review",

        focus:
          selectedStrategy.title,

        checklist:
          selectedStrategy
            .actions?.length
            ? selectedStrategy.actions
            : [
                selectedStrategy
                  .description,
              ],

        successMetric:
          selectedStrategy
            .successMetrics?.[0] ??
          "cognitive_strategy_progress",
      },
    },

    source_signal: {
      ...primaryLegacyAction
        .source_signal,

      cognitiveProvenance,
    },
  };
}
} catch (error) {
console.error(
  "auto-actions/generate cognitive primary action error:",
  error,
);
}

    /*
 * Supersede stale Cognitive Brain recommendations safely.
 *
 * Do not delete operator history.
 * Do not touch approved or executed actions.
 * Do not dismiss unrelated legacy actions.
 *
 * Only pending Cognitive OS recommendations are retired when
 * a fresh Cognitive recommendation is generated.
 */
const {
  data: activeCognitiveActions,
  error: activeCognitiveActionsError,
} = await supabase
  .from("auto_actions")
  .select(AUTO_ACTION_SELECT)
  .eq("user_id", user.id)
  .eq("status", "pending");

if (activeCognitiveActionsError) {
  console.error(
    "auto-actions/generate cognitive supersede lookup error:",
    activeCognitiveActionsError,
  );

  return NextResponse.json(
    {
      error:
        `Failed to check stale Cognitive actions: ${activeCognitiveActionsError.message}`,
    },
    { status: 500 },
  );
}

const staleCognitiveActions =
  (
    (activeCognitiveActions ?? []) as AutoActionRow[]
  ).filter((action) => {
    const payload =
      action.recommended_payload;

    if (
      !payload ||
      typeof payload !== "object"
    ) {
      return false;
    }

    const provenance =
      (
        payload as {
          cognitiveProvenance?: {
            generatedFrom?: unknown;
          };
        }
      ).cognitiveProvenance;

    return (
      provenance?.generatedFrom ===
      "cognitive_os"
    );
  });

  const freshCognitiveAction =
  actionsToInsert[0] ?? null;

const previousCognitiveAction =
  freshCognitiveAction
    ? staleCognitiveActions
        .filter(
          (action) =>
            action.location_name ===
            freshCognitiveAction.location_name,
        )
        .sort(
          (a, b) =>
            new Date(
              b.updated_at,
            ).getTime() -
            new Date(
              a.updated_at,
            ).getTime(),
        )[0] ?? null
    : null;

if (
  freshCognitiveAction &&
  previousCognitiveAction
) {
  const previousPayload =
    previousCognitiveAction
      .recommended_payload;

  const previousProvenance =
    previousPayload &&
    typeof previousPayload ===
      "object"
      ? (
          previousPayload as {
            cognitiveProvenance?: {
              strategyId?: unknown;
              strategyTitle?: unknown;
            };
          }
        ).cognitiveProvenance
      : undefined;

  const freshPayload =
    freshCognitiveAction
      .recommended_payload;

  const freshProvenance =
    freshPayload &&
    typeof freshPayload ===
      "object"
      ? (
          freshPayload as {
            cognitiveProvenance?: {
              strategyId?: unknown;
              strategyTitle?: unknown;
            };
          }
        ).cognitiveProvenance
      : undefined;

  const previousStrategyId =
    typeof previousProvenance
      ?.strategyId === "string"
      ? previousProvenance.strategyId
      : null;

  const currentStrategyId =
    typeof freshProvenance
      ?.strategyId === "string"
      ? freshProvenance.strategyId
      : null;

  const previousStrategyTitle =
    typeof previousProvenance
      ?.strategyTitle === "string"
      ? previousProvenance.strategyTitle
      : previousCognitiveAction.title;

  const currentStrategyTitle =
    typeof freshProvenance
      ?.strategyTitle === "string"
      ? freshProvenance.strategyTitle
      : freshCognitiveAction.title;

  const changedMind =
    previousStrategyId &&
    currentStrategyId
      ? previousStrategyId !==
        currentStrategyId
      : previousStrategyTitle !==
        currentStrategyTitle;

  const changeProvenance =
    changedMind
    ? buildDecisionChangeProvenance(
        currentFutureComparison,
        previousStrategyId,
      )
    : null;
    const changeExplanationStatus =
  !changedMind
    ? "not_needed"
    : changeProvenance?.verified === true
      ? "verified"
      : changeProvenance
        ? "verification_failed"
        : "previous_strategy_not_comparable";

    const decisionTransition = {
      type:
        changedMind
          ? "changed_mind"
          : "reaffirmed",
    
      changedMind,
      changeExplanationStatus,
    
      changeExplanationVerified:
        changedMind
          ? changeProvenance
              ?.verified === true
          : null,
    
      changeProvenance:
        changedMind &&
        changeProvenance?.verified
          ? changeProvenance
          : null,
    
      

    previousActionId:
      previousCognitiveAction.id,

    previousStrategyId,
    previousStrategyTitle,

    currentStrategyId,
    currentStrategyTitle,

    locationName:
      freshCognitiveAction.location_name,

    previousDecisionAt:
      previousCognitiveAction
        .updated_at,

    currentDecisionAt:
      now,

    currentDecisionReason:
      freshCognitiveAction.reason,
  };

  actionsToInsert[0] = {
    ...freshCognitiveAction,

    recommended_payload: {
      ...freshCognitiveAction
        .recommended_payload,

      decisionTransition,
    },

    source_signal: {
      ...freshCognitiveAction
        .source_signal,

      decisionTransition,
    },
  };
}

const staleCognitiveIds =
  staleCognitiveActions.map(
    (action) => action.id,
  );
  if (forceInsertFailure) {
  return NextResponse.json(
    {
      error:
        "Forced lifecycle insert failure.",
      lifecycleFault: "insert",
    },
    { status: 500 },
  );
}
  const { data: inserted, error: insertError } = await supabase
      .from("auto_actions")
      .insert(actionsToInsert)
      .select(AUTO_ACTION_SELECT);

    if (insertError) {
      console.error("auto-actions/generate insert error:", insertError);
      return NextResponse.json(
        {
          error: `Failed to save auto actions: ${insertError.message}`,
          details: insertError,
        },
        { status: 500 }
      );
    }


/*
 * Supersede stale legacy recommendations safely.
 *
 * A fresh generation represents the current recommendation set.
 *
 * For normal legacy actions:
 * retire older pending copies that have the same
 * location + action type as a freshly generated action.
 *
 * For a location whose primary legacy action was replaced by
 * the Cognitive Brain:
 * retire that location's old pending legacy recommendations so
 * they do not compete with the Brain's current decision.
 *
 * Approved and executed actions are never touched.
 */
const freshLegacyKeys =
  new Set<string>();

const freshCognitiveLocations =
  new Set<string>();

for (
  const action of actionsToInsert
) {
  const payload =
    action.recommended_payload;

  const provenance =
    payload &&
    typeof payload === "object"
      ? (
          payload as {
            cognitiveProvenance?: {
              generatedFrom?: unknown;
            };
          }
        ).cognitiveProvenance
      : undefined;

  const isCognitive =
    provenance?.generatedFrom ===
    "cognitive_os";

  if (isCognitive) {
    freshCognitiveLocations.add(
      action.location_name,
    );

    continue;
  }

  freshLegacyKeys.add(
    `${action.location_name}:${action.action_type}`,
  );
}

const staleLegacyIds =
  (
    (activeCognitiveActions ?? []) as AutoActionRow[]
  )
    .filter((action) => {
      const payload =
        action.recommended_payload;

      const provenance =
        payload &&
        typeof payload === "object"
          ? (
              payload as {
                cognitiveProvenance?: {
                  generatedFrom?: unknown;
                };
              }
            ).cognitiveProvenance
          : undefined;

      /*
       * Cognitive recommendations are handled by the
       * Cognitive supersede block above.
       */
      if (
        provenance?.generatedFrom ===
        "cognitive_os"
      ) {
        return false;
      }

      const legacyKey =
        `${action.location_name}:${action.action_type}`;

      /*
       * Replace an older copy of the same legacy move.
       */
      if (
        freshLegacyKeys.has(
          legacyKey,
        )
      ) {
        return true;
      }

      /*
       * If the Cognitive Brain now owns the recommendation for
       * this location, retire stale legacy recommendations there.
       */
      return freshCognitiveLocations.has(
        action.location_name,
      );
    })
    .map((action) => action.id);

const staleActionIds =
  Array.from(
    new Set([
      ...staleCognitiveIds,
      ...staleLegacyIds,
    ]),
  );

if (staleActionIds.length > 0) {
  const {
  error: supersedeError,
} = forceSupersedeFailure
  ? {
      error: {
        message:
          "Forced lifecycle supersede failure.",
      },
    }
  : await supabase
      .from("auto_actions")
      .update({
        status: "dismissed",
        updated_at: now,
      })
      .eq("user_id", user.id)
      .eq("status", "pending")
      .in(
        "id",
        staleActionIds,
      );

  if (supersedeError) {
    console.error(
      "auto-actions/generate stale supersede error:",
      supersedeError,
    );

    /*
     * The fresh recommendation was already inserted.
     *
     * If retirement fails, remove those fresh pending rows
     * so the previously valid recommendations remain the
     * authoritative pending set.
     */
    const insertedIds =
      (inserted ?? [])
        .map(
          (action) =>
            action.id,
        )
        .filter(
          (
            id,
          ): id is string =>
            typeof id ===
            "string",
        );

    if (insertedIds.length > 0) {
      const {
  data: rolledBackRows,
  error: rollbackError,
} = await supabase
  .from("auto_actions")
  .update({
    status: "dismissed",
    updated_at: now,
  })
  .eq(
    "user_id",
    user.id,
  )
  .eq(
    "status",
    "pending",
  )
  .in(
    "id",
    insertedIds,
  )
  .select("id");

const rolledBackIds =
  new Set(
    (rolledBackRows ?? [])
      .map((row) => row.id)
      .filter(
        (id): id is string =>
          typeof id === "string",
      ),
  );

const rollbackComplete =
  insertedIds.every(
    (id) =>
      rolledBackIds.has(id),
  );

if (
  rollbackError ||
  !rollbackComplete
) {
  console.error(
    "auto-actions/generate fresh-action rollback error:",
    rollbackError ?? {
      expectedIds:
        insertedIds,
      rolledBackIds:
        Array.from(rolledBackIds),
    },
  );

  return NextResponse.json(
    {
      error:
        `Failed to supersede stale actions: ${supersedeError.message}`,
      rollback:
        "failed",
      rollbackError:
        rollbackError?.message ??
        "Not every fresh action was successfully retired.",
    },
    { status: 500 },
  );
}
    }

    return NextResponse.json(
      {
        error:
          `Failed to supersede stale actions: ${supersedeError.message}`,
        rollback:
          "completed",
      },
      { status: 500 },
    );
  }
}
    

    return NextResponse.json({
      ok: true,
      skipped: false,
      reason: "generated",
      message: `Generated ${inserted?.length ?? 0} fresh operator move${
        (inserted?.length ?? 0) === 1 ? "" : "s"
      }.`,
      saved: inserted?.length ?? 0,
      items: (inserted ?? []) as AutoActionRow[],
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("auto-actions/generate unexpected error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `Unexpected error: ${error.message}`
            : "Unexpected error",
      },
      { status: 500 }
    );
  }
}