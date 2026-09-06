export default function AdminAgentsLoading() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 sm:py-20">
      <div className="h-8 w-56 skeleton-shimmer rounded bg-surface" />
      <div className="mt-2 h-3 w-80 skeleton-shimmer rounded bg-surface" />
      <div className="mt-8 flex flex-col gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5">
            <div className="flex items-center justify-between">
              <div className="h-3 w-20 skeleton-shimmer rounded bg-surface-raised" />
              <div className="h-3 w-24 skeleton-shimmer rounded bg-surface-raised" />
            </div>
            <div className="h-4 w-1/3 skeleton-shimmer rounded bg-surface-raised" />
            <div className="h-3 w-2/3 skeleton-shimmer rounded bg-surface-raised" />
            <div className="h-14 w-full skeleton-shimmer rounded-lg bg-surface-raised" />
            <div className="flex items-center gap-2">
              <div className="h-9 w-32 skeleton-shimmer rounded-lg bg-surface-raised" />
              <div className="h-9 w-16 skeleton-shimmer rounded-full bg-surface-raised" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
