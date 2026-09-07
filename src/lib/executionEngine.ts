export type ExecutionMode = "automatic" | "approval_required" | "monitor";

export interface ExecutionTask {
  id: string;
  title: string;
  description: string;
  priority: number;
  mode: ExecutionMode;
  estimatedImpact: number;
  confidence: number;
}

export interface ExecutionResult {
  summary: string;
  mode: ExecutionMode;
  topTask: ExecutionTask;
  queue: ExecutionTask[];
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
  const recommendation =
    input.executiveAI?.recommendation ?? "Review restaurant operations.";

  const confidence = input.executiveAI?.confidence ?? 60;
  const risk = String(input.executiveAI?.riskLevel ?? "medium").toLowerCase();

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
  };

  return {
    summary: `Execution Engine selected "${recommendation}" as the next operator action.`,
    mode,
    topTask,
    queue: [topTask],
    generatedAt: new Date().toISOString(),
  };
}