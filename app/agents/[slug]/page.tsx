import { notFound } from "next/navigation";
import { getAgentBySlug } from "@/lib/catalog";

function priceLabel(agent: NonNullable<Awaited<ReturnType<typeof getAgentBySlug>>>) {
  if (agent.pricing_model === "free") return "Free";
  const amount = ((agent.price_cents ?? 0) / 100).toFixed(0);
  return agent.pricing_model === "subscription" ? `€${amount} / month` : `€${amount} one-time`;
}

export default async function AgentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const agent = await getAgentBySlug(slug);
  if (!agent) notFound();

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-semibold">{agent.name}</h1>
          <p className="mt-1 text-lg text-ink/70">{agent.tagline}</p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="rounded-full bg-accent/10 px-3 py-1 font-medium text-accent">
            {priceLabel(agent)}
          </span>
          <span className="text-ink/50">
            Trust score <span className="font-mono font-semibold text-ink/70">{agent.trust_score}</span>
          </span>
          {agent.status === "approved" && (
            <span className="text-ink/50">Safety-reviewed ✓</span>
          )}
        </div>

        <div className="rounded-xl border border-ink/10 bg-white/60 p-5">
          <h2 className="mb-2 text-sm font-semibold text-accent">The problem this solves</h2>
          <p className="text-sm text-ink/80">{agent.problem_solved}</p>
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold text-accent">What it does</h2>
          <p className="whitespace-pre-line text-ink/80">{agent.description}</p>
        </div>

        <form action="/api/checkout" method="POST" className="pt-4">
          <input type="hidden" name="agentId" value={agent.id} />
          <button
            type="submit"
            className="rounded-full bg-accent px-6 py-3 text-sm font-medium text-white hover:opacity-90"
          >
            {agent.pricing_model === "free" ? "Get this agent" : `Buy — ${priceLabel(agent)}`}
          </button>
        </form>
      </div>
    </main>
  );
}
