"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

/* =========================
   TYPES
========================= */

type HealthStatus = "healthy" | "watch" | "risk";
type AlertSeverity = "low" | "medium" | "high";
type AlertType = "sales" | "reviews" | "ops";
type ActionStatus = "pending" | "in_progress" | "done";

type PriorityLabel = "urgent" | "high" | "normal" | "low";
type AutoActionStatus = "pending" | "approved" | "executed" | "dismissed";
type AutoActionFilter = "all" | AutoActionStatus;
type DecisionUrgency = "low" | "medium" | "high" | "critical";
type DecisionImpact = "low" | "medium" | "high";

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
};

type CommandCenterAlert = {
  id: string;
  severity: AlertSeverity;
  locationName: string;
  type: AlertType;
  title: string;
  description: string;
  priorityScore?: number;
  priorityLabel?: PriorityLabel;
  priorityReason?: string;
};

type CommandCenterAction = {
  id: string;
  locationName: string;
  title: string;
  reason: string;
  status: ActionStatus;
  href?: string;
  priorityScore?: number;
  priorityLabel?: PriorityLabel;
  priorityReason?: string;
};

type BriefingItem = {
  id: string;
  locationName: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  recommendedAction: string;
};

type MorningBriefing = {
  headline: string;
  summary: string;
  resolvedWins: number;
  items: BriefingItem[];
};

type AutoActionDecision = {
  confidence?: number;
  baseConfidence?: number;
  confidenceBoost?: number;
  urgency?: DecisionUrgency;
  expectedImpact?: DecisionImpact;
  likelyOutcome?: string;
  reasonBullets?: string[];
  trigger?: {
    type?: string;
    summary?: string;
    detectedFrom?: string[];
  };
  operatorLearning?: OperatorLearningPayload;
};

type AutoActionPlan = {
  executionMode?: string;
  targetWindow?: string;
  channel?: string;
  suggestedOffer?: string;
  suggestedWorkflow?: string;
  focus?: string;
  checklist?: string[];
  successMetric?: string;
};

type AutoActionBusinessContext = {
  health?: string;
  salesDeltaPct?: number | null;
  avgRating?: number | null;
  reviewIssueCount?: number | null;
  openAlerts?: number | null;
  topIssue?: string | null;
};

type AutoActionExpectedMetrics = {
  revenueRecoveryPct?: number | null;
  ratingProtection?: string | null;
  marginProtection?: string | null;
  throughputProtection?: string | null;
};

type OperatorLearningLesson = {
  id?: string;
  locationName?: string | null;
  problemType?: string | null;
  actionType?: string | null;
  actionTitle?: string | null;
  resultSummary?: string | null;
  lesson?: string | null;
  confidence?: string | null;
  lessonStrength?: string | null;
  outcomeScore?: number | null;
  reuseRecommended?: boolean | null;
};

type OperatorLearningSummary = {
  totalLessons?: number;
  lessonsFound?: number;
  reusableLessons?: number;
  successfulLessons?: number;
  averageOutcomeScore?: number | null;
  confidenceBoost?: number;
  topPlaybook?: string | null;
};

type OperatorLearningPayload = {
  problemType?: string | null;
  lessonsFound?: number;
  reusableLessons?: number;
  successfulLessons?: number;
  averageOutcomeScore?: number | null;
  topPlaybook?: string | null;
  confidenceBoost?: number;
  recommendationContext?: string | null;
  lessons?: OperatorLearningLesson[];
  summary?: OperatorLearningSummary | null;
};

type AutoActionPayload = {
  version?: string;
  type?: string;
  title?: string;
  reason?: string;
  decision?: AutoActionDecision;
  actionPlan?: AutoActionPlan;
  businessContext?: AutoActionBusinessContext;
  expectedMetrics?: AutoActionExpectedMetrics;
  operatorLearning?: OperatorLearningPayload;
};

type AutoActionSourceSignal = {
  version?: string;
  generatedFrom?: {
    reviewWindowDays?: number;
    performanceSnapshotsUsed?: number;
  };
  trigger?: {
    type?: string;
    summary?: string;
    detectedFrom?: string[];
  };
  health?: string;
  salesDeltaPct?: number | null;
  latestRevenue?: number | null;
  previousRevenue?: number | null;
  latestOrders?: number | null;
  previousOrders?: number | null;
  latestAvgTicket?: number | null;
  previousAvgTicket?: number | null;
  latestLaborPct?: number | null;
  latestMarginPct?: number | null;
  latestRefunds?: number | null;
  reviewIssueCount?: number | null;
  avgRating?: number | null;
  openAlerts?: number | null;
  topIssue?: string | null;
  recommendedAction?: string | null;
  negativeReviewExamples?: string[];
  operatorLearning?: OperatorLearningPayload;
};

type AutoActionItem = {
  id: string;
  user_id?: string;
  location_name: string;
  action_type: string;
  title: string;
  reason: string;
  recommended_payload?: Record<string, unknown> | null;
  source_signal?: Record<string, unknown> | null;
  status: AutoActionStatus;
  priority_score: number;
  created_at?: string;
  updated_at?: string;
};

type AutoActionExecutionResult = {
  ok?: boolean;
  actionType?: string;
  executionSummary?: string;
  workflowItemsCreated?: number;
  executionMode?: string | null;
  downstreamRecords?: Array<Record<string, unknown>>;
};

type AutoActionFeedback = {
  kind: "success" | "info" | "error";
  message: string;
  downstreamRecords?: Array<Record<string, unknown>>;
};

type OperatorMemoryItem = {
  id: string;
  location_name: string | null;
  problem_type: string;
  action_type: string;
  action_title: string;
  result_summary: string;
  lesson: string;
  confidence: "low" | "medium" | "high" | string;
  status: "active" | "archived" | string;
  source_outcome_id?: string | null;
  evidence?: Record<string, unknown> | null;
  outcome_score?: number | null;
  success?: boolean | null;
  revenue_before?: number | null;
  revenue_after?: number | null;
  rating_before?: number | null;
  rating_after?: number | null;
  lesson_strength?: "weak" | "developing" | "strong" | string | null;
  reuse_recommended?: boolean | null;
  created_at?: string;
  updated_at?: string;
};

type HydratedAutoAction = AutoActionItem & {
  parsedPayload: AutoActionPayload | null;
  parsedSignal: AutoActionSourceSignal | null;
  decision: AutoActionDecision | null;
  actionPlan: AutoActionPlan | null;
  businessContext: AutoActionBusinessContext | null;
  expectedMetrics: AutoActionExpectedMetrics | null;
  triggerSummary: string | null;
  operatorLearning: OperatorLearningPayload | null;
  confidence: number | null;
  urgency: DecisionUrgency | null;
  expectedImpact: DecisionImpact | null;
};

/* =========================
   HELPERS
========================= */

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

async function readErrorMessage(res: Response, fallback: string) {
  try {
    const text = await res.text();
    if (!text) return fallback;

    try {
      const parsed = JSON.parse(text) as { error?: string; message?: string };
      return parsed.error || parsed.message || text;
    } catch {
      return text;
    }
  } catch {
    return fallback;
  }
}

function formatDelta(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value}%`;
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US").format(value);
}

function formatCompactNumber(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatPercentValue(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value}%`;
}

function formatOutcomeScore(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${Math.round(value)}/100`;
}

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `$${formatCompactNumber(value)}`;
}

function formatMetricChange(before: number | null | undefined, after: number | null | undefined, suffix = "") {
  if (before === null || before === undefined || after === null || after === undefined) return "—";
  const delta = after - before;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${Math.round(delta * 10) / 10}${suffix}`;
}

function formatBeforeAfter(
  before: number | null | undefined,
  after: number | null | undefined,
  formatter: (value: number | null | undefined) => string = formatCompactNumber,
) {
  if (before === null || before === undefined || after === null || after === undefined) return "—";
  return `${formatter(before)} → ${formatter(after)}`;
}

function evidenceSnapshotNumber(
  evidence: Record<string, unknown> | null | undefined,
  snapshotName: "baseline" | "current",
  key: string,
) {
  if (!isRecord(evidence)) return null;
  const snapshot = evidence[snapshotName];
  if (!isRecord(snapshot)) return null;
  return asNumber(snapshot[key]);
}

function outcomeScoreStyles(score: number | null | undefined) {
  if (score === null || score === undefined) return "bg-white/10 text-white/70";
  if (score >= 75) return "bg-emerald-500/15 text-emerald-200";
  if (score >= 55) return "bg-cyan-500/15 text-cyan-200";
  if (score >= 40) return "bg-amber-500/15 text-amber-200";
  return "bg-rose-500/15 text-rose-200";
}

function lessonStrengthStyles(strength?: string | null) {
  if (strength === "strong") return "bg-emerald-500/15 text-emerald-200";
  if (strength === "developing") return "bg-cyan-500/15 text-cyan-200";
  if (strength === "weak") return "bg-amber-500/15 text-amber-200";
  return "bg-white/10 text-white/70";
}

function formatConfidence(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${Math.round(value * 100)}%`;
}

function titleCase(value: string | null | undefined) {
  if (!value) return "—";
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function compactText(value: string | null | undefined, max = 180) {
  const text = (value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function formatWhen(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";

  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function severityStyles(severity: AlertSeverity) {
  if (severity === "high") return "bg-rose-500/15 text-rose-300";
  if (severity === "medium") return "bg-amber-500/15 text-amber-300";
  return "bg-sky-500/15 text-sky-300";
}

function actionStatusStyles(status: ActionStatus) {
  if (status === "done") return "bg-emerald-500/15 text-emerald-300";
  if (status === "in_progress") return "bg-amber-500/15 text-amber-300";
  return "bg-white/10 text-white/80";
}

function priorityStyles(priority?: PriorityLabel) {
  if (priority === "urgent") return "bg-rose-500/15 text-rose-200";
  if (priority === "high") return "bg-amber-500/15 text-amber-200";
  if (priority === "normal") return "bg-sky-500/15 text-sky-200";
  return "bg-white/10 text-white/70";
}

function healthStyles(health?: string | null) {
  if (health === "risk") return "bg-rose-500/15 text-rose-200";
  if (health === "watch") return "bg-amber-500/15 text-amber-200";
  if (health === "healthy") return "bg-emerald-500/15 text-emerald-200";
  return "bg-white/10 text-white/70";
}

function urgencyStyles(urgency?: DecisionUrgency | null) {
  if (urgency === "critical")
    return "bg-rose-500/20 text-rose-100 border border-rose-500/20";
  if (urgency === "high")
    return "bg-amber-500/20 text-amber-100 border border-amber-500/20";
  if (urgency === "medium")
    return "bg-sky-500/20 text-sky-100 border border-sky-500/20";
  return "bg-white/10 text-white/70 border border-white/10";
}

function impactStyles(impact?: DecisionImpact | null) {
  if (impact === "high") return "bg-emerald-500/15 text-emerald-200";
  if (impact === "medium") return "bg-cyan-500/15 text-cyan-200";
  return "bg-white/10 text-white/70";
}

function memoryConfidenceStyles(confidence?: string | null) {
  if (confidence === "high") return "bg-emerald-500/15 text-emerald-200";
  if (confidence === "medium") return "bg-cyan-500/15 text-cyan-200";
  if (confidence === "low") return "bg-amber-500/15 text-amber-200";
  return "bg-white/10 text-white/70";
}

function autoActionStatusStyles(status: AutoActionStatus) {
  if (status === "executed") return "bg-emerald-500/15 text-emerald-300";
  if (status === "approved") return "bg-cyan-500/15 text-cyan-300";
  if (status === "dismissed") return "bg-white/10 text-white/60";
  return "bg-amber-500/15 text-amber-300";
}

function autoActionTypeLabel(type: string) {
  switch (type) {
    case "promo_launch":
      return "Promo Launch";
    case "review_response_push":
      return "Review Response Push";
    case "labor_adjustment":
      return "Labor Adjustment";
    case "growth_test":
      return "Growth Test";
    case "operator_review":
      return "Operator Review";
    case "performance_push":
      return "Performance Push";
    case "service_recovery":
      return "Service Recovery";
    case "throughput_stabilization":
      return "Throughput Stabilization";
    case "margin_protection":
      return "Margin Protection";
    case "traffic_reactivation":
      return "Traffic Reactivation";
    default:
      return titleCase(type) ?? type;
  }
}

function autoActionFilterLabel(filter: AutoActionFilter) {
  switch (filter) {
    case "all":
      return "All";
    case "pending":
      return "Pending";
    case "approved":
      return "Approved";
    case "executed":
      return "Executed";
    case "dismissed":
      return "Dismissed";
    default:
      return filter;
  }
}

function feedbackStyles(kind: AutoActionFeedback["kind"]) {
  if (kind === "success") {
    return "border border-emerald-500/20 bg-emerald-500/10 text-emerald-200";
  }
  if (kind === "error") {
    return "border border-rose-500/20 bg-rose-500/10 text-rose-200";
  }
  return "border border-cyan-500/20 bg-cyan-500/10 text-cyan-200";
}

function downstreamRecordLabel(record: Record<string, unknown>) {
  const type = asString(record.type) ?? "record";
  const title = asString(record.title);
  const status = asString(record.status);
  const reviewId = asString(record.review_id);

  if (title && status) return `${title} · ${status}`;
  if (title) return title;
  if (reviewId && status) return `Review ${reviewId} · ${status}`;
  if (status) return status;
  return type;
}

function downstreamRecordType(record: Record<string, unknown>) {
  return titleCase(asString(record.type) ?? "record");
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return null;
}

function parseOperatorLearning(
  value: unknown,
): OperatorLearningPayload | undefined {
  if (!isRecord(value)) return undefined;

  const summaryRecord = isRecord(value.summary) ? value.summary : null;
  const rawLessons = Array.isArray(value.lessons) ? value.lessons : [];

  const lessons = rawLessons.filter(isRecord).map((lesson) => ({
    id: asString(lesson.id) ?? undefined,
    locationName:
      asString(lesson.locationName) ?? asString(lesson.location_name),
    problemType: asString(lesson.problemType) ?? asString(lesson.problem_type),
    actionType: asString(lesson.actionType) ?? asString(lesson.action_type),
    actionTitle: asString(lesson.actionTitle) ?? asString(lesson.action_title),
    resultSummary:
      asString(lesson.resultSummary) ?? asString(lesson.result_summary),
    lesson: asString(lesson.lesson),
    confidence: asString(lesson.confidence),
    lessonStrength:
      asString(lesson.lessonStrength) ?? asString(lesson.lesson_strength),
    outcomeScore:
      asNumber(lesson.outcomeScore) ?? asNumber(lesson.outcome_score),
    reuseRecommended:
      asBoolean(lesson.reuseRecommended) ?? asBoolean(lesson.reuse_recommended),
  }));

  const summary = summaryRecord
    ? {
        totalLessons:
          asNumber(summaryRecord.totalLessons) ??
          asNumber(summaryRecord.lessonsFound) ??
          undefined,
        lessonsFound:
          asNumber(summaryRecord.lessonsFound) ??
          asNumber(summaryRecord.totalLessons) ??
          undefined,
        reusableLessons: asNumber(summaryRecord.reusableLessons) ?? undefined,
        successfulLessons:
          asNumber(summaryRecord.successfulLessons) ?? undefined,
        averageOutcomeScore: asNumber(summaryRecord.averageOutcomeScore),
        confidenceBoost: asNumber(summaryRecord.confidenceBoost) ?? undefined,
        topPlaybook: asString(summaryRecord.topPlaybook),
      }
    : null;

  return {
    problemType: asString(value.problemType) ?? asString(value.problem_type),
    lessonsFound:
      asNumber(value.lessonsFound) ??
      summary?.lessonsFound ??
      summary?.totalLessons,
    reusableLessons:
      asNumber(value.reusableLessons) ?? summary?.reusableLessons,
    successfulLessons:
      asNumber(value.successfulLessons) ?? summary?.successfulLessons,
    averageOutcomeScore:
      asNumber(value.averageOutcomeScore) ?? summary?.averageOutcomeScore,
    topPlaybook: asString(value.topPlaybook) ?? summary?.topPlaybook,
    confidenceBoost:
      asNumber(value.confidenceBoost) ?? summary?.confidenceBoost,
    recommendationContext: asString(value.recommendationContext),
    lessons,
    summary,
  };
}

function parseAutoActionPayload(
  value: Record<string, unknown> | null | undefined,
): AutoActionPayload | null {
  if (!isRecord(value)) return null;

  const decisionRecord = isRecord(value.decision) ? value.decision : null;
  const triggerRecord =
    decisionRecord && isRecord(decisionRecord.trigger)
      ? decisionRecord.trigger
      : null;
  const actionPlanRecord = isRecord(value.actionPlan) ? value.actionPlan : null;
  const businessContextRecord = isRecord(value.businessContext)
    ? value.businessContext
    : null;
  const expectedMetricsRecord = isRecord(value.expectedMetrics)
    ? value.expectedMetrics
    : null;
  const payloadLearning = parseOperatorLearning(value.operatorLearning);
  const decisionLearning = decisionRecord
    ? parseOperatorLearning(decisionRecord.operatorLearning)
    : undefined;

  return {
    version: asString(value.version) ?? undefined,
    type: asString(value.type) ?? undefined,
    title: asString(value.title) ?? undefined,
    reason: asString(value.reason) ?? undefined,
    decision: decisionRecord
      ? {
          confidence: asNumber(decisionRecord.confidence) ?? undefined,
          baseConfidence: asNumber(decisionRecord.baseConfidence) ?? undefined,
          confidenceBoost:
            asNumber(decisionRecord.confidenceBoost) ?? undefined,
          urgency:
            (asString(decisionRecord.urgency) as DecisionUrgency | null) ??
            undefined,
          expectedImpact:
            (asString(
              decisionRecord.expectedImpact,
            ) as DecisionImpact | null) ?? undefined,
          likelyOutcome: asString(decisionRecord.likelyOutcome) ?? undefined,
          reasonBullets: asStringArray(decisionRecord.reasonBullets),
          trigger: triggerRecord
            ? {
                type: asString(triggerRecord.type) ?? undefined,
                summary: asString(triggerRecord.summary) ?? undefined,
                detectedFrom: asStringArray(triggerRecord.detectedFrom),
              }
            : undefined,
          operatorLearning: decisionLearning,
        }
      : undefined,
    actionPlan: actionPlanRecord
      ? {
          executionMode: asString(actionPlanRecord.executionMode) ?? undefined,
          targetWindow: asString(actionPlanRecord.targetWindow) ?? undefined,
          channel: asString(actionPlanRecord.channel) ?? undefined,
          suggestedOffer:
            asString(actionPlanRecord.suggestedOffer) ?? undefined,
          suggestedWorkflow:
            asString(actionPlanRecord.suggestedWorkflow) ?? undefined,
          focus: asString(actionPlanRecord.focus) ?? undefined,
          checklist: asStringArray(actionPlanRecord.checklist),
          successMetric: asString(actionPlanRecord.successMetric) ?? undefined,
        }
      : undefined,
    businessContext: businessContextRecord
      ? {
          health: asString(businessContextRecord.health) ?? undefined,
          salesDeltaPct: asNumber(businessContextRecord.salesDeltaPct),
          avgRating: asNumber(businessContextRecord.avgRating),
          reviewIssueCount: asNumber(businessContextRecord.reviewIssueCount),
          openAlerts: asNumber(businessContextRecord.openAlerts),
          topIssue: asString(businessContextRecord.topIssue),
        }
      : undefined,
    expectedMetrics: expectedMetricsRecord
      ? {
          revenueRecoveryPct: asNumber(
            expectedMetricsRecord.revenueRecoveryPct,
          ),
          ratingProtection: asString(expectedMetricsRecord.ratingProtection),
          marginProtection: asString(expectedMetricsRecord.marginProtection),
          throughputProtection: asString(
            expectedMetricsRecord.throughputProtection,
          ),
        }
      : undefined,
    operatorLearning: payloadLearning,
  };
}

function parseSourceSignal(
  value: Record<string, unknown> | null | undefined,
): AutoActionSourceSignal | null {
  if (!isRecord(value)) return null;

  const generatedFrom = isRecord(value.generatedFrom)
    ? value.generatedFrom
    : null;
  const trigger = isRecord(value.trigger) ? value.trigger : null;
  const sourceLearning = parseOperatorLearning(value.operatorLearning);

  return {
    version: asString(value.version) ?? undefined,
    generatedFrom: generatedFrom
      ? {
          reviewWindowDays:
            asNumber(generatedFrom.reviewWindowDays) ?? undefined,
          performanceSnapshotsUsed:
            asNumber(generatedFrom.performanceSnapshotsUsed) ?? undefined,
        }
      : undefined,
    trigger: trigger
      ? {
          type: asString(trigger.type) ?? undefined,
          summary: asString(trigger.summary) ?? undefined,
          detectedFrom: asStringArray(trigger.detectedFrom),
        }
      : undefined,
    health: asString(value.health) ?? undefined,
    salesDeltaPct: asNumber(value.salesDeltaPct),
    latestRevenue: asNumber(value.latestRevenue),
    previousRevenue: asNumber(value.previousRevenue),
    latestOrders: asNumber(value.latestOrders),
    previousOrders: asNumber(value.previousOrders),
    latestAvgTicket: asNumber(value.latestAvgTicket),
    previousAvgTicket: asNumber(value.previousAvgTicket),
    latestLaborPct: asNumber(value.latestLaborPct),
    latestMarginPct: asNumber(value.latestMarginPct),
    latestRefunds: asNumber(value.latestRefunds),
    reviewIssueCount: asNumber(value.reviewIssueCount),
    avgRating: asNumber(value.avgRating),
    openAlerts: asNumber(value.openAlerts),
    topIssue: asString(value.topIssue),
    recommendedAction: asString(value.recommendedAction),
    negativeReviewExamples: asStringArray(value.negativeReviewExamples),
    operatorLearning: sourceLearning,
  };
}

function hydrateAutoAction(item: AutoActionItem): HydratedAutoAction {
  const parsedPayload = parseAutoActionPayload(
    item.recommended_payload ?? null,
  );
  const parsedSignal = parseSourceSignal(item.source_signal ?? null);
  const decision = parsedPayload?.decision ?? null;
  const actionPlan = parsedPayload?.actionPlan ?? null;
  const businessContext = parsedPayload?.businessContext ?? null;
  const expectedMetrics = parsedPayload?.expectedMetrics ?? null;
  const operatorLearning =
    parsedPayload?.operatorLearning ??
    decision?.operatorLearning ??
    parsedSignal?.operatorLearning ??
    null;
  const triggerSummary =
    decision?.trigger?.summary ??
    parsedSignal?.trigger?.summary ??
    parsedSignal?.topIssue ??
    null;

  return {
    ...item,
    parsedPayload,
    parsedSignal,
    decision,
    actionPlan,
    businessContext,
    expectedMetrics,
    triggerSummary,
    operatorLearning,
    confidence: decision?.confidence ?? null,
    urgency: decision?.urgency ?? null,
    expectedImpact: decision?.expectedImpact ?? null,
  };
}

/* =========================
   PRIORITY ENGINE
========================= */

function computeAlertPriority(alert: CommandCenterAlert): CommandCenterAlert {
  let score = 0;

  if (alert.severity === "high") score += 60;
  if (alert.severity === "medium") score += 35;

  if (alert.type === "reviews") score += 20;
  if (alert.type === "sales") score += 25;
  if (alert.type === "ops") score += 12;

  let label: PriorityLabel = "low";
  if (score >= 80) label = "urgent";
  else if (score >= 55) label = "high";
  else if (score >= 30) label = "normal";

  return {
    ...alert,
    priorityScore: score,
    priorityLabel: label,
    priorityReason: "Severity + business impact",
  };
}

function computeActionPriority(
  action: CommandCenterAction,
): CommandCenterAction {
  let score = 0;

  if (action.status === "pending") score += 50;
  if (action.status === "in_progress") score += 25;

  if (action.reason.toLowerCase().includes("revenue")) score += 30;
  if (action.reason.toLowerCase().includes("review")) score += 20;
  if (action.reason.toLowerCase().includes("labor")) score += 20;

  let label: PriorityLabel = "low";
  if (score >= 80) label = "urgent";
  else if (score >= 55) label = "high";
  else if (score >= 30) label = "normal";

  return {
    ...action,
    priorityScore: score,
    priorityLabel: label,
    priorityReason: "Status + impact",
  };
}

/* =========================
   PAGE
========================= */

export default function CommandCenterPage() {
  const autoGenerateAttemptedRef = useRef(false);

  const [locations, setLocations] = useState<CommandCenterLocation[]>([]);
  const [alerts, setAlerts] = useState<CommandCenterAlert[]>([]);
  const [actions, setActions] = useState<CommandCenterAction[]>([]);
  const [briefing, setBriefing] = useState<MorningBriefing | null>(null);
  const [commandCenterError, setCommandCenterError] = useState<string | null>(
    null,
  );

  const [autoActions, setAutoActions] = useState<HydratedAutoAction[]>([]);
  const [autoActionsLoading, setAutoActionsLoading] = useState(true);
  const [autoActionsError, setAutoActionsError] = useState<string | null>(null);
  const [generatingAutoActions, setGeneratingAutoActions] = useState(false);
  const [autoPilotNotice, setAutoPilotNotice] = useState<string | null>(null);
  const [savingAutoActionId, setSavingAutoActionId] = useState<string | null>(
    null,
  );
  const [autoActionFilter, setAutoActionFilter] =
    useState<AutoActionFilter>("pending");
  const [autoActionFeedback, setAutoActionFeedback] = useState<
    Record<string, AutoActionFeedback>
  >({});

  const [operatorMemory, setOperatorMemory] = useState<OperatorMemoryItem[]>(
    [],
  );
  const [operatorMemoryLoading, setOperatorMemoryLoading] = useState(true);
  const [operatorMemoryError, setOperatorMemoryError] = useState<string | null>(
    null,
  );

  const [loading, setLoading] = useState(true);

  async function loadCommandCenter() {
    try {
      setCommandCenterError(null);

      const res = await fetch("/api/command-center/signals", {
        cache: "no-store",
      });

      if (!res.ok) {
        const message = await readErrorMessage(
          res,
          "Failed to load command center data",
        );
        console.warn("command center signals failed:", message);
        setCommandCenterError(message);
        setLocations([]);
        setAlerts([]);
        setActions([]);
        setBriefing(null);
        return;
      }

      const json = (await res.json()) as {
        locations?: CommandCenterLocation[];
        alerts?: CommandCenterAlert[];
        actions?: CommandCenterAction[];
        briefing?: MorningBriefing | null;
      };

      const rawAlerts: CommandCenterAlert[] = json.alerts ?? [];
      const rawActions: CommandCenterAction[] = json.actions ?? [];

      const prioritizedAlerts = rawAlerts
        .map(computeAlertPriority)
        .sort((a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0));

      const prioritizedActions = rawActions
        .map(computeActionPriority)
        .sort((a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0));

      setLocations(json.locations ?? []);
      setAlerts(prioritizedAlerts);
      setActions(prioritizedActions);
      setBriefing(json.briefing ?? null);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to load command center data";
      console.warn("command center load error:", message);
      setCommandCenterError(message);
      setLocations([]);
      setAlerts([]);
      setActions([]);
      setBriefing(null);
    }
  }

  async function loadAutoActions() {
    try {
      setAutoActionsLoading(true);
      setAutoActionsError(null);

      const res = await fetch("/api/auto-actions", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });

      if (!res.ok) {
        const message = await readErrorMessage(
          res,
          "Failed to load auto actions",
        );
        throw new Error(message);
      }

      const json = (await res.json()) as {
        items?: AutoActionItem[];
      };

      const items = Array.isArray(json.items) ? json.items : [];
      const hydrated = items.map(hydrateAutoAction);

      const sorted = [...hydrated].sort((a, b) => {
        if (b.priority_score !== a.priority_score) {
          return b.priority_score - a.priority_score;
        }
        return (
          new Date(b.updated_at ?? b.created_at ?? 0).getTime() -
          new Date(a.updated_at ?? a.created_at ?? 0).getTime()
        );
      });

      setAutoActions(sorted);
      return sorted;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load auto actions";
      setAutoActionsError(message);
      setAutoActions([]);
      return [];
    } finally {
      setAutoActionsLoading(false);
    }
  }

  async function loadOperatorMemory() {
    try {
      setOperatorMemoryLoading(true);
      setOperatorMemoryError(null);

      const res = await fetch("/api/operator-memory", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });

      if (!res.ok) {
        const message = await readErrorMessage(
          res,
          "Failed to load operator memory",
        );
        throw new Error(message);
      }

      const json = (await res.json()) as {
        items?: OperatorMemoryItem[];
      };

      const items = Array.isArray(json.items) ? json.items : [];

      const sorted = [...items].sort(
        (a, b) =>
          new Date(b.updated_at ?? b.created_at ?? 0).getTime() -
          new Date(a.updated_at ?? a.created_at ?? 0).getTime(),
      );

      setOperatorMemory(sorted);
      return sorted;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to load operator memory";
      setOperatorMemoryError(message);
      setOperatorMemory([]);
      return [];
    } finally {
      setOperatorMemoryLoading(false);
    }
  }

  async function handleGenerateAutoActions(options?: { silent?: boolean }) {
    const silent = options?.silent ?? false;

    try {
      setGeneratingAutoActions(true);
      setAutoActionsError(null);

      if (silent) {
        setAutoPilotNotice("Autonomous mode checked for new operator moves.");
      } else {
        setAutoPilotNotice(null);
      }

      const res = await fetch("/api/auto-actions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const message = await readErrorMessage(
          res,
          "Failed to generate auto actions",
        );
        throw new Error(message);
      }

      const nextActions = await loadAutoActions();

      if (silent) {
        setAutoPilotNotice(
          nextActions.length > 0
            ? `Autonomous mode generated ${nextActions.length} operator move${
                nextActions.length === 1 ? "" : "s"
              }.`
            : "Autonomous mode found no urgent operator moves right now.",
        );
      }

      return nextActions;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to generate auto actions";
      setAutoActionsError(message);

      if (silent) {
        setAutoPilotNotice(
          "Autonomous mode could not generate actions right now.",
        );
      }

      return [];
    } finally {
      setGeneratingAutoActions(false);
    }
  }

  useEffect(() => {
    async function load() {
      try {
        await loadCommandCenter();
        const loadedActions = await loadAutoActions();
        await loadOperatorMemory();

        if (loadedActions.length === 0 && !autoGenerateAttemptedRef.current) {
          autoGenerateAttemptedRef.current = true;
          await handleGenerateAutoActions({ silent: true });
        }
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const locationSummary = useMemo(() => {
    const needsAttention = locations.filter(
      (l) => l.health !== "healthy",
    ).length;
    const highAlerts = alerts.filter((a) => a.severity === "high").length;
    const pendingActions = actions.filter((a) => a.status === "pending").length;

    return {
      needsAttention,
      highAlerts,
      pendingActions,
    };
  }, [locations, alerts, actions]);

  const topActionNow = useMemo(() => {
    return (
      actions.find((action) => action.status === "pending") ??
      actions[0] ??
      null
    );
  }, [actions]);

  const autoActionSummary = useMemo(() => {
    return {
      pending: autoActions.filter((item) => item.status === "pending").length,
      approved: autoActions.filter((item) => item.status === "approved").length,
      executed: autoActions.filter((item) => item.status === "executed").length,
      dismissed: autoActions.filter((item) => item.status === "dismissed")
        .length,
      urgent: autoActions.filter(
        (item) => item.urgency === "critical" || item.urgency === "high",
      ).length,
      highConfidence: autoActions.filter(
        (item) => (item.confidence ?? 0) >= 0.8,
      ).length,
    };
  }, [autoActions]);

  const filteredAutoActions = useMemo(() => {
    if (autoActionFilter === "all") return autoActions;
    return autoActions.filter((item) => item.status === autoActionFilter);
  }, [autoActions, autoActionFilter]);

  const autoActionFilterCounts = useMemo(() => {
    return {
      all: autoActions.length,
      pending: autoActions.filter((item) => item.status === "pending").length,
      approved: autoActions.filter((item) => item.status === "approved").length,
      executed: autoActions.filter((item) => item.status === "executed").length,
      dismissed: autoActions.filter((item) => item.status === "dismissed")
        .length,
    };
  }, [autoActions]);

  const executedLearningItems = useMemo(() => {
    return autoActions
      .filter((item) => item.status === "executed")
      .sort(
        (a, b) =>
          new Date(b.updated_at ?? b.created_at ?? 0).getTime() -
          new Date(a.updated_at ?? a.created_at ?? 0).getTime(),
      )
      .slice(0, 6);
  }, [autoActions]);

  const learningSummary = useMemo(() => {
    const executed = autoActions.filter((item) => item.status === "executed");
    const highImpact = executed.filter(
      (item) => item.expectedImpact === "high",
    ).length;
    const avgConfidence =
      executed.length > 0
        ? executed.reduce((sum, item) => sum + (item.confidence ?? 0), 0) /
          executed.length
        : null;

    const typeCounts = executed.reduce<Record<string, number>>(
      (counts, item) => {
        counts[item.action_type] = (counts[item.action_type] ?? 0) + 1;
        return counts;
      },
      {},
    );

    const topType =
      Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    return {
      executed: executed.length,
      highImpact,
      avgConfidence,
      topType,
    };
  }, [autoActions]);

  const operatorMemorySummary = useMemo(() => {
    const active = operatorMemory.filter((item) => item.status === "active");
    const highConfidence = active.filter(
      (item) => item.confidence === "high",
    ).length;

    const locationCounts = active.reduce<Record<string, number>>(
      (counts, item) => {
        const key = item.location_name || "Global";
        counts[key] = (counts[key] ?? 0) + 1;
        return counts;
      },
      {},
    );

    const topLocation =
      Object.entries(locationCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ??
      null;

    const playbookCounts = active.reduce<Record<string, number>>(
      (counts, item) => {
        counts[item.action_type] = (counts[item.action_type] ?? 0) + 1;
        return counts;
      },
      {},
    );

    const topPlaybook =
      Object.entries(playbookCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ??
      null;

    return {
      active: active.length,
      highConfidence,
      topLocation,
      topPlaybook,
    };
  }, [operatorMemory]);

  const outcomeTrackingSummary = useMemo(() => {
    const active = operatorMemory.filter((item) => item.status === "active");
    const measured = active.filter((item) => asNumber(item.outcome_score) !== null);
    const reusable = measured.filter((item) => item.reuse_recommended === true);
    const strong = measured.filter((item) => item.lesson_strength === "strong");
    const weak = measured.filter((item) => item.lesson_strength === "weak");

    const averageScore =
      measured.length > 0
        ? measured.reduce((sum, item) => sum + (asNumber(item.outcome_score) ?? 0), 0) /
          measured.length
        : null;

    const bestMeasured =
      [...measured].sort(
        (a, b) => (asNumber(b.outcome_score) ?? -1) - (asNumber(a.outcome_score) ?? -1),
      )[0] ?? null;

    const latestMeasured =
      [...measured].sort(
        (a, b) =>
          new Date(b.updated_at ?? b.created_at ?? 0).getTime() -
          new Date(a.updated_at ?? a.created_at ?? 0).getTime(),
      )[0] ?? null;

    const posture =
      measured.length === 0
        ? "Waiting for outcomes"
        : reusable.length > 0
          ? "Evidence-backed reuse"
          : "Controlled testing";

    return {
      measured: measured.length,
      reusable: reusable.length,
      strong: strong.length,
      weak: weak.length,
      averageScore,
      bestMeasured,
      latestMeasured,
      posture,
    };
  }, [operatorMemory]);

  const operatorIntelligenceSummary = useMemo(() => {
    const memoryInfluencedActions = autoActions.filter((item) => {
      const lessonsFound =
        item.operatorLearning?.lessonsFound ??
        item.operatorLearning?.summary?.lessonsFound ??
        item.operatorLearning?.summary?.totalLessons ??
        0;

      return lessonsFound > 0;
    });

    const pendingMemoryInfluenced = memoryInfluencedActions.filter(
      (item) => item.status === "pending",
    ).length;

    const executedMemoryInfluenced = memoryInfluencedActions.filter(
      (item) => item.status === "executed",
    ).length;

    const cautionActions = memoryInfluencedActions.filter((item) => {
      const reusableLessons =
        item.operatorLearning?.reusableLessons ??
        item.operatorLearning?.summary?.reusableLessons ??
        0;
      const avgOutcome =
        item.operatorLearning?.averageOutcomeScore ??
        item.operatorLearning?.summary?.averageOutcomeScore ??
        null;

      return reusableLessons === 0 || (avgOutcome !== null && avgOutcome < 65);
    }).length;

    const confidenceBoosts = memoryInfluencedActions
      .map(
        (item) =>
          item.operatorLearning?.confidenceBoost ??
          item.operatorLearning?.summary?.confidenceBoost ??
          0,
      )
      .filter((value) => Number.isFinite(value));

    const avgConfidenceBoost =
      confidenceBoosts.length > 0
        ? confidenceBoosts.reduce((sum, value) => sum + value, 0) /
          confidenceBoosts.length
        : 0;

    const playbookCounts = memoryInfluencedActions.reduce<Record<string, number>>(
      (counts, item) => {
        const playbook =
          item.operatorLearning?.topPlaybook ??
          item.operatorLearning?.summary?.topPlaybook ??
          item.action_type;

        if (playbook) counts[playbook] = (counts[playbook] ?? 0) + 1;
        return counts;
      },
      {},
    );

    const topPlaybook =
      Object.entries(playbookCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ??
      operatorMemorySummary.topPlaybook ??
      null;

    const latestLearningAction = memoryInfluencedActions
      .sort(
        (a, b) =>
          new Date(b.updated_at ?? b.created_at ?? 0).getTime() -
          new Date(a.updated_at ?? a.created_at ?? 0).getTime(),
      )[0] ?? null;

    const learningState =
      memoryInfluencedActions.length === 0
        ? "TurnTableAI has not reused operator memory yet. Generate fresh actions after executing a few moves."
        : cautionActions > 0
          ? "TurnTableAI is using memory cautiously because previous outcomes are still developing."
          : "TurnTableAI is finding reusable patterns and applying them to new operator moves.";

    return {
      memoryInfluenced: memoryInfluencedActions.length,
      pendingMemoryInfluenced,
      executedMemoryInfluenced,
      cautionActions,
      avgConfidenceBoost,
      topPlaybook,
      latestLearningAction,
      learningState,
    };
  }, [autoActions, operatorMemorySummary.topPlaybook]);


  const executiveIntelligenceBriefing = useMemo(() => {
    const latest = operatorIntelligenceSummary.latestLearningAction;
    const learning = latest?.operatorLearning ?? null;

    const lessonsFound =
      learning?.lessonsFound ??
      learning?.summary?.lessonsFound ??
      learning?.summary?.totalLessons ??
      operatorIntelligenceSummary.memoryInfluenced;

    const reusableLessons =
      learning?.reusableLessons ?? learning?.summary?.reusableLessons ?? 0;

    const successfulLessons =
      learning?.successfulLessons ?? learning?.summary?.successfulLessons ?? 0;

    const averageOutcomeScore =
      learning?.averageOutcomeScore ??
      learning?.summary?.averageOutcomeScore ??
      null;

    const confidenceBoost =
      learning?.confidenceBoost ??
      learning?.summary?.confidenceBoost ??
      operatorIntelligenceSummary.avgConfidenceBoost;

    const topPlaybook =
      learning?.topPlaybook ??
      learning?.summary?.topPlaybook ??
      operatorIntelligenceSummary.topPlaybook;

    const isCautious =
      lessonsFound > 0 &&
      (reusableLessons === 0 ||
        operatorIntelligenceSummary.cautionActions > 0 ||
        (averageOutcomeScore !== null && averageOutcomeScore < 65));

    const posture =
      lessonsFound === 0
        ? "Collecting evidence"
        : isCautious
          ? "Cautious reuse"
          : "Pattern reuse";

    const headline =
      lessonsFound === 0
        ? "The AI is collecting enough examples before reusing playbooks."
        : `${titleCase(topPlaybook ?? latest?.action_type)} is the leading playbook right now.`;

    const recommendation =
      lessonsFound === 0
        ? "Keep executing approved actions so TurnTableAI can compare results and learn which playbooks work."
        : isCautious
          ? `Use ${titleCase(topPlaybook ?? latest?.action_type)} as a controlled operator review, not a fully automatic move yet.`
          : `Reuse ${titleCase(topPlaybook ?? latest?.action_type)} when similar signals appear, while continuing to monitor results.`;

    const operatorNote =
      lessonsFound === 0
        ? "TurnTableAI does not have enough completed actions to make a strong recommendation yet."
        : isCautious
          ? "The pattern is real, but outcome evidence is still developing. The operator should approve and monitor this move."
          : "The pattern has enough supporting memory to influence future recommendations.";

    const evidenceBullets =
      lessonsFound === 0
        ? [
            "No memory-influenced actions have been generated yet.",
            "Execute a few approved actions to create reusable evidence.",
            "The AI will become more confident as outcomes are scored.",
          ]
        : [
            `${lessonsFound} similar lesson${lessonsFound === 1 ? "" : "s"} found in operator memory.`,
            `${successfulLessons} strong outcome${successfulLessons === 1 ? "" : "s"} confirmed so far.`,
            reusableLessons > 0
              ? `${reusableLessons} lesson${reusableLessons === 1 ? "" : "s"} can be reused with confidence.`
              : "No lessons are strong enough for automatic reuse yet.",
            averageOutcomeScore !== null
              ? `Average outcome score is ${Math.round(averageOutcomeScore)}/100.`
              : "Outcome score is still being collected.",
          ];

    const latestMoveLabel = latest
      ? `${latest.title} · ${latest.location_name}`
      : "No memory-influenced move yet";

    return {
      headline,
      recommendation,
      operatorNote,
      posture,
      latestMoveLabel,
      topPlaybook,
      lessonsFound,
      reusableLessons,
      successfulLessons,
      averageOutcomeScore,
      confidenceBoost,
      evidenceBullets,
    };
  }, [
    operatorIntelligenceSummary.avgConfidenceBoost,
    operatorIntelligenceSummary.cautionActions,
    operatorIntelligenceSummary.latestLearningAction,
    operatorIntelligenceSummary.memoryInfluenced,
    operatorIntelligenceSummary.topPlaybook,
  ]);

  async function handleUpdateAutoActionStatus(
    id: string,
    status: AutoActionStatus,
  ) {
    try {
      setSavingAutoActionId(id);
      setAutoActionsError(null);

      const res = await fetch("/api/auto-actions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          status,
        }),
      });

      let json: {
        item?: AutoActionItem;
        executionResult?: AutoActionExecutionResult | null;
        error?: string;
      } | null = null;

      try {
        json = (await res.json()) as {
          item?: AutoActionItem;
          executionResult?: AutoActionExecutionResult | null;
          error?: string;
        };
      } catch {
        json = null;
      }

      if (!res.ok) {
        throw new Error(json?.error || "Failed to update auto action");
      }

      const nextFeedback: AutoActionFeedback =
        status === "executed"
          ? {
              kind: "success",
              message:
                json?.executionResult?.executionSummary ||
                "Auto action executed successfully.",
              downstreamRecords: json?.executionResult?.downstreamRecords ?? [],
            }
          : status === "approved"
            ? {
                kind: "info",
                message: "Auto action approved and ready for execution.",
              }
            : {
                kind: "info",
                message: "Auto action dismissed.",
              };

      setAutoActionFeedback((current) => ({
        ...current,
        [id]: nextFeedback,
      }));

      await loadAutoActions();

      if (status === "executed") {
        await loadOperatorMemory();
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update auto action";
      setAutoActionsError(message);
      setAutoActionFeedback((current) => ({
        ...current,
        [id]: {
          kind: "error",
          message,
        },
      }));
    } finally {
      setSavingAutoActionId(null);
    }
  }

  if (loading) {
    return <div className="p-8 text-white">Loading Command Center...</div>;
  }

  return (
    <div className="space-y-8 p-8 text-white">
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-neutral-900 via-neutral-950 to-black p-6 shadow-2xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-300">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
              Restaurant Operator Workspace
            </div>

            <h1 className="mt-4 text-3xl font-bold tracking-tight text-white md:text-4xl">
              Command Center
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-400 md:text-base">
              Monitor every location, detect risk early, rank priority, and
              surface the next best operator move before the business slips.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-neutral-500">
                Needs attention
              </div>
              <div className="mt-1 text-xl font-semibold text-white">
                {locationSummary.needsAttention}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-neutral-500">
                High alerts
              </div>
              <div className="mt-1 text-xl font-semibold text-white">
                {locationSummary.highAlerts}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-neutral-500">
                Pending actions
              </div>
              <div className="mt-1 text-xl font-semibold text-white">
                {locationSummary.pendingActions}
              </div>
            </div>
          </div>
        </div>
      </div>

      {commandCenterError ? (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          Command Center signals failed to load: {commandCenterError}
        </div>
      ) : null}

      <section className="rounded-3xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 via-sky-500/5 to-neutral-950 p-5 shadow-xl">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-cyan-200">
              Operator Briefing
            </div>

            <h2 className="mt-4 text-2xl font-semibold text-white">
              {briefing?.headline ?? "No major risk cluster detected right now"}
            </h2>

            <p className="mt-3 text-sm leading-6 text-neutral-300">
              {briefing?.summary ??
                "Your operator snapshot is live. As more reviews and performance history come in, this briefing will become sharper and more decision-oriented."}
            </p>

            {topActionNow ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4">
                <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                  Top move right now
                </div>
                <div className="mt-2 text-base font-semibold text-white">
                  {topActionNow.title}
                </div>
                <div className="mt-1 text-sm text-neutral-300">
                  {topActionNow.reason}
                </div>
                {topActionNow.href ? (
                  <Link
                    href={topActionNow.href}
                    className="mt-3 inline-block text-sm text-cyan-300"
                  >
                    Open recommended action →
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:w-[360px]">
            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4">
              <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                Resolved wins
              </div>
              <div className="mt-1 text-2xl font-semibold text-emerald-300">
                {briefing?.resolvedWins ?? 0}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4">
              <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                Priority items
              </div>
              <div className="mt-1 text-2xl font-semibold text-cyan-200">
                {briefing?.items?.length ?? 0}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4">
              <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                Active locations
              </div>
              <div className="mt-1 text-2xl font-semibold text-white">
                {locations.length}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4">
              <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                Pending moves
              </div>
              <div className="mt-1 text-2xl font-semibold text-amber-300">
                {locationSummary.pendingActions}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          {(briefing?.items?.length ?? 0) > 0 ? (
            briefing!.items.slice(0, 3).map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-white/10 bg-black/25 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cx(
                      "rounded px-2 py-1 text-xs",
                      severityStyles(item.severity),
                    )}
                  >
                    {item.severity}
                  </span>
                  <span className="rounded px-2 py-1 text-xs bg-white/10 text-white/70">
                    {item.type}
                  </span>
                  <span className="text-xs text-neutral-400">
                    {item.locationName}
                  </span>
                </div>

                <div className="mt-3 text-base font-semibold text-white">
                  {item.title}
                </div>
                <div className="mt-2 text-sm text-neutral-300">
                  {item.description}
                </div>

                <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-neutral-200">
                  {item.recommendedAction}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-neutral-300 lg:col-span-3">
              No briefing items yet. As the system gathers richer reviews,
              alerts, and performance signals, your operator briefing will show
              the top issues here.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-violet-500/20 bg-gradient-to-br from-violet-500/10 via-cyan-500/5 to-neutral-950 p-5 shadow-xl">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-violet-200">
              Executive Intelligence
            </div>

            <h2 className="mt-4 text-2xl font-semibold text-white">
              {executiveIntelligenceBriefing.headline}
            </h2>

            <p className="mt-3 text-sm leading-6 text-neutral-300">
              {executiveIntelligenceBriefing.operatorNote}
            </p>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                AI recommendation
              </div>
              <div className="mt-2 text-base font-semibold text-white">
                {executiveIntelligenceBriefing.recommendation}
              </div>

              <div className="mt-4 grid gap-2">
                {executiveIntelligenceBriefing.evidenceBullets.map((bullet) => (
                  <div
                    key={bullet}
                    className="flex gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-neutral-300"
                  >
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-violet-300" />
                    <span>{bullet}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:w-[420px]">
            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4">
              <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                Lessons found
              </div>
              <div className="mt-1 text-2xl font-semibold text-violet-200">
                {executiveIntelligenceBriefing.lessonsFound}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4">
              <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                Reusable lessons
              </div>
              <div className="mt-1 text-2xl font-semibold text-emerald-300">
                {executiveIntelligenceBriefing.reusableLessons}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4">
              <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                Outcome score
              </div>
              <div className="mt-1 text-2xl font-semibold text-cyan-200">
                {executiveIntelligenceBriefing.averageOutcomeScore !== null
                  ? `${Math.round(executiveIntelligenceBriefing.averageOutcomeScore)}/100`
                  : "—"}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4">
              <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                Confidence lift
              </div>
              <div className="mt-1 text-2xl font-semibold text-amber-300">
                {formatPercentValue(
                  Math.round(executiveIntelligenceBriefing.confidenceBoost * 100),
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
            <div className="text-[11px] uppercase tracking-wide text-neutral-500">
              Best-known playbook
            </div>
            <div className="mt-2 text-lg font-semibold text-white">
              {executiveIntelligenceBriefing.topPlaybook
                ? autoActionTypeLabel(executiveIntelligenceBriefing.topPlaybook)
                : "—"}
            </div>
            <div className="mt-2 text-sm leading-6 text-neutral-400">
              The move TurnTableAI sees most often when similar signals appear.
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
            <div className="text-[11px] uppercase tracking-wide text-neutral-500">
              Latest memory-influenced move
            </div>
            <div className="mt-2 text-lg font-semibold text-white">
              {executiveIntelligenceBriefing.latestMoveLabel}
            </div>
            <div className="mt-2 text-sm leading-6 text-neutral-400">
              This is the newest action where prior operator memory affected the recommendation.
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
            <div className="text-[11px] uppercase tracking-wide text-neutral-500">
              Current learning posture
            </div>
            <div className="mt-2 text-lg font-semibold text-white">
              {executiveIntelligenceBriefing.posture}
            </div>
            <div className="mt-2 text-sm leading-6 text-neutral-400">
              {executiveIntelligenceBriefing.posture === "Cautious reuse"
                ? "The AI should support the operator, not fully automate the move yet."
                : executiveIntelligenceBriefing.posture === "Pattern reuse"
                  ? "The AI has enough supporting memory to recommend this playbook more confidently."
                  : "The AI is still collecting evidence from executed actions."}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-cyan-500/5 to-neutral-950 p-5 shadow-xl">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-emerald-200">
              Outcome Engine
            </div>

            <h2 className="mt-4 text-2xl font-semibold text-white">
              Did the AI's decisions actually improve the restaurant?
            </h2>

            <p className="mt-3 text-sm leading-6 text-neutral-300">
              TurnTableAI now compares the business before and after executed actions, scores the result, and updates operator memory with measured evidence. This works for one-location restaurants and multi-location groups because every lesson is tied to the restaurant context where it happened.
            </p>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                Current outcome posture
              </div>
              <div className="mt-2 text-base font-semibold text-white">
                {outcomeTrackingSummary.posture}
              </div>
              <p className="mt-2 text-sm leading-6 text-neutral-400">
                {outcomeTrackingSummary.measured === 0
                  ? "Execute a few actions and run the Outcome Engine to begin scoring real-world impact."
                  : outcomeTrackingSummary.reusable > 0
                    ? "Some playbooks now have enough measured evidence to be reused more confidently."
                    : "The AI is measuring results, but the current evidence still says to keep actions operator-reviewed."}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:w-[420px]">
            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4">
              <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                Outcomes measured
              </div>
              <div className="mt-1 text-2xl font-semibold text-emerald-300">
                {outcomeTrackingSummary.measured}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4">
              <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                Average outcome
              </div>
              <div className="mt-1 text-2xl font-semibold text-cyan-200">
                {formatOutcomeScore(outcomeTrackingSummary.averageScore)}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4">
              <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                Reusable playbooks
              </div>
              <div className="mt-1 text-2xl font-semibold text-violet-200">
                {outcomeTrackingSummary.reusable}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4">
              <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                Strong lessons
              </div>
              <div className="mt-1 text-2xl font-semibold text-amber-300">
                {outcomeTrackingSummary.strong}
              </div>
            </div>
          </div>
        </div>

        {outcomeTrackingSummary.latestMeasured ? (
          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                Latest measured action
              </div>
              <div className="mt-2 text-lg font-semibold text-white">
                {outcomeTrackingSummary.latestMeasured.action_title}
              </div>
              <div className="mt-2 text-sm text-neutral-400">
                {outcomeTrackingSummary.latestMeasured.location_name ?? "Single-location workspace"}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                Outcome score
              </div>
              <div
                className={cx(
                  "mt-2 inline-flex rounded-full px-3 py-1 text-sm font-semibold",
                  outcomeScoreStyles(outcomeTrackingSummary.latestMeasured.outcome_score),
                )}
              >
                {formatOutcomeScore(outcomeTrackingSummary.latestMeasured.outcome_score)}
              </div>
              <div className="mt-2 text-sm leading-6 text-neutral-400">
                {outcomeTrackingSummary.latestMeasured.reuse_recommended
                  ? "Evidence supports reusing this playbook in similar situations."
                  : "Keep this as an operator-reviewed test until stronger results appear."}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                Before / after
              </div>
              <div className="mt-2 grid gap-2 text-sm text-neutral-300">
                <div>
                  Revenue: {formatBeforeAfter(
                    outcomeTrackingSummary.latestMeasured.revenue_before,
                    outcomeTrackingSummary.latestMeasured.revenue_after,
                    formatMoney,
                  )}
                </div>
                <div>
                  Rating: {formatBeforeAfter(
                    outcomeTrackingSummary.latestMeasured.rating_before,
                    outcomeTrackingSummary.latestMeasured.rating_after,
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-3xl border border-white/10 bg-neutral-950/60 p-5 shadow-xl">
        <h2 className="mb-4 text-xl font-semibold">Locations</h2>

        <div className="space-y-3">
          {locations.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-neutral-300">
              No location signals available right now.
            </div>
          ) : (
            locations.map((l) => (
              <div
                key={l.id}
                className="rounded-2xl border border-white/10 p-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="font-semibold">{l.name}</div>
                      <span
                        className={cx(
                          "rounded-full px-2 py-0.5 text-[11px] uppercase tracking-wide",
                          healthStyles(l.health),
                        )}
                      >
                        {l.health}
                      </span>
                    </div>
                    <div className="text-sm text-gray-400">{l.city}</div>
                    <div className="mt-2 text-sm text-neutral-300">
                      {l.topIssue ??
                        l.recommendedAction ??
                        "No major issue detected."}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                      <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                        Sales trend
                      </div>
                      <div className="mt-1 text-sm font-semibold text-white">
                        {formatDelta(l.salesDeltaPct)}
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                      <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                        Review issues
                      </div>
                      <div className="mt-1 text-sm font-semibold text-white">
                        {l.reviewIssueCount}
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                      <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                        Open alerts
                      </div>
                      <div className="mt-1 text-sm font-semibold text-white">
                        {l.openAlerts}
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                      <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                        Avg rating
                      </div>
                      <div className="mt-1 text-sm font-semibold text-white">
                        {l.avgRating !== null ? l.avgRating.toFixed(1) : "—"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-neutral-950/60 p-5 shadow-xl">
        <h2 className="mb-4 text-xl font-semibold">Priority Alerts</h2>

        <div className="space-y-3">
          {alerts.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-neutral-300">
              No priority alerts available right now.
            </div>
          ) : (
            alerts.map((a) => (
              <div
                key={a.id}
                className="rounded-2xl border border-white/10 p-4"
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex gap-2">
                    <span
                      className={cx(
                        "rounded px-2 py-1 text-xs",
                        severityStyles(a.severity),
                      )}
                    >
                      {a.severity}
                    </span>
                    {a.priorityLabel && (
                      <span
                        className={cx(
                          "rounded px-2 py-1 text-xs",
                          priorityStyles(a.priorityLabel),
                        )}
                      >
                        {a.priorityLabel}
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-gray-400">
                    {a.locationName}
                  </span>
                </div>

                <div className="font-semibold">{a.title}</div>
                <div className="text-sm text-gray-400">{a.description}</div>

                <div className="mt-2 text-xs text-gray-500">
                  {a.priorityReason} · Score {a.priorityScore}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-neutral-950/60 p-5 shadow-xl">
        <h2 className="mb-4 text-xl font-semibold">Recommended Actions</h2>

        <div className="space-y-3">
          {actions.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-neutral-300">
              No recommended actions available right now.
            </div>
          ) : (
            actions.map((a) => (
              <div
                key={a.id}
                className="rounded-2xl border border-white/10 p-4"
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex gap-2">
                    <span
                      className={cx(
                        "rounded px-2 py-1 text-xs",
                        actionStatusStyles(a.status),
                      )}
                    >
                      {a.status}
                    </span>
                    {a.priorityLabel && (
                      <span
                        className={cx(
                          "rounded px-2 py-1 text-xs",
                          priorityStyles(a.priorityLabel),
                        )}
                      >
                        {a.priorityLabel}
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-gray-400">
                    {a.locationName}
                  </span>
                </div>

                <div className="font-semibold">{a.title}</div>
                <div className="text-sm text-gray-400">{a.reason}</div>

                <div className="mt-2 text-xs text-gray-500">
                  {a.priorityReason} · Score {a.priorityScore}
                </div>

                {a.href && (
                  <Link
                    href={a.href}
                    className="mt-2 inline-block text-xs text-cyan-300"
                  >
                    Open →
                  </Link>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 via-sky-500/5 to-neutral-950 p-5 shadow-xl">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-cyan-200">
              Auto Actions
            </div>

            <h2 className="mt-4 text-2xl font-semibold text-white">
              Decision engine output
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-300">
              These are machine-generated operator moves ranked by urgency,
              confidence, and expected business impact. This is where
              TurnTableAI starts to feel less like software and more like an
              actual operating brain.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4">
              <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                Pending
              </div>
              <div className="mt-1 text-2xl font-semibold text-amber-300">
                {autoActionSummary.pending}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4">
              <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                Urgent / critical
              </div>
              <div className="mt-1 text-2xl font-semibold text-rose-300">
                {autoActionSummary.urgent}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4">
              <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                High confidence
              </div>
              <div className="mt-1 text-2xl font-semibold text-emerald-300">
                {autoActionSummary.highConfidence}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <button
              onClick={() => handleGenerateAutoActions()}
              disabled={generatingAutoActions}
              className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-200 transition hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {generatingAutoActions ? "Generating…" : "Generate auto actions"}
            </button>

            <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
              Autonomous mode active
            </div>

            {autoPilotNotice ? (
              <div className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-200">
                {autoPilotNotice}
              </div>
            ) : null}

            {autoActionsLoading && (
              <div className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs text-amber-200">
                Loading auto actions…
              </div>
            )}

            {autoActionsError && (
              <div className="rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-xs text-rose-200">
                {autoActionsError}
              </div>
            )}
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {(
              [
                "all",
                "pending",
                "approved",
                "executed",
                "dismissed",
              ] as AutoActionFilter[]
            ).map((filter) => {
              const count = autoActionFilterCounts[filter];
              const isActive = autoActionFilter === filter;

              return (
                <button
                  key={filter}
                  onClick={() => setAutoActionFilter(filter)}
                  className={cx(
                    "rounded-full border px-3 py-1.5 text-xs font-medium uppercase tracking-wide transition",
                    isActive
                      ? "border-cyan-400/40 bg-cyan-500/10 text-cyan-200"
                      : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10",
                  )}
                >
                  {autoActionFilterLabel(filter)} ({count})
                </button>
              );
            })}
          </div>

          {autoActionsLoading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-neutral-300">
              Loading auto actions…
            </div>
          ) : filteredAutoActions.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-neutral-300">
              {autoActionFilter === "all"
                ? "No auto actions yet. Autonomous mode checks for operator moves when the Command Center loads. You can also generate them manually."
                : `No ${autoActionFilterLabel(autoActionFilter).toLowerCase()} auto actions right now.`}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAutoActions.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cx(
                            "rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide",
                            autoActionStatusStyles(item.status),
                          )}
                        >
                          {item.status}
                        </span>

                        <span
                          className={cx(
                            "rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide",
                            item.priority_score >= 110
                              ? "bg-rose-500/15 text-rose-200"
                              : item.priority_score >= 75
                                ? "bg-amber-500/15 text-amber-200"
                                : item.priority_score >= 40
                                  ? "bg-sky-500/15 text-sky-200"
                                  : "bg-white/10 text-white/70",
                          )}
                        >
                          score {item.priority_score}
                        </span>

                        <span
                          className={cx(
                            "rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide",
                            urgencyStyles(item.urgency),
                          )}
                        >
                          {item.urgency
                            ? `${item.urgency} urgency`
                            : "operator review"}
                        </span>

                        <span
                          className={cx(
                            "rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide",
                            impactStyles(item.expectedImpact),
                          )}
                        >
                          {item.expectedImpact
                            ? `${item.expectedImpact} impact`
                            : "impact unknown"}
                        </span>

                        {item.businessContext?.health ? (
                          <span
                            className={cx(
                              "rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide",
                              healthStyles(item.businessContext.health),
                            )}
                          >
                            {item.businessContext.health}
                          </span>
                        ) : null}

                        <span className="text-xs uppercase tracking-wide text-neutral-500">
                          {autoActionTypeLabel(item.action_type)}
                        </span>

                        <span className="text-xs text-neutral-400">
                          {item.location_name}
                        </span>
                      </div>

                      <h3 className="mt-3 text-lg font-semibold text-white">
                        {item.title}
                      </h3>
                      <p className="mt-2 max-w-3xl text-sm text-neutral-300">
                        {item.reason}
                      </p>

                      {item.triggerSummary ? (
                        <div className="mt-3 rounded-xl border border-cyan-500/15 bg-cyan-500/5 px-3 py-2 text-sm text-cyan-100">
                          <span className="mr-2 text-xs uppercase tracking-wide text-cyan-300">
                            Trigger
                          </span>
                          {item.triggerSummary}
                        </div>
                      ) : null}
                    </div>

                    <div className="grid min-w-[240px] gap-3 sm:grid-cols-2 xl:w-[320px] xl:grid-cols-1">
                      <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-neutral-400">
                        Updated {formatWhen(item.updated_at ?? item.created_at)}
                      </div>

                      <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                        <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                          Confidence
                        </div>
                        <div className="mt-1 text-lg font-semibold text-white">
                          {formatConfidence(item.confidence)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                      <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                        Sales trend
                      </div>
                      <div className="mt-1 text-sm text-white/90">
                        {formatDelta(
                          item.businessContext?.salesDeltaPct ??
                            item.parsedSignal?.salesDeltaPct,
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                      <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                        Avg rating
                      </div>
                      <div className="mt-1 text-sm text-white/90">
                        {item.businessContext?.avgRating !== null &&
                        item.businessContext?.avgRating !== undefined
                          ? item.businessContext.avgRating.toFixed(1)
                          : item.parsedSignal?.avgRating !== null &&
                              item.parsedSignal?.avgRating !== undefined
                            ? item.parsedSignal.avgRating.toFixed(1)
                            : "—"}
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                      <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                        Review issues
                      </div>
                      <div className="mt-1 text-sm text-white/90">
                        {item.businessContext?.reviewIssueCount ??
                          item.parsedSignal?.reviewIssueCount ??
                          "—"}
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                      <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                        Open alerts
                      </div>
                      <div className="mt-1 text-sm text-white/90">
                        {item.businessContext?.openAlerts ??
                          item.parsedSignal?.openAlerts ??
                          "—"}
                      </div>
                    </div>
                  </div>

                  {(item.decision?.reasonBullets?.length ?? 0) > 0 ? (
                    <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                      <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                        Why the AI chose this
                      </div>
                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        {item.decision?.reasonBullets?.map((bullet, index) => (
                          <div
                            key={`${item.id}-reason-${index}`}
                            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-neutral-200"
                          >
                            {bullet}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {item.operatorLearning
                    ? (() => {
                        const learning = item.operatorLearning;
                        const lessons = learning.lessons ?? [];
                        const lessonsFound =
                          learning.lessonsFound ??
                          learning.summary?.lessonsFound ??
                          learning.summary?.totalLessons ??
                          lessons.length;
                        const reusableLessons =
                          learning.reusableLessons ??
                          learning.summary?.reusableLessons ??
                          0;
                        const successfulLessons =
                          learning.successfulLessons ??
                          learning.summary?.successfulLessons ??
                          0;
                        const averageOutcomeScore =
                          learning.averageOutcomeScore ??
                          learning.summary?.averageOutcomeScore ??
                          null;
                        const confidenceBoost =
                          learning.confidenceBoost ??
                          learning.summary?.confidenceBoost ??
                          0;
                        const topPlaybook =
                          learning.topPlaybook ??
                          learning.summary?.topPlaybook ??
                          item.action_type;
                        const actionLabel = autoActionTypeLabel(topPlaybook);
                        const isCautious =
                          lessonsFound > 0 &&
                          (reusableLessons === 0 ||
                            (averageOutcomeScore !== null && averageOutcomeScore < 65));
                        const currentRefunds =
                          item.parsedSignal?.latestRefunds ?? null;
                        const laborPct = item.parsedSignal?.latestLaborPct ?? null;
                        const marginPct = item.parsedSignal?.latestMarginPct ?? null;
                        const salesDelta = item.parsedSignal?.salesDeltaPct ?? null;
                        const reviewIssues = item.parsedSignal?.reviewIssueCount ?? null;
                        const likelyRootCause =
                          item.action_type === "margin_protection" ||
                          item.action_type === "labor_adjustment"
                            ? "Operational leakage: refunds, labor drag, waste, or inconsistent service recovery may be compressing margin."
                            : item.action_type === "service_recovery" ||
                                item.action_type === "review_response_push"
                              ? "Guest experience pressure: unresolved complaints may be damaging reputation and repeat visits."
                              : item.action_type === "traffic_reactivation" ||
                                  item.action_type === "promo_launch"
                                ? "Demand softness: traffic may need a focused recovery offer, local campaign, or daypart-specific push."
                                : "Mixed operator signal: the AI sees enough risk to require human review before automation.";
                        const operatingThesis =
                          lessonsFound === 0
                            ? "The AI does not have enough historical evidence yet, so this should be treated as a first controlled test."
                            : isCautious
                              ? `The AI has seen this pattern before, but the evidence is still developing. Use ${actionLabel} with operator review before repeating it broadly.`
                              : `The AI has enough supporting memory to reuse ${actionLabel} more confidently for similar signals.`;
                        const nextMove =
                          item.action_type === "margin_protection"
                            ? "Audit refunds by reason code, compare labor by daypart, review comp/waste logs, then assign one owner to close the largest leak within 48 hours."
                            : item.action_type === "service_recovery"
                              ? "Prioritize low-rating reviews, identify the repeating complaint theme, draft replies, and escalate the root cause to the shift lead."
                              : item.action_type === "traffic_reactivation"
                                ? "Identify the weakest daypart, create one targeted recovery offer, and compare traffic/revenue against the last matching period."
                                : "Confirm the root cause, choose the smallest safe intervention, and measure the result before scaling it.";
                        const realWorldChecks = [
                          currentRefunds !== null
                            ? `Refund pressure: ${currentRefunds} refund${currentRefunds === 1 ? "" : "s"} need reason-code review.`
                            : "Refund pressure: check comps, refunds, and service recovery logs before acting.",
                          laborPct !== null
                            ? `Labor reality: labor is at ${laborPct}%; compare it against traffic by daypart before cutting hours.`
                            : "Labor reality: check staffing, breaks, and schedule fit against demand before changing labor.",
                          marginPct !== null
                            ? `Margin reality: margin is at ${marginPct}%; verify waste, discounting, and menu mix before assuming demand is the issue.`
                            : "Margin reality: verify waste, discounting, supplier changes, and menu mix before choosing the fix.",
                          salesDelta !== null
                            ? `Demand reality: sales are ${formatDelta(salesDelta)}; compare weather, local events, promos, and daypart traffic.`
                            : "Demand reality: compare weather, local events, promos, and daypart traffic before launching offers.",
                          reviewIssues !== null
                            ? `Guest reality: ${reviewIssues} review issue${reviewIssues === 1 ? "" : "s"}; read examples before deciding whether the problem is service, food, or speed.`
                            : "Guest reality: read recent negative reviews before assuming the operational root cause.",
                        ].slice(0, 5);

                        return (
                          <div className="mt-4 rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/10 via-cyan-500/5 to-black/20 p-4">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                              <div className="max-w-3xl">
                                <div className="inline-flex items-center rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-violet-200">
                                  AI operator intelligence
                                </div>
                                <h4 className="mt-3 text-base font-semibold text-white">
                                  {lessonsFound > 0
                                    ? `TurnTable has seen this pattern ${lessonsFound} time${lessonsFound === 1 ? "" : "s"}.`
                                    : "TurnTable is treating this as a new operating pattern."}
                                </h4>
                                <p className="mt-2 text-sm leading-6 text-neutral-300">
                                  {operatingThesis}
                                </p>

                                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                                  <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                                    <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                                      Likely root cause
                                    </div>
                                    <div className="mt-2 text-sm leading-6 text-neutral-200">
                                      {likelyRootCause}
                                    </div>
                                  </div>
                                  <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                                    <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                                      Recommended operator move
                                    </div>
                                    <div className="mt-2 text-sm leading-6 text-neutral-200">
                                      {nextMove}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="grid min-w-[260px] gap-2 sm:grid-cols-2 xl:w-[320px]">
                                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                                  <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                                    Lessons found
                                  </div>
                                  <div className="mt-1 text-lg font-semibold text-white">
                                    {lessonsFound}
                                  </div>
                                </div>

                                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                                  <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                                    Confidence lift
                                  </div>
                                  <div className="mt-1 text-lg font-semibold text-white">
                                    {formatPercentValue(Math.round(confidenceBoost * 100))}
                                  </div>
                                </div>

                                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                                  <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                                    Best playbook
                                  </div>
                                  <div className="mt-1 text-sm font-semibold text-white">
                                    {actionLabel}
                                  </div>
                                </div>

                                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                                  <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                                    AI posture
                                  </div>
                                  <div className="mt-1 text-sm font-semibold text-white">
                                    {isCautious ? "Controlled test" : "Pattern reuse"}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                              <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                                Real-world checks before execution
                              </div>
                              <div className="mt-3 grid gap-2 lg:grid-cols-2">
                                {realWorldChecks.map((check) => (
                                  <div
                                    key={check}
                                    className="flex gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm leading-6 text-neutral-200"
                                  >
                                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-cyan-300" />
                                    <span>{check}</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {(lessons.length > 0 || averageOutcomeScore !== null) ? (
                              <div className="mt-4 grid gap-2 lg:grid-cols-3">
                                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-neutral-200">
                                  <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                                    Outcome evidence
                                  </div>
                                  <div className="mt-1">
                                    {averageOutcomeScore !== null
                                      ? `${Math.round(averageOutcomeScore)}/100 average outcome score.`
                                      : successfulLessons > 0
                                        ? `${successfulLessons} strong outcome${successfulLessons === 1 ? "" : "s"} confirmed.`
                                        : "Outcome evidence is still being collected."}
                                  </div>
                                </div>

                                {lessons.slice(0, 2).map((lesson, index) => (
                                  <div
                                    key={`${item.id}-operator-intelligence-${lesson.id ?? index}`}
                                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-neutral-200"
                                  >
                                    <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                                      {lesson.reuseRecommended
                                        ? "Reusable memory"
                                        : "Caution memory"}
                                      {lesson.outcomeScore !== null &&
                                      lesson.outcomeScore !== undefined
                                        ? ` · ${lesson.outcomeScore}/100`
                                        : ""}
                                    </div>
                                    <div className="mt-1">
                                      {compactText(
                                        lesson.lesson ??
                                          lesson.resultSummary ??
                                          lesson.actionTitle ??
                                          "Prior operator memory found.",
                                        170,
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        );
                      })()
                    : null}

                  <div className="mt-4 grid gap-4 xl:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                        Action plan
                      </div>

                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                          <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                            Execution mode
                          </div>
                          <div className="mt-1 text-sm text-white/90">
                            {titleCase(item.actionPlan?.executionMode)}
                          </div>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                          <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                            Success metric
                          </div>
                          <div className="mt-1 text-sm text-white/90">
                            {titleCase(item.actionPlan?.successMetric)}
                          </div>
                        </div>

                        {(item.actionPlan?.channel ||
                          item.actionPlan?.targetWindow) && (
                          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                            <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                              Channel / window
                            </div>
                            <div className="mt-1 text-sm text-white/90">
                              {titleCase(item.actionPlan?.channel) !== "—"
                                ? titleCase(item.actionPlan?.channel)
                                : titleCase(item.actionPlan?.targetWindow)}
                            </div>
                          </div>
                        )}

                        {(item.actionPlan?.suggestedOffer ||
                          item.actionPlan?.suggestedWorkflow ||
                          item.actionPlan?.focus) && (
                          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                            <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                              Recommended move
                            </div>
                            <div className="mt-1 text-sm text-white/90">
                              {item.actionPlan?.suggestedOffer ??
                                item.actionPlan?.suggestedWorkflow ??
                                titleCase(item.actionPlan?.focus)}
                            </div>
                          </div>
                        )}
                      </div>

                      {(item.actionPlan?.checklist?.length ?? 0) > 0 ? (
                        <div className="mt-4 space-y-2">
                          {item.actionPlan?.checklist?.map((step, index) => (
                            <div
                              key={`${item.id}-check-${index}`}
                              className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-neutral-200"
                            >
                              <span className="mt-0.5 inline-block h-2 w-2 rounded-full bg-cyan-300" />
                              <span>{step}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                        Expected business outcome
                      </div>

                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                          <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                            Likely outcome
                          </div>
                          <div className="mt-1 text-sm text-white/90">
                            {item.decision?.likelyOutcome ?? "—"}
                          </div>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                          <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                            Revenue recovery
                          </div>
                          <div className="mt-1 text-sm text-white/90">
                            {item.expectedMetrics?.revenueRecoveryPct !==
                              null &&
                            item.expectedMetrics?.revenueRecoveryPct !==
                              undefined
                              ? formatPercentValue(
                                  item.expectedMetrics.revenueRecoveryPct,
                                )
                              : "—"}
                          </div>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                          <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                            Rating protection
                          </div>
                          <div className="mt-1 text-sm text-white/90">
                            {item.expectedMetrics?.ratingProtection ?? "—"}
                          </div>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                          <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                            Margin / throughput protection
                          </div>
                          <div className="mt-1 text-sm text-white/90">
                            {item.expectedMetrics?.marginProtection ??
                              item.expectedMetrics?.throughputProtection ??
                              "—"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {(item.parsedSignal?.negativeReviewExamples?.length ?? 0) >
                  0 ? (
                    <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                      <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                        Review evidence
                      </div>

                      <div className="mt-3 grid gap-3">
                        {item.parsedSignal?.negativeReviewExamples?.map(
                          (example, index) => (
                            <div
                              key={`${item.id}-review-${index}`}
                              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-neutral-300"
                            >
                              “{compactText(example, 150)}”
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                      <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                        Latest revenue
                      </div>
                      <div className="mt-1 text-sm text-white/90">
                        {formatCompactNumber(item.parsedSignal?.latestRevenue)}
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                      <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                        Latest orders
                      </div>
                      <div className="mt-1 text-sm text-white/90">
                        {formatNumber(item.parsedSignal?.latestOrders)}
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                      <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                        Labor %
                      </div>
                      <div className="mt-1 text-sm text-white/90">
                        {formatPercentValue(item.parsedSignal?.latestLaborPct)}
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                      <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                        Refunds
                      </div>
                      <div className="mt-1 text-sm text-white/90">
                        {formatNumber(item.parsedSignal?.latestRefunds)}
                      </div>
                    </div>
                  </div>

                  {autoActionFeedback[item.id] ? (
                    <div className="mt-4 space-y-3">
                      <div
                        className={cx(
                          "rounded-xl px-4 py-3 text-sm",
                          feedbackStyles(autoActionFeedback[item.id].kind),
                        )}
                      >
                        {autoActionFeedback[item.id].message}
                      </div>

                      {(autoActionFeedback[item.id].downstreamRecords?.length ??
                        0) > 0 ? (
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                          <div className="mb-3 text-[11px] uppercase tracking-wide text-neutral-500">
                            What the system created
                          </div>

                          <div className="grid gap-2 md:grid-cols-2">
                            {autoActionFeedback[item.id].downstreamRecords?.map(
                              (record, index) => (
                                <div
                                  key={`${item.id}-downstream-${index}`}
                                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-neutral-200"
                                >
                                  <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                                    {downstreamRecordType(record)}
                                  </div>
                                  <div className="mt-1">
                                    {downstreamRecordLabel(record)}
                                  </div>
                                </div>
                              ),
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-3">
                    {item.status === "pending" && (
                      <button
                        onClick={() =>
                          handleUpdateAutoActionStatus(item.id, "approved")
                        }
                        disabled={savingAutoActionId === item.id}
                        className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-200 transition hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {savingAutoActionId === item.id ? "Saving…" : "Approve"}
                      </button>
                    )}

                    {item.status === "approved" && (
                      <button
                        onClick={() =>
                          handleUpdateAutoActionStatus(item.id, "executed")
                        }
                        disabled={savingAutoActionId === item.id}
                        className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {savingAutoActionId === item.id ? "Saving…" : "Execute"}
                      </button>
                    )}

                    {item.status !== "dismissed" &&
                      item.status !== "executed" && (
                        <button
                          onClick={() =>
                            handleUpdateAutoActionStatus(item.id, "dismissed")
                          }
                          disabled={savingAutoActionId === item.id}
                          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/75 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {savingAutoActionId === item.id
                            ? "Saving…"
                            : "Dismiss"}
                        </button>
                      )}

                    {item.status === "approved" && (
                      <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-200">
                        Approved
                      </div>
                    )}

                    {item.status === "executed" && (
  <>
    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-200">
      Executed
    </div>

    <a
      href={`/brain?actionId=${encodeURIComponent(item.id)}`}
      className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-200 transition hover:bg-cyan-500/15"
    >
      Review in Brain
    </a>
  </>
)}

                    {item.status === "dismissed" && (
                      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/60">
                        Dismissed
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-cyan-500/5 to-neutral-950 p-5 shadow-xl">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-emerald-200">
              Outcomes / Learning
            </div>

            <h2 className="mt-4 text-2xl font-semibold text-white">
              What the AI operator has executed
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-300">
              This section turns executed actions into visible learning history.
              It helps show which operator moves have been completed, what
              signals caused them, and what outcomes the system expected.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4">
              <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                Executed moves
              </div>
              <div className="mt-1 text-2xl font-semibold text-emerald-300">
                {learningSummary.executed}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4">
              <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                High impact
              </div>
              <div className="mt-1 text-2xl font-semibold text-cyan-200">
                {learningSummary.highImpact}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4">
              <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                Avg confidence
              </div>
              <div className="mt-1 text-2xl font-semibold text-white">
                {formatConfidence(learningSummary.avgConfidence)}
              </div>
            </div>
          </div>
        </div>

        {learningSummary.topType ? (
          <div className="mb-4 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-neutral-300">
            Most repeated executed playbook:{" "}
            <span className="font-semibold text-white">
              {autoActionTypeLabel(learningSummary.topType)}
            </span>
          </div>
        ) : null}

        {executedLearningItems.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-neutral-300">
            No executed learning records yet. Approve and execute an auto
            action, then it will show up here as part of the operator memory
            trail.
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {executedLearningItems.map((item) => (
              <div
                key={`learning-${item.id}`}
                className="rounded-2xl border border-white/10 bg-black/25 p-4"
              >
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-emerald-300">
                    executed
                  </span>

                  <span
                    className={cx(
                      "rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide",
                      impactStyles(item.expectedImpact),
                    )}
                  >
                    {item.expectedImpact
                      ? `${item.expectedImpact} impact`
                      : "impact unknown"}
                  </span>

                  <span className="text-xs uppercase tracking-wide text-neutral-500">
                    {autoActionTypeLabel(item.action_type)}
                  </span>

                  <span className="text-xs text-neutral-400">
                    {item.location_name}
                  </span>
                </div>

                <div className="text-lg font-semibold text-white">
                  {item.title}
                </div>

                <p className="mt-2 text-sm leading-6 text-neutral-300">
                  {item.decision?.likelyOutcome ?? item.reason}
                </p>

                {item.triggerSummary ? (
                  <div className="mt-3 rounded-xl border border-cyan-500/15 bg-cyan-500/5 px-3 py-2 text-sm text-cyan-100">
                    <span className="mr-2 text-xs uppercase tracking-wide text-cyan-300">
                      Learned from
                    </span>
                    {item.triggerSummary}
                  </div>
                ) : null}

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                      Confidence
                    </div>
                    <div className="mt-1 text-sm font-semibold text-white">
                      {formatConfidence(item.confidence)}
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                      Success metric
                    </div>
                    <div className="mt-1 text-sm font-semibold text-white">
                      {titleCase(item.actionPlan?.successMetric)}
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                      Executed
                    </div>
                    <div className="mt-1 text-sm font-semibold text-white">
                      {formatWhen(item.updated_at ?? item.created_at)}
                    </div>
                  </div>
                </div>

                {(item.decision?.reasonBullets?.length ?? 0) > 0 ? (
                  <div className="mt-4 space-y-2">
                    {item.decision?.reasonBullets
                      ?.slice(0, 3)
                      .map((bullet, index) => (
                        <div
                          key={`learning-${item.id}-reason-${index}`}
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-neutral-200"
                        >
                          {bullet}
                        </div>
                      ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-violet-500/20 bg-gradient-to-br from-violet-500/10 via-cyan-500/5 to-neutral-950 p-5 shadow-xl">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-violet-200">
              Operator Memory
            </div>

            <h2 className="mt-4 text-2xl font-semibold text-white">
              What TurnTableAI has learned
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-300">
              These are reusable lessons created from executed operator actions.
              The goal is to help future decisions avoid repeating work and
              recommend the playbooks that have already shown useful operating
              patterns.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4">
              <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                Active lessons
              </div>
              <div className="mt-1 text-2xl font-semibold text-violet-200">
                {operatorMemorySummary.active}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4">
              <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                High confidence
              </div>
              <div className="mt-1 text-2xl font-semibold text-emerald-300">
                {operatorMemorySummary.highConfidence}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4">
              <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                Top playbook
              </div>
              <div className="mt-1 text-lg font-semibold text-white">
                {operatorMemorySummary.topPlaybook
                  ? autoActionTypeLabel(operatorMemorySummary.topPlaybook)
                  : "—"}
              </div>
            </div>
          </div>
        </div>

        {operatorMemorySummary.topLocation ? (
          <div className="mb-4 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-neutral-300">
            Most learned location:{" "}
            <span className="font-semibold text-white">
              {operatorMemorySummary.topLocation}
            </span>
          </div>
        ) : null}

        {operatorMemoryLoading ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-neutral-300">
            Loading operator memory…
          </div>
        ) : operatorMemoryError ? (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-5 text-sm text-rose-200">
            Operator memory failed to load: {operatorMemoryError}
          </div>
        ) : operatorMemory.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-neutral-300">
            No operator memory yet. Execute a fresh auto action and TurnTableAI
            will start building reusable operating lessons here.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {operatorMemory.slice(0, 8).map((memory) => (
              <div
                key={memory.id}
                className="rounded-2xl border border-white/10 bg-black/25 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cx(
                      "rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide",
                      memoryConfidenceStyles(memory.confidence),
                    )}
                  >
                    {memory.confidence} confidence
                  </span>

                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-white/70">
                    {autoActionTypeLabel(memory.action_type)}
                  </span>

                  <span className="text-xs text-neutral-400">
                    {memory.location_name ?? "Global"}
                  </span>

                  {memory.outcome_score !== null && memory.outcome_score !== undefined ? (
                    <span
                      className={cx(
                        "rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide",
                        outcomeScoreStyles(memory.outcome_score),
                      )}
                    >
                      Outcome {formatOutcomeScore(memory.outcome_score)}
                    </span>
                  ) : null}

                  {memory.lesson_strength ? (
                    <span
                      className={cx(
                        "rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide",
                        lessonStrengthStyles(memory.lesson_strength),
                      )}
                    >
                      {memory.lesson_strength} lesson
                    </span>
                  ) : null}

                  {memory.reuse_recommended === true ? (
                    <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-emerald-200">
                      Reuse recommended
                    </span>
                  ) : memory.reuse_recommended === false ? (
                    <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-amber-200">
                      Operator review
                    </span>
                  ) : null}
                </div>

                <h3 className="mt-3 text-lg font-semibold text-white">
                  {memory.action_title}
                </h3>

                <div className="mt-2 rounded-xl border border-violet-500/15 bg-violet-500/5 px-3 py-2 text-sm text-violet-100">
                  <span className="mr-2 text-xs uppercase tracking-wide text-violet-300">
                    Lesson
                  </span>
                  {memory.lesson}
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                      Outcome score
                    </div>
                    <div className="mt-1 text-sm font-semibold text-white">
                      {formatOutcomeScore(memory.outcome_score)}
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                      Revenue before / after
                    </div>
                    <div className="mt-1 text-sm font-semibold text-white">
                      {formatBeforeAfter(memory.revenue_before, memory.revenue_after, formatMoney)}
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                      Refunds before / after
                    </div>
                    <div className="mt-1 text-sm font-semibold text-white">
                      {formatBeforeAfter(
                        evidenceSnapshotNumber(memory.evidence, "baseline", "refunds"),
                        evidenceSnapshotNumber(memory.evidence, "current", "refunds"),
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                      Rating before / after
                    </div>
                    <div className="mt-1 text-sm font-semibold text-white">
                      {formatBeforeAfter(memory.rating_before, memory.rating_after)}
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                      Problem type
                    </div>
                    <div className="mt-1 text-sm text-white/90">
                      {titleCase(memory.problem_type)}
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                      Last updated
                    </div>
                    <div className="mt-1 text-sm text-white/90">
                      {formatWhen(memory.updated_at ?? memory.created_at)}
                    </div>
                  </div>
                </div>

                <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                    Result summary
                  </div>
                  <div className="mt-1 text-sm leading-6 text-neutral-200">
                    {memory.result_summary}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
