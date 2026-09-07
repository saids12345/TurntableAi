"use client";
import type {
  ExecutiveAI,
  ExecutionPlan,
  OperatorWorkflow,
  WorkflowStep,
} from "./types";
  
type OperatorWorkflowProps = {
  workflow: OperatorWorkflow | null;
  executionPlan?: ExecutionPlan | null;
  executiveAI?: ExecutiveAI | null;

  onApproveStep?: (
    stepId: string,
  ) => void;

  onStartStep?: (
    stepId: string,
  ) => void;

  onCompleteStep?: (
    stepId: string,
  ) => void;
};

  type StepVisualState =
  | "completed"
  | "running"
  | "approved"
  | "pending_approval"
  | "waiting"
  | "blocked"
  | "pending";

function titleCase(value?: string | null) {
  if (!value) return "Not available";

  return value
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatPercent(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  const normalizedValue = value <= 1 ? value * 100 : value;

  return `${Math.round(normalizedValue)}%`;
}

function formatScore(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  return `${Math.round(value)}/100`;
}

function normalizeStepStatus(
  step: WorkflowStep,
  _currentStepId?: string | null,
): StepVisualState {
  const status = String(step.status ?? "")
    .toLowerCase()
    .replace(/[\s-]/g, "_");

  if (
    status === "complete" ||
    status === "completed" ||
    status === "executed" ||
    status === "done" ||
    status === "success" ||
    status === "skipped"
  ) {
    return "completed";
  }

  if (
    status === "running" ||
    status === "active" ||
    status === "in_progress" ||
    status === "processing"
  ) {
    return "running";
  }

  if (status === "approved") {
    return "approved";
  }

  if (
    status === "pending_approval" ||
    status === "approval_required" ||
    status === "awaiting_approval"
  ) {
    return "pending_approval";
  }

  if (
    status === "blocked" ||
    status === "failed" ||
    status === "error" ||
    status === "attention_required" ||
    status === "cancelled"
  ) {
    return "blocked";
  }

  if (
    status === "waiting" ||
    status === "scheduled" ||
    status === "queued" ||
    status === "ready"
  ) {
    return "waiting";
  }

  return "pending";
}

function getStepStyles(status: StepVisualState) {
  if (status === "completed") {
    return {
      container:
        "border-emerald-500/25 bg-emerald-500/[0.07]",
      indicator:
        "border-emerald-400/30 bg-emerald-400/15 text-emerald-200",
      badge:
        "border-emerald-400/20 bg-emerald-500/10 text-emerald-200",
      dot: "bg-emerald-300",
      label: "Complete",
    };
  }
  if (status === "approved") {
    return {
      container:
        "border-sky-400/25 bg-sky-500/[0.07]",
      indicator:
        "border-sky-400/30 bg-sky-400/15 text-sky-100",
      badge:
        "border-sky-400/20 bg-sky-500/10 text-sky-100",
      dot: "bg-sky-300",
      label: "Approved",
    };
  }
  
  if (status === "pending_approval") {
    return {
      container:
        "border-amber-500/25 bg-amber-500/[0.07]",
      indicator:
        "border-amber-400/30 bg-amber-400/15 text-amber-100",
      badge:
        "border-amber-400/20 bg-amber-500/10 text-amber-100",
      dot: "bg-amber-300",
      label: "Pending Approval",
    };
  }

  if (status === "running") {
    return {
      container:
        "border-cyan-400/35 bg-cyan-500/[0.09] shadow-[0_0_40px_rgba(34,211,238,0.08)]",
      indicator:
        "border-cyan-400/40 bg-cyan-400/15 text-cyan-100",
      badge:
        "border-cyan-400/25 bg-cyan-500/10 text-cyan-100",
      dot: "animate-pulse bg-cyan-300",
      label: "Running",
    };
  }

  if (status === "blocked") {
    return {
      container:
        "border-rose-500/30 bg-rose-500/[0.08]",
      indicator:
        "border-rose-400/30 bg-rose-400/15 text-rose-200",
      badge:
        "border-rose-400/20 bg-rose-500/10 text-rose-200",
      dot: "bg-rose-300",
      label: "Blocked",
    };
  }

  if (status === "waiting") {
    return {
      container:
        "border-amber-500/20 bg-amber-500/[0.05]",
      indicator:
        "border-amber-400/25 bg-amber-400/10 text-amber-200",
      badge:
        "border-amber-400/20 bg-amber-500/10 text-amber-200",
      dot: "bg-amber-300",
      label: "Waiting",
    };
  }

  return {
    container: "border-white/10 bg-white/[0.025]",
    indicator:
      "border-white/10 bg-white/5 text-neutral-400",
    badge:
      "border-white/10 bg-white/5 text-neutral-400",
    dot: "bg-neutral-600",
    label: "Pending",
  };
}

function getProgress(
  steps: WorkflowStep[],
  currentStepId?: string | null,
) {
  if (!steps.length) return 0;

  const completedSteps = steps.filter(
    (step) =>
      normalizeStepStatus(
        step,
        currentStepId,
      ) === "completed",
  ).length;

  const progress =
    (completedSteps / steps.length) * 100;

  return Math.round(
    Math.min(
      100,
      Math.max(0, progress),
    ),
  );
}

function getCurrentStep(
  steps: WorkflowStep[],
  currentStepId?: string | null
) {
  const matchingStep = steps.find(
    (step) => step.id && step.id === currentStepId
  );

  if (matchingStep) return matchingStep;

  return (
    steps.find(
      (step) =>
        normalizeStepStatus(step, currentStepId) === "running"
    ) ??
    steps.find(
      (step) =>
        normalizeStepStatus(step, currentStepId) !== "completed"
    ) ??
    null
  );
}

function EmptyWorkflow() {
  return (
    <section className="rounded-3xl border border-violet-500/20 bg-gradient-to-br from-violet-500/10 via-neutral-950 to-black p-5 shadow-xl md:p-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-violet-200">
            <span className="h-2 w-2 rounded-full bg-violet-300" />
            Operator Workflow
          </div>

          <h2 className="mt-4 text-2xl font-semibold text-white">
            Waiting for the next operator workflow
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">
            The AI Kernel is monitoring restaurant conditions. A
            workflow will appear here when TurnTableAI identifies a
            meaningful action that should be tracked, approved, or
            executed.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/30 px-5 py-4 lg:min-w-[240px]">
          <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">
            Workflow state
          </div>

          <div className="mt-2 text-lg font-semibold text-neutral-200">
            Monitoring
          </div>

          <div className="mt-2 text-xs leading-5 text-neutral-500">
            No active operator intervention is currently required.
          </div>
        </div>
      </div>
    </section>
  );
}

export default function OperatorWorkflow({
  workflow,
  executionPlan,
  executiveAI,
  onApproveStep,
  onStartStep,
  onCompleteStep,
}: OperatorWorkflowProps) {
  if (!workflow) {
    return <EmptyWorkflow />;
  }

  const steps = Array.isArray(workflow.steps)
    ? [...workflow.steps].sort(
        (firstStep, secondStep) =>
          (firstStep.order ?? 0) - (secondStep.order ?? 0)
      )
    : [];

  const progress = getProgress(
    steps,
    workflow.currentStepId
  );

  const currentStep = getCurrentStep(
    steps,
    workflow.currentStepId
  );
  const currentStepIndex = currentStep
  ? steps.findIndex(
      (step) => step.id === currentStep.id,
    )
  : -1;

  const completedCount = steps.filter(
    (step) =>
      normalizeStepStatus(
        step,
        workflow.currentStepId
      ) === "completed"
  ).length;

  const nextStep =
  steps.find((step, index) => {
    if (index <= currentStepIndex) {
      return false;
    }

    const status = normalizeStepStatus(
      step,
      workflow.currentStepId,
    );

    return status !== "completed";
  }) ?? null;

  const executionQueue = Array.isArray(executionPlan?.queue)
    ? executionPlan.queue
    : [];

  const activeRecommendation =
    executiveAI?.recommendation ??
    executiveAI?.executiveSummary ??
    executionPlan?.topTask?.description ??
    workflow.description ??
    "Continue following the active operator workflow.";

  return (
    <section className="overflow-hidden rounded-3xl border border-violet-500/25 bg-gradient-to-br from-violet-500/[0.12] via-neutral-950 to-black shadow-xl">
      <div className="border-b border-white/10 p-5 md:p-6">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-4xl">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-violet-200">
                <span className="h-2 w-2 animate-pulse rounded-full bg-violet-300" />
                Operator Workflow
              </div>

              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-300">
                {titleCase(workflow.status ?? "active")}
              </div>

              {workflow.locationName ? (
                <div className="rounded-full border border-cyan-400/15 bg-cyan-500/[0.07] px-3 py-1 text-xs text-cyan-200">
                  {workflow.locationName}
                </div>
              ) : null}
            </div>

            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white">
              {workflow.title ?? "Restaurant operator workflow"}
            </h2>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-300">
              {workflow.description ??
                "TurnTableAI has generated a structured workflow for the current restaurant situation."}
            </p>
          </div>

          <div className="grid min-w-0 gap-3 sm:grid-cols-3 xl:w-[520px]">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-[10px] uppercase tracking-[0.17em] text-neutral-500">
                Confidence
              </div>

              <div className="mt-2 text-2xl font-semibold text-cyan-200">
                {formatPercent(workflow.confidence)}
              </div>

              <div className="mt-1 text-xs text-neutral-500">
                Decision certainty
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-[10px] uppercase tracking-[0.17em] text-neutral-500">
                Impact
              </div>

              <div className="mt-2 text-2xl font-semibold text-emerald-200">
                {formatScore(workflow.estimatedImpact)}
              </div>

              <div className="mt-1 text-xs text-neutral-500">
                Estimated leverage
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
  <div className="text-[10px] uppercase tracking-[0.17em] text-neutral-500">
    Execution
  </div>

  <div className="mt-2 text-sm font-semibold text-amber-100">
    {titleCase(
      currentStep?.executionMode ??
        workflow.executionMode ??
        executionPlan?.mode
    )}
  </div>

  <div className="mt-1 text-xs text-neutral-500">
    Current step mode
  </div>
</div>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between gap-4 text-xs">
            <span className="font-medium text-neutral-300">
              Workflow progress
            </span>

            <span className="text-neutral-400">
              {completedCount} of {steps.length} steps complete
            </span>
          </div>

          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-400 to-cyan-300 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="mt-2 text-right text-xs font-medium text-cyan-200">
            {progress}% complete
          </div>
        </div>
      </div>

      <div className="grid gap-6 p-5 md:p-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">
                Active sequence
              </div>

              <h3 className="mt-1 text-lg font-semibold text-white">
                Operator steps
              </h3>
            </div>

            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-400">
              {steps.length} total
            </div>
          </div>

          {steps.length ? (
            <div className="mt-4 space-y-3">
              {steps.map((step, index) => {
                const visualStatus = normalizeStepStatus(
                  step,
                  workflow.currentStepId
                );

                const styles = getStepStyles(visualStatus);

                return (
                  <div key={step.id ?? `${step.title}-${index}`}>
                    <div
                      className={`rounded-2xl border p-4 transition ${styles.container}`}
                    >
                      <div className="flex gap-4">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${styles.indicator}`}
                        >
                          {visualStatus === "completed"
                            ? "✓"
                            : index + 1}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <div className="text-base font-semibold text-white">
                                {step.title ??
                                  `Workflow step ${index + 1}`}
                              </div>

                              {step.description ? (
                                <p className="mt-1 text-sm leading-6 text-neutral-400">
                                  {step.description}
                                </p>
                              ) : null}
                            </div>

                            <div
                              className={`inline-flex w-fit items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.13em] ${styles.badge}`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${styles.dot}`}
                              />
                              {styles.label}
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2 text-xs">
                            {step.executionMode ? (
                              <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-neutral-400">
                                {titleCase(step.executionMode)}
                              </span>
                            ) : null}

                            {step.successMetric ? (
                              <span className="rounded-full border border-emerald-400/15 bg-emerald-500/[0.06] px-2.5 py-1 text-emerald-200">
                                Measure: {step.successMetric}
                              </span>
                            ) : null}
                          </div>
                          {visualStatus === "pending_approval" &&
onApproveStep ? (
  <div className="mt-4">
    <button
      type="button"
      onClick={() => {
        if (!step.id) {
          return;
        }

        onApproveStep(step.id);
      }}
      className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-100 transition hover:bg-amber-500/15"
    >
      Approve & Start Step
    </button>
  </div>
) : null}
{visualStatus === "waiting" &&
onStartStep ? (
  <div className="mt-4">
    <button
      type="button"
      onClick={() => {
        if (!step.id) {
          return;
        }

        onStartStep(step.id);
      }}
      className="rounded-xl border border-cyan-400/25 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/15"
    >
      Start Step
    </button>
  </div>
) : null}
                          {visualStatus === "running" &&
onCompleteStep ? (
  <div className="mt-4">
    <button
      type="button"
      onClick={() => {
        if (!step.id) {
          return;
        }
      
        onCompleteStep(step.id);
      }}
      className="rounded-xl border border-cyan-400/25 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/15"
    >
      Mark Step Complete
    </button>
  </div>
) : null}
                        </div>
                      </div>
                    </div>

                    {index < steps.length - 1 ? (
                      <div className="ml-[34px] h-3 w-px bg-white/10" />
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center">
              <div className="text-sm font-medium text-neutral-300">
                Workflow steps are being prepared
              </div>

              <p className="mt-2 text-xs leading-5 text-neutral-500">
                The AI Kernel returned a workflow, but no individual
                execution steps are available yet.
              </p>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.06] p-4">
            <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-300">
              Current step
            </div>

            <div className="mt-2 text-lg font-semibold text-white">
              {currentStep?.title ?? "Monitoring workflow"}
            </div>

            <p className="mt-2 text-sm leading-6 text-neutral-300">
              {currentStep?.description ??
                activeRecommendation}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">
            Next workflow step
            </div>

            <div className="mt-2 text-sm font-semibold text-white">
              {nextStep?.title ?? "No additional step queued"}
            </div>

            {nextStep?.description ? (
              <p className="mt-2 text-xs leading-5 text-neutral-400">
                {nextStep.description}
              </p>
            ) : null}
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">
              Expected result
            </div>

            <p className="mt-2 text-sm leading-6 text-neutral-200">
              {workflow.expectedOutcome ??
                executiveAI?.recommendation ??
                "Measure the operational result after the workflow is completed."}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">
              Success metric
            </div>

            <p className="mt-2 text-sm leading-6 text-neutral-200">
              {workflow.successMetric ??
                executiveAI?.successMetric ??
                currentStep?.successMetric ??
                "Complete the workflow and compare the measured outcome against the restaurant baseline."}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">
                Queue
              </div>

              <div className="mt-2 text-2xl font-semibold text-white">
                {executionQueue.length}
              </div>

              <div className="mt-1 text-xs text-neutral-500">
                Actions selected
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">
                Priority
              </div>

              <div className="mt-2 text-sm font-semibold text-violet-200">
                {titleCase(workflow.priority)}
              </div>

              <div className="mt-2 text-xs text-neutral-500">
                Workflow urgency
              </div>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}