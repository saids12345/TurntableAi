import {
  MetricCard,
  Panel,
  ProgressBar,
  SectionTitle,
  StatusBadge,
} from "./ui";

import type { RecommendedActionData } from "./types";

type RecommendedActionProps = {
  data: RecommendedActionData;
};

export default function RecommendedAction({
  data,
}: RecommendedActionProps) {
  const urgencyStatus =
    data.urgency === "high"
      ? "danger"
      : data.urgency === "medium"
      ? "warning"
      : "success";

  return (
    <Panel
      title="Recommended Action"
      subtitle="Executive Recommendation"
      headerRight={
        <StatusBadge status={urgencyStatus}>
          {data.urgency.toUpperCase()} PRIORITY
        </StatusBadge>
      }
    >
      <SectionTitle
        title={data.title}
        description={data.summary}
      />

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Confidence"
          value={`${data.confidence}%`}
          helper="AI confidence"
        />

        <MetricCard
          label="Impact"
          value={`${data.impact}/100`}
          helper="Estimated business impact"
        />

        <MetricCard
          label="Urgency"
          value={
            data.urgency.charAt(0).toUpperCase() +
            data.urgency.slice(1)
          }
          helper="Recommended priority"
        />
      </div>

      {data.decisionProvenance?.available &&
  data.decisionProvenance.verified && (
    <div className="mt-8 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-300">
            Why This Action Won
          </div>

          <div className="mt-2 text-sm text-neutral-300">
            {data.decisionProvenance.summary}
          </div>
        </div>

        <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
          ✓ Verified against decision math
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {data.decisionProvenance.primaryDriver && (
          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">
              Primary Driver
            </div>

            <div className="mt-2 text-sm font-medium text-white">
              {data.decisionProvenance.primaryDriver.label}
            </div>

            <div className="mt-1 text-xs text-neutral-400">
              +
              {data.decisionProvenance.primaryDriver.contribution.toFixed(
                2,
              )}{" "}
              points
            </div>
          </div>
        )}

        {data.decisionProvenance.secondaryDriver && (
          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">
              Supporting Driver
            </div>

            <div className="mt-2 text-sm font-medium text-white">
              {data.decisionProvenance.secondaryDriver.label}
            </div>

            <div className="mt-1 text-xs text-neutral-400">
              +
              {data.decisionProvenance.secondaryDriver.contribution.toFixed(
                2,
              )}{" "}
              points
            </div>
          </div>
        )}

        {data.decisionProvenance.countervailingDriver && (
          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">
              Tradeoff
            </div>

            <div className="mt-2 text-sm font-medium text-white">
              {
                data.decisionProvenance
                  .countervailingDriver.label
              }
            </div>

            <div className="mt-1 text-xs text-neutral-400">
              {data.decisionProvenance.countervailingDriver.contribution.toFixed(
                2,
              )}{" "}
              points
            </div>
          </div>
        )}
      </div>
    </div>
  )}
  {data.decisionTransition?.changedMind && (
  <div className="mt-8 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-5">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-violet-300">
          Brain Changed Its Mind
        </div>

        <div className="mt-3 text-sm leading-6 text-neutral-300">
          The Brain previously recommended{" "}
          <span className="font-medium text-white">
            {data.decisionTransition
              .previousStrategyTitle ??
              "a different strategy"}
          </span>
          , but now recommends{" "}
          <span className="font-medium text-white">
            {data.decisionTransition
              .currentStrategyTitle ??
              data.title}
          </span>
          .
        </div>
      </div>

      {data.decisionTransition
        .changeExplanationStatus ===
      "verified" ? (
        <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
          ✓ Change mathematically verified
        </div>
      ) : (
        <div className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
          Explanation withheld
        </div>
      )}
    </div>

    {data.decisionTransition
      .changeExplanationStatus ===
      "verified" &&
    data.decisionTransition
      .changeProvenance?.summary ? (
      <>
        <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">
            Why The Decision Changed
          </div>

          <div className="mt-2 text-sm leading-6 text-neutral-300">
            {
              data.decisionTransition
                .changeProvenance.summary
            }
          </div>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {data.decisionTransition
            .changeProvenance
            .primaryDriver && (
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">
                Strongest Reason For Change
              </div>

              <div className="mt-2 text-sm font-medium text-white">
                {
                  data.decisionTransition
                    .changeProvenance
                    .primaryDriver.label
                }
              </div>

              <div className="mt-1 text-xs text-neutral-400">
                {data.decisionTransition
                  .changeProvenance
                  .primaryDriver
                  .contribution > 0
                  ? "+"
                  : ""}
                {data.decisionTransition
                  .changeProvenance
                  .primaryDriver
                  .contribution.toFixed(
                    2,
                  )}{" "}
                points
              </div>
            </div>
          )}

          {data.decisionTransition
            .changeProvenance
            .countervailingDriver && (
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">
                Tradeoff Considered
              </div>

              <div className="mt-2 text-sm font-medium text-white">
                {
                  data.decisionTransition
                    .changeProvenance
                    .countervailingDriver
                    .label
                }
              </div>

              <div className="mt-1 text-xs text-neutral-400">
                {data.decisionTransition
                  .changeProvenance
                  .countervailingDriver
                  .contribution.toFixed(
                    2,
                  )}{" "}
                points
              </div>
            </div>
          )}
        </div>
      </>
    ) : (
      <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-neutral-400">
        {data.decisionTransition
          .changeExplanationStatus ===
        "previous_strategy_not_comparable"
          ? "The previous strategy is not part of the Brain's current simulated future set, so TurnTableAI will not claim a mathematically verified reason for this change."
          : data.decisionTransition
                .changeExplanationStatus ===
              "verification_failed"
            ? "The Brain detected a decision change, but its mathematical explanation did not pass the provenance integrity check, so the explanation is being withheld."
            : "The Brain changed its recommendation, but no verified explanation is currently available."}
      </div>
    )}
  </div>
)}
      
      <div className="mt-8">
        <SectionTitle
          title="Execution Progress"
          description="Progress toward completing this recommendation."
        />

        <div className="mt-4">
          <ProgressBar
            value={data.progress}
            showLabel
          />
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <button
  type="button"
  onClick={
    data.onApprove
  }
  disabled={
    data.actionDisabled ||
    data.actionBusy ||
    !data.onApprove
  }
  aria-busy={
    data.actionBusy
  }
  aria-controls={
    data.actionControlsId
  }
  className="rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-cyan-500"
>
  {data.actionBusy
    ? data.actionBusyLabel ??
      "Working..."
    : data.actionLabel}
</button>

        {data.secondaryLabel && (
          <button
            type="button"
            onClick={data.onViewDetails}
            className="rounded-xl border border-white/10 px-5 py-2.5 text-sm text-neutral-300 transition hover:bg-white/5"
          >
            {data.secondaryLabel}
          </button>
        )}
      </div>
    </Panel>
  );
}