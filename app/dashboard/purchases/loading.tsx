export default function PurchasesLoading() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
      <div className="mb-8">
        <div className="h-8 w-44 skeleton-shimmer rounded bg-surface" />
        <div className="mt-2 h-3 w-72 skeleton-shimmer rounded bg-surface" />
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 flex-1">
              <div className="h-4 w-1/3 skeleton-shimmer rounded bg-surface-raised" />
              <div className="mt-2 h-3 w-2/3 skeleton-shimmer rounded bg-surface-raised" />
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <div className="h-3 w-12 skeleton-shimmer rounded bg-surface-raised" />
              <div className="h-3 w-20 skeleton-shimmer rounded bg-surface-raised" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
