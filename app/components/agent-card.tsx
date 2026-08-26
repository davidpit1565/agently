import Link from "next/link";
import { CATEGORIES_FALLBACK } from "@/data/categories";
import { agentCode } from "@/lib/agent-code";
import { TrustRing } from "@/app/components/trust-ring";
import type { Agent } from "@/lib/types";

function priceLabel(agent: Agent) {
  if (agent.pricing_model === "free") return "Free";
  const amount = ((agent.price_cents ?? 0) / 100).toFixed(0);
  return agent.pricing_model === "subscription" ? `€${amount}/mo` : `€${amount} once`;
}

function category(slug: string) {
  return CATEGORIES_FALLBACK.find((c) => c.slug === slug) ?? CATEGORIES_FALLBACK[CATEGORIES_FALLBACK.length - 1];
}

export function AgentCard({ agent }: { agent: Agent }) {
  const cat = category(agent.category_slug);
  return (
    <Link
      href={`/agents/${agent.slug}`}
      className="group flex flex-col gap-3 rounded-xl border border-line bg-surface p-5 transition duration-200 ease-out hover:-translate-y-1 hover:border-accent/40 hover:bg-surface-raised hover:shadow-[0_12px_32px_-12px_rgba(47,224,173,0.25)]"
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 font-mono text-xs text-ink-faint">
          <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-accent" aria-hidden />
          {agentCode(agent.id)}
        </span>
        <TrustRing score={agent.trust_score} />
      </div>

      <div>
        <h2 className="text-balance font-display font-semibold">{agent.name}</h2>
        <p className="mt-1 text-sm text-ink-soft">{agent.tagline}</p>
      </div>

      <div className="mt-auto flex items-center justify-between pt-2 text-xs">
        <span className="flex items-center gap-1.5 rounded-full border border-line px-2 py-0.5 text-ink-faint">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: cat.color }} aria-hidden />
          {cat.name}
        </span>
        <span className="font-mono font-medium tabular-nums text-accent">{priceLabel(agent)}</span>
      </div>
    </Link>
  );
}
