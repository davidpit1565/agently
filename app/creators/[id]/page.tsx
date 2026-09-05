import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCreatorProfile, getAgentsByCreator } from "@/lib/catalog";
import { AgentCard } from "@/app/components/agent-card";
import { Reveal } from "@/app/components/reveal";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const creator = await getCreatorProfile(id);
  if (!creator) return {};

  const title = `${creator.display_name} on Agently`;
  const description = `Agents listed by ${creator.display_name} — safety-reviewed before they're for sale.`;

  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function CreatorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const creator = await getCreatorProfile(id);
  if (!creator) notFound();

  const { agents, failed } = await getAgentsByCreator(id);

  return (
    <main className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
      <Reveal className="mb-10 flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-line bg-surface font-display text-lg font-semibold text-accent shadow-[inset_0_1px_0_0_rgba(237,243,238,0.05)]">
          {creator.display_name.slice(0, 1).toUpperCase()}
        </div>
        <div>
          <h1 className="text-balance font-display text-2xl font-semibold">{creator.display_name}</h1>
          <p className="font-mono text-xs text-ink-faint">
            {creator.account_type === "company" ? "Company" : "Individual"} ·{" "}
            {agents.length} agent{agents.length === 1 ? "" : "s"} listed
          </p>
        </div>
      </Reveal>

      {(creator.bio || creator.website_url) && (
        <Reveal delay={70} className="mb-10 flex flex-col gap-2 border-b border-line pb-8">
          {creator.bio && <p className="max-w-2xl text-pretty leading-relaxed text-ink-soft">{creator.bio}</p>}
          {creator.website_url && (
            <a
              href={creator.website_url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="w-fit text-sm text-accent transition-colors duration-200 hover:underline"
            >
              {creator.website_url.replace(/^https?:\/\//, "")}
            </a>
          )}
        </Reveal>
      )}

      {failed ? (
        <p className="text-sm text-ink-soft">Couldn't load this creator's listings — try refreshing the page.</p>
      ) : agents.length === 0 ? (
        <p className="text-sm text-ink-soft">Nothing listed yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent, i) => (
            <Reveal key={agent.id} delay={Math.min(i, 8) * 60}>
              <AgentCard agent={agent} />
            </Reveal>
          ))}
        </div>
      )}
    </main>
  );
}
