import Link from "next/link";
import { getApprovedAgents } from "@/lib/catalog";
import { AgentCard } from "@/app/components/agent-card";
import { Reveal } from "@/app/components/reveal";
import { CounterUp } from "@/app/components/counter-up";
import { TrustRing } from "@/app/components/trust-ring";
import { agentCode } from "@/lib/agent-code";
import { formatEuros } from "@/lib/format";
import type { Agent } from "@/lib/types";

const PILLARS = [
  {
    n: "01",
    title: "List it your way",
    body: "One-time purchase, monthly subscription, or free — as an individual or a company.",
    icon: (
      <path
        d="M3.5 6h13M3.5 10h9M3.5 14h5.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    ),
  },
  {
    n: "02",
    title: "Reviewed before it's listed",
    body: "Every agent is checked for the permissions it asks for and the risk it carries before buyers ever see it.",
    icon: (
      <>
        <path
          d="M10 2.5l6 2.2v4.6c0 4-2.6 6.7-6 7.7-3.4-1-6-3.7-6-7.7V4.7z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path d="M7.2 9.8l2 2 3.6-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  {
    n: "03",
    title: "Found by problem, not category",
    body: "Describe what you're stuck on. Search matches you to the agent that solves it — not a keyword.",
    icon: (
      <>
        <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.4" />
        <path d="M10 4.5v3M10 12.5v3M4.5 10h3M12.5 10h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="10" cy="10" r="1.4" fill="currentColor" />
      </>
    ),
  },
];

/** Small pricing label for the hero's live-console panel — same rule AgentCard uses
 *  (formatEuros, not .toFixed(0), so a €2.50 agent never reads as "€3"), duplicated
 *  locally since it's the only other call site and importing AgentCard's private
 *  helper isn't worth the coupling for one line. */
function priceLabel(agent: Agent) {
  if (agent.pricing_model === "free") return "Free";
  const amount = formatEuros(agent.price_cents ?? 0);
  return agent.pricing_model === "subscription" ? `€${amount}/mo` : `€${amount} once`;
}

export default async function Home() {
  const agents = await getApprovedAgents();
  const newest = agents[0];

  return (
    <main className="relative overflow-hidden">
      <div className="hero-glow">
        <div className="hero-glow-a" />
        <div className="hero-glow-b" />
      </div>

      <div className="relative mx-auto flex max-w-6xl flex-col gap-28 px-6 py-24 sm:py-32">
        {/* Hero: text column left, live-catalog console panel right on wide screens —
            an asymmetric split instead of one centered narrow column, with a real,
            currently-listed agent (not placeholder data) giving the right side weight. */}
        <div className="grid items-center gap-16 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
          <div className="flex max-w-xl flex-col gap-6">
            <div
              className="flex w-fit animate-fade-up items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 font-mono text-xs uppercase tracking-wide text-ink-soft"
              style={{ animationDelay: "0ms" }}
            >
              <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-accent" aria-hidden />
              <CounterUp value={agents.length} duration={700} /> agent{agents.length === 1 ? "" : "s"} live now
            </div>
            <h1 className="text-balance font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
              <span>
                <span className="inline-block overflow-hidden">
                  <span className="inline-block animate-word-in" style={{ animationDelay: "90ms" }}>
                    The
                  </span>
                </span>{" "}
                <span className="inline-block overflow-hidden">
                  <span className="inline-block animate-word-in" style={{ animationDelay: "160ms" }}>
                    catalog
                  </span>
                </span>{" "}
                <span className="inline-block overflow-hidden">
                  <span className="inline-block animate-word-in" style={{ animationDelay: "230ms" }}>
                    for
                  </span>
                </span>
              </span>
              <br />
              <span className="inline-block overflow-hidden">
                <span
                  className="inline-block animate-word-in bg-gradient-to-r from-accent to-accent-strong bg-clip-text text-transparent"
                  style={{ animationDelay: "300ms" }}
                >
                  AI agents.
                </span>
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
                className="shine-sweep magnetic-btn group flex items-center gap-2 rounded-full bg-accent py-1.5 pl-5 pr-1.5 text-sm font-medium text-[#04140f] transition-all duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-0.5 hover:opacity-90"
              >
                Browse the catalog
                <span className="magnetic-icon flex h-7 w-7 items-center justify-center rounded-full bg-black/10">
                  →
                </span>
              </Link>
              <Link
                href="/pricing"
                className="magnetic-btn rounded-full border border-line px-5 py-2.5 text-sm font-medium text-ink transition-all duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-0.5 hover:border-accent/50"
              >
                Become a member
              </Link>
            </div>
          </div>

          {newest && (
            <div className="relative hidden lg:block" aria-hidden={false}>
              {/* Decorative card stacked behind the real one, offset for depth (Z-axis
                  cascade) — carries no independent content of its own. */}
              <div
                data-decor
                className="absolute -right-5 -top-5 h-full w-full rotate-2 rounded-[1.7rem] border border-line/60 bg-surface/40"
              />
              <Reveal delay={220} className="bezel-shell relative">
                <div className="bezel-core flex flex-col gap-4 border border-line bg-surface p-5 font-mono text-xs">
                  <div className="flex items-center justify-between border-b border-line pb-3 text-ink-faint">
                    <span className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-accent" aria-hidden />
                      agently / catalog
                    </span>
                    <span>newest listing</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-ink-faint">{agentCode(newest.id)}</span>
                    <TrustRing score={newest.trust_score} />
                  </div>
                  <div>
                    <p className="font-display text-base font-semibold normal-case tracking-normal text-ink">
                      {newest.name}
                    </p>
                    <p className="mt-1 text-[13px] normal-case leading-relaxed tracking-normal text-ink-soft">
                      {newest.tagline}
                    </p>
                  </div>
                  <div className="flex items-center justify-between border-t border-line pt-3">
                    <span className="text-ink-faint">just listed</span>
                    <span className="font-medium tabular-nums text-accent">{priceLabel(newest)}</span>
                  </div>
                </div>
              </Reveal>
            </div>
          )}
        </div>

        {/* Three pillars — each its own double-bezel panel (not a flat 3-up card row),
            with a slight vertical offset on the middle one so the row reads as
            deliberately composed rather than a stock feature grid. */}
        <div className="grid gap-4 sm:grid-cols-3">
          {PILLARS.map((p, i) => (
            <Reveal
              key={p.n}
              delay={i * 110}
              className={`bezel-shell group ${i === 1 ? "sm:-translate-y-3" : ""}`}
            >
              <div className="bezel-core relative flex h-full flex-col gap-4 overflow-hidden border border-line bg-surface p-6 transition-all duration-300 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] group-hover:-translate-y-1 group-hover:border-accent/40 group-hover:bg-surface-raised group-hover:shadow-[0_20px_48px_-18px_rgba(47,224,173,0.28)]">
                <span
                  aria-hidden
                  className="pointer-events-none absolute -right-2 -top-4 select-none font-display text-6xl font-bold text-ink/[0.04] transition-colors duration-300 group-hover:text-accent/10"
                >
                  {p.n}
                </span>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent transition-transform duration-300 group-hover:scale-110">
                  <svg viewBox="0 0 20 20" width="18" height="18" fill="none">
                    {p.icon}
                  </svg>
                </span>
                <div className="flex flex-col gap-2">
                  <h2 className="text-balance font-display text-base font-semibold">{p.title}</h2>
                  <p className="text-sm leading-relaxed text-ink-soft">{p.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        {agents.length > 0 && (
          <div className="flex flex-col gap-5">
            <Reveal className="flex items-end justify-between">
              <div className="flex flex-col gap-1.5">
                <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-faint">
                  Live catalog
                </span>
                <h2 className="font-display text-lg font-semibold">Newest in the catalog</h2>
              </div>
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

        {/* Closing band — the same two paths as the hero CTAs, so someone who scrolled
            the whole page without clicking still leaves with an obvious next step
            instead of the page trailing off after the agent grid. */}
        <Reveal className="bezel-shell">
          <div className="bezel-core flex flex-col items-start gap-5 border border-line bg-surface p-8 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1.5">
              <h2 className="font-display text-xl font-semibold">Ready when you are.</h2>
              <p className="text-sm text-ink-soft">
                Browsing and buying is free. Listing your own agent takes a membership.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/browse"
                className="shine-sweep magnetic-btn group flex items-center gap-2 rounded-full bg-accent py-1.5 pl-5 pr-1.5 text-sm font-medium text-[#04140f] transition-all duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-0.5 hover:opacity-90"
              >
                Browse the catalog
                <span className="magnetic-icon flex h-7 w-7 items-center justify-center rounded-full bg-black/10">
                  →
                </span>
              </Link>
              <Link
                href="/pricing"
                className="magnetic-btn rounded-full border border-line px-5 py-2.5 text-sm font-medium text-ink transition-all duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-0.5 hover:border-accent/50"
              >
                Become a member
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </main>
  );
}
