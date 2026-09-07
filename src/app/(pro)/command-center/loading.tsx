export default function Loading() {
    return (
      <div className="min-h-screen w-full px-4 pb-12 pt-8 md:px-8">
        <div className="mx-auto max-w-7xl animate-pulse">
          <div className="mb-8 rounded-3xl border border-white/10 bg-neutral-950/60 p-6">
            <div className="h-4 w-32 rounded bg-white/10" />
            <div className="mt-4 h-10 w-72 rounded bg-white/10" />
            <div className="mt-3 h-5 w-[32rem] max-w-full rounded bg-white/10" />
          </div>
  
          <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-white/10 bg-neutral-900/50 p-4"
              >
                <div className="h-3 w-28 rounded bg-white/10" />
                <div className="mt-3 h-8 w-14 rounded bg-white/10" />
                <div className="mt-2 h-3 w-32 rounded bg-white/10" />
              </div>
            ))}
          </div>
  
          <div className="grid gap-6 xl:grid-cols-[1.5fr,1fr]">
            <div className="rounded-3xl border border-white/10 bg-neutral-950/60 p-5">
              <div className="mb-5 h-6 w-56 rounded bg-white/10" />
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border border-white/10 bg-neutral-900/50 p-4"
                  >
                    <div className="h-5 w-40 rounded bg-white/10" />
                    <div className="mt-3 h-4 w-72 max-w-full rounded bg-white/10" />
                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {Array.from({ length: 4 }).map((__, j) => (
                        <div
                          key={j}
                          className="rounded-xl border border-white/10 bg-black/30 px-3 py-3"
                        >
                          <div className="h-3 w-16 rounded bg-white/10" />
                          <div className="mt-2 h-5 w-10 rounded bg-white/10" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
  
            <div className="space-y-6">
              {Array.from({ length: 2 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-3xl border border-white/10 bg-neutral-950/60 p-5"
                >
                  <div className="mb-5 h-6 w-40 rounded bg-white/10" />
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((__, j) => (
                      <div
                        key={j}
                        className="rounded-2xl border border-white/10 bg-neutral-900/50 p-4"
                      >
                        <div className="h-4 w-20 rounded bg-white/10" />
                        <div className="mt-3 h-4 w-40 rounded bg-white/10" />
                        <div className="mt-2 h-3 w-full rounded bg-white/10" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }