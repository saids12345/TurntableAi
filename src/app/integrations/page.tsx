// src/app/integrations/page.tsx
"use client";

import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";

function IntegrationsContent() {
  const q = useSearchParams();
  const [email, setEmail] = useState("owner@example.com");

  const notice = q.get("connected")
    ? "✅ Google connected"
    : q.get("error")
    ? `⚠️ ${q.get("error")}`
    : "Connect your review platform to receive email alerts for new reviews.";

  return (
    <div className="min-h-screen w-full px-3 pb-12 pt-10 sm:px-4 md:px-8">
      <div className="mx-auto max-w-2xl rounded-2xl border border-white/10 bg-black/30 p-6 shadow-2xl backdrop-blur">
        <h1 className="text-2xl font-semibold">Integrations</h1>
        <p className="mt-2 text-white/70">{notice}</p>

        <div className="mt-6 grid gap-4">
          <div className="rounded-xl border border-white/10 bg-black/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-medium">Google Business Profile</div>
                <div className="text-sm text-white/60">
                  Connect your Google listing to get email alerts for new reviews.
                </div>
              </div>

              {/* IMPORTANT: path must match your API route */}
              <form action="/api/google/auth/start" method="GET">
                <input type="hidden" name="email" value={email} />
                <button className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20">
                  Connect
                </button>
              </form>
            </div>

            <div className="mt-3">
              <label className="block text-sm text-white/80">Alert email (where notifications go)</label>
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="owner@restaurant.com"
              />
              <p className="mt-1 text-xs text-white/50">Tip: use a shared inbox like managers@…</p>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={async () => {
                  const r = await fetch("/api/google/poll", { method: "POST" });
                  const j = await r.json();
                  alert(`Polled. Emails sent: ${j.sent ?? 0}`);
                }}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:bg-white/10"
              >
                Test poll now
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/40 p-4">
            <div className="font-medium">Yelp</div>
            <div className="mt-1 text-sm text-white/60">
              Yelp’s public API doesn’t provide a continuous review feed. We’ll add an official integration later.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function IntegrationsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <IntegrationsContent />
    </Suspense>
  );
}
