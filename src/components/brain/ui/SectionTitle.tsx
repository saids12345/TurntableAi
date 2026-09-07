import { ReactNode } from "react";

type SectionTitleProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;

  right?: ReactNode;

  className?: string;
};

export default function SectionTitle({
  eyebrow,
  title,
  description,
  right,
  className = "",
}: SectionTitleProps) {
  return (
    <div
      className={[
        "flex",
        "flex-col",
        "gap-5",
        "lg:flex-row",
        "lg:items-start",
        "lg:justify-between",
        className,
      ].join(" ")}
    >
      <div className="max-w-3xl">
        {eyebrow ? (
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">
            {eyebrow}
          </div>
        ) : null}

        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white">
          {title}
        </h2>

        {description ? (
          <p className="mt-2 text-sm leading-6 text-neutral-400">
            {description}
          </p>
        ) : null}
      </div>

      {right ? (
        <div className="shrink-0">
          {right}
        </div>
      ) : null}
    </div>
  );
}