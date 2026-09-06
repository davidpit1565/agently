export default function CreatorLoading() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
      <div className="mb-10 flex items-center gap-4">
        <div className="h-14 w-14 shrink-0 skeleton-shimmer rounded-full bg-surface" />
        <div>
          <div className="h-6 w-40 skeleton-shimmer rounded bg-surface" />
          <div className="mt-2 h-3 w-28 skeleton-shimmer rounded bg-surface" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5">
            <div className="flex items-center justify-between">
              <div className="h-3 w-16 skeleton-shimmer rounded bg-surface-raised" />
              <div className="h-8 w-8 skeleton-shimmer rounded-full bg-surface-raised" />
            </div>
            <div className="h-4 w-2/3 skeleton-shimmer rounded bg-surface-raised" />
            <div className="h-3 w-full skeleton-shimmer rounded bg-surface-raised" />
            <div className="mt-auto h-5 w-24 skeleton-shimmer rounded-full bg-surface-raised" />
          </div>
        ))}
      </div>
    </main>
  );
}
