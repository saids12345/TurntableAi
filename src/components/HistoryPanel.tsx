// src/components/HistoryPanel.tsx
"use client";

import { HistoryItem } from "@/lib/client";

export default function HistoryPanel({
  items,
  onUse,
  onClear,
  title = "History",
}: {
  items: HistoryItem[];
  onUse: (text: string) => void;
  onClear: () => void;
  title?: string;
}) {
  return (
    <section className="mt-8 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-neutral-200">{title}</h2>
        <button
          type="button"
          onClick={onClear}
          className="rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
        >
          Clear
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-neutral-500 text-sm">Nothing saved yet.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => (
            <li key={it.id} className="rounded-lg border border-neutral-800 p-3">
              <div className="flex items-center justify-between">
                <div className="text-xs text-neutral-400">
                  {new Date(it.createdAt).toLocaleString()}
                </div>
                <button
                  type="button"
                  onClick={() => onUse(it.text)}
                  className="rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-200 hover:bg-neutral-800"
                >
                  Use
                </button>
              </div>
              <div className="mt-1 text-sm text-neutral-200 line-clamp-3 whitespace-pre-wrap">
                {it.title}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
