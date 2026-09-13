import { ReactNode } from "react";

type PanelProps = {
  children: ReactNode;
  className?: string;

  title?: ReactNode;
  subtitle?: ReactNode;

  headerRight?: ReactNode;
};

export default function Panel({
  children,
  className = "",
  title,
  subtitle,
  headerRight,
}: PanelProps) {
  return (
    <section
      className={[
        "rounded-3xl",
        "border",
        "border-white/10",
        "bg-black/30",
        "backdrop-blur-sm",
        "shadow-xl",
        className,
      ].join(" ")}
    >
      {(title || subtitle || headerRight) && (
        <div className="flex items-start justify-between gap-6 border-b border-white/10 p-6">
          <div>
            {subtitle ? (
              <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">
                {subtitle}
              </div>
            ) : null}

            {title ? (
              <h2 className="mt-1 text-2xl font-semibold text-white">
                {title}
              </h2>
            ) : null}
          </div>

          {headerRight}
        </div>
      )}

      <div className="p-6">{children}</div>
    </section>
  );
}