import type {
  ProductionDecisionProvenance,
} from "@/lib/brain/decisionProvenance";

export type BrainDiagnosticCognition = {
  metadata?: {
    status?: string;

    currentPhase?: string;

    completedAt?: string | null;
  };

  objective?: {
    id?: string;

    title?: string;

    reason?: string;

    confidence?: number;
  } | null;

  hypotheses?: {
    primaryHypothesis?: {
      id?: string;

      title?: string;

      description?: string;

      confidence?: number;

      category?: string;

      status?: string;

      supportingEvidence?: string[];
    } | null;

    evidenceCoverage?: number;

    unknowns?: string[];
  } | null;

  beliefs?: {
    primaryBelief?: {
      id?: string;

      statement?: string;

      confidence?: number;

      status?: string;

      category?: string;

      evidenceCoverage?: number;

      contradictionRatio?: number;

      unknowns?: string[];
    } | null;

    overallConfidence?: number;

    uncertainty?: number;
  } | null;

  internalDialogue?: {
    summary?: string;

    unresolvedCount?: number;

    questions?: Array<{
      id?: string;

      question?: string;

      kind?: string;

      importance?: number;
    }>;
  } | null;

  decisionEvaluation?: {
    missionAlignment?: number;

    principleAlignment?: number;

    objectiveAlignment?: number;

    beliefConfidence?: number;

    evidenceCoverage?: number;

    uncertainty?: number;

    contradictionRatio?: number;

    confidence?: number;

    readinessScore?: number;

    unresolvedQuestions?: number;

    decisionMode?: string;

    recommendation?: string;

    blockingReasons?: string[];

    unknowns?: string[];

    reasoning?: string[];
  } | null;

  selectedStrategy?: {
    rank?: number;

    score?: number;

    status?: string;

    strengths?: string[];

    concerns?: string[];

    reasoning?: string[];

    strategy?: {
      id?: string;

      title?: string;

      description?: string;

      priority?: number;

      decisionMode?: string;

      kind?: string;

      risk?: string;

      reversibility?: string;

      urgency?: string;

      confidence?: number;

      expectedOutcome?: string;

      successMetrics?: string[];
    };
  } | null;

  futureComparison?: {
    best?: {
      strategyId?: string;

      strategyTitle?: string;

      summary?: string;

      confidence?: number;

      expectedRevenueImpact?: number;

      expectedGuestExperienceImpact?: number;

      expectedOperationalImpact?: number;

      expectedRisk?: number;

      timeHorizon?: string;

      leadingIndicators?: string[];

      failureConditions?: string[];

      unknowns?: string[];
    };

    bestScore?: number;

    scoreGap?: number;

    decisionConfidence?: number;

    tradeoffs?: string[];

    warnings?: string[];

    reasoning?: string[];
  } | null;

  decisionProvenance?:
  | ProductionDecisionProvenance
  | null;

  confidence?: {
    decision?: number;

    readiness?: number;

    belief?: number;

    uncertainty?: number;

    futureSelection?: number;

    evidenceCoverage?: number;
  } | null;
};

export type BrainDiagnosticLearning = {
  status?: string;

  message?: string;
};

type BrainDiagnosticConsoleProps = {
  cognition:
    | BrainDiagnosticCognition
    | null
    | undefined;

  pipeline:
    | Record<string, boolean>
    | null
    | undefined;

  learning:
    | BrainDiagnosticLearning
    | null
    | undefined;

  mode?: string | null;

  locationsAnalyzed?: number | null;
};

type DiagnosticCardProps = {
  label: string;

  title: string;

  body?: string | null;

  badge?: string | null;

  footer?: string | null;

  accent?:
    | "violet"
    | "cyan"
    | "emerald"
    | "amber";
};

function clamp(
  value: number,
  minimum = 0,
  maximum = 100,
) {
  return Math.min(
    maximum,
    Math.max(
      minimum,
      value,
    ),
  );
}

function toPercentage(
  value:
    | number
    | null
    | undefined,
) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return null;
  }

  return clamp(
    value >= -1 &&
      value <= 1
      ? value * 100
      : value,
  );
}

function formatPercentage(
  value:
    | number
    | null
    | undefined,
) {
  const percentage =
    toPercentage(
      value,
    );

  return percentage === null
    ? "—"
    : `${Math.round(
        percentage,
      )}%`;
}

function formatScore(
  value:
    | number
    | null
    | undefined,
) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return "—";
  }

  return `${Math.round(
    value,
  )}/100`;
}

function titleCase(
  value:
    | string
    | null
    | undefined,
) {
  if (!value) {
    return "—";
  }

  return value
    .replace(
      /_/g,
      " ",
    )
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase(),
    );
}

function formatImpact(
  value:
    | number
    | null
    | undefined,
) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return "—";
  }

  const percentage =
    value >= -1 &&
    value <= 1
      ? value * 100
      : value;

  const rounded =
    Math.round(
      percentage,
    );

  return `${
    rounded > 0
      ? "+"
      : ""
  }${rounded}`;
}

function accentClasses(
  accent:
    DiagnosticCardProps["accent"],
) {
  switch (accent) {
    case "cyan":
      return {
        border:
          "border-cyan-500/20",

        label:
          "text-cyan-300",

        badge:
          "border-cyan-400/20 bg-cyan-500/10 text-cyan-200",
      };

    case "emerald":
      return {
        border:
          "border-emerald-500/20",

        label:
          "text-emerald-300",

        badge:
          "border-emerald-400/20 bg-emerald-500/10 text-emerald-200",
      };

    case "amber":
      return {
        border:
          "border-amber-500/20",

        label:
          "text-amber-300",

        badge:
          "border-amber-400/20 bg-amber-500/10 text-amber-200",
      };

    default:
      return {
        border:
          "border-violet-500/20",

        label:
          "text-violet-300",

        badge:
          "border-violet-400/20 bg-violet-500/10 text-violet-200",
      };
  }
}

function DiagnosticCard({
  label,
  title,
  body,
  badge,
  footer,
  accent = "violet",
}: DiagnosticCardProps) {
  const classes =
    accentClasses(
      accent,
    );

  return (
    <div
      className={`rounded-2xl border ${classes.border} bg-black/30 p-4`}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={`text-[11px] font-medium uppercase tracking-[0.18em] ${classes.label}`}
        >
          {label}
        </div>

        {badge ? (
          <div
            className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide ${classes.badge}`}
          >
            {badge}
          </div>
        ) : null}
      </div>

      <h3 className="mt-3 text-lg font-semibold leading-7 text-white">
        {title}
      </h3>

      {body ? (
        <p className="mt-2 text-sm leading-6 text-neutral-300">
          {body}
        </p>
      ) : null}

      {footer ? (
        <div className="mt-4 border-t border-white/10 pt-3 text-xs leading-5 text-neutral-500">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

function Metric({
  label,
  value,
  helper,
}: {
  label: string;

  value: string;

  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="text-[10px] uppercase tracking-[0.17em] text-neutral-500">
        {label}
      </div>

      <div className="mt-2 text-2xl font-semibold text-white">
        {value}
      </div>

      <div className="mt-2 text-xs leading-5 text-neutral-500">
        {helper}
      </div>
    </div>
  );
}

function PipelineBadge({
  label,
  ready,
}: {
  label: string;

  ready: boolean;
}) {
  return (
    <div
      className={
        ready
          ? "inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-200"
          : "inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-neutral-500"
      }
    >
      <span
        className={
          ready
            ? "h-2 w-2 rounded-full bg-emerald-300"
            : "h-2 w-2 rounded-full bg-neutral-600"
        }
      />

      {label}

      <span className="text-[10px] uppercase tracking-wide opacity-70">
        {ready
          ? "Ready"
          : "Waiting"}
      </span>
    </div>
  );
}

export default function BrainDiagnosticConsole({
  cognition,
  pipeline,
  learning,
  mode,
  locationsAnalyzed,
}: BrainDiagnosticConsoleProps) {
  const objective =
    cognition?.objective;

  const primaryHypothesis =
    cognition?.hypotheses
      ?.primaryHypothesis;

  const primaryBelief =
    cognition?.beliefs
      ?.primaryBelief;

  const decision =
    cognition
      ?.decisionEvaluation;

  const selected =
    cognition
      ?.selectedStrategy;

  const selectedStrategy =
    selected?.strategy;

  const comparison =
    cognition
      ?.futureComparison;

  const bestFuture =
    comparison?.best;

  const brainCompleted =
    pipeline
      ?.brainRunCompleted ===
      true ||
    cognition?.metadata
      ?.status ===
      "completed";

  const reasoningReady = [
    "cognitiveObjectiveLoaded",
    "cognitiveHypothesesLoaded",
    "cognitiveBeliefsLoaded",
    "cognitiveDialogueLoaded",
    "cognitiveStrategiesLoaded",
    "cognitiveFuturesLoaded",
    "cognitiveComparisonLoaded",
  ].every(
    (key) =>
      pipeline?.[key] ===
      true,
  );

  const actionReady =
    pipeline
      ?.operatorIntelligenceLoaded ===
      true &&
    pipeline
      ?.operatorWorkflowLoaded ===
      true;

  const stages = [
    {
      label:
        "Perception",

      ready:
        pipeline
          ?.restaurantStateLoaded ===
        true,
    },

    {
      label:
        "Knowledge",

      ready:
        pipeline
          ?.operatorMemoryLoaded ===
        true,
    },

    {
      label:
        "Reasoning",

      ready:
        reasoningReady,
    },

    {
      label:
        "Action",

      ready:
        actionReady,
    },

    {
      label:
        "Learning",

      ready:
        pipeline
          ?.outcomeLearningReady ===
        true,
    },
  ];

  const warning =
    comparison
      ?.warnings?.[0] ??
    decision
      ?.blockingReasons?.[0] ??
    comparison
      ?.tradeoffs?.[0] ??
    null;

  const learningStatus =
    titleCase(
      learning?.status ??
        (
          pipeline
            ?.outcomeLearningReady
            ? "ready"
            : "waiting"
        ),
    );

  if (!cognition) {
    return (
      <section className="rounded-3xl border border-amber-500/20 bg-amber-500/5 p-5">
        <div className="text-xs font-medium uppercase tracking-[0.18em] text-amber-300">
          Brain Diagnostic Console
        </div>

        <h2 className="mt-3 text-2xl font-semibold text-white">
          Cognitive output is not available yet
        </h2>

        <p className="mt-2 text-sm leading-6 text-neutral-400">
          The AI Kernel returned operator information, but its cognitive reasoning state was not included.
        </p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-[2rem] border border-violet-500/20 bg-gradient-to-br from-violet-500/10 via-neutral-950 to-black p-5 shadow-xl md:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-violet-200">
            <span
              className={
                brainCompleted
                  ? "h-2 w-2 rounded-full bg-emerald-300"
                  : "h-2 w-2 rounded-full bg-amber-300"
              }
            />

            Brain Diagnostic Console
          </div>

          <h2 className="mt-4 text-2xl font-semibold text-white md:text-3xl">
            How the Brain reached its decision
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-400">
            A compact view of the current objective, diagnosis, selected strategy, simulated future, confidence, and learning readiness.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-neutral-300">
            {titleCase(
              mode,
            )}
          </span>

          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-neutral-300">
            {locationsAnalyzed ??
              0}{" "}
            location
            {(locationsAnalyzed ??
              0) === 1
              ? ""
              : "s"}
          </span>

          <span
            className={
              brainCompleted
                ? "rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-emerald-200"
                : "rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-amber-200"
            }
          >
            {brainCompleted
              ? "Run completed"
              : "Run incomplete"}
          </span>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {stages.map(
          (stage) => (
            <PipelineBadge
              key={
                stage.label
              }
              label={
                stage.label
              }
              ready={
                stage.ready
              }
            />
          ),
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <DiagnosticCard
          label="Current Objective"
          title={
            objective?.title ??
            "No objective selected"
          }
          body={
            objective?.reason ??
            "The Brain has not established its current operating objective."
          }
          badge={formatPercentage(
            objective?.confidence,
          )}
          footer={
            objective?.id
              ? `Objective ID: ${objective.id}`
              : null
          }
          accent="violet"
        />

        <DiagnosticCard
          label="Strongest Hypothesis"
          title={
            primaryHypothesis
              ?.title ??
            "No primary hypothesis"
          }
          body={
            primaryHypothesis
              ?.description ??
            "The Brain has not formed a defensible primary explanation."
          }
          badge={formatPercentage(
            primaryHypothesis
              ?.confidence,
          )}
          footer={
            primaryHypothesis
              ?.category
              ? `Category: ${titleCase(
                  primaryHypothesis.category,
                )}`
              : null
          }
          accent="cyan"
        />

        <DiagnosticCard
          label="Primary Belief"
          title={
            primaryBelief
              ?.statement ??
            "No primary belief"
          }
          body={
            primaryBelief
              ?.status
              ? `The belief is currently ${titleCase(
                  primaryBelief.status,
                ).toLowerCase()} with ${formatPercentage(
                  primaryBelief.evidenceCoverage,
                )} evidence coverage.`
              : "The Brain has not committed to a primary belief."
          }
          badge={formatPercentage(
            primaryBelief
              ?.confidence,
          )}
          footer={
            primaryBelief
              ?.category
              ? `Belief category: ${titleCase(
                  primaryBelief.category,
                )}`
              : null
          }
          accent="cyan"
        />

        <DiagnosticCard
          label="Selected Strategy"
          title={
            selectedStrategy
              ?.title ??
            "No strategy selected"
          }
          body={
            selectedStrategy
              ?.expectedOutcome ??
            selectedStrategy
              ?.description ??
            "The Brain has not selected an operating strategy."
          }
          badge={
            selected?.score !==
              null &&
            selected?.score !==
              undefined
              ? formatScore(
                  selected.score,
                )
              : titleCase(
                  selected
                    ?.status,
                )
          }
          footer={[
            selectedStrategy
              ?.decisionMode
              ? `Mode: ${titleCase(
                  selectedStrategy.decisionMode,
                )}`
              : null,

            selectedStrategy
              ?.risk
              ? `Risk: ${titleCase(
                  selectedStrategy.risk,
                )}`
              : null,

            selectedStrategy
              ?.reversibility
              ? `Reversibility: ${titleCase(
                  selectedStrategy.reversibility,
                )}`
              : null,
          ]
            .filter(
              Boolean,
            )
            .join(
              " · ",
            )}
          accent="emerald"
        />

        <div className="rounded-2xl border border-emerald-500/20 bg-black/30 p-4 lg:col-span-2">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="max-w-3xl">
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-300">
                Best Simulated Future
              </div>

              <h3 className="mt-3 text-lg font-semibold leading-7 text-white">
                {bestFuture
                  ?.strategyTitle ??
                  selectedStrategy
                    ?.title ??
                  "No future selected"}
              </h3>

              <p className="mt-2 text-sm leading-6 text-neutral-300">
                {bestFuture
                  ?.summary ??
                  "The Brain has not completed a future comparison."}
              </p>
            </div>

            <div className="grid shrink-0 grid-cols-2 gap-2 md:w-[360px]">
              <Metric
                label="Simulation Confidence"
                value={formatPercentage(
                  bestFuture
                    ?.confidence,
                )}
                helper="Confidence in the projected outcome."
              />

              <Metric
                label="Expected Risk"
                value={formatPercentage(
                  bestFuture
                    ?.expectedRisk,
                )}
                helper="Probability-weighted projected risk."
              />
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Metric
              label="Revenue Impact"
              value={formatImpact(
                bestFuture
                  ?.expectedRevenueImpact,
              )}
              helper="Normalized directional impact."
            />

            <Metric
              label="Guest Impact"
              value={formatImpact(
                bestFuture
                  ?.expectedGuestExperienceImpact,
              )}
              helper="Expected guest-experience movement."
            />

            <Metric
              label="Operational Impact"
              value={formatImpact(
                bestFuture
                  ?.expectedOperationalImpact,
              )}
              helper="Expected operating-performance movement."
            />
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Decision Confidence"
          value={formatPercentage(
            decision
              ?.confidence ??
              cognition
                .confidence
                ?.decision,
          )}
          helper="Confidence in the current decision."
        />

        <Metric
          label="Decision Readiness"
          value={formatPercentage(
            decision
              ?.readinessScore ??
              cognition
                .confidence
                ?.readiness,
          )}
          helper="Whether current evidence supports acting."
        />

        <Metric
          label="Evidence Coverage"
          value={formatPercentage(
            decision
              ?.evidenceCoverage ??
              cognition
                .confidence
                ?.evidenceCoverage,
          )}
          helper="Relevant evidence represented in reasoning."
        />

        <Metric
          label="Future Selection"
          value={formatPercentage(
            comparison
              ?.decisionConfidence ??
              cognition
                .confidence
                ?.futureSelection,
          )}
          helper="Confidence that the preferred future is best."
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div
          className={
            warning
              ? "rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4"
              : "rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4"
          }
        >
          <div
            className={
              warning
                ? "text-[11px] font-medium uppercase tracking-[0.18em] text-amber-300"
                : "text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-300"
            }
          >
            {warning
              ? "Key Warning or Tradeoff"
              : "Decision Guardrails"}
          </div>

          <div className="mt-3 text-sm leading-6 text-neutral-300">
            {warning ??
              "No material decision warning was reported during this reasoning cycle."}
          </div>

          <div className="mt-3 text-xs text-neutral-500">
            Mode:{" "}
            {titleCase(
              decision
                ?.decisionMode,
            )}{" "}
            · Recommendation:{" "}
            {titleCase(
              decision
                ?.recommendation,
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4">
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-violet-300">
            Learning Status
          </div>

          <div className="mt-3 text-base font-semibold text-white">
            {learningStatus}
          </div>

          <div className="mt-2 text-sm leading-6 text-neutral-300">
            {learning?.message ??
              "The Brain is waiting for an executed action and measured outcome before updating long-term memory."}
          </div>
        </div>
      </div>
    </section>
  );
}