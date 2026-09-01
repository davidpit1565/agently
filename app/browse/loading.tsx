export default function BrowseLoading() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <div className="mb-8">
        <div className="h-8 w-40 skeleton-shimmer rounded bg-surface" />
      </div>
      <div className="mb-6 h-12 skeleton-shimmer rounded-xl bg-surface" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
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
