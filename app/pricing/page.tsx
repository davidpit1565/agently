import type { Metadata } from "next";
import { MEMBERSHIP_TIERS } from "@/lib/membership";
import { createClient } from "@/lib/supabase/server";

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

export default async function PricingPage() {
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
    <main className="mx-auto max-w-4xl px-6 py-16">
      <div className="mb-10 flex flex-col gap-2">
        <h1 className="font-display text-2xl font-semibold">Membership</h1>
        <p className="max-w-xl text-pretty leading-relaxed text-ink-soft">
          Browsing and buying is always free. A membership is what lets you{" "}
          <strong className="text-ink">list</strong> your own agents — it's a
          quality filter as much as a plan. Prices below are early and will
          move once we have real usage data; existing members keep their rate.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {TIER_ORDER.map((tier, i) => {
          const config = MEMBERSHIP_TIERS[tier];
          const featured = tier === "pro";
          return (
            <div
              key={tier}
              className={`flex flex-col gap-3 rounded-xl border p-6 ${
                featured
                  ? "border-accent/50 bg-surface-raised shadow-[0_0_0_1px_rgba(47,224,173,0.15)]"
                  : "border-line bg-surface"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-ink-faint">0{i + 1}</span>
                {featured && (
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[10px] text-accent">
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
                  <form action="/api/membership/portal" method="POST">
                    <button type="submit" className="w-full text-center text-xs text-ink-faint underline hover:text-ink-soft">
                      Manage or cancel
                    </button>
                  </form>
                </div>
              ) : hasActiveMembership ? (
                <form action="/api/membership/portal" method="POST" className="mt-4">
                  <button
                    type="submit"
                    className="w-full rounded-full border border-line px-4 py-2 text-center text-sm font-medium text-ink-soft hover:border-accent/50 hover:text-ink"
                    title={`Cancel your ${currentTier} membership first, then join ${config.name}`}
                  >
                    Switch from {currentTier}
                  </button>
                </form>
              ) : signedIn ? (
                <div className="mt-4 flex gap-2">
                  <form action="/api/membership/checkout" method="POST" className="flex-1">
                    <input type="hidden" name="tier" value={tier} />
                    <input type="hidden" name="interval" value="monthly" />
                    <button
                      type="submit"
                      className="w-full rounded-full bg-accent px-4 py-2 text-sm font-medium text-[#04140f] hover:opacity-90"
                    >
                      Join monthly
                    </button>
                  </form>
                  <form action="/api/membership/checkout" method="POST">
                    <input type="hidden" name="tier" value={tier} />
                    <input type="hidden" name="interval" value="yearly" />
                    <button
                      type="submit"
                      className="rounded-full border border-line px-3 py-2 text-xs text-ink-soft hover:border-accent/50 hover:text-accent"
                      title="Pay yearly instead"
                    >
                      Yearly
                    </button>
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
            </div>
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
