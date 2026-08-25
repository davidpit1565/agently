const PILLARS = [
  {
    title: "List it your way",
    body: "One-time purchase, monthly subscription, or free — as an individual or a company.",
  },
  {
    title: "Reviewed before it's listed",
    body: "Every agent is checked for the permissions it asks for and the risk it carries before buyers ever see it.",
  },
  {
    title: "Found by problem, not category",
    body: "Describe what you're stuck on. The concierge matches you to the agent that solves it — not a keyword.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-14 px-6 py-24">
      <div className="flex flex-col gap-5">
        <span className="w-fit rounded-full border border-ink/15 px-3 py-1 text-xs uppercase tracking-wide text-ink/60">
          Coming soon
        </span>
        <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
          The marketplace for AI agents.
        </h1>
        <p className="max-w-xl text-lg text-ink/70">
          Built for the people making agents and the people who need one —
          with a safety review and a matchmaker in between, not just a list.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        {PILLARS.map((p) => (
          <div key={p.title} className="flex flex-col gap-2 rounded-xl border border-ink/10 bg-white/60 p-5">
            <h2 className="text-sm font-semibold text-accent">{p.title}</h2>
            <p className="text-sm text-ink/70">{p.body}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
