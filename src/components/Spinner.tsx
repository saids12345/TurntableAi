// src/components/Spinner.tsx
export default function Spinner({
  label = "Loading…",
  className = "",
}: { label?: string; className?: string }) {
  return (
    <div className={`inline-flex items-center gap-2 ${className}`} role="status" aria-live="polite">
      <svg
        className="h-4 w-4 animate-spin"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
        <path className="opacity-75" d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" fill="none" />
      </svg>
      <span className="text-sm text-neutral-300">{label}</span>
    </div>
  );
}
