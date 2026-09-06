export default function AnalyticsLoading() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16 sm:py-20">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <div className="h-8 w-32 skeleton-shimmer rounded bg-surface" />
          <div className="mt-2 h-3 w-64 skeleton-shimmer rounded bg-surface" />
        </div>
        <div className="h-4 w-24 skeleton-shimmer rounded bg-surface" />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4">
            <div className="h-3 w-20 skeleton-shimmer rounded bg-surface-raised" />
            <div className="h-5 w-16 skeleton-shimmer rounded bg-surface-raised" />
          </div>
        ))}
      </div>

      <div className="mb-6 h-[70px] rounded-2xl border border-line bg-surface p-4">
        <div className="flex h-full items-center gap-4">
          <div className="h-9 w-9 shrink-0 skeleton-shimmer rounded-full bg-surface-raised" />
          <div className="h-4 flex-1 skeleton-shimmer rounded bg-surface-raised" />
          <div className="h-5 w-16 skeleton-shimmer rounded bg-surface-raised" />
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <div className="h-3 w-16 skeleton-shimmer rounded bg-surface-raised" />
        <div className="h-6 w-28 skeleton-shimmer rounded-full bg-surface-raised" />
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-line bg-surface p-5">
            <div className="mb-4 h-3 w-32 skeleton-shimmer rounded bg-surface-raised" />
            <div className="h-40 w-full skeleton-shimmer rounded bg-surface-raised" />
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-line bg-surface p-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-t border-line py-3 first:border-t-0">
            <div className="h-[34px] w-[34px] shrink-0 skeleton-shimmer rounded-full bg-surface-raised" />
            <div className="h-4 flex-1 skeleton-shimmer rounded bg-surface-raised" />
          </div>
        ))}
      </div>
    </main>
  );
}
