// src/components/ReviewInboxModal.tsx
"use client";

import { useMemo } from "react";

type Platform = "Google" | "Yelp";

export type InboxReview = {
  id: string;
  platform: Platform;
  rating: number | null;
  review_text: string;
  review_created_at: string; // ISO string
};

type Props = {
  open: boolean;
  onClose: () => void;
  items: InboxReview[];
  loading: boolean;
  error?: string;
  currentPlatform?: Platform | null;
  onSelect: (item: InboxReview) => void;
};

export default function ReviewInboxModal({
  open,
  onClose,
  items,
  loading,
  error,
  currentPlatform,
  onSelect,
}: Props) {
  // Don’t render anything if the modal is closed
  if (!open) return null;

  const filteredItems = useMemo(
    () =>
      items.filter((item) =>
        currentPlatform ? item.platform === currentPlatform : true
      ),
    [items, currentPlatform]
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-3 pb-6 sm:items-center">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-neutral-950 p-4 shadow-2xl">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Insert from inbox</h2>
            <p className="text-xs text-white/60">
              Pick a recent Google/Yelp review you&apos;ve imported, then drop it
              into the reply tool.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-white/70 hover:bg-white/5"
          >
            Close
          </button>
        </div>

        {loading && (
          <div className="py-6 text-center text-xs text-white/60">
            Loading inbox…
          </div>
        )}

        {error && !loading && (
          <div className="mb-2 rounded-lg border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-100">
            {error}
          </div>
        )}

        {!loading && !filteredItems.length && !error && (
          <div className="py-6 text-center text-xs text-white/60">
            No inbox reviews yet. Once you connect Google/Yelp and import
            reviews, they&apos;ll show up here.
          </div>
        )}

        <div className="max-h-80 space-y-2 overflow-y-auto pt-1">
          {filteredItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item)}
              className="w-full rounded-xl border border-white/10 bg-black/40 p-3 text-left text-xs text-white/80 transition hover:bg-white/5 hover:scale-[1.01] active:scale-[0.99]"
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                  {item.platform}
                  {typeof item.rating === "number" && (
                    <span className="ml-1 text-[10px]">{item.rating}★</span>
                  )}
                </span>
                <span className="text-[10px] text-white/50">
                  {new Date(item.review_created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="line-clamp-2 text-[11px] text-white/80">
                {item.review_text}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
