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
      <div className="film-grain" aria-hidden data-decor />
      <div className="hero-glow">
        <div className="hero-glow-a" />
        <div className="hero-glow-b" />
        <div className="hero-glow-c" />
      </div>

      <div className="relative mx-auto flex max-w-6xl flex-col gap-32 px-6 py-28 sm:py-40">
        {/* Hero: text column left, live-catalog console panel right on wide screens —
            an asymmetric split instead of one centered narrow column, with a real,
            currently-listed agent (not placeholder data) giving the right side weight.
            The split is deliberately lopsided (1.35fr/0.65fr, not ~1.1/0.9) and the
            headline is no longer capped by the same max-w-xl as the paragraph below it
            — two elements of near-equal visual mass were competing for the first glance
            instead of one clearly winning it, so the console card now reads as
            supporting evidence for the headline rather than a second focal point. */}
        <div className="grid items-center gap-20 lg:grid-cols-[1.35fr_0.65fr] lg:gap-16">
          <div className="flex flex-col gap-7">
            <div
              className="magnetic-btn flex w-fit animate-fade-up items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 font-mono text-xs uppercase tracking-wide text-ink-soft transition-colors duration-200 hover:border-accent/40"
              style={{ animationDelay: "0ms" }}
            >
              <span className="pulse-ring relative flex h-1.5 w-1.5 items-center justify-center">
                <span className="relative z-10 h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
              </span>
              <CounterUp value={agents.length} duration={700} /> agent{agents.length === 1 ? "" : "s"} live now
            </div>
            <h1 className="animate-tracking-in text-balance font-display text-6xl font-bold leading-[1.02] tracking-tight sm:text-7xl lg:text-[5.25rem]">
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
                  className="gradient-drift inline-block animate-word-in bg-gradient-to-r from-accent to-accent-strong bg-clip-text text-transparent"
                  style={{ animationDelay: "300ms" }}
                >
                  AI agents.
                </span>
              </span>
            </h1>
            <p
              className="max-w-xl animate-reveal-up text-pretty text-lg leading-relaxed text-ink-soft"
              style={{ animationDelay: "220ms" }}
            >
              Built for the people making agents and the people who need one. The
              first agents in the catalog are the ones already running on our own
              channel — we&apos;re the first customer, not just the platform.
            </p>
            {agents.length > 0 && (
              <div
                className="flex animate-fade-up items-center gap-5 font-mono text-xs uppercase tracking-wide text-ink-faint"
                style={{ animationDelay: "260ms" }}
              >
                <span className="flex items-baseline gap-1.5">
                  <CounterUp
                    value={Math.round(agents.reduce((sum, a) => sum + a.trust_score, 0) / agents.length)}
                    duration={900}
                    className="font-display text-lg font-semibold normal-case tracking-normal text-ink"
                  />
                  avg. trust score
                </span>
                <span className="h-3 w-px bg-line" aria-hidden />
                <span className="flex items-baseline gap-1.5">
                  <CounterUp
                    value={new Set(agents.map((a) => a.category_slug)).size}
                    duration={900}
                    className="font-display text-lg font-semibold normal-case tracking-normal text-ink"
                  />
                  categories
                </span>
              </div>
            )}
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/browse"
                className="cta-glow shine-sweep magnetic-btn group flex animate-fade-up items-center gap-2 rounded-full bg-accent py-1.5 pl-5 pr-1.5 text-sm font-medium text-[#04140f] transition-all duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-0.5 hover:opacity-90"
                style={{ animationDelay: "300ms" }}
              >
                Browse the catalog
                <span className="magnetic-icon flex h-7 w-7 items-center justify-center rounded-full bg-black/10">
                  →
                </span>
              </Link>
              <Link
                href="/pricing"
                className="border-glow-hover magnetic-btn animate-fade-up rounded-full border border-line px-5 py-2.5 text-sm font-medium text-ink transition-all duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-0.5 hover:border-accent/50"
                style={{ animationDelay: "380ms" }}
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
                className="scroll-parallax absolute -right-5 -top-5 h-full w-full rotate-2 rounded-[1.7rem] border border-line/60 bg-surface/40"
              />
              <Reveal delay={220} className="bezel-shell console-breathe spotlight-ring tilt-hover relative">
                <div className="bezel-core flex flex-col gap-4 border border-line bg-surface p-5 font-mono text-xs">
                  <div className="flex items-center justify-between border-b border-line pb-3 text-ink-faint">
                    <span className="flex items-center gap-1.5">
                      <span className="pulse-ring relative flex h-1.5 w-1.5 items-center justify-center">
                        <span className="relative z-10 h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
                      </span>
                      agently / catalog
                    </span>
                    <span>
                      newest listing
                      <span className="blink-cursor" aria-hidden>
                        &nbsp;
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-ink-faint">{agentCode(newest.id)}</span>
                    <TrustRing score={newest.trust_score} />
                  </div>
                  <div className="animate-fade-up" style={{ animationDelay: "380ms" }}>
                    <p className="font-display text-base font-semibold normal-case tracking-normal text-ink">
                      {newest.name}
                    </p>
                    <p className="mt-1 text-[13px] normal-case leading-relaxed tracking-normal text-ink-soft">
                      {newest.tagline}
                    </p>
                  </div>
                  <div
                    className="animate-fade-up flex items-center justify-between border-t border-line pt-3"
                    style={{ animationDelay: "460ms" }}
                  >
                    <span className="text-ink-faint">just listed</span>
                    <span className="value-flash rounded px-1 font-medium tabular-nums text-accent">
                      {priceLabel(newest)}
                    </span>
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
              delay={i * 130}
              className={`tilt-hover bezel-shell group ${i === 1 ? "sm:-translate-y-3" : ""}`}
            >
              <div className="shine-sweep bezel-core relative flex h-full flex-col gap-4 overflow-hidden border border-line bg-surface p-6 transition-all duration-300 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] group-hover:-translate-y-1 group-hover:border-accent/40 group-hover:bg-surface-raised group-hover:shadow-[0_20px_48px_-18px_rgba(47,224,173,0.28)]">
                <span aria-hidden data-decor className="accent-bar-grow" />
                <span
                  aria-hidden
                  className="pointer-events-none absolute -right-2 -top-4 select-none font-display text-6xl font-bold text-ink/[0.04] transition-all duration-300 group-hover:translate-y-1 group-hover:text-accent/10"
                >
                  {p.n}
                </span>
                <span className="spotlight-ring flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent transition-transform duration-300 group-hover:rotate-6 group-hover:scale-110">
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
                <span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-faint">
                  <span className="pulse-ring relative flex h-1.5 w-1.5 items-center justify-center">
                    <span className="relative z-10 h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
                  </span>
                  Live catalog
                </span>
                <h2 className="font-display text-lg font-semibold">Newest in the catalog</h2>
              </div>
              <Link
                href="/browse"
                className="group text-sm text-ink-faint transition-colors hover:text-accent"
              >
                <span className="underline-grow">
                  See all <CounterUp value={agents.length} duration={600} />
                </span>{" "}
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
        <Reveal className="bezel-shell console-breathe">
          <div className="bezel-core flex flex-col items-start gap-5 border border-line bg-surface p-8 sm:flex-row sm:items-center sm:justify-between">
            <Reveal delay={0} className="flex flex-col gap-1.5">
              <h2 className="font-display text-xl font-semibold">Ready when you are.</h2>
              <p className="text-sm text-ink-soft">
                Browsing and buying is free. Listing your own agent takes a membership.
              </p>
            </Reveal>
            <Reveal delay={110} className="flex flex-wrap gap-3">
              <Link
                href="/browse"
                className="cta-glow shine-sweep magnetic-btn group flex items-center gap-2 rounded-full bg-accent py-1.5 pl-5 pr-1.5 text-sm font-medium text-[#04140f] transition-all duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-0.5 hover:opacity-90"
              >
                Browse the catalog
                <span className="magnetic-icon flex h-7 w-7 items-center justify-center rounded-full bg-black/10">
                  →
                </span>
              </Link>
              <Link
                href="/pricing"
                className="border-glow-hover magnetic-btn rounded-full border border-line px-5 py-2.5 text-sm font-medium text-ink transition-all duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-0.5 hover:border-accent/50"
              >
                Become a member
              </Link>
            </Reveal>
          </div>
        </Reveal>
      </div>
    </main>
  );
}
