import type { WhyThisIsHappeningData } from "@/components/brain/types";

type WhyThisIsHappeningProps = {
  data: WhyThisIsHappeningData;
};

export default function WhyThisIsHappening({
  data,
}: WhyThisIsHappeningProps) {
  return (
    <section className="rounded-3xl border border-rose-500/20 bg-gradient-to-br from-rose-500/10 via-neutral-950 to-black p-6 shadow-xl">
      <div className="max-w-5xl">
        <div className="inline-flex rounded-full border border-rose-400/20 bg-rose-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-rose-200">
          Why This Is Happening
        </div>

        <h2 className="mt-4 text-3xl font-semibold text-white">
  {data.heading ??
    "The AI's strongest explanation"}
</h2>

        <p className="mt-3 text-base leading-7 text-neutral-300">
          {data.summary}
        </p>

        <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-6">
          <div className="text-xs uppercase tracking-[0.16em] text-neutral-500">
  {data.primaryCauseLabel ??
    "Primary Cause"}
</div>

          <div className="mt-2 text-2xl font-semibold text-white">
            {data.primaryCause}
          </div>

          <p className="mt-4 leading-7 text-neutral-300">
            {data.explanation}
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-neutral-500">
                Category
              </div>

              <div className="mt-2 text-white">
                {data.category || "Unknown"}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-neutral-500">
                Severity
              </div>

              <div className="mt-2 text-white">
                {data.severity || "Unknown"}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-neutral-500">
                Confidence
              </div>

              <div className="mt-2 text-white">
                {data.confidence}%
              </div>
            </div>
          </div>

          {data.evidence.length > 0 && (
            <div className="mt-8">
              <div className="text-xs uppercase tracking-[0.16em] text-neutral-500">
                Supporting Evidence
              </div>

              <div className="mt-3 space-y-2">
                {data.evidence.map((item) => (
                  <div
                    key={item}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-neutral-300"
                  >
                    • {item}
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.recommendedActions.length > 0 && (
            <div className="mt-8">
              <div className="text-xs uppercase tracking-[0.16em] text-neutral-500">
                Recommended Actions
              </div>

              <div className="mt-3 space-y-2">
                {data.recommendedActions.map((item) => (
                  <div
                    key={item}
                    className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3 text-sm text-cyan-100"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.whatWouldChangeMyMind.length > 0 && (
            <div className="mt-8">
              <div className="text-xs uppercase tracking-[0.16em] text-neutral-500">
                What Would Change My Mind
              </div>

              <div className="mt-3 space-y-2">
                {data.whatWouldChangeMyMind.map((item) => (
                  <div
                    key={item}
                    className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-100"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}