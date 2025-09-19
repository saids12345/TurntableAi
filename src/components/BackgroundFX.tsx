export default function BackgroundFX() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {/* soft vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(80%_50%_at_50%_0%,rgba(56,189,248,0.12),transparent_60%)]" />
      {/* animated blobs */}
      <div className="animate-float-slow absolute -top-24 -left-24 h-72 w-72 rounded-full bg-sky-500/20 blur-3xl" />
      <div className="animate-float absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-fuchsia-500/20 blur-3xl" />
      <div className="animate-float-slower absolute top-1/3 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-pink-500/10 blur-[80px]" />
      {/* bottom glow line */}
      <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-fuchsia-500/40 to-transparent" />
    </div>
  );
}
