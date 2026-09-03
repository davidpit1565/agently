import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MEMBERSHIP_TIERS } from "@/lib/membership";
import { Notice } from "@/app/components/form-field";
import { SubmitButton } from "@/app/components/submit-button";
import { Reveal } from "@/app/components/reveal";
import type { MembershipTier } from "@/lib/types";

// Every other Supabase-backed dashboard page here forces dynamic rendering
// as a side effect of taking a `searchParams` prop — this one doesn't need
// one, and without this it built as a static page (confirmed in the actual
// build output), meaning every visitor would get one frozen snapshot of
// whichever session happened to be resolved at build time instead of their
// own membership data.
export const dynamic = "force-dynamic";

// A dedicated stop before Stripe's own portal, which the old direct
// "Manage or cancel" button skipped entirely — someone about to cancel never
// saw what they'd actually be giving up, or that dropping a tier (not
// canceling outright) might cover what they need. Every number here comes
// from lib/membership.ts and this account's real listing count — no
// invented urgency, no hidden or relabeled cancel path. Stripe's own portal
// (linked below, same as before) is still exactly one click away and does
// the actual canceling; this page only adds context before that click.
export default async function ManageMembershipPage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return (
      <Notice title="Not connected yet">
        This page needs Supabase configured before it can show real membership status.
      </Notice>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <Notice title="Sign in first">You need an account to manage a membership.</Notice>;
  }

  const { data: profile } = await supabase
    .from("agently_profiles")
    .select("membership_tier, membership_status")
    .eq("id", user.id)
    .single();

  const tier = profile?.membership_tier as MembershipTier | undefined;

  if (profile?.membership_status !== "active" || !tier || tier === "free") {
    return (
      <main className="mx-auto max-w-lg px-6 py-16 sm:py-20">
        <Notice title="No active membership">
          There's nothing to manage — see <Link href="/pricing" className="underline">/pricing</Link> to join one.
        </Notice>
      </main>
    );
  }

  const { count: activeListings } = await supabase
    .from("agently_agents")
    .select("id", { count: "exact", head: true })
    .eq("creator_id", user.id)
    .in("status", ["pending_review", "approved"]);

  const usedListings = activeListings ?? 0;
  const config = MEMBERSHIP_TIERS[tier];
  const lowerTiers = (Object.keys(MEMBERSHIP_TIERS) as Exclude<MembershipTier, "free">[]).filter(
    (t) => MEMBERSHIP_TIERS[t].monthlyPriceCents < config.monthlyPriceCents
  );
  // Only ever offer a tier this account's real listing count still fits —
  // suggesting a downgrade that would immediately block them from their own
  // existing listings isn't a real alternative, it's just a worse cancel.
  const downgradeTarget = [...lowerTiers]
    .sort((a, b) => MEMBERSHIP_TIERS[b].monthlyPriceCents - MEMBERSHIP_TIERS[a].monthlyPriceCents)
    .find((t) => MEMBERSHIP_TIERS[t].maxActiveListings >= usedListings);

  return (
    <main className="mx-auto max-w-lg px-6 py-16 sm:py-20">
      <div className="animate-fade-up">
        <h1 className="text-balance mb-2 font-display text-2xl font-semibold">Manage your membership</h1>
        <p className="mb-8 text-pretty text-sm leading-relaxed text-ink-soft">
          You're on <span className="text-ink">{config.name}</span> —{" "}
          <span className="tabular-nums text-ink">{usedListings}</span> of{" "}
          <span className="tabular-nums text-ink">{config.maxActiveListings}</span> active listings used.
        </p>
      </div>

      <Reveal delay={80} className="bezel-shell mb-4">
        <div className="bezel-core border border-line bg-surface p-6">
          <p className="mb-1 text-sm font-medium text-ink">If you cancel</p>
          <p className="text-sm leading-relaxed text-ink-soft">
            Your {usedListings > 0 ? `${usedListings} existing listing${usedListings === 1 ? "" : "s"} stay${usedListings === 1 ? "s" : ""} live and sellable` : "listings stay live and sellable"} — you just won't be able to list new ones until you rejoin a plan. Billing stops; the current period isn't refunded.
          </p>
        </div>
      </Reveal>

      {downgradeTarget && (
        <Reveal delay={140} className="bezel-shell mb-4">
          <div className="bezel-core border border-accent/30 bg-accent-soft p-6">
            <p className="mb-1 text-sm font-medium text-accent">Or just switch down</p>
            <p className="mb-4 text-sm leading-relaxed text-ink-soft">
              {MEMBERSHIP_TIERS[downgradeTarget].name} covers your {usedListings} listing
              {usedListings === 1 ? "" : "s"} for €{(MEMBERSHIP_TIERS[downgradeTarget].monthlyPriceCents / 100).toFixed(0)}/month — Stripe prorates the difference automatically, no separate checkout.
            </p>
            <form action="/api/membership/switch" method="POST">
              <input type="hidden" name="tier" value={downgradeTarget} />
              <input type="hidden" name="interval" value="monthly" />
              <SubmitButton
                pendingText="Switching…"
                className="shine-sweep magnetic-btn w-full rounded-full bg-accent px-4 py-2.5 text-center text-sm font-medium text-[#04140f] transition-all duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-0.5 hover:opacity-90"
              >
                Switch to {MEMBERSHIP_TIERS[downgradeTarget].name} instead
              </SubmitButton>
            </form>
          </div>
        </Reveal>
      )}

      <form action="/api/membership/portal" method="POST">
        <SubmitButton
          pendingText="Redirecting to Stripe…"
          className="w-full rounded-full border border-line px-4 py-2.5 text-center text-sm text-ink-soft hover:border-accent/50 hover:text-ink"
        >
          Continue to Stripe to manage or cancel
        </SubmitButton>
      </form>
    </main>
  );
}
