import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

// Sends an existing member to Stripe's own billing portal — the correct
// place to upgrade, downgrade, switch billing interval, or cancel. Doing
// any of that through a second /api/membership/checkout call would create
// a second, separate subscription instead of changing the one they have.
export async function POST(request: Request) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.redirect(
      new URL(`/dashboard/membership?error=${encodeURIComponent("Not connected yet — Supabase isn't configured.")}`, request.url),
      303
    );
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.redirect(
      new URL(`/dashboard/membership?error=${encodeURIComponent("Not connected yet — Stripe isn't configured.")}`, request.url),
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

  // Creates a real Stripe API session on every hit — same "don't let a
  // loop burn Stripe API calls" reasoning as /api/checkout and
  // /api/membership/checkout.
  const allowed = await checkRateLimit(`membership_portal:${user.id}`, 10, 60);
  if (!allowed) {
    return NextResponse.redirect(
      new URL(`/dashboard/membership?error=${encodeURIComponent("Too many attempts — wait a moment and try again.")}`, request.url),
      303
    );
  }

  const { data: profile } = await supabase
    .from("agently_profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  if (!profile?.stripe_customer_id) {
    return NextResponse.redirect(
      new URL(`/dashboard/membership?error=${encodeURIComponent("No membership on file yet.")}`, request.url),
      303
    );
  }

  const stripe = getStripe();
  const origin = new URL(request.url).origin;

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${origin}/dashboard/agents`,
    });
    return NextResponse.redirect(session.url, 303);
  } catch (err) {
    // Same test-mode/live-mode id mismatch as app/api/stripe/connect/route.ts
    // and membership/checkout — unlike checkout, there's no "just create a
    // fresh customer" fallback here: a billing portal only makes sense for
    // a subscription that actually exists under the current key. Surface a
    // clear error instead of a raw Stripe one; membership/switch and
    // checkout both already fail gracefully (empty results, or their own
    // resource_missing handling) rather than crashing on the same stale id.
    if (err instanceof Stripe.errors.StripeInvalidRequestError && err.code === "resource_missing") {
      return NextResponse.redirect(
        new URL(
          `/dashboard/membership?error=${encodeURIComponent("Couldn't find your membership on file — this can happen right after a Stripe mode change. Contact support to sort it out.")}`,
          request.url
        ),
        303
      );
    }
    throw err;
  }
}
