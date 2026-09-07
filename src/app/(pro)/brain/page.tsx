"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import OperatorWorkflow from "@/components/brain/OperatorWorkflow";
import RecommendedAction from "@/components/brain/RecommendedAction";
import EvidenceReviewPanel from "@/components/brain/EvidenceReviewPanel";
import WhyThisIsHappening from "@/components/brain/WhyThisIsHappening";
import BrainDiagnosticConsole, {
  type BrainDiagnosticCognition,
  type BrainDiagnosticLearning,
} from "@/components/brain/BrainDiagnosticConsole";
import {
  buildRecommendedAction,
  buildWhyThisIsHappening,
} from "@/components/brain/adapters";
import type {
  EvidenceGapContext,
  EvidenceSubmission,
  RecommendedActionData,
  DecisionTransitionData,
  WhyThisIsHappeningData,
} from "@/components/brain/types";
import {
  approveWorkflow,
  completeWorkflowStep,
  markWorkflowLearned,
  startWorkflow,
} from "@/lib/operatorWorkflowEngine";
import type {
  OperatorWorkflow as OperatorWorkflowModel,
} from "@/lib/operatorWorkflowEngine";
import {
  synchronizeDecisionTransition,
} from "@/lib/brain/decisionProvenance";
type AutoActionStatus = "pending" | "approved" | "executed" | "dismissed";

type AutoActionItem = {
  id: string;
  location_name?: string | null;
  action_type?: string | null;
  title?: string | null;
  reason?: string | null;
  status?: AutoActionStatus | string | null;
  priority_score?: number | null;
  recommended_payload?: Record<string, unknown> | null;
  source_signal?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type OperatorMemoryItem = {
  id: string;
  location_name?: string | null;
  problem_type?: string | null;
  action_type?: string | null;
  action_title?: string | null;
  result_summary?: string | null;
  lesson?: string | null;
  confidence?: string | null;
  status?: string | null;
  evidence?: Record<string, unknown> | null;
  outcome_score?: number | null;
  success?: boolean | null;
  revenue_before?: number | null;
  revenue_after?: number | null;
  rating_before?: number | null;
  rating_after?: number | null;
  lesson_strength?: string | null;
  reuse_recommended?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type BrainStat = {
  label: string;
  value: string;
  helper: string;
};

type PlanningMove = {
  id?: string;
  title?: string;
  actionType?: string;
  locationName?: string | null;
  urgency?: string;
  impact?: string;
  risk?: string;
  confidence?: number | null;
  roiScore?: number | null;
  priorityScore?: number | null;
  reason?: string;
  expectedOutcome?: string;
  executionWindow?: string;
  checklist?: string[];
  successMetric?: string;
};

type PlanningPayload = {
  ok?: boolean;
  mode?: "single_location" | "network" | string;
  restaurantState?: Record<string, unknown>;
  restaurantStates?: Array<Record<string, unknown>>;
  planning?: {
    ok?: boolean;
    horizon?: string;
    summary?: string;
    topMove?: PlanningMove | null;
    moves?: PlanningMove[];
    locationsPlanned?: number;
    locationName?: string | null;
    generatedAt?: string;
  };
  generatedAt?: string;
};

type CausalHypothesis = {
  id?: string;
  locationName?: string | null;
  category?: string;
  severity?: string;
  confidence?: string;
  confidenceScore?: number | null;
  cause?: string;
  explanation?: string;
  evidence?: string[];
  affectedMetrics?: string[];
  recommendedActions?: string[];
  whatWouldChangeMyMind?: string[];
  generatedAt?: string;
};

type CausalPayload = {
  ok?: boolean;
  mode?: "single_location" | "network" | string;
  restaurantStates?: Array<Record<string, unknown>>;
  causalAnalysis?: {
    ok?: boolean;
    mode?: "single_location" | "network" | string;
    summary?: string;
    topHypothesis?: CausalHypothesis | null;
    hypotheses?: CausalHypothesis[];
    generatedAt?: string;
  };
  generatedAt?: string;
};


type RestaurantPrediction = {
  id?: string;
  locationName?: string | null;
  horizon?: string;
  riskLevel?: string;
  confidence?: number | null;
  prediction?: string;
  expectedChange?: string;
  estimatedBusinessImpact?: string;
  leadingIndicators?: string[];
  ifIgnored?: string[];
  bestIntervention?: string[];
  metricsForecast?: {
    revenueChangePct?: number | null;
    refundChangePct?: number | null;
    ratingChange?: number | null;
    marginChangePct?: number | null;
    laborChangePct?: number | null;
  };
  generatedAt?: string;
};

type PredictionPayload = {
  ok?: boolean;
  mode?: "single_location" | "network" | string;
  restaurantStates?: Array<Record<string, unknown>>;
  prediction?: {
    ok?: boolean;
    mode?: "single_location" | "network" | string;
    horizon?: string;
    summary?: string;
    topPrediction?: RestaurantPrediction | null;
    predictions?: RestaurantPrediction[];
    generatedAt?: string;
  };
  generatedAt?: string;
};

type WorldSignal = {
  id?: string;
  type?: string;
  label?: string;
  riskLevel?: string;
  confidence?: number | null;
  summary?: string;
  evidence?: string[];
  operatorImplication?: string;
  recommendedAdjustment?: string;
};

type WorldLocationModel = {
  ok?: boolean;
  locationName?: string | null;
  summary?: string;
  externalPressureScore?: number | null;
  demandModifierPct?: number | null;
  laborModifierPct?: number | null;
  marginRiskModifierPct?: number | null;
  deliveryPressure?: string;
  signals?: WorldSignal[];
  assumptions?: string[];
  generatedAt?: string;
};

type WorldModelPayload = {
  ok?: boolean;
  mode?: "single_location" | "network" | string;
  restaurantStates?: Array<Record<string, unknown>>;
  worldModel?: {
    ok?: boolean;
    mode?: "single_location" | "network" | string;
    locationsModeled?: number;
    summary?: string;
    topSignal?: {
      signal?: WorldSignal;
      locationName?: string | null;
    } | null;
    locationModels?: WorldLocationModel[];
    generatedAt?: string;
  };
  generatedAt?: string;
};


type ExecutionMode = "automatic" | "approval_required" | "monitor" | string;

type ExecutionTask = {
  id?: string;
  title?: string;
  description?: string;
  priority?: number | null;
  mode?: ExecutionMode;
  estimatedImpact?: number | null;
  confidence?: number | null;
};

type ExecutionPayload = {
  ok?: boolean;
  mode?: "single_location" | "network" | string;
  executionPlan?: {
    summary?: string;
    mode?: ExecutionMode;
    topTask?: ExecutionTask | null;
    queue?: ExecutionTask[];
    generatedAt?: string;
  };
  executiveAI?: {
    headline?: string;
    recommendation?: string;
    riskLevel?: string;
    confidence?: number | null;
    whyNow?: string[];
    doNext?: string[];
    watchClosely?: string[];
    successMetric?: string;
    executiveSummary?: string;
  };
  generatedAt?: string;
};
type KernelOperatorIntelligence = {
  ok?: boolean;
  mode?: "single_location" | "network" | string;

  judgment?: string | null;
  headline?: string | null;
  situation?: string | null;

  riskLevel?: string | null;
  confidence?: number | null;

  rootCause?: string | null;
  likelyFuture?: string | null;

  firstMove?: string | null;
  whyThisMove?: string | null;

  executionMode?: string | null;
  executionWindow?: string | null;

  doNow?: string[];
  doNotDo?: string[];
  watchNext?: string[];

  successMetric?: string | null;
  locationFocus?: string | null;
};



type AIKernelPayload = {
  ok?: boolean;

  mode?:
    | "single_location"
    | "network"
    | string;

  locationName?:
    | string
    | null;

  locationsAnalyzed?: number;

  cognition?:
    | BrainDiagnosticCognition
    | null;

  learning?:
    | BrainDiagnosticLearning
    | null;

  operatorIntelligence?:
    | KernelOperatorIntelligence
    | null;
  operatorWorkflow?: OperatorWorkflowModel | null; 

  executiveAI?: ExecutionPayload["executiveAI"];
  executionPlan?: ExecutionPayload["executionPlan"];

  pipeline?: Record<string, boolean>;
  generatedAt?: string;
};

type AIKernelResponse = {
  ok?: boolean;
  generatedAt?: string;
  kernel?: AIKernelPayload | null;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function asStringArray(
  value: unknown,
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => asString(item))
    .filter(
      (item): item is string =>
        item !== null,
    );
}

function uniqueStrings(
  values: Array<
    string | null | undefined
  >,
) {
  return Array.from(
    new Set(
      values
        .map((value) =>
          value
            ?.replace(/\s+/g, " ")
            .trim(),
        )
        .filter(
          (value): value is string =>
            Boolean(value),
        ),
    ),
  );
}
function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${Math.round(value)}%`;
}

function formatScore(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${Math.round(value)}/100`;
}

function formatWhen(value?: string | null) {
  if (!value) return "Recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function titleCase(value: string | null | undefined) {
  if (!value) return "—";
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function compactText(value: string | null | undefined, max = 180) {
  const text = (value || "").replace(/\s+/g, " ").trim();
  if (!text) return "No lesson text yet.";
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function getPayloadLearning(item: AutoActionItem) {
  const payload = isRecord(item.recommended_payload)
    ? item.recommended_payload
    : null;
  const decision = payload && isRecord(payload.decision) ? payload.decision : null;
  const source = isRecord(item.source_signal) ? item.source_signal : null;

  const learning =
    payload && isRecord(payload.operatorLearning)
      ? payload.operatorLearning
      : decision && isRecord(decision.operatorLearning)
        ? decision.operatorLearning
        : source && isRecord(source.operatorLearning)
          ? source.operatorLearning
          : null;

  return learning;
}

function getLessonsFound(item: AutoActionItem) {
  const learning = getPayloadLearning(item);
  if (!learning) return 0;
  const summary = isRecord(learning.summary) ? learning.summary : null;
  return (
    asNumber(learning.lessonsFound) ??
    asNumber(summary?.lessonsFound) ??
    asNumber(summary?.totalLessons) ??
    0
  );
}

function getAverageOutcome(memory: OperatorMemoryItem[]) {
  const scores = memory
    .map((item) => asNumber(item.outcome_score))
    .filter((score): score is number => score !== null);

  if (!scores.length) return null;
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

function getTopCount(items: Array<string | null | undefined>) {
  const counts = items.reduce<Record<string, number>>((acc, item) => {
    if (!item) return acc;
    acc[item] = (acc[item] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0] ?? null;
}

function confidenceStyle(confidence?: string | null) {
  if (confidence === "high") return "text-emerald-200 bg-emerald-500/10 border-emerald-500/20";
  if (confidence === "medium") return "text-cyan-200 bg-cyan-500/10 border-cyan-500/20";
  if (confidence === "low") return "text-amber-200 bg-amber-500/10 border-amber-500/20";
  return "text-white/70 bg-white/5 border-white/10";
}

function buildBeliefs(memory: OperatorMemoryItem[]) {
  const active = memory.filter((item) => item.status !== "archived");
  const reusable = active.filter((item) => item.reuse_recommended);
  const measured = active.filter((item) => asNumber(item.outcome_score) !== null);
  const topPlaybook = getTopCount(active.map((item) => item.action_type));
  const topProblem = getTopCount(active.map((item) => item.problem_type));

  const beliefs = [];

  if (topPlaybook) {
    const matching = active.filter((item) => item.action_type === topPlaybook[0]);
    const avg = getAverageOutcome(matching);
    beliefs.push({
      title: `${titleCase(topPlaybook[0])} is the most observed playbook.`,
      body:
        avg !== null
          ? `The AI has measured this playbook ${matching.length} time${matching.length === 1 ? "" : "s"} with an average outcome score of ${Math.round(avg)}/100.`
          : `The AI has seen this playbook ${matching.length} time${matching.length === 1 ? "" : "s"}, but still needs stronger outcome evidence.`,
      confidence: avg !== null && avg >= 70 ? "high" : avg !== null && avg >= 55 ? "medium" : "low",
    });
  }

  if (topProblem) {
    beliefs.push({
      title: `${titleCase(topProblem[0])} is the strongest recurring operating pattern.`,
      body: `This pattern appears across ${topProblem[1]} learned observation${topProblem[1] === 1 ? "" : "s"}. The AI should continue comparing location, timing, revenue, refunds, and reviews before fully automating it.`,
      confidence: topProblem[1] >= 6 ? "medium" : "low",
    });
  }

  if (reusable.length > 0) {
    beliefs.push({
      title: `${reusable.length} playbook${reusable.length === 1 ? "" : "s"} may be reusable now.`,
      body: "These moves have enough measured support to influence future recommendations more strongly.",
      confidence: "medium",
    });
  } else {
    beliefs.push({
      title: "The AI is still cautious about automatic reuse.",
      body: "Outcome evidence is developing. The safest path is operator-reviewed execution until stronger wins appear.",
      confidence: "low",
    });
  }

  if (measured.length > 0) {
    beliefs.push({
      title: "Outcome measurement is active.",
      body: `The AI has started measuring whether decisions actually improved the restaurant across ${measured.length} completed action${measured.length === 1 ? "" : "s"}.`,
      confidence: "medium",
    });
  }

  return beliefs.slice(0, 4);
}

function buildUnknowns(memory: OperatorMemoryItem[], actions: AutoActionItem[]) {
  const avgOutcome = getAverageOutcome(memory);
  const reusable = memory.filter((item) => item.reuse_recommended).length;
  const executed = actions.filter((item) => item.status === "executed").length;

  const unknowns = [];

  if (avgOutcome === null || avgOutcome < 65) {
    unknowns.push({
      title: "Which playbooks consistently improve outcomes?",
      body: "The AI needs more before/after evidence before it can separate real wins from noise.",
      need: "Need stronger outcome scores",
    });
  }

  if (reusable === 0) {
    unknowns.push({
      title: "What can be safely automated?",
      body: "No playbooks are strong enough for full automation yet. Keep using approve-and-execute mode.",
      need: "Need reusable lessons",
    });
  }

  if (executed < 20) {
    unknowns.push({
      title: "How does this restaurant behave over time?",
      body: "The Brain is still building its long-term operating memory from executed actions and measured results.",
      need: `${Math.max(0, 20 - executed)} more executions recommended`,
    });
  }

  unknowns.push({
    title: "Which external factors matter most?",
    body: "Weather, holidays, nearby events, labor pressure, and seasonality are not fully connected yet.",
    need: "World Model coming next",
  });

  return unknowns.slice(0, 4);
}

function StatCard({ label, value, helper }: BrainStat) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
      <div className="mt-2 text-xs leading-5 text-neutral-400">{helper}</div>
    </div>
  );
}

export default function BrainPage() {
  const [autoActions, setAutoActions] = useState<AutoActionItem[]>([]);
  const [operatorMemory, setOperatorMemory] = useState<OperatorMemoryItem[]>([]);
  const [planningData, setPlanningData] = useState<PlanningPayload | null>(null);
  const [causalData, setCausalData] = useState<CausalPayload | null>(null);
  const [predictionData, setPredictionData] = useState<PredictionPayload | null>(null);
  const [worldData, setWorldData] = useState<WorldModelPayload | null>(null);
  const [executionData, setExecutionData] = useState<ExecutionPayload | null>(null);
  const [kernelData, setKernelData] =
  useState<AIKernelResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [
    evidenceReviewOpen,
    setEvidenceReviewOpen,
  ] = useState(false);

  useEffect(() => {
    async function loadBrain() {
      try {
        setLoading(true);
        setError(null);
        const pageUrl =
  new URL(
    window.location.href,
  );

/*
 * Resolve the real Auto Action behind the Brain workflow.
 *
 * Preferred source:
 * 1. Explicit actionId already present in the URL.
 *
 * Automatic fallback:
 * 2. The current pending Cognitive OS recommendation.
 *
 * This allows a restaurant owner to open Brain directly from
 * navigation without losing the source action identity required
 * for Outcome Learning.
 */
const urlSourceActionId =
  pageUrl.searchParams
    .get("actionId")
    ?.trim() || null;

/*
 * Load current actions FIRST.
 *
 * We need them before running the AI Kernel so Brain can attach
 * the correct sourceActionId to the generated workflow.
 */
const actionsRes =
  await fetch(
    "/api/auto-actions",
    {
      cache: "no-store",
    },
  );

if (!actionsRes.ok) {
  throw new Error(
    "Failed to load auto actions.",
  );
}

const actionsJson =
  (await actionsRes.json()) as {
    items?: AutoActionItem[];
  };

const loadedActions =
  Array.isArray(
    actionsJson.items,
  )
    ? actionsJson.items
    : [];

/*
 * Our generation/supersede system keeps only the current
 * Cognitive recommendation pending.
 *
 * Find that recommendation when Brain was opened normally
 * without an explicit actionId.
 */
const currentCognitiveAction =
  !urlSourceActionId
    ? loadedActions.find(
        (action) => {
          if (
            action.status !==
            "pending"
          ) {
            return false;
          }

          const payload =
            action.recommended_payload;

          if (
            !isRecord(
              payload,
            )
          ) {
            return false;
          }

          const provenance =
            payload
              .cognitiveProvenance;

          if (
            !isRecord(
              provenance,
            )
          ) {
            return false;
          }

          return (
            provenance.generatedFrom ===
            "cognitive_os"
          );
        },
      ) ?? null
    : null;

const sourceActionId =
  urlSourceActionId ??
  currentCognitiveAction?.id ??
  null;

/*
 * Once Brain resolves the source automatically, preserve it
 * in the URL.
 *
 * This keeps workflow identity stable across normal refreshes.
 */
if (
  !urlSourceActionId &&
  sourceActionId
) {
  pageUrl.searchParams.set(
    "actionId",
    sourceActionId,
  );

  window.history.replaceState(
    window.history.state,
    "",
    pageUrl.toString(),
  );
}

const kernelParams =
  new URLSearchParams();

if (sourceActionId) {
  kernelParams.set(
    "actionId",
    sourceActionId,
  );
}

if (
  pageUrl.searchParams.get(
    "forceProvenanceFailure",
  ) === "true"
) {
  kernelParams.set(
    "forceProvenanceFailure",
    "true",
  );
}

const kernelQuery =
  kernelParams.toString();

const kernelUrl =
  kernelQuery
    ? `/api/ai-kernel/run?${kernelQuery}`
    : "/api/ai-kernel/run";

const [
  memoryRes,
  planningRes,
  causalRes,
  predictionRes,
  worldRes,
  executionRes,
  kernelRes,
] = await Promise.all([
  fetch(
    "/api/operator-memory",
    {
      cache: "no-store",
    },
  ),

  fetch(
    "/api/planning-engine/run",
    {
      cache: "no-store",
    },
  ),

  fetch(
    "/api/causal-engine/run",
    {
      cache: "no-store",
    },
  ),

  fetch(
    "/api/prediction-engine/run",
    {
      cache: "no-store",
    },
  ),

  fetch(
    "/api/world-model/run",
    {
      cache: "no-store",
    },
  ),

  fetch(
    "/api/execution-engine/run",
    {
      cache: "no-store",
    },
  ),

  fetch(
    kernelUrl,
    {
      cache: "no-store",
    },
  ),
]);

if (!memoryRes.ok) {
  throw new Error(
    "Failed to load operator memory.",
  );
}
        const memoryJson = (await memoryRes.json()) as { items?: OperatorMemoryItem[] };
        const planningJson = planningRes.ok
          ? ((await planningRes.json()) as PlanningPayload)
          : null;
        const causalJson = causalRes.ok
          ? ((await causalRes.json()) as CausalPayload)
          : null;
        const predictionJson = predictionRes.ok
          ? ((await predictionRes.json()) as PredictionPayload)
          : null;
        const worldJson = worldRes.ok
          ? ((await worldRes.json()) as WorldModelPayload)
          : null;
        const executionJson = executionRes.ok
          ? ((await executionRes.json()) as ExecutionPayload)
          : null;
        const kernelJson = kernelRes.ok
          ? await kernelRes.json()
          : null;
          setAutoActions(
            loadedActions,
          );
        setOperatorMemory(Array.isArray(memoryJson.items) ? memoryJson.items : []);
        setPlanningData(planningJson);
        setCausalData(causalJson);
        setPredictionData(predictionJson);
        setWorldData(worldJson);
        setExecutionData(executionJson);
        setKernelData(kernelJson);
        console.log("AI Kernel", kernelJson);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load Restaurant Brain.");
      } finally {
        setLoading(false);
      }
    }

    void loadBrain();
  }, []);

  const brain = useMemo(() => {
    const activeMemory = operatorMemory.filter((item) => item.status !== "archived");
    const measuredMemory = activeMemory.filter((item) => asNumber(item.outcome_score) !== null);
    const reusableMemory = activeMemory.filter((item) => item.reuse_recommended);
    const strongMemory = activeMemory.filter((item) => item.lesson_strength === "strong");
    const executedActions = autoActions.filter((item) => item.status === "executed");
    const memoryUsedActions = autoActions.filter((item) => getLessonsFound(item) > 0);
    const locations = new Set(
      [...activeMemory.map((item) => item.location_name), ...autoActions.map((item) => item.location_name)]
        .filter((value): value is string => !!value)
    );

    const avgOutcome = getAverageOutcome(activeMemory);
    const avgConfidence = activeMemory.length
      ? activeMemory.reduce((sum, item) => {
          if (item.confidence === "high") return sum + 90;
          if (item.confidence === "medium") return sum + 70;
          if (item.confidence === "low") return sum + 45;
          return sum + 50;
        }, 0) / activeMemory.length
      : 0;

    const successRate = measuredMemory.length
      ? (measuredMemory.filter((item) => item.success === true).length / measuredMemory.length) * 100
      : null;

    const learningCoverage = executedActions.length
      ? Math.min(100, (measuredMemory.length / executedActions.length) * 100)
      : 0;

    const iq = Math.round(
      Math.min(
        100,
        42 +
          Math.min(activeMemory.length, 30) * 0.9 +
          Math.min(measuredMemory.length, 25) * 1.1 +
          Math.min(memoryUsedActions.length, 20) * 0.8 +
          Math.min(reusableMemory.length, 12) * 1.6 +
          (avgOutcome !== null ? Math.max(0, avgOutcome - 50) * 0.25 : 0)
      )
    );

    const topPlaybook = getTopCount(activeMemory.map((item) => item.action_type));
    const topLocation = getTopCount(activeMemory.map((item) => item.location_name));
    const lastLearned = [...activeMemory].sort(
      (a, b) =>
        new Date(b.updated_at ?? b.created_at ?? 0).getTime() -
        new Date(a.updated_at ?? a.created_at ?? 0).getTime()
    )[0] ?? null;

    const stats: BrainStat[] = [
      {
        label: "AI IQ",
        value: `${iq}/100`,
        helper: "Composite score based on memory, measured outcomes, and reusable playbooks.",
      },
      {
        label: "Business Understanding",
        value: formatPercent(Math.min(96, 45 + activeMemory.length * 3 + measuredMemory.length * 2)),
        helper: "How much the AI understands from executed actions and operating memory.",
      },
      {
        label: "Outcome Confidence",
        value: formatPercent(avgConfidence),
        helper: "Average confidence across active operator memories.",
      },
      {
        label: "Learning Coverage",
        value: formatPercent(learningCoverage),
        helper: "Executed actions that have been measured by the Outcome Engine.",
      },
      {
        label: "Operator Memory",
        value: String(activeMemory.length),
        helper: "Active observations stored in long-term restaurant memory.",
      },
      {
        label: "Validated Playbooks",
        value: String(strongMemory.length),
        helper: "Playbooks with strong measured evidence.",
      },
      {
        label: "Reusable Lessons",
        value: String(reusableMemory.length),
        helper: "Lessons currently safe enough to influence future recommendations.",
      },
      {
        label: "Success Rate",
        value: successRate === null ? "Collecting" : formatPercent(successRate),
        helper: "Measured actions that produced a successful outcome.",
      },
    ];

    const planning = planningData?.planning ?? null;
    const topPlannedMove = planning?.topMove ?? null;
    const plannedMoves = Array.isArray(planning?.moves) ? planning.moves : [];
    const causalAnalysis = causalData?.causalAnalysis ?? null;
    const topHypothesis = causalAnalysis?.topHypothesis ?? null;
    const hypotheses = Array.isArray(causalAnalysis?.hypotheses)
      ? causalAnalysis.hypotheses
      : [];
    const prediction = predictionData?.prediction ?? null;
    const topPrediction = prediction?.topPrediction ?? null;
    const predictions = Array.isArray(prediction?.predictions)
      ? prediction.predictions
      : [];
    const worldModel = worldData?.worldModel ?? null;
    const topWorldSignal = worldModel?.topSignal?.signal ?? null;
    const worldLocationModels = Array.isArray(worldModel?.locationModels)
      ? worldModel.locationModels
      : [];
    const allWorldSignals = worldLocationModels.flatMap((model) =>
      Array.isArray(model.signals) ? model.signals : []
    );
    const executionPlan = executionData?.executionPlan ?? null;
    const topExecutionTask = executionPlan?.topTask ?? null;
    const executionQueue = Array.isArray(executionPlan?.queue) ? executionPlan.queue : [];
    const executiveAI = executionData?.executiveAI ?? null;

    return {
      activeMemory,
      measuredMemory,
      reusableMemory,
      executedActions,
      memoryUsedActions,
      locationsLearned: locations.size || 1,
      avgOutcome,
      iq,
      topPlaybook,
      topLocation,
      lastLearned,
      stats,
      beliefs: buildBeliefs(activeMemory),
      unknowns: buildUnknowns(activeMemory, autoActions),
      planning,
      topPlannedMove,
      plannedMoves,
      planningMode: planningData?.mode ?? null,
      causalAnalysis,
      topHypothesis,
      hypotheses,
      causalMode: causalData?.mode ?? null,
      prediction,
      topPrediction,
      predictions,
      predictionMode: predictionData?.mode ?? null,
      worldModel,
      topWorldSignal,
      worldLocationModels,
      allWorldSignals,
      worldMode: worldData?.mode ?? null,
      executionPlan,
      topExecutionTask,
      executionQueue,
      executiveAI,
      executionMode: executionData?.mode ?? null,
    };
  }, [autoActions, operatorMemory, planningData, causalData, predictionData, worldData, executionData]);

  const recentlyLearned = useMemo(() => {
    return [...brain.activeMemory]
      .sort(
        (a, b) =>
          new Date(b.updated_at ?? b.created_at ?? 0).getTime() -
          new Date(a.updated_at ?? a.created_at ?? 0).getTime()
      )
      .slice(0, 5);
  }, [brain.activeMemory]);
  const kernel =
  kernelData?.kernel ??
  null;

const cognition =
  kernel?.cognition ??
  null;

const kernelLearning =
  kernel?.learning ??
  null;

const kernelPipeline =
  kernel?.pipeline ??
  null;

const operatorIntelligence =
  kernel?.operatorIntelligence ??
  null;

const operatorWorkflow =
  kernel?.operatorWorkflow ??
  null;

const executiveAI =
  kernel?.executiveAI ??
  null;

const executionPlan =
  kernel?.executionPlan ??
  null;
  const currentPersistedCognitiveAction =
  autoActions.find((action) => {
    if (
      action.status !==
      "pending"
    ) {
      return false;
    }

    const payload =
      action.recommended_payload;

    if (!isRecord(payload)) {
      return false;
    }

    const provenance =
      payload.cognitiveProvenance;

    return (
      isRecord(provenance) &&
      provenance.generatedFrom ===
        "cognitive_os"
    );
  }) ?? null;

const persistedDecisionTransition:
  DecisionTransitionData | null =
  (() => {
    const payload =
      currentPersistedCognitiveAction
        ?.recommended_payload;

    if (
  !isRecord(payload) ||
  !isRecord(
    payload.decisionTransition,
  )
) {
  return null;
}

const transition =
  payload.decisionTransition;

if (
  typeof transition.type !==
    "string" ||
  typeof transition.changedMind !==
    "boolean"
) {
  return null;
}

return transition as unknown as
  DecisionTransitionData;
  })();
  const liveSelectedStrategy =
  cognition &&
  isRecord(cognition.selectedStrategy) &&
  isRecord(
    cognition.selectedStrategy.strategy,
  )
    ? cognition.selectedStrategy.strategy
    : null;

const liveFutureComparison =
  cognition &&
  isRecord(cognition.futureComparison)
    ? cognition.futureComparison
    : null;

const liveBestFuture =
  liveFutureComparison &&
  isRecord(liveFutureComparison.best)
    ? liveFutureComparison.best
    : null;

const liveRecommendationStrategyId =
  typeof liveSelectedStrategy?.id ===
  "string"
    ? liveSelectedStrategy.id
    : typeof liveBestFuture?.strategyId ===
        "string"
      ? liveBestFuture.strategyId
      : null;

const synchronizedDecisionTransition =
  synchronizeDecisionTransition(
    persistedDecisionTransition,
    liveRecommendationStrategyId,
  );


  const recommendedAction =
  buildRecommendedAction(
    executionPlan,
    operatorIntelligence,
    executiveAI,
    cognition,
  );
  const evidenceGapContext =
  useMemo<EvidenceGapContext | null>(
    () => {
      if (!cognition) {
        return null;
      }

      const objective =
        isRecord(cognition.objective)
          ? cognition.objective
          : null;

      const hypotheses:
  Record<string, unknown> | null =
  isRecord(cognition.hypotheses)
    ? (
        cognition.hypotheses as unknown as Record<
          string,
          unknown
        >
      )
    : null;

const primaryHypothesis:
  Record<string, unknown> | null =
  hypotheses &&
  isRecord(
    hypotheses.primaryHypothesis,
  )
    ? hypotheses.primaryHypothesis
    : null;

      const beliefs =
        isRecord(cognition.beliefs)
          ? cognition.beliefs
          : null;

      const primaryBelief =
        beliefs &&
        isRecord(beliefs.primaryBelief)
          ? beliefs.primaryBelief
          : null;

      const internalDialogue =
        isRecord(
          cognition.internalDialogue,
        )
          ? cognition.internalDialogue
          : null;

      const decisionEvaluation =
        isRecord(
          cognition.decisionEvaluation,
        )
          ? cognition.decisionEvaluation
          : null;

      const selectedStrategy =
        isRecord(
          cognition.selectedStrategy,
        )
          ? cognition.selectedStrategy
          : null;

      const strategy =
        selectedStrategy &&
        isRecord(
          selectedStrategy.strategy,
        )
          ? selectedStrategy.strategy
          : null;

      const futureComparison =
        isRecord(
          cognition.futureComparison,
        )
          ? cognition.futureComparison
          : null;

      const bestFuture =
        futureComparison &&
        isRecord(
          futureComparison.best,
        )
          ? futureComparison.best
          : null;

      const confidenceState =
        isRecord(cognition.confidence)
          ? cognition.confidence
          : null;

      const questions = (
        internalDialogue &&
        Array.isArray(
          internalDialogue.questions,
        )
          ? internalDialogue.questions.filter(
              isRecord,
            )
          : []
      ).sort(
        (left, right) =>
          (asNumber(right.importance) ??
            0) -
          (asNumber(left.importance) ??
            0),
      );

      const decisionUnknowns =
        asStringArray(
          decisionEvaluation?.unknowns,
        );

      const hypothesisUnknowns =
        asStringArray(
          hypotheses?.unknowns,
        );

      const futureUnknowns =
        asStringArray(
          bestFuture?.unknowns,
        );

      

        const operatorIntelligenceRecord:
  Record<string, unknown> | null =
  isRecord(operatorIntelligence)
    ? (
        operatorIntelligence as unknown as Record<
          string,
          unknown
        >
      )
    : null;

const rawDecisionEvidence =
  operatorIntelligenceRecord
    ?.evidence;

const decisionEvidence:
  Record<string, unknown>[] =
  Array.isArray(
    rawDecisionEvidence,
  )
    ? rawDecisionEvidence.filter(
        (
          item: unknown,
        ): item is Record<
          string,
          unknown
        > => isRecord(item),
      )
    : [];
      
      const evidenceStatementById =
        new Map<string, string>();
      
      for (const item of decisionEvidence) {
        const evidenceId =
          asString(item.id);
      
        const statement =
          asString(item.statement);
      
        if (
          evidenceId &&
          statement
        ) {
          evidenceStatementById.set(
            evidenceId,
            statement,
          );
        }
      }
      
      const resolvedHypothesisEvidence =
        asStringArray(
          primaryHypothesis
            ?.supportingEvidence,
        )
          .map(
            (evidenceId) =>
              evidenceStatementById.get(
                evidenceId,
              ) ?? null,
          )
          .filter(
            (
              statement,
            ): statement is string =>
              statement !== null,
          );
      
      const fallbackDecisionEvidence =
        decisionEvidence
          .map((item) =>
            asString(item.statement),
          )
          .filter(
            (
              statement,
            ): statement is string =>
              statement !== null,
          );
          type OperatorEvidenceItem =
  NonNullable<
    EvidenceGapContext[
      "operatorEvidence"
    ]
  >[number];

const rawCognitiveEvidence =
  hypotheses?.evidence;

const cognitiveEvidence:
  Record<string, unknown>[] =
  Array.isArray(
    rawCognitiveEvidence,
  )
    ? rawCognitiveEvidence.filter(
        (
          item: unknown,
        ): item is Record<
          string,
          unknown
        > => isRecord(item),
      )
    : [];

const operatorEvidence:
  OperatorEvidenceItem[] =
  cognitiveEvidence.reduce<
    OperatorEvidenceItem[]
  >(
    (
      items:
        OperatorEvidenceItem[],
      item:
        Record<string, unknown>,
    ) => {
      const source =
        asString(item.source);

      const kind =
        asString(item.kind);

      const statement =
        asString(item.value) ??
        asString(item.statement) ??
        asString(item.title);

      if (
        source?.toLowerCase() !==
          "operator_memory" ||
        kind?.toLowerCase() !==
          "observation" ||
        !statement
      ) {
        return items;
      }

      items.push({
        id:
          asString(item.id),

        question:
          asString(item.question) ??
          asString(item.title),

        statement,

        source,

        confidence:
          asNumber(item.confidence),

        observedAt:
          asString(
            item.observedAt,
          ) ??
          asString(
            item.observed_at,
          ),

        locationName:
          asString(
            item.locationName,
          ) ??
          asString(
            item.location_name,
          ),
      });

      return items;
    },
    [],
  );
      
      const currentEvidence =
  uniqueStrings([
    ...operatorEvidence.map(
      (item) =>
        item.statement,
    ),

    ...(
      resolvedHypothesisEvidence
        .length > 0
        ? resolvedHypothesisEvidence
        : fallbackDecisionEvidence
    ),

    ...(
      brain.topHypothesis
        ?.evidence ?? []
    ),

    ...(
      brain.topWorldSignal
        ?.evidence ?? []
    ),
  ]);

      const resolvedUnknowns =
  uniqueStrings([
    ...asStringArray(
      hypotheses
        ?.resolvedUnknowns,
    ),

    ...asStringArray(
      primaryHypothesis
        ?.resolvedUnknowns,
    ),
  ]);

const partiallyResolvedUnknowns =
  uniqueStrings([
    ...asStringArray(
      hypotheses
        ?.partiallyResolvedUnknowns,
    ),

    ...asStringArray(
      primaryHypothesis
        ?.partiallyResolvedUnknowns,
    ),
  ]);

const normalizeUnknownKey = (
  value: string,
) =>
  value
    .toLowerCase()
    .replace(
      /[^a-z0-9\s]/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();

const resolvedUnknownKeys =
  new Set(
    resolvedUnknowns.map(
      normalizeUnknownKey,
    ),
  );

const unknowns =
  uniqueStrings([
    ...decisionUnknowns,
    ...hypothesisUnknowns,
    ...futureUnknowns,
  ]).filter(
    (unknown) =>
      !resolvedUnknownKeys.has(
        normalizeUnknownKey(
          unknown,
        ),
      ),
  );

const dialogueQuestions =
  questions
    .map((question) =>
      asString(
        question.question,
      ),
    )
    .filter(
      (
        question,
      ): question is string =>
        question !== null,
    );

const unresolvedQuestion =
  unknowns[0] ??
  dialogueQuestions.find(
    (question) =>
      !resolvedUnknownKeys.has(
        normalizeUnknownKey(
          question,
        ),
      ),
  ) ??
  "What evidence would most change the current decision?";

      const blockingReasons =
        uniqueStrings(
          asStringArray(
            decisionEvaluation
              ?.blockingReasons,
          ),
        );

      const warnings =
        uniqueStrings([
          ...asStringArray(
            futureComparison?.warnings,
          ),

          ...asStringArray(
            futureComparison?.tradeoffs,
          ),
        ]);

      const evidenceCoverage =
        asNumber(
          confidenceState
            ?.evidenceCoverage,
        ) ??
        asNumber(
          primaryBelief
            ?.evidenceCoverage,
        ) ??
        null;

      return {
        objective:
          asString(objective?.title) ??
          asString(objective?.reason),

        decisionMode:
          asString(
            strategy?.decisionMode,
          ) ??
          asString(
            decisionEvaluation
              ?.decisionMode,
          ),

        unresolvedQuestion,

        primaryHypothesis:
          asString(
            primaryHypothesis?.title,
          ),

        hypothesisDescription:
          asString(
            primaryHypothesis
              ?.description,
          ),

        currentEvidence,

operatorEvidence,

unknowns,

resolvedUnknowns,

partiallyResolvedUnknowns,

blockingReasons,

        warnings,

        evidenceCoverage,

        locationName:
          operatorWorkflow
            ?.locationName ??
          operatorIntelligence
            ?.locationFocus ??
          kernel?.locationName ??
          null,
      };
    },
    [
      cognition,
      brain.topHypothesis,
      brain.topWorldSignal,
      operatorWorkflow,
      operatorIntelligence,
      kernel?.locationName,
    ],
  );

const isEvidenceReviewAction =
  evidenceGapContext
    ?.decisionMode
    ?.toLowerCase() ===
    "investigate" ||
  recommendedAction.actionLabel
    .trim()
    .toLowerCase() ===
    "review evidence";
    function handleApproveRecommendedAction() {
      console.log(
        "[Brain Approval] click received",
      );
    
      setKernelData((current) => {
        const currentWorkflow =
          current?.kernel?.operatorWorkflow;
    
        console.log(
          "[Brain Approval] current workflow",
          currentWorkflow,
        );
    
        if (
          !current ||
          !current.kernel ||
          !currentWorkflow
        ) {
          console.warn(
            "[Brain Approval] workflow unavailable",
          );
    
          return current;
        }
    
        const approvedWorkflow =
          approveWorkflow(currentWorkflow);
    
        console.log(
          "[Brain Approval] approved workflow",
          approvedWorkflow,
        );
    
        console.log(
          "[Brain Approval] transition",
          {
            beforeWorkflowStatus:
              currentWorkflow.status,
    
            afterWorkflowStatus:
              approvedWorkflow.status,
    
            beforeCurrentStep:
              currentWorkflow.steps?.find(
                (step) =>
                  step.id ===
                  currentWorkflow.currentStepId,
              )?.status,
    
            afterCurrentStep:
              approvedWorkflow.steps?.find(
                (step) =>
                  step.id ===
                  approvedWorkflow.currentStepId,
              )?.status,
    
            currentStepId:
              approvedWorkflow.currentStepId,
          },
        );
    
        return {
          ...current,
    
          kernel: {
            ...current.kernel,
    
            operatorWorkflow:
              approvedWorkflow,
          },
        };
      });
    }
function handleStartRecommendedAction() {
  
  setKernelData((current) => {
    const currentWorkflow =
      current?.kernel?.operatorWorkflow;

    if (
      !current ||
      !current.kernel ||
      !currentWorkflow
    ) {
      return current;
    }

    const startedWorkflow =
      startWorkflow(currentWorkflow);

    return {
      ...current,

      kernel: {
        ...current.kernel,

        operatorWorkflow:
          startedWorkflow,
      },
    };
  });
}
async function handleApproveWorkflowStep(
  stepId: string,
) {
  const currentWorkflow =
    kernelData?.kernel?.operatorWorkflow;

  if (!currentWorkflow) {
    return;
  }

  const currentStep =
    currentWorkflow.steps.find(
      (step) =>
        step.id ===
        currentWorkflow.currentStepId,
    ) ?? null;

  /*
   * Only the current pending approval step
   * may be approved.
   */
  if (
    !currentStep ||
    currentStep.id !== stepId ||
    currentStep.status !==
      "pending_approval"
  ) {
    return;
  }

  const requiresExecutionAuthorization =
    currentStep.metadata
      ?.approvalBehavior ===
    "execution_authorization";

  /*
   * An execution-authorization approval is a
   * real human authorization boundary.
   *
   * Persist that approval on the source Auto
   * Action BEFORE allowing the workflow step
   * to begin.
   */
  if (requiresExecutionAuthorization) {
    const sourceActionId =
      typeof currentWorkflow.metadata
        ?.sourceActionId === "string"
        ? currentWorkflow.metadata
            .sourceActionId
            .trim()
        : "";

    /*
     * Fail closed when the workflow cannot be
     * tied to the real Auto Action.
     */
    if (!sourceActionId) {
      console.warn(
        "[Brain Approval] execution authorization blocked because sourceActionId is missing",
      );

      return;
    }

    try {
      const approvalResponse =
        await fetch(
          "/api/auto-actions",
          {
            method: "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              id: sourceActionId,
              status: "approved",
            }),
          },
        );

      const approvalPayload =
        (await approvalResponse
          .json()
          .catch(() => null)) as
          | {
              item?: AutoActionItem;
              error?: string;
            }
          | null;

      if (
        !approvalResponse.ok ||
        !approvalPayload?.item
      ) {
        throw new Error(
          approvalPayload?.error ||
            "Failed to persist execution approval.",
        );
      }

      const approvedAction =
        approvalPayload.item;

      /*
       * Keep Brain's local action state in sync
       * with the server-authoritative approval.
       */
      setAutoActions((current) =>
        current.map((action) =>
          action.id === sourceActionId
            ? {
                ...action,
                ...approvedAction,
              }
            : action,
        ),
      );
    } catch (error) {
      console.error(
        "[Brain Approval] failed to persist execution authorization",
        error,
      );

      return;
    }
  }

  /*
   * Re-check the live workflow after the async
   * server approval before changing local state.
   */
  setKernelData((current) => {
    const liveWorkflow =
      current?.kernel?.operatorWorkflow;

    if (
      !current ||
      !current.kernel ||
      !liveWorkflow
    ) {
      return current;
    }

    const liveStep =
      liveWorkflow.steps.find(
        (step) =>
          step.id ===
          liveWorkflow.currentStepId,
      ) ?? null;

    if (
      !liveStep ||
      liveStep.id !== stepId ||
      liveStep.status !==
        "pending_approval"
    ) {
      return current;
    }

    const approvedWorkflow =
      approveWorkflow(liveWorkflow);

    const startedWorkflow =
      startWorkflow(approvedWorkflow);

    return {
      ...current,

      kernel: {
        ...current.kernel,

        operatorWorkflow:
          startedWorkflow,
      },
    };
  });
}
function handleStartWorkflowStep(
  stepId: string,
) {
  setKernelData((current) => {
    const currentWorkflow =
      current?.kernel?.operatorWorkflow;

    if (
      !current ||
      !current.kernel ||
      !currentWorkflow
    ) {
      return current;
    }

    const currentStep =
      currentWorkflow.steps.find(
        (step) =>
          step.id ===
          currentWorkflow.currentStepId,
      ) ?? null;

    if (
      !currentStep ||
      currentStep.id !== stepId ||
      currentStep.status !== "ready"
    ) {
      return current;
    }

    const startedWorkflow =
      startWorkflow(currentWorkflow);

    return {
      ...current,

      kernel: {
        ...current.kernel,

        operatorWorkflow:
          startedWorkflow,
      },
    };
  });
}
async function handleCompleteWorkflowStep(
  stepId: string,
) {
  const currentWorkflow =
    kernelData?.kernel?.operatorWorkflow;

  if (
    !kernelData ||
    !kernelData.kernel ||
    !currentWorkflow
  ) {
    return;
  }

  const result =
    completeWorkflowStep(
      currentWorkflow,
      stepId,
    );
    console.log("WORKFLOW COMPLETION DIAGNOSTIC", {
  workflowCompleted: result.workflowCompleted,
  workflowStatus: result.workflow.status,
  currentStepId: result.workflow.currentStepId,
  sourceActionId:
    result.workflow.metadata?.sourceActionId ??
    null,
  steps: result.workflow.steps.map((step) => ({
    title: step.title,
    status: step.status,
  })),
});

  /*
   * First update the visible workflow.
   *
   * This keeps the normal workflow movement exactly
   * as it works today.
   */
  setKernelData((current) => {
    if (
      !current ||
      !current.kernel
    ) {
      return current;
    }

    return {
      ...current,

      kernel: {
        ...current.kernel,

        operatorWorkflow:
          result.workflow,
      },
    };
  });

  /*
   * Learning should only happen after the
   * ENTIRE workflow is complete.
   */
  if (!result.workflowCompleted) {
    return;
  }

  /*
   * Find the real action that originally caused
   * this workflow to exist.
   *
   * We intentionally refuse to learn when this
   * identifier is missing. Learning from the wrong
   * action would teach the Brain the wrong lesson.
   */
  const sourceActionId =
    typeof result.workflow.metadata
      ?.sourceActionId === "string"
      ? result.workflow.metadata
          .sourceActionId
          .trim()
      : "";

  if (!sourceActionId) {
    console.info(
      "Workflow completed, but no source action is available for outcome learning.",
    );

    return;
  }

  try {
    /*
     * The completed Brain workflow represents the
     * execution of the original Auto Action.
     *
     * Reuse the existing Auto Actions execution path
     * instead of manually changing database state.
     *
     * This preserves:
     * - execution side effects
     * - execution outcome recording
     * - execution memory
     * - normal Auto Action lifecycle rules
     */
    const sourceAction =
      autoActions.find(
        (action) =>
          action.id === sourceActionId,
      ) ?? null;

      if (!sourceAction) {
  console.info(
    "Workflow completed, but the source Auto Action could not be resolved.",
  );

  return;
}

if (
  sourceAction.status ===
  "pending"
) {
  console.info(
    "Workflow completed, but source Auto Action still requires human approval before execution.",
  );

  return;
}

if (
  sourceAction.status ===
  "dismissed"
) {
  console.info(
    "Workflow completed, but the source Auto Action was dismissed and will not execute.",
  );

  return;
}
  
    /*
     * Only execute the source action when it has not
     * already been executed.
     *
     * This also makes the completion path safer if
     * the UI ever retries the final workflow step.
     */
    if (
  sourceAction?.status ===
  "approved"
) {
      const executionResponse =
        await fetch(
          "/api/auto-actions",
          {
            method: "PATCH",
  
            headers: {
              "Content-Type":
                "application/json",
            },
  
            body: JSON.stringify({
              id: sourceActionId,
              status: "executed",
            }),
          },
        );
  
      const executionPayload =
        (await executionResponse
          .json()
          .catch(() => null)) as
          | {
              ok?: boolean;
              error?: string;
              item?: AutoActionItem;
              executionResult?: unknown;
              outcomeWrite?: unknown;
              memoryWrite?: unknown;
            }
          | null;
  
      if (
        !executionResponse.ok ||
        executionPayload?.ok !== true
      ) {
        throw new Error(
          executionPayload?.error ??
            `Source Auto Action execution failed with status ${executionResponse.status}.`,
        );
      }
  
      /*
       * Keep the Brain page's local Auto Action state
       * synchronized with the execution we just saved.
       */
      if (executionPayload.item) {
        setAutoActions((current) =>
          current.map((action) =>
            action.id ===
            sourceActionId
              ? {
                  ...action,
                  ...executionPayload.item,
                }
              : action,
          ),
        );
      }
  
      console.log(
        "WORKFLOW SOURCE ACTION EXECUTED",
        {
          sourceActionId,
          executionResult:
            executionPayload
              .executionResult ??
            null,
          outcomeWrite:
            executionPayload
              .outcomeWrite ??
            null,
          memoryWrite:
            executionPayload
              .memoryWrite ??
            null,
        },
      );
    }
  
    /*
     * Now that the source Auto Action is genuinely
     * executed, send that exact action through the
     * existing Outcome Learning system.
     *
     * The learning route will:
     * - measure the result
     * - update Operator Memory
     * - trigger a fresh Cognitive decision refresh
     */
    const response =
      await fetch(
        "/api/operator-memory/learn",
        {
          method: "POST",
  
          headers: {
            "Content-Type":
              "application/json",
          },
  
          body: JSON.stringify({
            actionId:
              sourceActionId,
          }),
        },
      );
  
    const learning =
      (await response
        .json()
        .catch(() => null)) as
        | {
            ok?: boolean;
            learned?: number;
            decisionRefresh?: {
              attempted?: boolean;
              ok?: boolean;
              reason?: string;
              saved?: number;
              error?: string | null;
            };
            error?: string;
          }
        | null;
  
    if (!response.ok) {
      throw new Error(
        learning?.error ??
          `Outcome learning failed with status ${response.status}.`,
      );
    }
  
    /*
     * Do not claim that the workflow learned
     * unless the learning system really produced
     * at least one learned result.
     */
    if (
      !learning?.ok ||
      !learning.learned ||
      learning.learned < 1
    ) {
      console.info(
        "Workflow completed, but no new lesson was stored.",
      );
  
      return;
    }
  
    console.log(
      "WORKFLOW LEARNING COMPLETE",
      {
        sourceActionId,
  
        learned:
          learning.learned,
  
        decisionRefresh:
          learning.decisionRefresh ??
          null,
      },
    );
  
    const learnedWorkflow =
      markWorkflowLearned(
        result.workflow,
      );
  
    /*
     * Update the Brain page only if this is still
     * the same workflow.
     */
    setKernelData((current) => {
      const displayedWorkflow =
        current?.kernel
          ?.operatorWorkflow;
  
      if (
        !current ||
        !current.kernel ||
        !displayedWorkflow ||
        displayedWorkflow.id !==
          learnedWorkflow.id
      ) {
        return current;
      }
  
      return {
        ...current,
  
        kernel: {
          ...current.kernel,
  
          operatorWorkflow:
            learnedWorkflow,
        },
      };
    });
  } catch (error) {
    console.error(
      "Workflow execution / outcome learning failed:",
      error,
    );
  }
}
const workflowStatus =
  operatorWorkflow?.status ?? null;

const isWorkflowApproved =
  workflowStatus === "approved";

const isWorkflowRunning =
  workflowStatus === "running";

const isWorkflowCompleted =
  workflowStatus === "completed";

const workflowProgress =
  operatorWorkflow?.steps?.length
    ? Math.round(
        (
          operatorWorkflow.steps.filter(
            (step) =>
              step.status === "completed",
          ).length /
          operatorWorkflow.steps.length
        ) * 100,
      )
    : recommendedAction.progress;
const connectedRecommendedAction:
  RecommendedActionData = {
  ...recommendedAction,
  decisionTransition:
  synchronizedDecisionTransition,
  progress:
  operatorWorkflow?.steps?.length
    ? Math.round(
        (
          operatorWorkflow.steps.filter(
            (step) =>
              step.status === "completed" ||
              step.status === "skipped" ||
              step.status === "cancelled",
          ).length /
          operatorWorkflow.steps.length
        ) * 100,
      )
    : recommendedAction.progress,

  

  actionLabel:
    isWorkflowCompleted
      ? "Completed"
      : isWorkflowRunning
        ? "Test Running"
        : isWorkflowApproved
          ? "Start Test"
          : recommendedAction.actionLabel,

  actionControlsId:
    isEvidenceReviewAction
      ? "evidence-review-panel"
      : recommendedAction
          .actionControlsId,

  actionDisabled:
    isWorkflowCompleted ||
    isWorkflowRunning ||
    (
      isEvidenceReviewAction
        ? !evidenceGapContext
        : recommendedAction
            .actionDisabled
    ),

  onApprove:
    isEvidenceReviewAction
      ? () => {
          setEvidenceReviewOpen(
            true,
          );
        }
      : isWorkflowApproved
        ? handleStartRecommendedAction
        : handleApproveRecommendedAction,
};

async function handleEvidenceSubmit(
  submission: EvidenceSubmission,
) {
  const response = await fetch(
    "/api/brain/evidence",
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify({
        ...submission,

        context: {
          workflowId:
            operatorWorkflow?.id ??
            null,

          decisionMode:
            evidenceGapContext
              ?.decisionMode ??
            null,

          primaryHypothesis:
            evidenceGapContext
              ?.primaryHypothesis ??
            null,

          recommendation:
            recommendedAction.title,

          previousKernelGeneratedAt:
            kernel?.generatedAt ??
            kernelData?.generatedAt ??
            null,
        },
      }),
    },
  );

  const payload = (
    await response
      .json()
      .catch(() => null)
  ) as
    | (
        AIKernelResponse & {
          error?: string;
          message?: string;
        }
      )
    | null;

  if (
    !response.ok ||
    !payload?.ok ||
    !payload.kernel
  ) {
    throw new Error(
      payload?.error ??
        payload?.message ??
        "TurnTableAI could not save the evidence or re-run the Brain.",
    );
  }

  setKernelData(payload);
  setEvidenceReviewOpen(false);
}
const whyThisIsHappening =
buildWhyThisIsHappening(
  brain.causalAnalysis?.summary,
  brain.topHypothesis,
  cognition,
);
  if (loading) {
    return <div className="p-8 text-white">Loading Restaurant Brain...</div>;
  }

  return (
    <div className="min-h-screen bg-black px-4 py-8 text-white md:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="overflow-hidden rounded-[2rem] border border-violet-500/20 bg-gradient-to-br from-violet-500/15 via-cyan-500/8 to-neutral-950 p-6 shadow-2xl md:p-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-violet-200">
                <span className="h-2 w-2 rounded-full bg-emerald-300" />
                Restaurant Brain
              </div>

              <div className="mt-5">
  <div className="text-xs uppercase tracking-[0.18em] text-cyan-300">
    Executive Briefing
  </div>

  <h1 className="mt-3 text-5xl font-bold tracking-tight text-white md:text-6xl">
    {operatorIntelligence?.headline ??
      "Restaurant operating normally."}
  </h1>

  <p className="mt-4 max-w-4xl text-xl leading-8 text-neutral-300">
    {operatorIntelligence?.situation ??
      "The AI is continuously monitoring operations across your restaurants."}
  </p>
</div>
{operatorIntelligence && (
  <div className="mt-6 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-5">
    <div className="text-xs uppercase tracking-[0.18em] text-cyan-300">
      Operator Intelligence
    </div>

    <div className="mt-3 text-lg font-semibold text-white">
      {operatorIntelligence.situation}
    </div>

    <div className="mt-3 text-neutral-300">
      {operatorIntelligence.rootCause}
    </div>

    <div className="mt-4 grid gap-3 md:grid-cols-2">
      <div className="rounded-xl bg-black/30 p-4">
        <div className="text-xs uppercase text-neutral-500">
          Next Expected Outcome
        </div>

        <div className="mt-2 text-white">
          {operatorIntelligence.likelyFuture}
        </div>
      </div>

      <div className="rounded-xl bg-black/30 p-4">
        <div className="text-xs uppercase text-neutral-500">
          First Recommended Move
        </div>

        <div className="mt-2 text-white">
          {operatorIntelligence.firstMove}
        </div>
      </div>
    </div>
  </div>
)}
              {error ? (
                <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {error}
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:w-[520px]">
              <div className="rounded-3xl border border-white/10 bg-black/35 p-5">
                <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">
                  AI IQ
                </div>
                <div className="mt-2 text-5xl font-semibold text-white">
                  {brain.iq}
                </div>
                <div className="mt-2 text-xs text-neutral-400">/100 and improving</div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/35 p-5">
                <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">
                  Locations Learning
                </div>
                <div className="mt-2 text-5xl font-semibold text-cyan-200">
                  {brain.locationsLearned}
                </div>
                <div className="mt-2 text-xs text-neutral-400">
                  Single or multi-location ready
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/35 p-5">
                <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">
                  Avg Outcome
                </div>
                <div className="mt-2 text-5xl font-semibold text-emerald-200">
                  {brain.avgOutcome === null ? "—" : Math.round(brain.avgOutcome)}
                </div>
                <div className="mt-2 text-xs text-neutral-400">Measured result score</div>
              </div>
            </div>
          </div>
                </section>

        <BrainDiagnosticConsole
          cognition={cognition}
          pipeline={kernelPipeline}
          learning={kernelLearning}
          mode={kernel?.mode ?? null}
          locationsAnalyzed={
            kernel?.locationsAnalyzed ??
            0
          }
        />

<RecommendedAction
  data={
    connectedRecommendedAction
  }
  />
<OperatorWorkflow
  workflow={operatorWorkflow}
  executionPlan={executionPlan}
  executiveAI={executiveAI}
  onApproveStep={
    handleApproveWorkflowStep
  }
  onStartStep={
  handleStartWorkflowStep
}
  onCompleteStep={
    handleCompleteWorkflowStep
  }
/>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {brain.stats.map((stat) => (
            <StatCard key={stat.label} {...stat} />
          ))}
        </section>

       

        <section className="rounded-3xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 via-neutral-950 to-black p-5 shadow-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-cyan-200">
              Operator Strategy
              </div>

              <h2 className="mt-4 text-2xl font-semibold text-white">
                What Should Happen Next
              </h2>

              <p className="mt-2 text-sm leading-6 text-neutral-400">
  {operatorWorkflow?.description ??
    recommendedAction.summary ??
    brain.planning?.summary ??
    "The AI is evaluating the next best business move."}
</p>

{operatorWorkflow ? (
  <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
    <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">
      Cognitive operating move
    </div>

    <div className="mt-2 text-xl font-semibold text-white">
      {operatorWorkflow.title ??
        recommendedAction.title ??
        "No operating move selected"}
    </div>

    <p className="mt-2 text-sm leading-6 text-neutral-300">
      {operatorWorkflow.description ??
        recommendedAction.summary ??
        "The Brain is still evaluating the safest next move."}
    </p>

    <div className="mt-4 grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">
          Expected result
        </div>

        <div className="mt-1 text-sm text-neutral-200">
          {operatorWorkflow.expectedOutcome ??
            recommendedAction.summary ??
            "—"}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">
          Planning window
        </div>

        <div className="mt-1 text-sm text-neutral-200">
          {brain.topPlannedMove?.executionWindow ?? "—"}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">
          Success metric
        </div>

        <div className="mt-1 text-sm text-neutral-200">
          {operatorWorkflow.successMetric ?? "—"}
        </div>
      </div>
    </div>
  </div>
) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:w-[440px]">
              <StatCard
                label="Planning Mode"
                value={brain.planningMode === "network" ? "Network" : brain.planningMode === "single_location" ? "Single Store" : "Collecting"}
                helper="The planner works for one restaurant or a multi-location group."
              />
              <StatCard
                label="Planning Horizon"
                value={titleCase(brain.planning?.horizon)}
                helper="The time window used to rank the next best move."
              />
              <StatCard
                label="Priority Score"
                value={brain.topPlannedMove?.priorityScore !== null && brain.topPlannedMove?.priorityScore !== undefined ? `${brain.topPlannedMove.priorityScore}/100` : "—"}
                helper="How strongly the AI prioritizes the top move."
              />
              <StatCard
                label="ROI Score"
                value={brain.topPlannedMove?.roiScore !== null && brain.topPlannedMove?.roiScore !== undefined ? `${brain.topPlannedMove.roiScore}/100` : "—"}
                helper="Expected business leverage from the selected move."
              />
              <StatCard
                label="Confidence"
                value={
                  brain.topPlannedMove?.confidence !== null && brain.topPlannedMove?.confidence !== undefined
                    ? formatPercent(brain.topPlannedMove.confidence * 100)
                    : "—"
                }
                helper="How confident the AI is based on state, memory, and outcomes."
              />
              <StatCard
                label="Moves Ranked"
                value={String(brain.plannedMoves.length)}
                helper="Candidate operator moves scored by the Planning Engine."
              />
            </div>
          </div>

          {operatorWorkflow?.steps?.length ? (
  <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4">
    <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">
      Cognitive execution checklist
    </div>

    <div className="mt-3 grid gap-2 md:grid-cols-2">
      {operatorWorkflow.steps.map(
        (step, index) => (
          <div
            key={
              step.id ??
              `workflow-step-${index}`
            }
            className="flex gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-neutral-300"
          >
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-cyan-300" />

            <div>
              <div className="font-medium text-neutral-200">
                {step.title ??
                  `Workflow step ${index + 1}`}
              </div>

              {step.description ? (
                <div className="mt-1 text-xs leading-5 text-neutral-500">
                  {step.description}
                </div>
              ) : null}
            </div>
          </div>
        ),
      )}
    </div>
  </div>
) : null}
        </section>

        <WhyThisIsHappening
  data={whyThisIsHappening}
/>

        
        <section className="rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-neutral-950 to-black p-5 shadow-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-emerald-200">
                Future Forecast
              </div>

              <h2 className="mt-4 text-2xl font-semibold text-white">
                What the AI thinks may happen next
              </h2>

              <p className="mt-2 text-sm leading-6 text-neutral-400">
                {brain.prediction?.summary ??
                  "The Brain is waiting for the Prediction Engine to forecast future restaurant risk."}
              </p>

              {brain.topPrediction ? (
                <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">
                    Top forecasted risk
                  </div>
                  <div className="mt-2 text-xl font-semibold text-white">
                    {brain.topPrediction.prediction ?? "No future risk forecast yet"}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-neutral-300">
                    {brain.topPrediction.estimatedBusinessImpact ??
                      "The AI needs more live operating data before estimating business impact."}
                  </p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">
                        Risk level
                      </div>
                      <div className="mt-1 text-sm font-semibold text-emerald-100">
                        {titleCase(brain.topPrediction.riskLevel)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">
                        Confidence
                      </div>
                      <div className="mt-1 text-sm font-semibold text-cyan-200">
                        {brain.topPrediction.confidence !== null &&
                        brain.topPrediction.confidence !== undefined
                          ? `${brain.topPrediction.confidence}%`
                          : "—"}
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">
                        Horizon
                      </div>
                      <div className="mt-1 text-sm font-semibold text-white">
                        {titleCase(brain.topPrediction.horizon)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">
                      Expected movement
                    </div>
                    <div className="mt-1 text-sm text-neutral-200">
                      {brain.topPrediction.expectedChange ?? "—"}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:w-[440px]">
              <StatCard
                label="Prediction Mode"
                value={brain.predictionMode === "network" ? "Network" : brain.predictionMode === "single_location" ? "Single Store" : "Collecting"}
                helper="The forecast works for one restaurant or a full restaurant group."
              />
              <StatCard
                label="Forecast Horizon"
                value={titleCase(brain.prediction?.horizon)}
                helper="The forward-looking window used by the Prediction Engine."
              />
              <StatCard
                label="Predictions"
                value={String(brain.predictions.length)}
                helper="Future risks ranked across the restaurant or network."
              />
              <StatCard
                label="Top Risk"
                value={titleCase(brain.topPrediction?.riskLevel)}
                helper="The highest current forecasted risk level."
              />
            </div>
          </div>

          {brain.topPrediction ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Leading indicators</div>
                <div className="mt-3 space-y-2">
                  {(brain.topPrediction.leadingIndicators ?? []).slice(0, 5).map((item) => (
                    <div key={item} className="flex gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-neutral-300">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-300" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">If ignored</div>
                <div className="mt-3 space-y-2">
                  {(brain.topPrediction.ifIgnored ?? []).slice(0, 5).map((item) => (
                    <div key={item} className="flex gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-neutral-300">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-300" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Best intervention</div>
                <div className="mt-3 space-y-2">
                  {(brain.topPrediction.bestIntervention ?? []).slice(0, 5).map((item) => (
                    <div key={item} className="flex gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-neutral-300">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-cyan-300" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </section>


        <section className="rounded-3xl border border-sky-500/20 bg-gradient-to-br from-sky-500/10 via-neutral-950 to-black p-5 shadow-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-sky-200">
                World Model
              </div>

              <h2 className="mt-4 text-2xl font-semibold text-white">
                What the outside world may be doing to the restaurant
              </h2>

              <p className="mt-2 text-sm leading-6 text-neutral-400">
                {brain.worldModel?.summary ??
                  "The Brain is waiting for the World Model to add calendar, seasonality, and external context."}
              </p>

              {brain.topWorldSignal ? (
                <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">
                    Strongest world signal
                  </div>
                  <div className="mt-2 text-xl font-semibold text-white">
                    {brain.topWorldSignal.label ?? "No dominant external signal yet"}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-neutral-300">
                    {brain.topWorldSignal.summary ??
                      "The AI needs more external context before explaining the outside pressure."}
                  </p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">
                        Signal type
                      </div>
                      <div className="mt-1 text-sm font-semibold text-white">
                        {titleCase(brain.topWorldSignal.type)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">
                        Risk level
                      </div>
                      <div className="mt-1 text-sm font-semibold text-sky-100">
                        {titleCase(brain.topWorldSignal.riskLevel)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">
                        Confidence
                      </div>
                      <div className="mt-1 text-sm font-semibold text-cyan-200">
                        {brain.topWorldSignal.confidence !== null &&
                        brain.topWorldSignal.confidence !== undefined
                          ? `${brain.topWorldSignal.confidence}%`
                          : "—"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">
                      Operator implication
                    </div>
                    <div className="mt-1 text-sm text-neutral-200">
                      {brain.topWorldSignal.operatorImplication ?? "—"}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:w-[440px]">
              <StatCard
                label="World Mode"
                value={brain.worldMode === "network" ? "Network" : brain.worldMode === "single_location" ? "Single Store" : "Collecting"}
                helper="External context works for one restaurant or a full restaurant group."
              />
              <StatCard
                label="Locations Modeled"
                value={String(brain.worldModel?.locationsModeled ?? brain.worldLocationModels.length)}
                helper="Restaurants currently receiving world-context assumptions."
              />
              <StatCard
                label="World Signals"
                value={String(brain.allWorldSignals.length)}
                helper="Calendar, seasonality, demand, staffing, and delivery pressure signals."
              />
              <StatCard
                label="Top External Risk"
                value={titleCase(brain.topWorldSignal?.riskLevel)}
                helper="The strongest outside-context pressure detected right now."
              />
            </div>
          </div>

          {brain.topWorldSignal ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Evidence</div>
                <div className="mt-3 space-y-2">
                  {(brain.topWorldSignal.evidence ?? []).slice(0, 5).map((item) => (
                    <div key={item} className="flex gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-neutral-300">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-300" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Recommended adjustment</div>
                <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm leading-6 text-neutral-300">
                  {brain.topWorldSignal.recommendedAdjustment ?? "No adjustment recommended yet."}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Assumptions</div>
                <div className="mt-3 space-y-2">
                  {(brain.worldLocationModels[0]?.assumptions ?? []).slice(0, 3).map((item) => (
                    <div key={item} className="flex gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-neutral-300">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-300" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="rounded-3xl border border-white/10 bg-neutral-950/70 p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-emerald-200">
                  Current Beliefs
                </div>
                <h2 className="mt-4 text-2xl font-semibold text-white">
                  What the AI currently believes about the restaurant
                </h2>
              </div>
              <Link href="/command-center" className="text-sm text-cyan-300 hover:text-cyan-200">
                Open Command Center →
              </Link>
            </div>

            <div className="mt-5 grid gap-3">
              {brain.beliefs.map((belief) => (
                <div key={belief.title} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-white">{belief.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-neutral-300">{belief.body}</p>
                    </div>
                    <div className={cx("shrink-0 rounded-full border px-3 py-1 text-xs uppercase tracking-wide", confidenceStyle(belief.confidence))}>
                      {belief.confidence} confidence
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-neutral-950/70 p-5 shadow-xl">
            <div className="inline-flex rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-amber-200">
              Things I'm Learning
            </div>
            <h2 className="mt-4 text-2xl font-semibold text-white">Unknowns</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-400">
              A strong operator knows what it does not know yet. These are the areas where the Brain wants more evidence.
            </p>

            <div className="mt-5 space-y-3">
              {brain.unknowns.map((unknown) => (
                <div key={unknown.title} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <div className="text-sm font-semibold text-white">{unknown.title}</div>
                  <div className="mt-2 text-sm leading-6 text-neutral-400">{unknown.body}</div>
                  <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                    {unknown.need}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-3xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 via-neutral-950 to-black p-5 shadow-xl">
            <div className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-cyan-200">
              Restaurant DNA
            </div>
            <h2 className="mt-4 text-2xl font-semibold text-white">
              How the AI describes this restaurant
            </h2>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <StatCard
                label="Operating Mode"
                value={brain.locationsLearned > 1 ? "Group" : "Single Store"}
                helper="The Brain adapts for one-location restaurants and multi-location operators."
              />
              <StatCard
                label="Top Playbook"
                value={brain.topPlaybook ? titleCase(brain.topPlaybook[0]) : "Collecting"}
                helper="The operating move showing up most often in memory."
              />
              <StatCard
                label="Top Location"
                value={brain.topLocation ? brain.topLocation[0] : "Primary"}
                helper="Location with the most learned observations."
              />
              <StatCard
                label="Risk Appetite"
                value={brain.reusableMemory.length > 0 ? "Measured" : "Conservative"}
                helper="Automation stays cautious until evidence improves."
              />
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-neutral-950/70 p-5 shadow-xl">
            <div className="inline-flex rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-violet-200">
              Recently Learned
            </div>
            <h2 className="mt-4 text-2xl font-semibold text-white">
              The newest observations added to the Brain
            </h2>

            <div className="mt-5 space-y-3">
              {recentlyLearned.length > 0 ? (
                recentlyLearned.map((memory) => (
                  <div key={memory.id} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">
                          {formatWhen(memory.updated_at ?? memory.created_at)} · {memory.location_name || "Global"}
                        </div>
                        <div className="mt-2 text-base font-semibold text-white">
                          {memory.action_title || titleCase(memory.action_type)}
                        </div>
                        <div className="mt-2 text-sm leading-6 text-neutral-300">
                          {compactText(memory.lesson, 260)}
                        </div>
                      </div>

                      <div className="grid shrink-0 grid-cols-2 gap-2 text-xs md:w-48">
                        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                          <div className="uppercase tracking-wide text-neutral-500">Outcome</div>
                          <div className="mt-1 text-sm font-semibold text-cyan-200">
                            {formatScore(asNumber(memory.outcome_score))}
                          </div>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                          <div className="uppercase tracking-wide text-neutral-500">Strength</div>
                          <div className="mt-1 text-sm font-semibold text-white">
                            {titleCase(memory.lesson_strength)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-neutral-400">
                  No memories yet. Execute actions from Command Center and run the Outcome Engine to begin teaching the Brain.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-neutral-950 to-black p-5 shadow-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-emerald-200">
                Learning Timeline
              </div>
              <h2 className="mt-4 text-2xl font-semibold text-white">
                How the Brain is evolving
              </h2>
              <p className="mt-2 text-sm leading-6 text-neutral-400">
                This is the foundation for the future Prediction Engine, World Model, and Autonomous Planner.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:w-[520px]">
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Now</div>
                <div className="mt-2 text-base font-semibold text-white">Memory + Outcomes</div>
                <p className="mt-2 text-sm leading-6 text-neutral-400">The AI remembers actions and measures whether they worked.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Next</div>
                <div className="mt-2 text-base font-semibold text-white">Causal Intelligence</div>
                <p className="mt-2 text-sm leading-6 text-neutral-400">The AI starts learning why actions worked, not just whether they worked.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Soon</div>
                <div className="mt-2 text-base font-semibold text-white">World Model</div>
                <p className="mt-2 text-sm leading-6 text-neutral-400">Weather, holidays, events, and local demand become part of decisions.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Future</div>
                <div className="mt-2 text-base font-semibold text-white">Autonomous Planner</div>
                <p className="mt-2 text-sm leading-6 text-neutral-400">The AI recommends the highest-leverage move before problems appear.</p>
              </div>
            </div>
          </div>
          </section>
      </div>

      <EvidenceReviewPanel
        id="evidence-review-panel"
        open={
          evidenceReviewOpen
        }
        context={
          evidenceGapContext
        }
        onClose={() => {
          setEvidenceReviewOpen(
            false,
          );
        }}
        onSubmit={
          handleEvidenceSubmit
        }
      />
    </div>
  );
}