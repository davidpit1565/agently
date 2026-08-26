import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { MEMBERSHIP_TIERS } from "@/lib/membership";
import type { MembershipTier } from "@/lib/types";

// Creates a Stripe subscription Checkout session for a membership tier.
// The webhook's checkout.session.completed handler sets profiles.membership_tier
// once payment succeeds — this route only starts checkout, nothing here
// grants access on its own.
export async function POST(request: Request) {
  const form = await request.formData();
  const tier = String(form.get("tier")) as MembershipTier;
  const interval = form.get("interval") === "yearly" ? "yearly" : "monthly";

  if (tier === "free" || !(tier in MEMBERSHIP_TIERS)) {
    return NextResponse.json({ error: "Unknown membership tier." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/auth/sign-in", request.url));
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  const config = MEMBERSHIP_TIERS[tier];
  const amount = interval === "yearly" ? config.yearlyPriceCents : config.monthlyPriceCents;
  const stripe = getStripe();
  const origin = new URL(request.url).origin;

  const session = await stripe.checkout.sessions.create({
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
  });

  return NextResponse.redirect(session.url!, 303);
}
