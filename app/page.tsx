import Link from "next/link";
import { getApprovedAgents } from "@/lib/catalog";
import { AgentCard } from "@/app/components/agent-card";

const PILLARS = [
  {
    n: "01",
    title: "List it your way",
    body: "One-time purchase, monthly subscription, or free — as an individual or a company.",
  },
  {
    n: "02",
    title: "Reviewed before it's listed",
    body: "Every agent is checked for the permissions it asks for and the risk it carries before buyers ever see it.",
  },
  {
    n: "03",
    title: "Found by problem, not category",
    body: "Describe what you're stuck on. Search matches you to the agent that solves it — not a keyword.",
  },
];

export default async function Home() {
  const agents = await getApprovedAgents();

  return (
    <main className="relative overflow-hidden">
      <div className="hero-glow" />
      <div className="relative mx-auto flex max-w-3xl flex-col gap-14 px-6 py-24">
        <div className="flex flex-col gap-6">
          <div className="flex w-fit items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 font-mono text-xs uppercase tracking-wide text-ink-soft">
            <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-accent" aria-hidden />
            {agents.length} agent{agents.length === 1 ? "" : "s"} live now
          </div>
          <h1 className="text-balance font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
            The catalog for
            <br />
            <span className="text-accent">AI agents.</span>
          </h1>
          <p className="max-w-xl text-pretty text-lg leading-relaxed text-ink-soft">
            Built for the people making agents and the people who need one. The
            first agents in the catalog are the ones already running on our own
            channel — we&apos;re the first customer, not just the platform.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/browse"
              className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-[#04140f] hover:opacity-90"
            >
              Browse the catalog
            </Link>
            <Link
              href="/pricing"
              className="rounded-full border border-line px-5 py-2.5 text-sm font-medium text-ink hover:border-accent/50"
            >
              Become a member
            </Link>
          </div>
        </div>

        <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3">
          {PILLARS.map((p) => (
            <div
              key={p.n}
              className="group flex flex-col gap-3 bg-surface p-6 transition hover:bg-surface-raised"
            >
              <span className="font-mono text-xs text-ink-faint transition group-hover:text-accent">
                {p.n}
              </span>
              <h2 className="text-balance font-display text-base font-semibold">{p.title}</h2>
              <p className="text-sm text-ink-soft">{p.body}</p>
            </div>
          ))}
        </div>

        {agents.length > 0 && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Newest in the catalog</h2>
              <Link href="/browse" className="text-sm text-ink-faint hover:text-accent">
                See all {agents.length} →
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {agents.slice(0, 3).map((agent) => (
                <AgentCard key={agent.id} agent={agent} />
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
