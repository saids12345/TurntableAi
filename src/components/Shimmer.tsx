export default function Shimmer({ className = "" }: { className?: string }) {
    return <div className={`animate-pulse rounded-xl bg-white/5 ${className}`} />;
  }
  