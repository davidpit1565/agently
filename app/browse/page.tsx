import Link from "next/link";
import { getApprovedAgents } from "@/lib/catalog";
import { CATEGORIES_FALLBACK } from "@/data/categories";
import { agentCode } from "@/lib/agent-code";
import { TrustRing } from "@/app/components/trust-ring";

function priceLabel(agent: Awaited<ReturnType<typeof getApprovedAgents>>[number]) {
  if (agent.pricing_model === "free") return "Free";
  const amount = ((agent.price_cents ?? 0) / 100).toFixed(0);
  return agent.pricing_model === "subscription" ? `€${amount}/mo` : `€${amount} once`;
}

function categoryName(slug: string) {
  return CATEGORIES_FALLBACK.find((c) => c.slug === slug)?.name ?? slug;
}

export default async function BrowsePage() {
  const agents = await getApprovedAgents();

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <div className="mb-10 flex flex-col gap-2">
        <h1 className="font-display text-2xl font-semibold">Browse agents</h1>
        <p className="font-mono text-sm text-ink-faint">
          {agents.length} agent{agents.length === 1 ? "" : "s"} · sorted newest first
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent) => (
          <Link
            key={agent.id}
            href={`/agents/${agent.slug}`}
            className="group flex flex-col gap-3 rounded-xl border border-line bg-surface p-5 transition hover:border-accent/40 hover:bg-surface-raised"
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-mono text-[11px] text-ink-faint">
                <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-accent" aria-hidden />
                {agentCode(agent.id)}
              </span>
              <TrustRing score={agent.trust_score} />
            </div>

            <div>
              <h2 className="font-display font-semibold">{agent.name}</h2>
              <p className="mt-1 text-sm text-ink-soft">{agent.tagline}</p>
            </div>

            <div className="mt-auto flex items-center justify-between pt-2 text-xs">
              <span className="rounded-full border border-line px-2 py-0.5 text-ink-faint">
                {categoryName(agent.category_slug)}
              </span>
              <span className="font-mono font-medium text-accent">{priceLabel(agent)}</span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
