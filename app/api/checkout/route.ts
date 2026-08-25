import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { PLATFORM_FEE_PERCENT } from "@/lib/membership";

// Creates a Stripe Checkout session for a single agent purchase.
// Uses Stripe Connect `application_fee_amount` so the platform's cut
// (report ch. 6) is taken automatically at the moment of payment —
// requires the creator to have completed Stripe Connect onboarding first.
export async function POST(request: Request) {
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
    .from("agents")
    .select("*, profiles!agents_creator_id_fkey(stripe_customer_id)")
    .eq("id", agentId)
    .single();

  if (!agent || agent.pricing_model === "free" || !agent.price_cents) {
    return NextResponse.json({ error: "This agent isn't purchasable through checkout." }, { status: 400 });
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
      agent.pricing_model === "one_time" ? { application_fee_amount: platformFee } : undefined,
    success_url: `${origin}/agents/${agent.slug}?purchased=1`,
    cancel_url: `${origin}/agents/${agent.slug}`,
    metadata: { agent_id: agent.id, buyer_id: user.id },
  });

  return NextResponse.redirect(session.url!, 303);
}
