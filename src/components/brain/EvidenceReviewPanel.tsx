"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";

import type {
  EvidenceGapContext,
  EvidenceSource,
  EvidenceSubmission,
} from "./types";

type EvidenceReviewPanelProps = {
  /**
   * HTML ID used by aria-controls on the Review Evidence button.
   */
  id?: string;

  /**
   * Controls whether the evidence-review dialog is visible.
   */
  open: boolean;

  /**
   * Current evidence gap produced by the Cognitive Brain.
   */
  context: EvidenceGapContext | null;

  /**
   * Closes the evidence-review dialog.
   */
  onClose: () => void;

  /**
   * Persists the evidence and triggers a new cognitive cycle.
   */
  onSubmit: (
    submission: EvidenceSubmission,
  ) => void | Promise<void>;
};

type SourceOption = {
  value: EvidenceSource;
  label: string;
  helper: string;
};

const SOURCE_OPTIONS: SourceOption[] = [
  {
    value: "operator",
    label: "Operator observation",
    helper:
      "Evidence directly observed or confirmed by the restaurant operator.",
  },
  {
    value: "pos",
    label: "POS data",
    helper:
      "Sales, orders, average ticket, refunds, discounts, or transaction evidence.",
  },
  {
    value: "reviews",
    label: "Guest reviews",
    helper:
      "Review text, ratings, complaints, praise, or guest sentiment evidence.",
  },
  {
    value: "labor",
    label: "Labor data",
    helper:
      "Staffing levels, labor percentage, schedules, overtime, or productivity evidence.",
  },
  {
    value: "inventory",
    label: "Inventory data",
    helper:
      "Ingredient availability, waste, stockouts, purchasing, or food-cost evidence.",
  },
  {
    value: "reservations",
    label: "Reservations or traffic",
    helper:
      "Reservations, covers, walk-ins, traffic, wait times, or demand evidence.",
  },
  {
    value: "other",
    label: "Other source",
    helper:
      "Any additional evidence that materially affects the operating decision.",
  },
];

function toLocalDateTimeInput(date: Date) {
  const offsetMilliseconds =
    date.getTimezoneOffset() * 60_000;

  return new Date(
    date.getTime() - offsetMilliseconds,
  )
    .toISOString()
    .slice(0, 16);
}

function clamp(
  value: number,
  min = 0,
  max = 100,
) {
  return Math.min(
    max,
    Math.max(min, value),
  );
}

function normalizeItems(
  values: string[] | null | undefined,
) {
  return Array.from(
    new Set(
      (values ?? [])
        .map((value) =>
          value.replace(/\s+/g, " ").trim(),
        )
        .filter(Boolean),
    ),
  );
}

function titleCase(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}
type ResolvedEvidenceItem = {
  question: string;
  statement: string;
  source?: string | null;
  confidence?: number | null;
  observedAt?: string | null;
  locationName?: string | null;
};

function normalizeComparisonText(
  value: string,
) {
  return value
    .toLowerCase()
    .replace(
      /[^a-z0-9\s]/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function questionsMatch(
  left: string,
  right: string,
) {
  return (
    normalizeComparisonText(left) ===
    normalizeComparisonText(right)
  );
}

function formatEvidenceConfidence(
  value?: number | null,
) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return null;
  }

  const percentage =
    value <= 1
      ? value * 100
      : value;

  return `${Math.round(
    clamp(percentage),
  )}% confidence`;
}

function formatEvidenceObservedAt(
  value?: string | null,
) {
  if (!value) {
    return null;
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return date.toLocaleString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    },
  );
}

function EvidenceList({
  title,
  description,
  items,
  emptyLabel,
  tone = "neutral",
}: {
  title: string;
  description: string;
  items: string[];
  emptyLabel: string;
  tone?: "neutral" | "warning" | "danger";
}) {
  const dotClass =
    tone === "danger"
      ? "bg-rose-300"
      : tone === "warning"
        ? "bg-amber-300"
        : "bg-cyan-300";

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <h3 className="text-sm font-semibold text-white">
        {title}
      </h3>

      <p className="mt-1 text-xs leading-5 text-neutral-500">
        {description}
      </p>

      {items.length > 0 ? (
        <div className="mt-4 space-y-2">
          {items.map((item, index) => (
            <div
              key={`${title}-${index}-${item}`}
              className="flex gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5"
            >
              <span
                aria-hidden="true"
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotClass}`}
              />

              <p className="text-sm leading-6 text-neutral-300">
                {item}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-white/10 px-3 py-4 text-sm text-neutral-500">
          {emptyLabel}
        </div>
      )}
    </section>
  );
}
function ResolvedEvidenceList({
  items,
}: {
  items: ResolvedEvidenceItem[];
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">
            Resolved by operator evidence
          </h3>

          <p className="mt-1 text-xs leading-5 text-neutral-500">
            Questions the Brain closed using verified restaurant evidence.
          </p>
        </div>

        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
          {items.length} resolved
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {items.map((item) => {
          const confidenceLabel =
            formatEvidenceConfidence(
              item.confidence,
            );

          const observedAtLabel =
            formatEvidenceObservedAt(
              item.observedAt,
            );

          return (
            <article
              key={`${item.question}-${item.statement}`}
              className="rounded-xl border border-emerald-400/15 bg-black/25 p-4"
            >
              <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-emerald-300">
                Resolved question
              </div>

              <h4 className="mt-2 text-sm font-semibold leading-6 text-white">
                {item.question}
              </h4>

              <div className="mt-3 rounded-xl border border-white/10 bg-black/25 px-3 py-3">
                <div className="text-[11px] uppercase tracking-[0.14em] text-neutral-500">
                  Evidence supplied
                </div>

                <p className="mt-2 text-sm leading-6 text-neutral-300">
                  {item.statement}
                </p>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {item.source && (
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-neutral-400">
                    {titleCase(
                      item.source,
                    )}
                  </span>
                )}

                {confidenceLabel && (
                  <span className="rounded-full border border-emerald-400/15 bg-emerald-400/[0.07] px-2.5 py-1 text-[11px] text-emerald-200">
                    {confidenceLabel}
                  </span>
                )}

                {item.locationName && (
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-neutral-400">
                    {item.locationName}
                  </span>
                )}

                {observedAtLabel && (
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-neutral-400">
                    Observed {observedAtLabel}
                  </span>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default function EvidenceReviewPanel({
  id = "evidence-review-panel",
  open,
  context,
  onClose,
  onSubmit,
}: EvidenceReviewPanelProps) {
  const evidenceInputRef =
    useRef<HTMLTextAreaElement | null>(null);

  const [source, setSource] =
    useState<EvidenceSource>("operator");
    const [
  selectedQuestion,
  setSelectedQuestion,
] = useState("");

  const [value, setValue] =
    useState("");

  const [confidence, setConfidence] =
    useState(75);

  const [observedAt, setObservedAt] =
    useState(() =>
      toLocalDateTimeInput(new Date()),
    );

  const [notes, setNotes] =
    useState("");

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const currentEvidence = useMemo(
    () =>
      normalizeItems(
        context?.currentEvidence,
      ),
    [context?.currentEvidence],
  );

  const unknowns = useMemo(
    () =>
      normalizeItems(context?.unknowns),
    [context?.unknowns],
  );
  const availableQuestions =
  useMemo(
    () =>
      normalizeItems([
        context?.unresolvedQuestion ??
          "",

        ...(context?.unknowns ??
          []),

        ...(
          context
            ?.partiallyResolvedUnknowns ??
          []
        ),
      ]),
    [
      context?.unresolvedQuestion,
      context?.unknowns,
      context
        ?.partiallyResolvedUnknowns,
    ],
  );

  const blockingReasons = useMemo(
    () =>
      normalizeItems(
        context?.blockingReasons,
      ),
    [context?.blockingReasons],
  );

  const warnings = useMemo(
    () =>
      normalizeItems(context?.warnings),
    [context?.warnings],
  );
  const operatorEvidence =
  useMemo(
    () =>
      context?.operatorEvidence ??
      [],
    [context?.operatorEvidence],
  );

const resolvedUnknowns =
  useMemo(
    () =>
      normalizeItems(
        context?.resolvedUnknowns,
      ),
    [context?.resolvedUnknowns],
  );

const partiallyResolvedUnknowns =
  useMemo(
    () =>
      normalizeItems(
        context
          ?.partiallyResolvedUnknowns,
      ),
    [
      context
        ?.partiallyResolvedUnknowns,
    ],
  );

const resolvedEvidenceItems =
  useMemo<ResolvedEvidenceItem[]>(
    () =>
      resolvedUnknowns.flatMap(
        (question) => {
          const matchingEvidence =
            operatorEvidence.find(
              (item) =>
                Boolean(
                  item.question &&
                    questionsMatch(
                      question,
                      item.question,
                    ),
                ),
            );

          if (
            !matchingEvidence
          ) {
            return [];
          }

          return [
            {
              question,

              statement:
                matchingEvidence
                  .statement,

              source:
                matchingEvidence
                  .source,

              confidence:
                matchingEvidence
                  .confidence,

              observedAt:
                matchingEvidence
                  .observedAt,

              locationName:
                matchingEvidence
                  .locationName,
            },
          ];
        },
      ),
    [
      resolvedUnknowns,
      operatorEvidence,
    ],
  );

const resolvedEvidenceStatements =
  useMemo(
    () =>
      new Set(
        resolvedEvidenceItems.map(
          (item) =>
            normalizeComparisonText(
              item.statement,
            ),
        ),
      ),
    [resolvedEvidenceItems],
  );

const remainingCurrentEvidence =
  useMemo(
    () =>
      currentEvidence.filter(
        (item) =>
          !resolvedEvidenceStatements.has(
            normalizeComparisonText(
              item,
            ),
          ),
      ),
    [
      currentEvidence,
      resolvedEvidenceStatements,
    ],
  );

  const selectedSource =
    SOURCE_OPTIONS.find(
      (option) =>
        option.value === source,
    ) ?? SOURCE_OPTIONS[0];

  const evidenceCoverage =
    typeof context?.evidenceCoverage ===
      "number" &&
    Number.isFinite(
      context.evidenceCoverage,
    )
      ? Math.round(
          clamp(
            context.evidenceCoverage <= 1
              ? context.evidenceCoverage *
                  100
              : context.evidenceCoverage,
          ),
        )
      : null;

  const canSubmit =
  Boolean(context) &&
  Boolean(selectedQuestion) &&
  value.trim().length >= 3 &&
  Boolean(observedAt) &&
  !submitting;

  useEffect(() => {
    if (!open) {
      return;
    }

    setSource("operator");
    setSelectedQuestion(
  context?.unresolvedQuestion ??
    availableQuestions[0] ??
    "",
);
    setValue("");
    setConfidence(75);
    setObservedAt(
      toLocalDateTimeInput(new Date()),
    );
    setNotes("");
    setError(null);

    const frame =
      window.requestAnimationFrame(() => {
        evidenceInputRef.current?.focus();
      });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [
  open,
  context?.unresolvedQuestion,
  availableQuestions,
]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (
        event.key === "Escape" &&
        !submitting
      ) {
        onClose();
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [open, submitting, onClose]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!context || !canSubmit) {
      return;
    }

    const observedDate =
      new Date(observedAt);

    if (
      Number.isNaN(
        observedDate.getTime(),
      )
    ) {
      setError(
        "Please enter a valid observation date and time.",
      );
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        question:
  selectedQuestion,
        source,
        value: value.trim(),
        confidence: Math.round(
          clamp(confidence),
        ),
        observedAt:
          observedDate.toISOString(),
        locationName:
          context.locationName ?? null,
        notes:
          notes.trim() || null,
      });

      setValue("");
      setNotes("");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "TurnTableAI could not submit the evidence. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onMouseDown={() => {
        if (!submitting) {
          onClose();
        }
      }}
    >
      <section
        id={id}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-description`}
        onMouseDown={(event) => {
          event.stopPropagation();
        }}
        className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-[2rem] border border-cyan-400/20 bg-neutral-950 shadow-2xl shadow-cyan-950/40"
      >
        <header className="sticky top-0 z-10 border-b border-white/10 bg-neutral-950/95 px-5 py-5 backdrop-blur md:px-7">
          <div className="flex items-start justify-between gap-5">
            <div>
              <div className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-300">
                Cognitive Evidence Review
              </div>

              <h2
                id={`${id}-title`}
                className="mt-2 text-2xl font-semibold tracking-tight text-white"
              >
                Resolve the decision gap
              </h2>

              <p
                id={`${id}-description`}
                className="mt-2 max-w-3xl text-sm leading-6 text-neutral-400"
              >
                Review what the Brain currently
                knows, identify what remains
                uncertain, and provide evidence
                that can strengthen or change the
                operating decision.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              aria-label="Close evidence review"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 text-xl text-neutral-400 transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              ×
            </button>
          </div>
        </header>

        {!context ? (
          <div className="p-6 md:p-8">
            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-5 text-sm leading-6 text-amber-100">
              The Brain did not provide an
              evidence gap for this decision.
              Close this panel and run the AI
              Kernel again.
            </div>
          </div>
        ) : (
          <div className="grid gap-6 p-5 md:p-7 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
            <div className="space-y-5">
              <section className="rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.07] p-5">
                <div className="flex flex-wrap gap-2">
                  {context.decisionMode && (
                    <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-200">
                      {titleCase(
                        context.decisionMode,
                      )}
                    </span>
                  )}

                  {context.locationName && (
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-neutral-300">
                      {context.locationName}
                    </span>
                  )}

                  {evidenceCoverage !== null && (
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-neutral-300">
                      {evidenceCoverage}% evidence
                      coverage
                    </span>
                  )}
                </div>

                {context.objective && (
                  <div className="mt-5">
                    <div className="text-xs uppercase tracking-[0.16em] text-neutral-500">
                      Current objective
                    </div>

                    <p className="mt-2 text-sm leading-6 text-neutral-300">
                      {context.objective}
                    </p>
                  </div>
                )}

                <div className="mt-5">
                  <div className="text-xs uppercase tracking-[0.16em] text-cyan-300">
                    Highest-impact unknown
                  </div>

                  <p className="mt-2 text-lg font-medium leading-7 text-white">
                    {
                      context.unresolvedQuestion
                    }
                  </p>
                </div>

                {evidenceCoverage !== null && (
                  <div className="mt-5">
                    <div className="mb-2 flex items-center justify-between text-xs text-neutral-400">
                      <span>
                        Evidence coverage
                      </span>

                      <span>
                        {evidenceCoverage}%
                      </span>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-cyan-400 transition-all"
                        style={{
                          width: `${evidenceCoverage}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </section>

              {(context.primaryHypothesis ||
                context.hypothesisDescription) && (
                <section className="rounded-2xl border border-violet-400/20 bg-violet-400/[0.06] p-5">
                  <div className="text-xs uppercase tracking-[0.16em] text-violet-300">
                    Leading hypothesis
                  </div>

                  <h3 className="mt-2 text-base font-semibold text-white">
                    {context.primaryHypothesis ??
                      "Current operating hypothesis"}
                  </h3>

                  {context.hypothesisDescription && (
                    <p className="mt-2 text-sm leading-6 text-neutral-300">
                      {
                        context.hypothesisDescription
                      }
                    </p>
                  )}
                </section>
              )}

              <ResolvedEvidenceList
  items={resolvedEvidenceItems}
/>

<EvidenceList
  title="Evidence already considered"
  description="Other signals currently supporting or challenging the Brain’s reasoning."
  items={
    remainingCurrentEvidence
  }
  emptyLabel="No additional supporting evidence was included in this decision."
/>

{partiallyResolvedUnknowns.length >
  0 && (
  <EvidenceList
    title="Partially resolved questions"
    description="Evidence was supplied, but the Brain still needs stronger confirmation before closing these questions."
    items={
      partiallyResolvedUnknowns
    }
    emptyLabel="No questions are partially resolved."
    tone="warning"
  />
)}

<EvidenceList
  title="What the Brain still needs to know"
                description="Unknown information that could materially change the decision."
                items={unknowns}
                emptyLabel="No additional unknowns were explicitly identified."
                tone="warning"
              />

              <EvidenceList
                title="Decision blockers"
                description="Reasons the Brain is not yet ready to make a stronger operating move."
                items={blockingReasons}
                emptyLabel="No formal blocking reasons were identified."
                tone="danger"
              />

              {warnings.length > 0 && (
                <EvidenceList
                  title="Warnings and tradeoffs"
                  description="Risks that should remain visible while the decision is updated."
                  items={warnings}
                  emptyLabel="No warnings were identified."
                  tone="warning"
                />
              )}
            </div>

            <div>
              <form
                onSubmit={handleSubmit}
                className="sticky top-28 rounded-2xl border border-white/10 bg-white/[0.035] p-5"
              >
                <div className="text-xs uppercase tracking-[0.16em] text-emerald-300">
                  Supply new evidence
                </div>

                <h3 className="mt-2 text-xl font-semibold text-white">
                  Update the Brain
                </h3>

                <p className="mt-2 text-sm leading-6 text-neutral-400">
                  Submit a concrete observation,
                  metric, or integration result.
                  TurnTableAI will use it to
                  rebuild the hypotheses, beliefs,
                  simulations, and selected
                  strategy.
                </p>

                <div className="mt-6 space-y-5">
                <div>
  <label
    htmlFor={`${id}-question`}
    className="text-sm font-medium text-neutral-200"
  >
    Question to answer
  </label>

  <select
    id={`${id}-question`}
    value={selectedQuestion}
    onChange={(event) => {
      setSelectedQuestion(
        event.target.value,
      );
    }}
    disabled={
      submitting ||
      availableQuestions.length === 0
    }
    className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-400/50 disabled:opacity-50"
  >
    {availableQuestions.map(
      (question) => (
        <option
          key={question}
          value={question}
          className="bg-neutral-950"
        >
          {question ===
          context.unresolvedQuestion
            ? `${question} — Highest impact`
            : question}
        </option>
      ),
    )}
  </select>

  <p className="mt-2 text-xs leading-5 text-neutral-500">
    Select the uncertainty this evidence directly addresses. The Brain will match the submission to this exact question during the next cognitive cycle.
  </p>
</div>
                  <div>
                    <label
                      htmlFor={`${id}-source`}
                      className="text-sm font-medium text-neutral-200"
                    >
                      Evidence source
                    </label>

                    <select
                      id={`${id}-source`}
                      value={source}
                      onChange={(event) => {
                        setSource(
                          event.target
                            .value as EvidenceSource,
                        );
                      }}
                      disabled={submitting}
                      className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-400/50 disabled:opacity-50"
                    >
                      {SOURCE_OPTIONS.map(
                        (option) => (
                          <option
                            key={option.value}
                            value={option.value}
                            className="bg-neutral-950"
                          >
                            {option.label}
                          </option>
                        ),
                      )}
                    </select>

                    <p className="mt-2 text-xs leading-5 text-neutral-500">
                      {selectedSource.helper}
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor={`${id}-value`}
                      className="text-sm font-medium text-neutral-200"
                    >
                      Evidence
                    </label>

                    <textarea
                      ref={evidenceInputRef}
                      id={`${id}-value`}
                      value={value}
                      onChange={(event) => {
                        setValue(
                          event.target.value,
                        );
                      }}
                      disabled={submitting}
                      rows={7}
                      placeholder="Example: Dinner revenue increased 12% over the previous four Tuesdays, but the increase came entirely from delivery orders while dine-in traffic stayed flat."
                      className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-neutral-600 focus:border-cyan-400/50 disabled:opacity-50"
                    />

                    <div className="mt-1 text-right text-xs text-neutral-600">
                      {value.trim().length} characters
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor={`${id}-observed-at`}
                      className="text-sm font-medium text-neutral-200"
                    >
                      Observation date and time
                    </label>

                    <input
                      id={`${id}-observed-at`}
                      type="datetime-local"
                      value={observedAt}
                      onChange={(event) => {
                        setObservedAt(
                          event.target.value,
                        );
                      }}
                      disabled={submitting}
                      className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-400/50 disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-4">
                      <label
                        htmlFor={`${id}-confidence`}
                        className="text-sm font-medium text-neutral-200"
                      >
                        Evidence confidence
                      </label>

                      <span className="text-sm font-semibold text-cyan-300">
                        {confidence}%
                      </span>
                    </div>

                    <input
                      id={`${id}-confidence`}
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={confidence}
                      onChange={(event) => {
                        setConfidence(
                          Number(
                            event.target.value,
                          ),
                        );
                      }}
                      disabled={submitting}
                      className="mt-3 w-full accent-cyan-400 disabled:opacity-50"
                    />

                    <div className="mt-1 flex justify-between text-[11px] text-neutral-600">
                      <span>Uncertain</span>
                      <span>Verified</span>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor={`${id}-notes`}
                      className="text-sm font-medium text-neutral-200"
                    >
                      Additional context
                      <span className="ml-1 text-neutral-600">
                        Optional
                      </span>
                    </label>

                    <textarea
                      id={`${id}-notes`}
                      value={notes}
                      onChange={(event) => {
                        setNotes(
                          event.target.value,
                        );
                      }}
                      disabled={submitting}
                      rows={3}
                      placeholder="Add scope, exceptions, assumptions, or anything the Brain should consider."
                      className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-neutral-600 focus:border-cyan-400/50 disabled:opacity-50"
                    />
                  </div>
                </div>

                {error && (
                  <div
                    role="alert"
                    className="mt-5 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm leading-6 text-rose-200"
                  >
                    {error}
                  </div>
                )}

                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={submitting}
                    className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-neutral-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={!canSubmit}
                    aria-busy={submitting}
                    className="rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-cyan-500"
                  >
                    {submitting
                      ? "Updating Brain..."
                      : "Submit Evidence & Re-run Brain"}
                  </button>
                </div>

                <p className="mt-4 text-xs leading-5 text-neutral-600">
                  Submitting evidence may change
                  the leading hypothesis,
                  confidence, recommended action,
                  and Operator Workflow.
                </p>
              </form>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}