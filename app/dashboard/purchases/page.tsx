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

  const purchases = await getMyPurchases(user.id);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
      <div className="mb-8 animate-fade-up">
        <h1 className="text-balance mb-2 font-display text-2xl font-semibold">Your purchases</h1>
        <p className="text-sm text-ink-faint">
          Every agent you own — delivery links, files, and reviews live on each
          agent's own page.
        </p>
      </div>

      {purchases.length === 0 ? (
        <p className="text-sm text-ink-soft">
          Nothing yet.{" "}
          <Link href="/browse" className="text-accent underline">
            Browse the catalog
          </Link>
          .
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {purchases.map(({ purchaseId, purchasedAt, amountPaidCents, agent }, i) => (
            <Reveal
              key={purchaseId}
              delay={Math.min(i, 6) * 60}
              className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4 transition-all duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] hover:border-accent/30 hover:bg-surface-raised sm:flex-row sm:items-center sm:justify-between"
            >
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
            </Reveal>
          ))}
        </div>
      )}
    </main>
  );
}
