import type { Metadata } from "next";
import Link from "next/link";
import { MEMBERSHIP_TIERS } from "@/lib/membership";
import { createClient } from "@/lib/supabase/server";
import { Reveal } from "@/app/components/reveal";
import { SubmitButton } from "@/app/components/submit-button";

const TIER_ORDER = ["basic", "pro", "professional"] as const;

const TIER_COPY: Record<(typeof TIER_ORDER)[number], { blurb: string }> = {
  basic: { blurb: "For your first agents. List up to 3 at a time." },
  pro: { blurb: "For creators publishing regularly. List up to 15 at a time." },
  professional: { blurb: "For teams and companies running a full catalog — plus you can request a custom agent built for you." },
};

const title = "Membership — Agently";
const description = "Browsing and buying is always free. A membership is what lets you list your own agents.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, type: "website" },
  twitter: { card: "summary_large_image", title, description },
};

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ switched?: string }>;
}) {
  const { switched } = await searchParams;
  let signedIn = false;
  let currentTier: string | null = null;
  let hasActiveMembership = false;
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    signedIn = !!user;
    if (user) {
      const { data: profile } = await supabase
        .from("agently_profiles")
        .select("membership_tier, membership_status")
        .eq("id", user.id)
        .single();
      currentTier = profile?.membership_tier ?? null;
      hasActiveMembership = profile?.membership_status === "active";
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-16 sm:py-24">
      {switched && (
        <div className="mb-6 rounded-lg border border-accent/30 bg-accent-soft px-4 py-2.5 text-sm text-accent">
          Switched — the new rate applies with Stripe's usual proration for the rest of this billing period.
        </div>
      )}
      <Reveal className="mb-10 flex flex-col gap-3">
        <h1 className="font-display text-2xl font-semibold">Membership</h1>
        <p className="max-w-xl text-pretty leading-relaxed text-ink-soft">
          Browsing and buying is always free. A membership is what lets you{" "}
          <strong className="text-ink">list</strong> your own agents — it's a
          quality filter as much as a plan.
        </p>
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-accent/30 bg-accent-soft px-3 py-1 font-mono text-[11px] text-accent">
          <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-accent" aria-hidden />
          Early pricing — existing members keep their rate when it moves
        </span>
      </Reveal>

      <div className="grid gap-4 sm:grid-cols-3">
        {TIER_ORDER.map((tier, i) => {
          const config = MEMBERSHIP_TIERS[tier];
          const featured = tier === "pro";
          const card = (
            <Reveal
              delay={i * 100}
              className={`group flex h-full flex-col gap-3 rounded-xl border p-6 transition-all duration-300 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-1.5 ${
                featured
                  ? "border-accent/50 bg-surface-raised shadow-[0_0_0_1px_rgba(47,224,173,0.15)] hover:shadow-[0_24px_56px_-16px_rgba(47,224,173,0.4)]"
                  : "border-line bg-surface hover:border-accent/30 hover:shadow-[0_16px_40px_-18px_rgba(47,224,173,0.2)]"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-ink-faint">0{i + 1}</span>
                {featured && (
                  <span className="flex items-center gap-1.5 rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[10px] text-accent">
                    <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-accent" aria-hidden />
                    MOST COMMON
                  </span>
                )}
              </div>
              <h2 className="font-display text-lg font-semibold">{config.name}</h2>
              <p className="text-sm text-ink-soft">{TIER_COPY[tier].blurb}</p>
              <div className="mt-2">
                <span className="font-display text-2xl font-semibold tabular-nums">
                  €{(config.monthlyPriceCents / 100).toFixed(0)}
                </span>
                <span className="text-ink-faint"> / month</span>
              </div>
              <p className="font-mono text-xs tabular-nums text-ink-faint">
                or €{(config.yearlyPriceCents / 100).toFixed(0)} / year
              </p>
              <p className="mt-2 text-sm text-ink-soft">Up to {config.maxActiveListings} active listings</p>

              {hasActiveMembership && currentTier === tier ? (
                <div className="mt-4 flex flex-col gap-2">
                  <span className="rounded-full border border-accent/30 bg-accent-soft px-4 py-2 text-center text-sm font-medium text-accent">
                    Current plan
                  </span>
                  <Link
                    href="/dashboard/membership"
                    className="w-full text-center text-xs text-ink-faint underline hover:text-ink-soft"
                  >
                    Manage or cancel
                  </Link>
                </div>
              ) : hasActiveMembership ? (
                <div className="mt-4 flex gap-2">
                  <form action="/api/membership/switch" method="POST" className="flex-1">
                    <input type="hidden" name="tier" value={tier} />
                    <input type="hidden" name="interval" value="monthly" />
                    <SubmitButton
                      pendingText="Switching…"
                      className="w-full rounded-full border border-line px-4 py-2 text-center text-sm font-medium text-ink-soft hover:border-accent/50 hover:text-ink"
                    >
                      Switch from {currentTier}
                    </SubmitButton>
                  </form>
                  <form action="/api/membership/switch" method="POST">
                    <input type="hidden" name="tier" value={tier} />
                    <input type="hidden" name="interval" value="yearly" />
                    <SubmitButton
                      pendingText="Switching…"
                      title="Switch and pay yearly instead"
                      className="rounded-full border border-line px-3 py-2 text-xs text-ink-soft hover:border-accent/50 hover:text-accent"
                    >
                      Yearly
                    </SubmitButton>
                  </form>
                </div>
              ) : signedIn ? (
                <div className="mt-4 flex gap-2">
                  <form action="/api/membership/checkout" method="POST" className="flex-1">
                    <input type="hidden" name="tier" value={tier} />
                    <input type="hidden" name="interval" value="monthly" />
                    <SubmitButton
                      pendingText="Redirecting to Stripe…"
                      className="shine-sweep magnetic-btn w-full rounded-full bg-accent px-4 py-2 text-sm font-medium text-[#04140f] transition-all duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-0.5 hover:opacity-90"
                    >
                      Join monthly
                    </SubmitButton>
                  </form>
                  <form action="/api/membership/checkout" method="POST">
                    <input type="hidden" name="tier" value={tier} />
                    <input type="hidden" name="interval" value="yearly" />
                    <SubmitButton
                      pendingText="Redirecting to Stripe…"
                      title="Pay yearly instead"
                      className="rounded-full border border-line px-3 py-2 text-xs text-ink-soft hover:border-accent/50 hover:text-accent"
                    >
                      Yearly
                    </SubmitButton>
                  </form>
                </div>
              ) : (
                <a
                  href="/auth/sign-in"
                  className="mt-4 block rounded-full border border-line px-4 py-2 text-center text-sm font-medium text-ink-soft hover:border-accent/50 hover:text-ink"
                >
                  Sign in to join
                </a>
              )}
            </Reveal>
          );
          return featured ? (
            <div key={tier} className="bezel-shell">
              <div className="bezel-core h-full">{card}</div>
            </div>
          ) : (
            <div key={tier}>{card}</div>
          );
        })}
      </div>

      <p className="mt-10 font-mono text-xs text-ink-faint">
        Platform fee on every sale: 15% — separate from membership, and only
        charged when an agent actually sells.
      </p>
    </main>
  );
}
