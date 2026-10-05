import type { PerformanceProvenance } from "@/lib/restaurantState";

type PerformanceProvenancePair = {
  latest: PerformanceProvenance | null;
  previous: PerformanceProvenance | null;
};

export type ExecutionMode = "automatic" | "approval_required" | "monitor";

export interface ExecutionTask {
  id: string;
  title: string;
  description: string;
  priority: number;
  mode: ExecutionMode;
  estimatedImpact: number;
  confidence: number;
  performanceProvenance: PerformanceProvenancePair | null;
}

export interface ExecutionResult {
  summary: string;
  mode: ExecutionMode;
  topTask: ExecutionTask;
  queue: ExecutionTask[];
  performanceProvenance: PerformanceProvenancePair | null;
  generatedAt: string;
}

interface BuildExecutionInput {
  executiveAI: any;
}

function determineMode(confidence: number, priority: number): ExecutionMode {
  if (confidence >= 90 && priority >= 95) return "automatic";
  if (confidence >= 70) return "approval_required";
  return "monitor";
}

export function buildExecutionPlan(input: BuildExecutionInput): ExecutionResult {
  if (
    input.executiveAI?.decisionStatus ===
    "insufficient_data"
  ) {
    const topTask: ExecutionTask = {
      id: "collect-trusted-data",
      title:
        "Collect more trusted restaurant data",
      description:
        "Operational execution is paused until TurnTableAI has enough trusted evidence for a reliable recommendation.",
      priority: 0,
      mode: "monitor",
      estimatedImpact: 0,
      confidence: 0,
      performanceProvenance: null,
    };

    return {
      summary:
        "Execution is paused because the current trusted restaurant data is insufficient.",
      mode: "monitor",
      topTask,
      queue: [topTask],
      performanceProvenance: null,
      generatedAt:
        new Date().toISOString(),
    };
  }

  const recommendation =
    input.executiveAI?.recommendation ?? "Review restaurant operations.";

  const confidence = input.executiveAI?.confidence ?? 60;
  const risk = String(input.executiveAI?.riskLevel ?? "medium").toLowerCase();
  const performanceProvenance =
    input.executiveAI?.performanceProvenance ?? null;

  const priority =
    risk === "critical" ? 98 : risk === "high" ? 90 : risk === "medium" ? 75 : 55;

  const mode = determineMode(confidence, priority);

  const topTask: ExecutionTask = {
    id: "primary-action",
    title: recommendation,
    description: "Highest priority action selected by Executive AI.",
    priority,
    mode,
    estimatedImpact: confidence,
    confidence,
    performanceProvenance,
  };

  return {
    summary: `Execution Engine selected "${recommendation}" as the next operator action.`,
    mode,
    topTask,
    queue: [topTask],
    performanceProvenance,
    generatedAt: new Date().toISOString(),
  };
}
