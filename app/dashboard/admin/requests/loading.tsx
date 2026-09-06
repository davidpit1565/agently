export default function AdminRequestsLoading() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 sm:py-20">
      <div className="h-8 w-48 skeleton-shimmer rounded bg-surface" />
      <div className="mt-8 h-9 w-64 skeleton-shimmer rounded-full bg-surface" />
      <div className="mt-8 flex flex-col gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5">
            <div className="flex items-center justify-between">
              <div className="h-3 w-16 skeleton-shimmer rounded bg-surface-raised" />
              <div className="h-3 w-20 skeleton-shimmer rounded bg-surface-raised" />
            </div>
            <div className="h-4 w-2/3 skeleton-shimmer rounded bg-surface-raised" />
            <div className="h-9 w-full skeleton-shimmer rounded-lg bg-surface-raised" />
            <div className="h-9 w-full skeleton-shimmer rounded-lg bg-surface-raised" />
            <div className="h-9 w-16 skeleton-shimmer rounded-full bg-surface-raised" />
          </div>
        ))}
      </div>
    </main>
  );
}
