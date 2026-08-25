import { MEMBERSHIP_TIERS } from "@/lib/membership";

const TIER_ORDER = ["basic", "pro", "professional"] as const;

const TIER_COPY: Record<(typeof TIER_ORDER)[number], { blurb: string }> = {
  basic: { blurb: "For your first agents. List up to 3 at a time." },
  pro: { blurb: "For creators publishing regularly. List up to 15 at a time." },
  professional: { blurb: "For teams and companies running a full catalog." },
};

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <div className="mb-10 flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Membership</h1>
        <p className="max-w-xl text-ink/60">
          Browsing and buying is always free. A membership is what lets you{" "}
          <strong className="text-ink">list</strong> your own agents — it's a
          quality filter as much as a plan. Prices below are early and will
          move once we have real usage data; existing members keep their rate.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        {TIER_ORDER.map((tier) => {
          const config = MEMBERSHIP_TIERS[tier];
          return (
            <div key={tier} className="flex flex-col gap-3 rounded-xl border border-ink/10 bg-white/60 p-6">
              <h2 className="text-lg font-semibold">{config.name}</h2>
              <p className="text-sm text-ink/60">{TIER_COPY[tier].blurb}</p>
              <div className="mt-2">
                <span className="text-2xl font-semibold">€{(config.monthlyPriceCents / 100).toFixed(0)}</span>
                <span className="text-ink/50"> / month</span>
              </div>
              <p className="text-xs text-ink/50">
                or €{(config.yearlyPriceCents / 100).toFixed(0)} / year
              </p>
              <p className="mt-2 text-sm text-ink/70">Up to {config.maxActiveListings} active listings</p>
              <button
                type="button"
                disabled
                className="mt-4 rounded-full border border-ink/15 px-4 py-2 text-sm font-medium text-ink/40"
                title="Sign in first — checkout wiring lands with real Stripe keys"
              >
                Sign in to join
              </button>
            </div>
          );
        })}
      </div>

      <p className="mt-10 text-sm text-ink/50">
        Platform fee on every sale: 15% — separate from membership, and only
        charged when an agent actually sells.
      </p>
    </main>
  );
}
