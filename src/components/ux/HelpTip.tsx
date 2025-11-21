'use client';
import React from 'react';

export default function HelpTip({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex items-center">
      <span className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/15 text-[10px] text-neutral-300/80">
        ?
      </span>
      <span className="pointer-events-none absolute left-1/2 top-6 z-20 hidden w-64 -translate-x-1/2 rounded-md border border-white/10 bg-neutral-900/95 px-3 py-2 text-xs text-neutral-200 shadow-xl group-hover:block">
        {text}
      </span>
    </span>
  );
}
