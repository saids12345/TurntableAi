// src/components/Skeleton.tsx
export default function Skeleton({ className = "" }: { className?: string }) {
    return <div className={`animate-pulse rounded-md bg-neutral-800/50 ${className}`} />;
  }
  