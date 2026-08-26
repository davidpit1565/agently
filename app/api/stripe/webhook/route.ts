import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

// Point this route at Stripe's dashboard (or `stripe listen` locally) once
// STRIPE_WEBHOOK_SECRET is set. Handles both one-time agent purchases and
// membership subscription events.
//
// Uses the service-role admin client, not the cookie-based one: Stripe calls
// this server-to-server with no user session, so auth.uid() is null and
// every RLS policy in schema.sql would reject these writes otherwise —
// meaning a real card charge would succeed on Stripe's side while the
// purchase row (and the connect/subscription status updates below) silently
// never got written.
export async function POST(request: Request) {
  const stripe = getStripe();
  const signature = request.headers.get("stripe-signature");
  const body = await request.text();

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return NextResponse.json({ error: `Signature verification failed: ${err}` }, { status: 400 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY not configured" }, { status: 500 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as {
        id: string;
        amount_total: number | null;
        customer: string | null;
        metadata: Record<string, string>;
      };
      const { agent_id, buyer_id, user_id, membership_tier } = session.metadata ?? {};

      if (agent_id && buyer_id) {
        await supabase.from("purchases").insert({
          agent_id,
          buyer_id,
          stripe_checkout_session_id: session.id,
          amount_cents: session.amount_total ?? 0,
          platform_fee_cents: Math.round((session.amount_total ?? 0) * 0.15),
          status: "paid",
        });
      } else if (user_id && membership_tier) {
        await supabase
          .from("profiles")
          .update({
            membership_tier,
            membership_status: "active",
            stripe_customer_id: session.customer,
          })
          .eq("id", user_id);
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      // A subscription can be either an Agently membership or a buyer's
      // subscription to one specific paid agent (agent.pricing_model ===
      // 'subscription') — both fire this same event type. Only the former
      // should ever touch profiles.membership_tier/status; without this
      // check, canceling a $19/mo agent would wrongly reset an unrelated
      // membership back to 'free' for anyone who happened to also be a
      // paying member. subscription_data.metadata (set at checkout time in
      // app/api/membership/checkout and app/api/checkout) is what tells
      // the two apart here.
      const subscription = event.data.object as {
        customer: string;
        status: string;
        metadata: Record<string, string>;
      };
      const { membership_tier } = subscription.metadata ?? {};
      if (!membership_tier) break;

      // membership_tier drives canUpload() (lib/membership.ts) — it isn't
      // enough to just flip membership_status to 'canceled' here, or a
      // lapsed subscription would keep uploading forever with whatever
      // tier it last had. Reset the tier itself back to 'free' the moment
      // the subscription stops being active.
      const active = subscription.status === "active";
      await supabase
        .from("profiles")
        .update({
          membership_status: active ? "active" : "canceled",
          ...(active ? {} : { membership_tier: "free" }),
        })
        .eq("stripe_customer_id", subscription.customer);
      break;
    }
    case "account.updated": {
      // Fires as a creator moves through Stripe's onboarding form. Only
      // charges_enabled means Stripe will actually let money reach them —
      // details_submitted alone can still mean "pending verification".
      const account = event.data.object as { id: string; charges_enabled: boolean };
      await supabase
        .from("profiles")
        .update({ stripe_connect_ready: account.charges_enabled })
        .eq("stripe_connect_id", account.id);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
