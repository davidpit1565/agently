import Link from "next/link";
import { CATEGORIES_FALLBACK } from "@/data/categories";
import { agentCode } from "@/lib/agent-code";
import { TrustRing } from "@/app/components/trust-ring";
import { formatEuros } from "@/lib/format";
import { ApproxPrice } from "@/app/components/approx-price";
import type { Agent } from "@/lib/types";

function priceLabel(agent: Agent) {
  if (agent.pricing_model === "free") return "Free";
  // formatEuros, not .toFixed(0) — that rounded away the cents entirely,
  // showing a €2.50 agent as "€3" and a €9.99 one as "€10" while Stripe
  // still charged the real amount.
  const amount = formatEuros(agent.price_cents ?? 0);
  return agent.pricing_model === "subscription" ? `€${amount}/mo` : `€${amount} once`;
}

function category(slug: string) {
  return CATEGORIES_FALLBACK.find((c) => c.slug === slug) ?? CATEGORIES_FALLBACK[CATEGORIES_FALLBACK.length - 1];
}

export function AgentCard({ agent, hasFiles }: { agent: Agent; hasFiles?: boolean }) {
  const cat = category(agent.category_slug);
  return (
    <Link
      href={`/agents/${agent.slug}`}
      className="bezel-shell group block transition duration-300 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-1.5 hover:shadow-[0_20px_48px_-16px_rgba(47,224,173,0.28)]"
    >
      <div className="bezel-core flex h-full flex-col gap-3 border border-line bg-surface p-5 transition-colors duration-300 group-hover:border-accent/40 group-hover:bg-surface-raised">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-mono text-xs text-ink-faint">
            <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-accent" aria-hidden />
            {agentCode(agent.id)}
          </span>
          <TrustRing score={agent.trust_score} />
        </div>

        <div className="min-w-0">
          <h2 className="line-clamp-1 text-balance font-display font-semibold">{agent.name}</h2>
          <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{agent.tagline}</p>
        </div>

        <div className="mt-auto flex items-center justify-between pt-2 text-xs">
          <span className="flex items-center gap-1.5 rounded-full border border-line px-2 py-0.5 text-ink-faint">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: cat.color }} aria-hidden />
            {cat.name}
          </span>
          <div className="flex items-center gap-2">
            {hasFiles && (
              <span
                className="flex items-center gap-1 text-ink-faint"
                title="This listing has a downloadable file attached"
              >
                <svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M10 3v10m0 0l-3.5-3.5M10 13l3.5-3.5M4 15.5v1a1 1 0 001 1h10a1 1 0 001-1v-1" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            )}
            <span className="flex items-center gap-1 font-mono font-medium tabular-nums text-accent">
              {priceLabel(agent)}
              {agent.pricing_model !== "free" && (
                <span className="text-[11px] font-normal">
                  <ApproxPrice cents={agent.price_cents ?? 0} />
                </span>
              )}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
