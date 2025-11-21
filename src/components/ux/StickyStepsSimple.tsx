'use client';
import React from 'react';

type Props = {
  current?: 1 | 2 | 3;   // optional; defaults to 1
  subtitle?: string;
};

export default function StickyStepsSimple({ current = 1, subtitle }: Props) {
  const steps = [
    { id: 1, label: 'Step 1 · Overview' },
    { id: 2, label: 'Step 2 · Context' },
    { id: 3, label: 'Step 3 · POS & Generate' },
  ];

  return (
    <div className="sticky top-14 z-30 sticky-shadow">
      <div className="mx-auto max-w-6xl px-4 py-2 bg-neutral-950/80 backdrop-blur-md border-b border-white/10">
        <div className="flex items-center justify-between text-sm">
          <div className="flex gap-2">
            {steps.map(s => (
              <div
                key={s.id}
                className={[
                  'px-2.5 py-1.5 rounded-md border',
                  s.id <= current
                    ? 'border-violet-400/40 bg-violet-500/10 text-violet-200'
                    : 'border-white/10 text-neutral-400',
                ].join(' ')}
              >
                {s.label}
              </div>
            ))}
          </div>
          <div className="hidden sm:block text-neutral-400">
            {subtitle ?? 'Sales Recap & Forecast'}
          </div>
        </div>
      </div>
      <div className="accent-line" />
    </div>
  );
}
