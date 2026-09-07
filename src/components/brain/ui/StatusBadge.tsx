import { ReactNode } from "react";

type Status =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral";

type StatusBadgeProps = {
  status?: Status;
  children: ReactNode;
  className?: string;
};

const statusStyles: Record<Status, string> = {
  success:
    "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",

  warning:
    "border-amber-500/20 bg-amber-500/10 text-amber-300",

  danger:
    "border-red-500/20 bg-red-500/10 text-red-300",

  info:
    "border-cyan-500/20 bg-cyan-500/10 text-cyan-300",

  neutral:
    "border-white/10 bg-white/5 text-neutral-300",
};

export default function StatusBadge({
  status = "neutral",
  children,
  className = "",
}: StatusBadgeProps) {
  return (
    <span
      className={[
        "inline-flex",
        "items-center",
        "rounded-full",
        "border",
        "px-3",
        "py-1",
        "text-xs",
        "font-medium",
        "tracking-wide",
        statusStyles[status],
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}