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
            TurnTableAI monitors reviews, sales trends, and operational signals
            across your locations — then recommends the next actions to grow
            revenue and protect your reputation.
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
                Google, Yelp, email alerts — issues are easy to miss and slow
                responses damage reputation.
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
            TurnTableAI continuously analyzes signals from your business and
            surfaces the most important actions in one Command Center.
          </p>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <div className="card card-hover">
              <span className="text-xl">👀</span>
              <h3 className="mt-3 font-semibold text-white">Monitor</h3>
              <p className="mt-2 text-sm text-neutral-400">
                Track reviews, sales signals, and operational issues across all
                locations in real time.
              </p>
            </div>

            <div className="card card-hover">
              <span className="text-xl">🧠</span>
              <h3 className="mt-3 font-semibold text-white">Detect</h3>
              <p className="mt-2 text-sm text-neutral-400">
                AI identifies risks like sales drops, review spikes, or service
                issues before they become bigger problems.
              </p>
            </div>

            <div className="card card-hover">
              <span className="text-xl">⚡</span>
              <h3 className="mt-3 font-semibold text-white">Act</h3>
              <p className="mt-2 text-sm text-neutral-400">
                Get recommended actions — respond to reviews, launch promotions,
                or fix operational issues.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CORE CAPABILITIES */}
      <section className="relative z-[1] px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-semibold text-white md:text-3xl">
            Built for multi-location operators
          </h2>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <div className="card">
              <h3 className="font-semibold text-white">Command Center</h3>
              <p className="mt-2 text-sm text-neutral-400">
                One dashboard to monitor health, alerts, and performance across
                every location.
              </p>
            </div>

            <div className="card">
              <h3 className="font-semibold text-white">Review Monitoring</h3>
              <p className="mt-2 text-sm text-neutral-400">
                Detect negative reviews instantly and generate brand-safe
                replies in seconds.
              </p>
            </div>

            <div className="card">
              <h3 className="font-semibold text-white">Performance Insights</h3>
              <p className="mt-2 text-sm text-neutral-400">
                Spot revenue dips, identify trends, and receive actionable
                recommendations.
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