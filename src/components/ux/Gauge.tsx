// src/components/ux/Gauge.tsx
"use client";
import React from "react";

// Simple conic-gradient gauge for a % value.
// color stops: red -> yellow -> green
export default function Gauge({
  value,            // 0..100 (safe to pass null/undefined)
  label,
  good = 70,        // >= good => green
  warn = 40,        // < good && >= warn => yellow
}: { value?: number | null; label: string; good?: number; warn?: number }) {
  const v = typeof value === "number" && isFinite(value) ? Math.max(0, Math.min(100, value)) : null;

  const color =
    v === null ? "#6b7280" :
    v >= good ? "#22c55e" :
    v >= warn ? "#eab308" : "#ef4444";

  const bg = `conic-gradient(${color} ${v ?? 0}%, #1f2937 0)`;

  return (
    <div className="flex items-center gap-3">
      <div
        className="h-10 w-10 rounded-full border border-white/10"
        style={{ background: bg }}
        aria-label={`${label} ${v === null ? "—" : `${Math.round(v)}%`}`}
      />
      <div className="leading-tight">
        <div className="text-xs text-neutral-400">{label}</div>
        <div className="text-sm font-semibold text-white">{v === null ? "—" : `${Math.round(v)}%`}</div>
      </div>
    </div>
  );
}
