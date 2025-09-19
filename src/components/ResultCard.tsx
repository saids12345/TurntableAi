"use client";

import clsx from "clsx";

type ResultCardProps = {
  text: string;
  className?: string;
  footer?: React.ReactNode;
};

export default function ResultCard({ text, className, footer }: ResultCardProps) {
  return (
    <div
      className={clsx(
        "rounded-xl border border-neutral-800/40 bg-neutral-900/40 p-6 shadow-sm",
        "transition will-change-transform hover:translate-y-[-2px] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_8px_30px_rgba(0,0,0,0.35)]",
        className
      )}
    >
      <p className="whitespace-pre-wrap leading-relaxed">{text}</p>
      {footer ? <div className="mt-3 flex items-center justify-between">{footer}</div> : null}
    </div>
  );
}

