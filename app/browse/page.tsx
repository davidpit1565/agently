import Link from "next/link";
import { getApprovedAgents } from "@/lib/catalog";

function priceLabel(agent: Awaited<ReturnType<typeof getApprovedAgents>>[number]) {
  if (agent.pricing_model === "free") return "Free";
  const amount = ((agent.price_cents ?? 0) / 100).toFixed(0);
  return agent.pricing_model === "subscription" ? `€${amount}/mo` : `€${amount} once`;
}

export default async function BrowsePage() {
  const agents = await getApprovedAgents();

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <div className="mb-10 flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Browse agents</h1>
        <p className="text-ink/60">
          {agents.length} agent{agents.length === 1 ? "" : "s"} in the catalog, sorted newest first.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent) => (
          <Link
            key={agent.id}
            href={`/agents/${agent.slug}`}
            className="flex flex-col gap-3 rounded-xl border border-ink/10 bg-white/60 p-5 transition hover:border-accent/40"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-semibold">{agent.name}</h2>
              <span className="shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                {priceLabel(agent)}
              </span>
            </div>
            <p className="text-sm text-ink/70">{agent.tagline}</p>
            <div className="mt-auto flex items-center gap-2 text-xs text-ink/50">
              <span>Trust score</span>
              <span className="font-mono font-semibold text-ink/70">{agent.trust_score}</span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
