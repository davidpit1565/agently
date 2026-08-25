import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

// Point this route at Stripe's dashboard (or `stripe listen` locally) once
// STRIPE_WEBHOOK_SECRET is set. Handles both one-time agent purchases and
// membership subscription events.
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

  const supabase = await createClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as { id: string; amount_total: number | null; metadata: Record<string, string> };
      const { agent_id, buyer_id } = session.metadata ?? {};
      if (agent_id && buyer_id) {
        await supabase.from("purchases").insert({
          agent_id,
          buyer_id,
          stripe_checkout_session_id: session.id,
          amount_cents: session.amount_total ?? 0,
          platform_fee_cents: Math.round((session.amount_total ?? 0) * 0.15),
          status: "paid",
        });
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as { customer: string; status: string };
      await supabase
        .from("profiles")
        .update({
          membership_status: subscription.status === "active" ? "active" : "canceled",
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
