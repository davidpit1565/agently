export default function SettingsLoading() {
  return (
    <main className="mx-auto max-w-xl px-6 py-16 sm:py-20">
      <div className="h-8 w-40 skeleton-shimmer rounded bg-surface" />
      <div className="mt-2 h-3 w-64 skeleton-shimmer rounded bg-surface" />
      <div className="mt-8 flex flex-col gap-4">
        <div className="h-16 w-full skeleton-shimmer rounded-lg bg-surface-raised" />
        <div className="h-16 w-full skeleton-shimmer rounded-lg bg-surface-raised" />
        <div className="h-16 w-full skeleton-shimmer rounded-lg bg-surface-raised" />
        <div className="h-32 w-full skeleton-shimmer rounded-lg bg-surface-raised" />
        <div className="h-16 w-full skeleton-shimmer rounded-lg bg-surface-raised" />
        <div className="mt-2 h-11 w-24 skeleton-shimmer rounded-full bg-surface-raised" />
      </div>
    </main>
  );
}
