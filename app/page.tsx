import Link from "next/link";
import { getApprovedAgents } from "@/lib/catalog";
import { AgentCard } from "@/app/components/agent-card";
import { Reveal } from "@/app/components/reveal";

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
      <div className="hero-glow">
        <div className="hero-glow-a" />
        <div className="hero-glow-b" />
      </div>
      <div className="relative mx-auto flex max-w-3xl flex-col gap-14 px-6 py-24">
        <div className="flex flex-col gap-6">
          <div
            className="flex w-fit animate-fade-up items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 font-mono text-xs uppercase tracking-wide text-ink-soft"
            style={{ animationDelay: "0ms" }}
          >
            <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-accent" aria-hidden />
            {agents.length} agent{agents.length === 1 ? "" : "s"} live now
          </div>
          <h1
            className="animate-fade-up text-balance font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl"
            style={{ animationDelay: "90ms" }}
          >
            The catalog for
            <br />
            <span className="bg-gradient-to-r from-accent to-accent-strong bg-clip-text text-transparent">
              AI agents.
            </span>
          </h1>
          <p
            className="max-w-xl animate-fade-up text-pretty text-lg leading-relaxed text-ink-soft"
            style={{ animationDelay: "180ms" }}
          >
            Built for the people making agents and the people who need one. The
            first agents in the catalog are the ones already running on our own
            channel — we&apos;re the first customer, not just the platform.
          </p>
          <div className="flex animate-fade-up flex-wrap gap-3 pt-2" style={{ animationDelay: "270ms" }}>
            <Link
              href="/browse"
              className="shine-sweep rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-[#04140f] transition-transform duration-200 hover:-translate-y-0.5 hover:opacity-90"
            >
              Browse the catalog
            </Link>
            <Link
              href="/pricing"
              className="rounded-full border border-line px-5 py-2.5 text-sm font-medium text-ink transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/50"
            >
              Become a member
            </Link>
          </div>
        </div>

        <Reveal className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3">
          {PILLARS.map((p, i) => (
            <div
              key={p.n}
              className="group flex flex-col gap-3 bg-surface p-6 transition-all duration-300 hover:z-10 hover:-translate-y-1 hover:bg-surface-raised hover:shadow-[0_16px_40px_-16px_rgba(47,224,173,0.3)]"
            >
              <span className="font-mono text-xs text-ink-faint transition-colors group-hover:text-accent">
                {p.n}
              </span>
              <h2 className="text-balance font-display text-base font-semibold">{p.title}</h2>
              <p className="text-sm text-ink-soft">{p.body}</p>
            </div>
          ))}
        </Reveal>

        {agents.length > 0 && (
          <div className="flex flex-col gap-5">
            <Reveal className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Newest in the catalog</h2>
              <Link
                href="/browse"
                className="group text-sm text-ink-faint transition-colors hover:text-accent"
              >
                See all {agents.length}{" "}
                <span className="inline-block transition-transform duration-200 group-hover:translate-x-1">
                  →
                </span>
              </Link>
            </Reveal>
            <div className="grid gap-4 sm:grid-cols-3">
              {agents.slice(0, 3).map((agent, i) => (
                <Reveal key={agent.id} delay={i * 90}>
                  <AgentCard agent={agent} />
                </Reveal>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
