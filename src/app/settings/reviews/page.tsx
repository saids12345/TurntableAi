// src/app/settings/reviews/page.tsx
"use client";

import { useState } from "react";

export default function ReviewSettingsPage() {
  const [connecting, setConnecting] = useState(false);

  function connectGoogle() {
    setConnecting(true);
    window.location.href = "/api/google/auth";
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">Review Integrations</h1>

      {/* Google Reviews */}
      <div className="border border-zinc-800 rounded-2xl p-5 mb-6 bg-black/40">
        <h2 className="text-lg font-semibold mb-1">Google Reviews</h2>
        <p className="text-sm text-zinc-400 mb-4">
          Connect your Google Business Profile so TurnTableAI can automatically
          fetch reviews, save them, and draft AI replies.
        </p>

        <button
          onClick={connectGoogle}
          disabled={connecting}
          className="inline-flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-2 text-sm font-medium text-white hover:bg-violet-400 disabled:opacity-60"
        >
          {connecting ? "Redirecting…" : "Connect Google Reviews"}
        </button>
      </div>

      {/* Yelp (coming soon) */}
      <div className="border border-zinc-800 rounded-2xl p-5 bg-black/40">
        <h2 className="text-lg font-semibold mb-1">Yelp Reviews</h2>
        <p className="text-sm text-zinc-400">
          Yelp integration is coming soon.
        </p>
      </div>
    </div>
  );
}
