import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getMyPurchases } from "@/lib/catalog";
import { Notice } from "@/app/components/form-field";
import { Reveal } from "@/app/components/reveal";
import { formatEuros } from "@/lib/format";

// No searchParams here (unlike the sibling dashboard pages), which is the
// only thing that was implicitly forcing those into per-request rendering —
// without this, Next statically optimized this page at build time (before
// any user exists), which would have shown every visitor the same frozen
// "sign in first" render instead of their own actual purchases.
export const dynamic = "force-dynamic";

export default async function MyPurchasesPage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return (
      <Notice title="Not connected yet">
        This page needs Supabase configured before it can show what you've bought.
      </Notice>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <Notice title="Sign in first">You need an account to see what you've bought.</Notice>;
  }

  const { purchases, failed } = await getMyPurchases(user.id);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
      <div className="mb-8 animate-fade-up">
        <h1 className="text-balance mb-2 font-display text-2xl font-semibold">Your purchases</h1>
        <p className="text-sm text-ink-faint">
          Every agent you own — delivery links, files, and reviews live on each
          agent's own page.
        </p>
      </div>

      {failed ? (
        <p className="text-sm text-ink-soft">
          Couldn't load your purchases — try refreshing the page.
        </p>
      ) : purchases.length === 0 ? (
        <div className="flex animate-reveal-up flex-col items-center gap-3 rounded-2xl border border-dashed border-line py-16 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-ink-faint">
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.4">
              <path d="M10 6v4l2.5 2.5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="10" cy="10" r="7.5" />
            </svg>
          </span>
          <p className="text-sm text-ink-soft">
            Nothing yet.{" "}
            <Link href="/browse" className="text-accent underline">
              Browse the catalog
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {purchases.map(({ purchaseId, purchasedAt, amountPaidCents, agent }, i) => (
            <Reveal
              key={purchaseId}
              delay={Math.min(i, 6) * 60}
              className="group bezel-shell transition-all duration-300 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-1 hover:shadow-[0_16px_40px_-18px_rgba(47,224,173,0.22)]"
            >
              <div className="bezel-core flex flex-col gap-2 border border-line bg-surface p-4 transition-colors duration-300 group-hover:border-accent/40 group-hover:bg-surface-raised sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <Link href={`/agents/${agent.slug}`} className="font-display text-sm font-semibold hover:text-accent">
                    {agent.name}
                  </Link>
                  <p className="mt-0.5 truncate text-sm text-ink-faint">{agent.tagline}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3 font-mono text-xs text-ink-faint">
                  <span className="tabular-nums">
                    {amountPaidCents === 0 ? "Free" : `€${formatEuros(amountPaidCents)}`}
                  </span>
                  <span>·</span>
                  <span className="tabular-nums">
                    {new Date(purchasedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                  </span>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      )}
    </main>
  );
}
