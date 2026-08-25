import Link from "next/link";

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
    body: "Describe what you're stuck on. Search matches you to the agent that solves it — not a keyword.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-14 px-6 py-24">
      <div className="flex flex-col gap-5">
        <span className="w-fit rounded-full border border-ink/15 px-3 py-1 text-xs uppercase tracking-wide text-ink/60">
          Now in early access
        </span>
        <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
          The marketplace for AI agents.
        </h1>
        <p className="max-w-xl text-lg text-ink/70">
          Built for the people making agents and the people who need one. The
          first agents in the catalog are the ones already running on our own
          channel — we&apos;re the first customer, not just the platform.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href="/browse"
            className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
          >
            Browse the catalog
          </Link>
          <Link
            href="/pricing"
            className="rounded-full border border-ink/15 px-5 py-2.5 text-sm font-medium hover:border-ink/40"
          >
            Become a member
          </Link>
        </div>
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
