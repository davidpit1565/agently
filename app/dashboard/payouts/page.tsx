import { createClient } from "@/lib/supabase/server";
import { Reveal } from "@/app/components/reveal";
import { Notice } from "@/app/components/form-field";
import { PLATFORM_FEE_PERCENT } from "@/lib/membership";

export default async function PayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ onboarded?: string }>;
}) {
  const { onboarded } = await searchParams;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return (
      <Notice title="Not connected yet">
        This page needs Supabase configured before it can show real payout status.
      </Notice>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <Notice title="Sign in first">You need an account to set up payouts.</Notice>;
  }

  const { data: profile } = await supabase
    .from("agently_profiles")
    .select("stripe_connect_id, stripe_connect_ready")
    .eq("id", user.id)
    .single();

  const ready = profile?.stripe_connect_ready ?? false;

  return (
    <main className="mx-auto max-w-lg px-6 py-16 sm:py-20">
      <div className="animate-fade-up">
        <h1 className="text-balance mb-2 font-display text-2xl font-semibold">Payouts</h1>
        <p className="mb-8 text-pretty text-sm leading-relaxed text-ink-soft">
          Every agent you sell pays through Stripe. This is where that money
          actually reaches you — {" "}
          <span className="tabular-nums text-ink">{100 - PLATFORM_FEE_PERCENT}%</span> of each sale, the rest is
          the platform fee.
        </p>
      </div>

      {onboarded && !ready && (
        <p className="mb-6 animate-fade-up rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink-soft">
          You're back from Stripe — this can take a minute to update below
          while they finish verifying your details.
        </p>
      )}

      <Reveal delay={80} className="bezel-shell">
        <div className="bezel-core border border-line bg-surface p-6">
          <div className="mb-4 flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${ready ? "animate-pulse-dot bg-accent" : "bg-ink-faint"}`}
              aria-hidden
            />
            <span className="font-mono text-sm">
              {ready ? "Payouts connected" : profile?.stripe_connect_id ? "Onboarding started" : "Not connected"}
            </span>
          </div>

          {!ready && (
            <>
              <p className="mb-4 text-sm text-ink-soft">
                {profile?.stripe_connect_id
                  ? "Stripe needs a bit more from you to finish setup — details, bank account, or identity verification."
                  : "Takes about 5 minutes on Stripe's own form: business details, bank account, identity verification."}
              </p>
              <form action="/api/stripe/connect" method="POST">
                <button
                  type="submit"
                  className="shine-sweep magnetic-btn rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-[#04140f] transition-all duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-0.5 hover:opacity-90"
                >
                  {profile?.stripe_connect_id ? "Finish setup on Stripe" : "Connect Stripe"}
                </button>
              </form>
            </>
          )}
        </div>
      </Reveal>
    </main>
  );
}
