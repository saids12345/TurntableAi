"use client";

import { useEffect, useState } from "react";

type PresetItem<T> = {
  ts: number;
  value: T;
};

export function PresetBar<T>({
  name,
  value,
  onLoad,
}: {
  name: string;
  value: T;
  onLoad: (v: T) => void;
}) {
  const key = `presets:${name}`;

  const [mounted, setMounted] = useState(false);
  const [presets, setPresets] = useState<PresetItem<T>[]>([]);

  // Mark as mounted so we know we're on the client
  useEffect(() => {
    setMounted(true);
  }, []);

  // Load presets from localStorage on the client
  useEffect(() => {
    if (!mounted) return;
    try {
      const raw = window.localStorage.getItem(key);
      const arr = raw ? (JSON.parse(raw) as PresetItem<T>[]) : [];
      setPresets(arr);
    } catch {
      setPresets([]);
    }
  }, [mounted, key]);

  function save() {
    if (!mounted) return; // safety

    try {
      const item: PresetItem<T> = { ts: Date.now(), value };
      const next = [item, ...presets].slice(0, 10);

      window.localStorage.setItem(key, JSON.stringify(next));
      setPresets(next);
      alert("Preset saved");
    } catch {
      // ignore errors for now
    }
  }

  // Avoid SSR/client mismatch: render nothing on the server
  if (!mounted) {
    return null;
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={save}
        className="rounded-md border border-white/10 px-3 py-1 text-xs text-white/80 hover:bg-white/5"
      >
        Save preset
      </button>
      {presets.map((p) => {
        const date = new Date(p.ts);
        const dateLabel = date.toLocaleDateString();
        const timeLabel = date.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });

        return (
          <button
            key={p.ts}
            type="button"
            onClick={() => onLoad(p.value)}
            className="rounded-md border border-white/10 px-3 py-1 text-xs text-white/70 hover:bg-white/5"
            title={date.toLocaleString()}
          >
            {dateLabel} {timeLabel}
          </button>
        );
      })}
    </div>
  );
}
