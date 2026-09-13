import { ReactNode } from "react";

type MetricCardProps = {
  label: ReactNode;
  value: ReactNode;

  helper?: ReactNode;

  accent?: ReactNode;

  className?: string;
};

export default function MetricCard({
  label,
  value,
  helper,
  accent,
  className = "",
}: MetricCardProps) {
  return (
    <div
      className={[
        "rounded-2xl",
        "border",
        "border-white/10",
        "bg-black/30",
        "p-4",
        className,
      ].join(" ")}
    >
      <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">
        {label}
      </div>

      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="text-2xl font-semibold text-white">
          {value}
        </div>

        {accent}
      </div>

      {helper ? (
        <div className="mt-2 text-xs leading-5 text-neutral-500">
          {helper}
        </div>
      ) : null}
    </div>
  );
}