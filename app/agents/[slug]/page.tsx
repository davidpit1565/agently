import { notFound } from "next/navigation";
import type { Metadata } from "next";
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const agent = await getAgentBySlug(slug);
  // Pending/rejected listings aren't public — don't hand their title or
  // description to a crawler just because the page itself now allows the
  // owner to preview it.
  if (!agent || agent.status !== "approved") return {};

  const title = `${agent.name} — ${agent.tagline}`;
  const description = agent.problem_solved;

  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function AgentPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ purchased?: string; reviewed?: string; updated?: string }>;
}) {
  const { slug } = await params;
  const { purchased, reviewed, updated } = await searchParams;
  const agent = await getAgentBySlug(slug);
  if (!agent) notFound();

  let isOwner = false;
  let hasPurchased = false;
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    isOwner = user?.id === agent.creator_id;

    if (user && !isOwner) {
      const { data: purchase } = await supabase
        .from("purchases")
        .select("id")
        .eq("agent_id", agent.id)
        .eq("buyer_id", user.id)
        .eq("status", "paid")
        .maybeSingle();
      hasPurchased = !!purchase;
    }
  }

  // Pending or rejected listings are only visible to their own creator —
  // getAgentBySlug no longer filters by status so the creator can preview
  // one before it's approved; everyone else still gets a 404.
  if (agent.status !== "approved" && !isOwner) notFound();

  const cat = category(agent.category_slug);
  const { reviews, average, count } = await getReviewsForAgent(agent.id);
  const creator = await getCreatorProfile(agent.creator_id);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: agent.name,
    description: agent.problem_solved,
    category: cat.name,
    ...(creator && {
      brand: { "@type": "Organization", name: creator.display_name },
    }),
    ...(average !== null && count > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: average.toFixed(1),
            reviewCount: count,
          },
        }
      : {}),
    offers: {
      "@type": "Offer",
      price: ((agent.price_cents ?? 0) / 100).toFixed(2),
      priceCurrency: "EUR",
      availability: "https://schema.org/InStock",
      ...(agent.pricing_model === "subscription" && {
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          billingDuration: "P1M",
        },
      }),
    },
  };

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="flex flex-col gap-5">
        {(purchased || reviewed || updated) && (
          <div className="rounded-lg border border-accent/30 bg-accent-soft px-4 py-2.5 text-sm text-accent">
            {purchased
              ? "You got it — check the delivery link below."
              : reviewed
                ? "Thanks — your review is posted."
                : "Saved. Every buyer who owns this agent has been notified."}
          </div>
        )}
        {isOwner && agent.status !== "approved" && (
          <div className="rounded-lg border border-line bg-surface px-4 py-2.5 text-xs text-ink-soft">
            {agent.status === "rejected"
              ? "This listing didn't pass safety review — only you can see this page. "
              : "This listing is still pending safety review — only you can see this page. "}
            {agent.review_notes && (
              <span className="text-ink-faint">{agent.review_notes}</span>
            )}
          </div>
        )}
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
          <h1 className="text-balance font-display text-3xl font-semibold">{agent.name}</h1>
          <p className="mt-1 text-pretty text-lg leading-relaxed text-ink-soft">{agent.tagline}</p>
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
          <span className="rounded-full bg-accent-soft px-3 py-1 font-mono font-medium tabular-nums text-accent">
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

        {(hasPurchased || isOwner) && agent.delivery_url && (
          <div className="rounded-xl border border-accent/30 bg-accent-soft p-5">
            <h2 className="mb-2 font-display text-sm font-semibold text-accent">
              {isOwner ? "Delivery link" : "You own this — here's how to get it"}
            </h2>
            <a
              href={agent.delivery_url}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-sm text-accent underline"
            >
              {agent.delivery_url}
            </a>
          </div>
        )}

        <div className="rounded-xl border border-line bg-surface p-5">
          <h2 className="mb-2 font-display text-sm font-semibold text-accent">The problem this solves</h2>
          <p className="text-pretty text-sm leading-relaxed text-ink-soft">{agent.problem_solved}</p>
        </div>

        <div>
          <h2 className="mb-2 font-display text-sm font-semibold text-accent">What it does</h2>
          <p className="whitespace-pre-line text-pretty leading-relaxed text-ink-soft">{agent.description}</p>
        </div>

        <div className="border-t border-line pt-6">
          <div className="mb-4 flex items-center gap-3">
            <h2 className="font-display text-sm font-semibold text-accent">Reviews</h2>
            {average !== null && (
              <span className="flex items-center gap-1.5 text-xs tabular-nums text-ink-faint">
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

          {hasPurchased ? (
            <ReviewForm agentId={agent.id} />
          ) : (
            <p className="text-xs text-ink-faint">
              {isOwner
                ? "You can't review your own agent."
                : "Get this agent to leave a review — reviews are limited to people who actually used it."}
            </p>
          )}
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
