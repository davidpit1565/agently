import { notFound } from "next/navigation";
import { getAgentBySlug } from "@/lib/catalog";
import { CATEGORIES_FALLBACK } from "@/data/categories";
import { agentCode } from "@/lib/agent-code";
import { TrustRing } from "@/app/components/trust-ring";

function priceLabel(agent: NonNullable<Awaited<ReturnType<typeof getAgentBySlug>>>) {
  if (agent.pricing_model === "free") return "Free";
  const amount = ((agent.price_cents ?? 0) / 100).toFixed(0);
  return agent.pricing_model === "subscription" ? `€${amount} / month` : `€${amount} one-time`;
}

function category(slug: string) {
  return CATEGORIES_FALLBACK.find((c) => c.slug === slug) ?? CATEGORIES_FALLBACK[CATEGORIES_FALLBACK.length - 1];
}

export default async function AgentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const agent = await getAgentBySlug(slug);
  if (!agent) notFound();
  const cat = category(agent.category_slug);

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-mono text-xs text-ink-faint">
            <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-accent" aria-hidden />
            {agentCode(agent.id)}
            <span className="mx-1 text-line">·</span>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: cat.color }} aria-hidden />
            {cat.name}
          </span>
          <TrustRing score={agent.trust_score} />
        </div>

        <div>
          <h1 className="font-display text-3xl font-semibold">{agent.name}</h1>
          <p className="mt-1 text-lg text-ink-soft">{agent.tagline}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="rounded-full bg-accent-soft px-3 py-1 font-mono font-medium text-accent">
            {priceLabel(agent)}
          </span>
          {agent.status === "approved" && (
            <span className="text-ink-faint">Safety-reviewed ✓</span>
          )}
        </div>

        <div className="rounded-xl border border-line bg-surface p-5">
          <h2 className="mb-2 font-display text-sm font-semibold text-accent">The problem this solves</h2>
          <p className="text-sm text-ink-soft">{agent.problem_solved}</p>
        </div>

        <div>
          <h2 className="mb-2 font-display text-sm font-semibold text-accent">What it does</h2>
          <p className="whitespace-pre-line text-ink-soft">{agent.description}</p>
        </div>

        <form action="/api/checkout" method="POST" className="pt-4">
          <input type="hidden" name="agentId" value={agent.id} />
          <button
            type="submit"
            className="rounded-full bg-accent px-6 py-3 text-sm font-medium text-[#04140f] hover:opacity-90"
          >
            {agent.pricing_model === "free" ? "Get this agent" : `Buy — ${priceLabel(agent)}`}
          </button>
        </form>
      </div>
    </main>
  );
}
