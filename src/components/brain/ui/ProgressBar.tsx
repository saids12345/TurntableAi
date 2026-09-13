type ProgressBarProps = {
  value: number;
  max?: number;

  height?: number;

  showLabel?: boolean;

  className?: string;
};

export default function ProgressBar({
  value,
  max = 100,
  height = 8,
  showLabel = false,
  className = "",
}: ProgressBarProps) {
  const percentage = Math.max(
    0,
    Math.min((value / max) * 100, 100)
  );

  return (
    <div className={className}>
      {showLabel && (
        <div className="mb-2 flex items-center justify-between text-xs text-neutral-400">
          <span>Progress</span>
          <span>{Math.round(percentage)}%</span>
        </div>
      )}

      <div
        className="overflow-hidden rounded-full bg-white/10"
        style={{ height }}
      >
        <div
          className="h-full rounded-full bg-cyan-400 transition-all duration-500 ease-out"
          style={{
            width: `${percentage}%`,
          }}
        />
      </div>
    </div>
  );
}