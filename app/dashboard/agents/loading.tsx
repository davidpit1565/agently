export default function MyAgentsLoading() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div className="h-8 w-40 skeleton-shimmer rounded bg-surface" />
        <div className="h-9 w-32 skeleton-shimmer rounded-full bg-surface" />
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4 sm:flex-row sm:items-center"
          >
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <div className="h-[34px] w-[34px] shrink-0 skeleton-shimmer rounded-full bg-surface-raised" />
              <div className="min-w-0 flex-1">
                <div className="h-4 w-1/3 skeleton-shimmer rounded bg-surface-raised" />
                <div className="mt-2 h-3 w-2/3 skeleton-shimmer rounded bg-surface-raised" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-7 w-16 skeleton-shimmer rounded-full bg-surface-raised" />
              <div className="h-7 w-16 skeleton-shimmer rounded-full bg-surface-raised" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
