"use client";

import Link from "next/link";
import Typewriter from "@/components/Typewriter";
import BackgroundFX from "@/components/BackgroundFX";

export default function HomePage() {
  return (
    <div className="min-h-screen relative">
      {/* colorful glowing backdrop */}
      <BackgroundFX />

      {/* ---------- Hero ---------- */}
      <section className="text-center py-14 px-6 relative z-[1]">
        <div className="mx-auto max-w-3xl">
          {/* Launch badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-950/70 px-3 py-1 text-xs text-neutral-300">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_2px_rgba(52,211,153,0.6)]" />
            Live • Beta
          </div>

          {/* Title — animated gradient */}
          <h1 className="mt-5 text-4xl md:text-5xl font-extrabold leading-tight tracking-tight text-gradient">
            TurnTable AI
          </h1>

          {/* Typewriter tagline */}
          <p className="mt-4 text-neutral-300 text-lg">
            <Typewriter
              words={[
                "Helping restaurants shine ✨",
                "Generate on-brand posts in seconds.",
                "Reply to reviews with confidence.",
                "Plan staffing with sales insights.",
              ]}
              typeSpeedMs={42}
              deleteSpeedMs={24}
              pauseMs={1200}
              className="font-medium"
            />
          </p>

          <p className="mt-3 text-neutral-400">
            Quick tools to market, reply to reviews, and plan the day — all in one place.
          </p>
        </div>
      </section>

      {/* ---------- Tools Grid ---------- */}
      <section id="tools" className="container-safe grid grid-cols-1 md:grid-cols-3 gap-6 pb-16 relative z-[1]">
        {/* Social */}
        <div className="card card-hover group">
          <div className="relative z-[1] flex items-start gap-3">
            <span className="text-xl">✨</span>
            <div>
              <h3 className="font-semibold text-lg text-white">Social Generator</h3>
              <p className="mt-1 text-sm text-neutral-300">
                Instant captions and TikTok/Reel ideas tailored to your brand.
              </p>
            </div>
          </div>
          <div className="relative z-[1] mt-6">
            <Link href="/social" className="btn btn-primary pressable inline-flex items-center gap-1">
              Open →
            </Link>
          </div>
          <div className="card-accent" />
        </div>

        {/* Reviews */}
        <div className="card card-hover group">
          <div className="relative z-[1] flex items-start gap-3">
            <span className="text-xl">💬</span>
            <div>
              <h3 className="font-semibold text-lg text-white">Review Responder</h3>
              <p className="mt-1 text-sm text-neutral-300">
                Polished, brand-safe replies in your chosen tone — ready to post.
              </p>
            </div>
          </div>
          <div className="relative z-[1] mt-6">
            <Link href="/reviews" className="btn btn-primary pressable inline-flex items-center gap-1">
              Open →
            </Link>
          </div>
          <div className="card-accent" />
        </div>

        {/* Sales */}
        <div className="card card-hover group">
          <div className="relative z-[1] flex items-start gap-3">
            <span className="text-xl">📈</span>
            <div>
              <h3 className="font-semibold text-lg text-white">Sales Recap & Forecast</h3>
              <p className="mt-1 text-sm text-neutral-300">
                Summarize performance and plan staffing & ordering. (MVP)
              </p>
            </div>
          </div>
          <div className="relative z-[1] mt-6">
            <Link href="/sales" className="btn btn-primary pressable inline-flex items-center gap-1">
              Open →
            </Link>
          </div>
          <div className="card-accent" />
        </div>
      </section>

      {/* ---------- Footnote ---------- */}
      <footer className="container-safe pb-10 text-center text-xs text-neutral-500 relative z-[1]">
        Tip: use the top navigation to jump between tools.
      </footer>
    </div>
  );
}


















