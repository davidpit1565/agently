export default function MembershipLoading() {
  return (
    <main className="mx-auto max-w-lg px-6 py-16 sm:py-20">
      <div className="h-8 w-64 skeleton-shimmer rounded bg-surface" />
      <div className="mt-2 h-3 w-full skeleton-shimmer rounded bg-surface" />
      <div className="mt-8 flex flex-col gap-4">
        <div className="h-20 w-full skeleton-shimmer rounded-xl border border-line bg-surface" />
        <div className="h-11 w-full skeleton-shimmer rounded-full bg-surface-raised" />
      </div>
    </main>
  );
}
