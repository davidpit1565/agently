import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getAgentBySlug, getCreatorProfile, recordAgentView } from "@/lib/catalog";
import { getReviewsForAgent } from "@/lib/reviews";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES_FALLBACK } from "@/data/categories";
import { agentCode } from "@/lib/agent-code";
import { TrustRing } from "@/app/components/trust-ring";
import { ReviewForm } from "@/app/components/review-form";
import { Reveal } from "@/app/components/reveal";
import { getAgentFiles, getReadmeHtml } from "@/lib/agent-files";
import { formatEuros } from "@/lib/format";
import { RefundButton } from "@/app/components/refund-button";
import { CancelSubscriptionButton } from "@/app/components/cancel-subscription-button";
import { getAcceptedTeamPurchaseId } from "@/lib/team-invites";
import { PurchaseButton } from "@/app/components/purchase-button";
import { ApproxPrice } from "@/app/components/approx-price";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
          className="text-line transition-colors duration-150"
        >
          <path d="M10 1.6l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L1.4 7.9l6-.8z" />
        </svg>
      ))}
    </span>
  );
}

function priceLabel(agent: NonNullable<Awaited<ReturnType<typeof getAgentBySlug>>>) {
  if (agent.pricing_model === "free") return "Free";
  // formatEuros, not .toFixed(0) — that rounded away the cents entirely,
  // showing a €2.50 agent as "€3" and a €9.99 one as "€10" while Stripe
  // still charged the real amount.
  const amount = formatEuros(agent.price_cents ?? 0);
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
  searchParams: Promise<{
    purchased?: string;
    reviewed?: string;
    updated?: string;
    saved?: string;
    skipped_files?: string;
    refunded?: string;
    canceled?: string;
    joined?: string;
    error?: string;
  }>;
}) {
  const { slug } = await params;
  const { purchased, reviewed, updated, saved, skipped_files: skippedFiles, refunded, canceled, joined, error } = await searchParams;
  const agent = await getAgentBySlug(slug);
  if (!agent) notFound();

  let isOwner = false;
  let hasPurchased = false;
  let canReview = false;
  let refundEligiblePurchaseId: string | null = null;
  let cancelablePurchaseId: string | null = null;
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    isOwner = user?.id === agent.creator_id;

    if (user && !isOwner) {
      const { data: purchase } = await supabase
        .from("agently_purchases")
        .select("id, created_at, delivery_accessed_at")
        .eq("agent_id", agent.id)
        .eq("buyer_id", user.id)
        .eq("status", "paid")
        .maybeSingle();
      hasPurchased = !!purchase;
      // Reviews require an actual agently_purchases row under this user's
      // own id (see the "buyers can write their own review" RLS policy in
      // supabase/schema.sql) — a team member below gets hasPurchased=true
      // for view/download access but has no such row, so canReview has to
      // stay tied to the direct purchase check, not the broader flag.
      canReview = hasPurchased;

      // Matches app/api/refunds/[purchaseId]/route.ts's own checks exactly —
      // this only decides whether to show the button, not whether a request
      // succeeds; the route re-checks everything itself. Not accessed yet
      // (see app/api/deliveries/[agentId]/route.ts) is what keeps this an
      // instant self-service refund instead of a way to download something
      // and get the money back too.
      if (purchase && agent.pricing_model === "one_time" && !purchase.delivery_accessed_at) {
        const daysSincePurchase = (Date.now() - new Date(purchase.created_at).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSincePurchase <= 7) refundEligiblePurchaseId = purchase.id;
      }
      if (purchase && agent.pricing_model === "subscription") {
        cancelablePurchaseId = purchase.id;
      }

      // Not the buyer, but maybe a teammate who accepted a seat on a still-
      // paid team purchase of this agent (lib/team-invites.ts). Only grants
      // the same view/download access a buyer gets — never refund or cancel,
      // which stay tied to whoever actually bought it.
      if (!hasPurchased) {
        const teamPurchaseId = await getAcceptedTeamPurchaseId(agent.id, user.id);
        hasPurchased = !!teamPurchaseId;
      }
    }
  }

  // Pending, rejected, or delisted listings are only visible to their own
  // creator and to a buyer who already owns it — delisting an agent (or a
  // rejected re-review) must not cut off someone who already paid for it
  // and still needs their delivery link and files. Everyone else still
  // gets a 404.
  if (agent.status !== "approved" && !isOwner && !hasPurchased) notFound();

  // Not the creator's own preview visits — those would inflate the count
  // with clicks that say nothing about buyer interest.
  if (!isOwner) recordAgentView(agent.id);

  const cat = category(agent.category_slug);
  // These four don't depend on each other — only on `agent` and the
  // hasPurchased/isOwner check already done above — so run them together
  // instead of paying for four sequential round trips on every page view.
  // The files themselves ARE the deliverable — same gate as delivery_url
  // below. Actually downloading one goes through
  // app/api/deliveries/[agentId]/route.ts (which signs the URL fresh at
  // click time and marks the purchase's delivery_accessed_at) rather than a
  // pre-signed URL rendered directly on the page — no reason to sign one for
  // every page view when most are never clicked.
  // The README is documentation, not the paid deliverable — shown to any
  // visitor, same as a README on GitHub or npm before you install anything.
  const [{ reviews, average, count }, creator, readmeHtml, files] = await Promise.all([
    getReviewsForAgent(agent.id),
    getCreatorProfile(agent.creator_id),
    getReadmeHtml(agent.id),
    hasPurchased || isOwner ? getAgentFiles(agent.id) : Promise.resolve([]),
  ]);
  const downloadableFiles = files.filter((f) => !f.is_readme);

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
    <main className="mx-auto max-w-2xl px-6 py-16 sm:py-20">
      <script
        type="application/ld+json"
        // JSON.stringify doesn't escape "</", so a listing name/description
        // containing "</script><script>..." (a creator-supplied field, only
        // LLM-reviewed for risk, never for HTML breakout) would otherwise
        // close this tag early and execute for every visitor of the page.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <div className="flex flex-col gap-5">
        {(purchased || reviewed || updated || saved || refunded || canceled || joined) && (
          <div className="animate-fade-up flex items-center gap-2 rounded-lg border border-accent/30 bg-accent-soft px-4 py-2.5 text-sm text-accent">
            {purchased && (
              <svg className="purchase-check shrink-0" width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <circle cx="9" cy="9" r="8" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
                <path d="M5.5 9.2l2.3 2.3 4.7-5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            {purchased
              ? "You got it — check the delivery link below."
              : reviewed
                ? "Thanks — your review is posted."
                : updated
                  ? "Saved as a new version. Every buyer who owns this agent has been notified, and its version-check endpoint now reports it."
                  : refunded
                    ? "Refund requested — Stripe usually returns it to your card within 5-10 business days. Access to the delivery link and files is revoked once Stripe confirms it."
                    : canceled
                      ? "Canceled — you keep access through the end of what you already paid for, then billing stops for good."
                      : joined
                        ? "You're in — check the delivery link and files below."
                        : "Saved."}
          </div>
        )}
        {error && (
          <div className="animate-shake rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
            {error}
          </div>
        )}
        {skippedFiles && (
          <div className="animate-fade-up rounded-lg border border-line bg-surface px-4 py-2.5 text-sm text-ink-soft">
            Everything else was saved, but this didn&apos;t upload: <strong>{skippedFiles}</strong> (over
            the 50MB limit, or the upload failed). Try again from the edit page.
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
        <div className="flex animate-fade-up items-center justify-between">
          <span className="flex items-center gap-1.5 font-mono text-xs text-ink-faint">
            <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-accent" aria-hidden />
            {agentCode(agent.id)}
            <span className="mx-1 text-line">·</span>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: cat.color }} aria-hidden />
            {cat.name}
            <span className="mx-1 text-line">·</span>
            <span className="tabular-nums">v{agent.version}</span>
          </span>
          <TrustRing score={agent.trust_score} />
        </div>

        <div className="animate-fade-up" style={{ animationDelay: "70ms" }}>
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

        <div className="flex animate-fade-up flex-wrap items-center gap-3 text-sm" style={{ animationDelay: "140ms" }}>
          <span className="rounded-full bg-accent-soft px-3 py-1 font-mono font-medium tabular-nums text-accent">
            {priceLabel(agent)}
          </span>
          {agent.pricing_model !== "free" && (
            <span className="font-mono text-xs tabular-nums">
              <ApproxPrice cents={agent.price_cents ?? 0} />
            </span>
          )}
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
          <Reveal className="bezel-shell">
            <div className="bezel-core border border-accent/30 bg-accent-soft p-5">
              <h2 className="mb-2 font-display text-sm font-semibold text-accent">
                {isOwner ? "Delivery link" : "You own this — here's how to get it"}
              </h2>
              <a
                href={`/api/deliveries/${agent.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-sm text-accent underline"
              >
                {agent.delivery_url}
              </a>

              {isOwner && (
                <details className="details-anim mt-4 border-t border-accent/20 pt-4">
                  <summary className="text-xs font-medium text-ink-soft">
                    Let a standalone script check for updates on its own
                  </summary>
                  <div>
                    <p className="mt-2 text-xs leading-relaxed text-ink-faint">
                      The notification above only reaches someone looking at
                      this site. If what you deliver runs on its own — a
                      script, a scheduled job — it can check{" "}
                      <code className="text-ink-soft">
                        GET /api/version/{agent.slug}
                      </code>{" "}
                      itself instead. See{" "}
                      <code className="text-ink-soft">CHECKING-FOR-UPDATES.md</code>{" "}
                      in the repo for a drop-in Python/JS snippet.
                    </p>
                  </div>
                </details>
              )}
            </div>
          </Reveal>
        )}

        {(hasPurchased || isOwner) && downloadableFiles.length > 0 && (
          <Reveal className="bezel-shell">
            <div className="bezel-core border border-line bg-surface p-5">
              <h2 className="mb-3 font-display text-sm font-semibold text-accent">Files</h2>
              <div className="flex flex-col gap-2">
                {downloadableFiles.map((f) => (
                  <a
                    key={f.id}
                    href={`/api/deliveries/${agent.id}?file=${f.id}`}
                    className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm text-ink-soft transition-all duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] hover:border-accent/50 hover:text-accent"
                  >
                    <span>{f.file_name}</span>
                    <span className="font-mono text-xs text-ink-faint">{formatSize(f.size_bytes)}</span>
                  </a>
                ))}
              </div>
            </div>
          </Reveal>
        )}

        {refundEligiblePurchaseId && (
          <Reveal className="rounded-xl border border-line bg-surface p-5">
            <h2 className="mb-2 font-display text-sm font-semibold text-accent">Not what you expected?</h2>
            <p className="mb-3 text-pretty text-sm leading-relaxed text-ink-soft">
              One-time purchases are refundable within 7 days if the agent
              doesn&apos;t work as described. Requesting one revokes your
              access to the delivery link and files once Stripe confirms it.
            </p>
            <RefundButton purchaseId={refundEligiblePurchaseId} />
          </Reveal>
        )}

        {cancelablePurchaseId && (
          <Reveal className="rounded-xl border border-line bg-surface p-5">
            <h2 className="mb-2 font-display text-sm font-semibold text-accent">Subscription</h2>
            <p className="mb-3 text-pretty text-sm leading-relaxed text-ink-soft">
              Canceling stops future billing — you keep access through the
              end of what you&apos;ve already paid for, not refunded early.
            </p>
            <CancelSubscriptionButton purchaseId={cancelablePurchaseId} />
          </Reveal>
        )}

        <Reveal className="rounded-xl border border-line bg-surface p-5">
          <h2 className="mb-2 font-display text-sm font-semibold text-accent">The problem this solves</h2>
          <p className="text-pretty text-sm leading-relaxed text-ink-soft">{agent.problem_solved}</p>
        </Reveal>

        <Reveal delay={80}>
          <h2 className="mb-2 font-display text-sm font-semibold text-accent">What it does</h2>
          <p className="whitespace-pre-line text-pretty leading-relaxed text-ink-soft">{agent.description}</p>
        </Reveal>

        {readmeHtml && (
          <Reveal className="rounded-xl border border-line bg-surface p-5">
            <h2 className="mb-3 font-display text-sm font-semibold text-accent">README</h2>
            <div
              className="prose prose-sm max-w-none text-ink-soft [&_a]:text-accent [&_code]:text-ink [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-surface-raised [&_pre]:p-3"
              dangerouslySetInnerHTML={{ __html: readmeHtml }}
            />
          </Reveal>
        )}

        <Reveal className="border-t border-line pt-6">
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

          {canReview ? (
            <ReviewForm agentId={agent.id} />
          ) : (
            <p className="text-xs text-ink-faint">
              {isOwner
                ? "You can't review your own agent."
                : hasPurchased
                  ? "Reviews are limited to whoever bought the agent — not a teammate on a shared seat."
                  : "Get this agent to leave a review — reviews are limited to people who actually used it."}
            </p>
          )}
        </Reveal>

        {/* /api/checkout unconditionally 403s a creator buying their own
            listing, and (separately) an already-owned one-time or free
            agent — the plain-HTML-form POST means either error renders as
            a raw JSON body in the browser instead of a friendly message.
            Hiding the button for the owner, or for a buyer who already
            holds a 'paid' purchase, avoids that dead end entirely — the
            delivery link/files section above already covers what a buyer
            who owns this needs to do next. A canceled subscription's
            hasPurchased is false again, so resubscribing still shows Buy. */}
        {!isOwner && !hasPurchased && (
          <form action="/api/checkout" method="POST" className="flex flex-col gap-3 pt-4">
            <input type="hidden" name="agentId" value={agent.id} />
            <PurchaseButton pricingModel={agent.pricing_model} basePriceCents={agent.price_cents ?? 0} baseLabel={priceLabel(agent)} />
          </form>
        )}
      </div>
    </main>
  );
}
