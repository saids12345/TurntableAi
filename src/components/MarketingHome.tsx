"use client";

import Link from "next/link";
import BackgroundFX from "@/components/BackgroundFX";

export default function MarketingHome() {
  return (
    <div className="min-h-screen relative">
      <BackgroundFX />

      {/* HERO */}
      <section className="relative z-[1] px-6 py-20 text-center">
        <div className="mx-auto max-w-4xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-950/70 px-3 py-1 text-xs text-neutral-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            AI Operator for Restaurants
          </div>

          <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight text-gradient md:text-6xl">
            Run Every Location
            <br />
            From One AI Command Center
          </h1>

          <p className="mt-6 text-lg text-neutral-300">
            TurnTableAI brings together connected Google reviews and Square sales
            signals, helping you spot patterns and decide what to do next.
            Available data and features depend on your connections.
          </p>

          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              href="/command-center"
              className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-black transition hover:scale-[1.02]"
            >
              Open Command Center →
            </Link>

            <Link
              href="/reviews"
              className="rounded-xl border border-white/10 px-6 py-3 text-sm text-white/80 hover:bg-white/5"
            >
              See Review Monitoring
            </Link>
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="relative z-[1] px-6 py-16">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="text-2xl font-semibold text-white md:text-3xl">
            Restaurants run on dozens of disconnected tools
          </h2>

          <p className="mt-4 text-neutral-400">
            Reviews, marketing, sales reports, alerts, and operations are
            scattered across different platforms. Operators spend hours chasing
            problems instead of growing their business.
          </p>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            <div className="card">
              <h3 className="font-semibold text-white">Reviews Everywhere</h3>
              <p className="mt-2 text-sm text-neutral-400">
                Customer feedback and sales data live in different tools, making it
                harder to spot issues and respond consistently.
              </p>
            </div>

            <div className="card">
              <h3 className="font-semibold text-white">
                Sales Problems Too Late
              </h3>
              <p className="mt-2 text-sm text-neutral-400">
                Revenue dips or weak shifts are usually discovered days after
                they already hurt performance.
              </p>
            </div>

            <div className="card">
              <h3 className="font-semibold text-white">
                No Clear Next Action
              </h3>
              <p className="mt-2 text-sm text-neutral-400">
                Data is everywhere, but operators rarely know the highest
                leverage action to take next.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* OPERATOR SYSTEM */}
      <section className="relative z-[1] px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-semibold text-white md:text-3xl">
            Meet the AI Restaurant Operator
          </h2>

          <p className="mt-4 text-center text-neutral-400">
            TurnTableAI analyzes available restaurant data as updates arrive and
            highlights potential issues and suggested next steps in one place.
          </p>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <div className="card card-hover">
              <span className="text-xl">👀</span>
              <h3 className="mt-3 font-semibold text-white">Monitor</h3>
              <p className="mt-2 text-sm text-neutral-400">
                See connected Google review activity and Square performance when
                scheduled data updates become available.
              </p>
            </div>

            <div className="card card-hover">
              <span className="text-xl">🧠</span>
              <h3 className="mt-3 font-semibold text-white">Detect</h3>
              <p className="mt-2 text-sm text-neutral-400">
                Explore potential sales drops and review patterns, with context on
                the data available for each recommendation.
              </p>
            </div>

            <div className="card card-hover">
              <span className="text-xl">⚡</span>
              <h3 className="mt-3 font-semibold text-white">Act</h3>
              <p className="mt-2 text-sm text-neutral-400">
                Review suggested actions, create editable replies, and choose which
                operational improvements to pursue.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CORE CAPABILITIES */}
      <section className="relative z-[1] px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-semibold text-white md:text-3xl">
            Built for One Restaurant or Many
          </h2>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <div className="card">
              <h3 className="font-semibold text-white">Command Center</h3>
              <p className="mt-2 text-sm text-neutral-400">
                One dashboard for signals and performance across your connected
                restaurant locations.
              </p>
            </div>

            <div className="card">
              <h3 className="font-semibold text-white">Review Monitoring</h3>
              <p className="mt-2 text-sm text-neutral-400">
                Google Business Profile review checks are scheduled daily;
                review replies are AI-drafted and editable.
              </p>
            </div>

            <div className="card">
              <h3 className="font-semibold text-white">Performance Insights</h3>
              <p className="mt-2 text-sm text-neutral-400">
                Explore connected Square sales trends and suggested actions,
                with clear limits when data is missing.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative z-[1] px-6 py-20 text-center">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-semibold text-white">
            Start operating your restaurants with AI
          </h2>

          <p className="mt-4 text-neutral-400">
            TurnTableAI helps operators focus on the decisions that actually
            move the business forward.
          </p>

          <Link
            href="/command-center"
            className="mt-8 inline-flex rounded-xl bg-white px-6 py-3 text-sm font-semibold text-black hover:scale-[1.02]"
          >
            Launch Command Center →
          </Link>
        </div>
      </section>
    </div>
  );
}