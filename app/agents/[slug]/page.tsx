import { notFound } from "next/navigation";
import Link from "next/link";
import { getAgentBySlug, getCreatorProfile } from "@/lib/catalog";
import { getReviewsForAgent } from "@/lib/reviews";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES_FALLBACK } from "@/data/categories";
import { agentCode } from "@/lib/agent-code";
import { TrustRing } from "@/app/components/trust-ring";
import { ReviewForm } from "@/app/components/review-form";

function Stars({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${value.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg
          key={n}
          viewBox="0 0 20 20"
          width="14"
          height="14"
          fill={n <= Math.round(value) ? "#2fe0ad" : "none"}
          stroke={n <= Math.round(value) ? "#2fe0ad" : "currentColor"}
          strokeWidth="1.3"
          className="text-line"
        >
          <path d="M10 1.6l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L1.4 7.9l6-.8z" />
        </svg>
      ))}
    </span>
  );
}

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
  const { reviews, average, count } = await getReviewsForAgent(agent.id);
  const creator = await getCreatorProfile(agent.creator_id);

  let isOwner = false;
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    isOwner = user?.id === agent.creator_id;
  }

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
          {creator && (
            <Link
              href={`/creators/${creator.id}`}
              className="mt-2 inline-block text-sm text-ink-faint hover:text-accent"
            >
              by {creator.display_name}
            </Link>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="rounded-full bg-accent-soft px-3 py-1 font-mono font-medium text-accent">
            {priceLabel(agent)}
          </span>
          {agent.status === "approved" && (
            <span className="text-ink-faint">Safety-reviewed ✓</span>
          )}
          {isOwner && (
            <Link
              href={`/dashboard/agents/${agent.id}/edit`}
              className="rounded-full border border-line px-3 py-1 text-xs text-ink-faint hover:border-accent/50 hover:text-accent"
            >
              Edit listing
            </Link>
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

        <div className="border-t border-line pt-6">
          <div className="mb-4 flex items-center gap-3">
            <h2 className="font-display text-sm font-semibold text-accent">Reviews</h2>
            {average !== null && (
              <span className="flex items-center gap-1.5 text-xs text-ink-faint">
                <Stars value={average} />
                {average.toFixed(1)} · {count} review{count === 1 ? "" : "s"}
              </span>
            )}
          </div>

          {reviews.length > 0 && (
            <div className="mb-5 flex flex-col gap-3">
              {reviews.map((r) => (
                <div key={r.id} className="rounded-lg border border-line bg-surface p-4">
                  <Stars value={r.rating} />
                  {r.comment && <p className="mt-2 text-sm text-ink-soft">{r.comment}</p>}
                </div>
              ))}
            </div>
          )}

          <ReviewForm agentId={agent.id} />
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
