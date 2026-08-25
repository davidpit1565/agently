export default function AgentLoading() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div className="h-3 w-32 animate-pulse rounded bg-surface" />
          <div className="h-8 w-8 animate-pulse rounded-full bg-surface" />
        </div>
        <div className="h-9 w-2/3 animate-pulse rounded bg-surface" />
        <div className="h-5 w-1/2 animate-pulse rounded bg-surface" />
        <div className="h-32 animate-pulse rounded-xl bg-surface" />
        <div className="h-24 animate-pulse rounded bg-surface" />
      </div>
    </main>
  );
}
