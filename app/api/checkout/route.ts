import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { PLATFORM_FEE_PERCENT } from "@/lib/membership";

// Creates a Stripe Checkout session for a single agent purchase, splitting
// payment via Stripe Connect: the platform fee via `application_fee_amount`,
// the rest transferred straight to the creator's connected account via
// `transfer_data.destination`. Both fields have to be set together — one
// without the other either sends the platform nothing or the creator
// nothing. A creator who hasn't finished Stripe onboarding (/dashboard/payouts)
// has no destination account to pay out to, so checkout refuses up front
// instead of silently taking 100% of a sale with no way to pay them.
export async function POST(request: Request) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ error: "Not connected yet — Supabase isn't configured." }, { status: 503 });
  }

  const form = await request.formData();
  const agentId = String(form.get("agentId"));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/auth/sign-in", request.url));
  }

  const { data: agent } = await supabase
    .from("agently_agents")
    .select("*, profiles:agently_profiles!agently_agents_creator_id_fkey(stripe_connect_id, stripe_connect_ready)")
    .eq("id", agentId)
    .single();

  if (!agent) {
    return NextResponse.json({ error: "This agent doesn't exist." }, { status: 404 });
  }

  // Free agents skip Stripe entirely — record a zero-amount purchase so the
  // buyer shows up as owning it (unlocks reviewing it, matches paid agents'
  // "you already got this" state) and send them straight to the delivery link.
  if (agent.pricing_model === "free") {
    await supabase.from("agently_purchases").upsert(
      {
        agent_id: agent.id,
        buyer_id: user.id,
        stripe_checkout_session_id: `free_${agent.id}_${user.id}`,
        amount_cents: 0,
        platform_fee_cents: 0,
        status: "paid",
      },
      { onConflict: "stripe_checkout_session_id" }
    );
    const origin = new URL(request.url).origin;
    return NextResponse.redirect(
      agent.delivery_url || `${origin}/agents/${agent.slug}?purchased=1`,
      303
    );
  }

  if (!agent.price_cents) {
    return NextResponse.json({ error: "This agent isn't purchasable through checkout." }, { status: 400 });
  }

  // Same reasoning as membership/checkout.ts: starting a second Checkout
  // session for an agent subscription that's already active creates a
  // second, separate Stripe subscription — a double-click or a browser
  // back-button resubmit would double-bill the buyer for the same agent.
  //
  // one_time was missing this check entirely: nothing stopped a buyer who
  // already owns a one-time agent (the Buy button stays visible on
  // app/agents/[slug]/page.tsx even after hasPurchased is true) from
  // hitting this route again — a double-click, a resubmitted form, a
  // revisit — and being charged a second time for the exact same delivery
  // link, with a second agently_purchases row and no warning anywhere.
  if (agent.pricing_model === "subscription" || agent.pricing_model === "one_time") {
    const { data: existing, error: existingError } = await supabase
      .from("agently_purchases")
      .select("id")
      .eq("agent_id", agent.id)
      .eq("buyer_id", user.id)
      .eq("status", "paid")
      .limit(1)
      .maybeSingle();
    // A failed check here is not "no existing purchase" — treating it that
    // way on a transient Supabase error would let this fall through to
    // Stripe and create a second subscription, or a second charge for a
    // one-time agent, for someone who already owns it.
    if (existingError) {
      return NextResponse.json(
        { error: "Couldn't verify your existing purchases — try again in a moment." },
        { status: 503 }
      );
    }
    if (existing) {
      return NextResponse.json(
        {
          error:
            agent.pricing_model === "subscription"
              ? "You already have an active subscription to this agent."
              : "You already own this agent.",
        },
        { status: 409 }
      );
    }
  }

  const creator = agent.profiles as { stripe_connect_id: string | null; stripe_connect_ready: boolean } | null;
  if (!creator?.stripe_connect_ready || !creator.stripe_connect_id) {
    return NextResponse.json(
      { error: "This creator hasn't finished payout setup yet, so this agent can't be purchased right now." },
      { status: 409 }
    );
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Not connected yet — Stripe isn't configured." }, { status: 503 });
  }

  const stripe = getStripe();
  const platformFee = Math.round((agent.price_cents * PLATFORM_FEE_PERCENT) / 100);
  const origin = new URL(request.url).origin;

  const session = await stripe.checkout.sessions.create({
    mode: agent.pricing_model === "subscription" ? "subscription" : "payment",
    line_items: [
      {
        price_data: {
          currency: agent.currency,
          product_data: { name: agent.name },
          unit_amount: agent.price_cents,
          ...(agent.pricing_model === "subscription" ? { recurring: { interval: "month" } } : {}),
        },
        quantity: 1,
      },
    ],
    payment_intent_data:
      agent.pricing_model === "one_time"
        ? { application_fee_amount: platformFee, transfer_data: { destination: creator.stripe_connect_id } }
        : undefined,
    subscription_data:
      agent.pricing_model === "subscription"
        ? {
            application_fee_percent: PLATFORM_FEE_PERCENT,
            transfer_data: { destination: creator.stripe_connect_id },
            // The webhook's customer.subscription.* handler needs this to
            // tell "someone canceled their subscription to this agent"
            // apart from "someone canceled their Agently membership" —
            // both fire the same event type. Metadata set here (not just
            // on the Checkout Session) is what actually reaches that event,
            // since it carries the Subscription object, not the Session.
            metadata: { agent_id: agent.id, buyer_id: user.id },
          }
        : undefined,
    success_url: `${origin}/agents/${agent.slug}?purchased=1`,
    cancel_url: `${origin}/agents/${agent.slug}`,
    metadata: { agent_id: agent.id, buyer_id: user.id },
  });

  return NextResponse.redirect(session.url!, 303);
}
