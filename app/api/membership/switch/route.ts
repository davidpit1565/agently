import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MEMBERSHIP_TIERS } from "@/lib/membership";
import type { MembershipTier } from "@/lib/types";

// Unlike Checkout Session line items (which take inline `price_data.product_data`),
// updating an existing subscription's price requires a real, persistent Stripe
// Product id — `product_data` isn't accepted there. Tagged with metadata instead
// of hardcoding an id, so this works the moment Stripe is configured, with no
// manual "go create 3 products in the dashboard first" setup step.
async function getOrCreateMembershipProductId(
  stripe: Stripe,
  tier: Exclude<MembershipTier, "free">
): Promise<string> {
  const products = await stripe.products.list({ active: true, limit: 100 });
  const existing = products.data.find((p) => p.metadata?.agently_tier === tier);
  if (existing) return existing.id;
  const created = await stripe.products.create({
    name: `Agently ${MEMBERSHIP_TIERS[tier].name} membership`,
    metadata: { agently_tier: tier },
  });
  return created.id;
}

// Upgrades or downgrades an existing membership in place, on the same
// subscription — the pricing page's "Switch from X" button used to just
// send everyone to /api/membership/portal and hope Stripe's own Customer
// Portal offered a plan-switch option. It doesn't, unless someone has
// separately created real Stripe Products/Prices for every tier and wired
// them into the portal's configuration — these tiers are only ever priced
// via inline `price_data` at checkout time, so there was nothing for the
// portal to switch between; clicking the button did nothing useful. This
// route does the switch directly against Stripe's subscription API instead,
// so it works regardless of whether that portal configuration ever happens.
export async function POST(request: Request) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ error: "Not connected yet — Supabase isn't configured." }, { status: 503 });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Not connected yet — Stripe isn't configured." }, { status: 503 });
  }

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

  const { data: profile, error: profileError } = await supabase
    .from("agently_profiles")
    .select("stripe_customer_id, membership_status")
    .eq("id", user.id)
    .single();

  if (profileError) {
    return NextResponse.json({ error: "Couldn't verify your membership — try again in a moment." }, { status: 503 });
  }

  if (profile?.membership_status !== "active" || !profile.stripe_customer_id) {
    return NextResponse.json(
      { error: "No active membership to switch — join a plan first from /pricing." },
      { status: 409 }
    );
  }

  const stripe = getStripe();

  // Membership status is per-customer, not per-subscription — there's
  // exactly one active membership subscription per customer by construction
  // (membership/checkout refuses to start a second one while active), so
  // the first result here is the one to change. Stripe rejects a customer
  // id from a different key mode (test vs. live — see
  // app/api/stripe/connect/route.ts for the same class of bug) with
  // resource_missing rather than an empty list; treat it the same as "no
  // subscription found" instead of a raw 500.
  let subscriptions;
  try {
    subscriptions = await stripe.subscriptions.list({
      customer: profile.stripe_customer_id,
      status: "active",
      limit: 1,
    });
  } catch (err) {
    if (err instanceof Stripe.errors.StripeInvalidRequestError && err.code === "resource_missing") {
      return NextResponse.json(
        { error: "Couldn't find your active subscription on Stripe — try again in a moment." },
        { status: 409 }
      );
    }
    throw err;
  }
  const subscription = subscriptions.data[0];
  const item = subscription?.items.data[0];
  if (!subscription || !item) {
    return NextResponse.json(
      { error: "Couldn't find your active subscription on Stripe — try again in a moment." },
      { status: 409 }
    );
  }

  const config = MEMBERSHIP_TIERS[tier];
  const amount = interval === "yearly" ? config.yearlyPriceCents : config.monthlyPriceCents;
  const productId = await getOrCreateMembershipProductId(stripe, tier);

  const updated = await stripe.subscriptions.update(
    subscription.id,
    {
      items: [
        {
          id: item.id,
          price_data: {
            currency: "eur",
            product: productId,
            unit_amount: amount,
            recurring: { interval: interval === "yearly" ? "year" : "month" },
          },
        },
      ],
      // A downgrade shouldn't feel like paying twice for the same month, and
      // an upgrade shouldn't feel free until the next renewal — Stripe's own
      // proration handles both directions correctly from here.
      proration_behavior: "create_prorations",
      metadata: { user_id: user.id, membership_tier: tier },
    },
    {
      // A double-click (or a resubmitted form) fires two of these requests
      // before the first one's response comes back. Without an idempotency
      // key, Stripe has no way to know the second call is the same switch
      // and not a genuinely new one — it would apply create_prorations
      // twice, invoicing the buyer for the same plan change twice. The key
      // is built from the item's *current* price id (item.price.id), which
      // both racing requests still observe unchanged (neither has completed
      // yet), so they collide on the same key and Stripe returns the first
      // call's result to both. A later, genuinely separate switch reads a
      // different current price id and gets its own key.
      idempotencyKey: `membership-switch:${user.id}:${item.id}:${item.price.id}:${tier}:${interval}`,
    }
  );

  // Update immediately rather than waiting on the customer.subscription.updated
  // webhook — Stripe's own API call above already confirms the change
  // succeeded, and a user landing back on /pricing right after switching
  // shouldn't see their old tier for however long webhook delivery takes.
  // The webhook (app/api/stripe/webhook/route.ts) still applies the same
  // update on delivery, so a retried or delayed webhook doesn't fight this.
  const admin = createAdminClient();
  if (admin) {
    await admin
      .from("agently_profiles")
      .update({ membership_tier: tier, membership_status: updated.status === "active" ? "active" : "past_due" })
      .eq("id", user.id);
  }

  return NextResponse.redirect(new URL("/pricing?switched=1", request.url), 303);
}
