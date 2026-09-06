export default function PayoutsLoading() {
  return (
    <main className="mx-auto max-w-lg px-6 py-16 sm:py-20">
      <div className="h-8 w-32 skeleton-shimmer rounded bg-surface" />
      <div className="mt-2 h-3 w-full skeleton-shimmer rounded bg-surface" />
      <div className="mt-1 h-3 w-2/3 skeleton-shimmer rounded bg-surface" />
      <div className="mt-8 h-28 w-full skeleton-shimmer rounded-xl border border-line bg-surface" />
    </main>
  );
}
