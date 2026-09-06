import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { MEMBERSHIP_TIERS } from "@/lib/membership";
import { checkRateLimit } from "@/lib/rate-limit";
import type { MembershipTier } from "@/lib/types";

// Creates a Stripe subscription Checkout session for a membership tier.
// The webhook's checkout.session.completed handler sets profiles.membership_tier
// once payment succeeds — this route only starts checkout, nothing here
// grants access on its own.
export async function POST(request: Request) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.redirect(
      new URL(`/pricing?error=${encodeURIComponent("Not connected yet — Supabase isn't configured.")}`, request.url),
      303
    );
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.redirect(
      new URL(`/pricing?error=${encodeURIComponent("Not connected yet — Stripe isn't configured.")}`, request.url),
      303
    );
  }

  const form = await request.formData();
  const tier = String(form.get("tier")) as MembershipTier;
  const interval = form.get("interval") === "yearly" ? "yearly" : "monthly";

  if (tier === "free" || !(tier in MEMBERSHIP_TIERS)) {
    return NextResponse.redirect(
      new URL(`/pricing?error=${encodeURIComponent("Unknown membership tier.")}`, request.url),
      303
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/auth/sign-in", request.url));
  }

  // Real Stripe API calls on every hit — nothing else here stops a signed-in
  // account from looping this endpoint and burning Stripe API quota.
  const allowedToCheckout = await checkRateLimit(`membership_checkout:${user.id}`, 10, 60);
  if (!allowedToCheckout) {
    return NextResponse.redirect(
      new URL(`/pricing?error=${encodeURIComponent("Too many attempts — wait a moment and try again.")}`, request.url),
      303
    );
  }

  const { data: profile } = await supabase
    .from("agently_profiles")
    .select("stripe_customer_id, membership_status")
    .eq("id", user.id)
    .single();

  // Starting a second Checkout session while one subscription is already
  // active would create a second, separate subscription — Stripe has no
  // idea it's meant to replace the first one, so this would double-bill.
  // Changing or canceling an existing membership goes through the billing
  // portal instead (/api/membership/portal), which edits the one real
  // subscription rather than stacking a new one on top of it.
  if (profile?.membership_status === "active") {
    return NextResponse.redirect(
      new URL(
        `/pricing?error=${encodeURIComponent(
          "You already have an active membership — manage or change it from your dashboard instead of starting a new one."
        )}`,
        request.url
      ),
      303
    );
  }

  const config = MEMBERSHIP_TIERS[tier];
  const amount = interval === "yearly" ? config.yearlyPriceCents : config.monthlyPriceCents;
  const stripe = getStripe();
  const origin = new URL(request.url).origin;

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    ...(profile?.stripe_customer_id
      ? { customer: profile.stripe_customer_id }
      : { customer_email: user.email }),
    line_items: [
      {
        price_data: {
          currency: "eur",
          product_data: { name: `Agently ${config.name} membership` },
          unit_amount: amount,
          recurring: { interval: interval === "yearly" ? "year" : "month" },
        },
        quantity: 1,
      },
    ],
    success_url: `${origin}/dashboard/agents?membership=1`,
    cancel_url: `${origin}/pricing`,
    metadata: { user_id: user.id, membership_tier: tier },
    // Also set on the subscription itself, not just the Checkout Session —
    // customer.subscription.* webhook events carry the Subscription object,
    // not the Session, and this is what lets that handler tell "this
    // subscription is someone's Agently membership" apart from "this
    // subscription is someone's purchase of a specific paid agent" (both
    // fire the same event type otherwise).
    subscription_data: { metadata: { user_id: user.id, membership_tier: tier } },
  };

  let session;
  try {
    session = await stripe.checkout.sessions.create(sessionParams);
  } catch (err) {
    // profile.stripe_customer_id can be stale in the same way a Connect
    // account id can (see app/api/stripe/connect/route.ts): created under a
    // different Stripe key mode (test vs. live) than this request is
    // running under, so Stripe rejects it with resource_missing. Retrying
    // once without a customer id lets Stripe create a fresh one under the
    // current key from customer_email instead — the webhook's
    // checkout.session.completed handler saves whatever customer id the
    // successful session actually used, so this self-heals for next time
    // without the buyer ever seeing a raw Stripe error.
    if (
      profile?.stripe_customer_id &&
      err instanceof Stripe.errors.StripeInvalidRequestError &&
      err.code === "resource_missing"
    ) {
      const { customer: _customer, ...withoutCustomer } = sessionParams;
      session = await stripe.checkout.sessions.create({ ...withoutCustomer, customer_email: user.email });
    } else {
      throw err;
    }
  }

  return NextResponse.redirect(session.url!, 303);
}
