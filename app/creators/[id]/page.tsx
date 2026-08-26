import { notFound } from "next/navigation";
import { getCreatorProfile, getAgentsByCreator } from "@/lib/catalog";
import { AgentCard } from "@/app/components/agent-card";

export default async function CreatorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const creator = await getCreatorProfile(id);
  if (!creator) notFound();

  const agents = await getAgentsByCreator(id);

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <div className="mb-10 flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-line bg-surface font-display text-lg font-semibold text-accent">
          {creator.display_name.slice(0, 1).toUpperCase()}
        </div>
        <div>
          <h1 className="text-balance font-display text-2xl font-semibold">{creator.display_name}</h1>
          <p className="font-mono text-xs text-ink-faint">
            {creator.account_type === "company" ? "Company" : "Individual"} ·{" "}
            {agents.length} agent{agents.length === 1 ? "" : "s"} listed
          </p>
        </div>
      </div>

      {agents.length === 0 ? (
        <p className="text-sm text-ink-soft">Nothing listed yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}
    </main>
  );
}
