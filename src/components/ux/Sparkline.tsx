// src/components/ux/Sparkline.tsx
"use client";
import React from "react";

type Pt = { x: number; y: number };

export default function Sparkline({
  values,
  width = 220,
  height = 56,
  strokeWidth = 2,
  ariaLabel = "sparkline",
}: {
  values: number[];
  width?: number;
  height?: number;
  strokeWidth?: number;
  ariaLabel?: string;
}) {
  if (!values || values.length < 2) {
    return (
      <div className="h-14 w-[220px] rounded-md bg-neutral-900/50" aria-label={ariaLabel} />
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padX = 8;
  const padY = 8;
  const w = width - padX * 2;
  const h = height - padY * 2;

  const pts: Pt[] = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w + padX;
    const y =
      (1 - (v - min) / (Math.max(1, max - min))) * h + padY; // 0..1 -> top..bottom
    return { x, y };
  });

  const path = pts.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ");
  const area = `M${padX},${height - padY} ` + path + ` L${width - padX},${height - padY} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-[220px] h-14">
      <path d={area} className="fill-violet-500/10" />
      <path d={path} className="stroke-violet-400" strokeWidth={strokeWidth} fill="none" />
    </svg>
  );
}
