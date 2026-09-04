import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyCreatorOfSale } from "@/lib/notifications";
import { createTeamInvitesAndNotify } from "@/lib/team-invites";
import { PLATFORM_FEE_PERCENT } from "@/lib/membership";

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
  const signature = request.headers.get("stripe-signature");

  // Checked before getStripe() on purpose — that throws with no
  // STRIPE_SECRET_KEY, which would turn a stray or premature POST to this
  // endpoint (before Stripe is even configured) into an unhandled 500
  // instead of the same clean 400 an unconfigured webhook already returns.
  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET || !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 400 });
  }

  const stripe = getStripe();
  const body = await request.text();

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
        subscription: string | null;
        metadata: Record<string, string>;
      };
      const { agent_id, buyer_id, user_id, membership_tier, seats: seatsRaw, team_emails } = session.metadata ?? {};
      const seats = seatsRaw ? Number(seatsRaw) : 1;

      if (agent_id && buyer_id) {
        // Stripe doesn't guarantee webhook delivery order — that's
        // documented behavior, not an edge case, especially once retries
        // are involved. For an agent *subscription* checkout, a
        // customer.subscription.deleted for this same subscription (an
        // immediate cancellation, or one racing in from a retry) can reach
        // this server before this event does. Without checking, this
        // insert would still record 'paid' even though the subscription is
        // already gone at Stripe — a buyer left with permanent access to
        // something already canceled. Reading the subscription's own
        // current status here (rather than assuming "paid" because this
        // event fired) makes the recorded outcome match Stripe's actual
        // state regardless of which webhook happened to arrive first.
        let status = "paid";
        if (session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription);
          if (subscription.status !== "active" && subscription.status !== "trialing") {
            status = "canceled";
          }
        }
        const { data: insertedPurchase, error } = await supabase
          .from("agently_purchases")
          .insert({
            agent_id,
            buyer_id,
            stripe_checkout_session_id: session.id,
            amount_cents: session.amount_total ?? 0,
            // Was a second hard-coded 0.15 — drifted from PLATFORM_FEE_PERCENT
            // the moment anyone changed the real fee, silently misreporting
            // actual platform revenue with no error anywhere.
            platform_fee_cents: Math.round((session.amount_total ?? 0) * (PLATFORM_FEE_PERCENT / 100)),
            status,
            // Only present for pricing_model 'subscription' — what
            // app/api/purchases/[purchaseId]/cancel/route.ts actually cancels.
            stripe_subscription_id: session.subscription ?? null,
            seats,
          })
          .select("id")
          .single();
        // stripe_checkout_session_id is unique, so Stripe retrying this same
        // event throws a constraint violation here — that's not a failure,
        // it's this handler already having run once; anything else means the
        // charge succeeded but the purchase row never landed, silently, with
        // no trace. Log it either way and only fail loudly (so Stripe
        // retries) on the second case.
        if (error) {
          console.error("[stripe/webhook] purchases insert failed", {
            eventId: event.id,
            agentId: agent_id,
            buyerId: buyer_id,
            code: error.code,
            message: error.message,
          });
          if (error.code !== "23505") {
            return NextResponse.json({ error: "Failed to record purchase" }, { status: 500 });
          }
          // 23505 means this exact event was already processed (a Stripe
          // retry) — the creator was already notified the first time, so
          // notifying again here would double-email them for one sale.
        } else if (status === "paid") {
          const { data: agent } = await supabase
            .from("agently_agents")
            .select("creator_id, name, currency, slug")
            .eq("id", agent_id)
            .single();
          if (agent) {
            await notifyCreatorOfSale(supabase, {
              creatorId: agent.creator_id,
              agentId: agent_id,
              agentName: agent.name,
              amountCents: session.amount_total ?? 0,
              currency: agent.currency,
            });

            if (seats > 1 && team_emails && insertedPurchase) {
              const emails = team_emails.split(",").filter(Boolean);
              await createTeamInvitesAndNotify(supabase, {
                purchaseId: insertedPurchase.id,
                agentId: agent_id,
                agentName: agent.name,
                agentSlug: agent.slug,
                emails,
              });
            }
          }
        }
      } else if (user_id && membership_tier) {
        const { error } = await supabase
          .from("agently_profiles")
          .update({
            membership_tier,
            membership_status: "active",
            stripe_customer_id: session.customer,
          })
          .eq("id", user_id);
        if (error) {
          console.error("[stripe/webhook] membership update failed", { eventId: event.id, userId: user_id, message: error.message });
          return NextResponse.json({ error: "Failed to record membership" }, { status: 500 });
        }
      }
      break;
    }
    case "charge.refunded": {
      // Without this, a refunded buyer's purchases row stays status='paid'
      // forever — app/agents/[slug]/page.tsx keeps showing them as having
      // bought it, and schema.sql's review policy keeps letting them post or
      // keep a "verified buyer" review for an agent they got their money
      // back on.
      const charge = event.data.object as { payment_intent: string | null; invoice: string | null };
      // The purchases row a refund needs to reach is keyed by whichever id
      // its insert used: the Checkout Session id for a one-time purchase or
      // a subscription's first payment, but the invoice id for every
      // renewal after that (see invoice.paid below — renewals never go
      // through Checkout, so there is no Checkout Session for
      // stripe.checkout.sessions.list to find). Looking up by
      // payment_intent alone silently missed a refund of any renewal
      // charge, leaving that row at status='paid' forever even though the
      // buyer got their money back — the buyer keeps a "verified purchase"
      // and continued file access after being refunded.
      let checkoutSessionId: string | undefined;
      if (charge.payment_intent) {
        const session = await stripe.checkout.sessions.list({ payment_intent: charge.payment_intent, limit: 1 });
        checkoutSessionId = session.data[0]?.id;
      }
      const purchaseRowId = checkoutSessionId ?? charge.invoice ?? undefined;
      if (purchaseRowId) {
        const { error } = await supabase
          .from("agently_purchases")
          .update({ status: "refunded" })
          .eq("stripe_checkout_session_id", purchaseRowId);
        if (error) {
          console.error("[stripe/webhook] refund update failed", { eventId: event.id, purchaseRowId, message: error.message });
          return NextResponse.json({ error: "Failed to record refund" }, { status: 500 });
        }
      }
      break;
    }
    case "invoice.paid": {
      // The first invoice on a new agent-subscription fires this same event
      // (billing_reason "subscription_create") — that one's already recorded
      // by checkout.session.completed above, from the Checkout Session
      // itself. Only "subscription_cycle" is a real renewal with no purchase
      // row yet; without this, every renewal after the first charges the
      // buyer and pays the creator correctly on Stripe's side but leaves no
      // trace in agently_purchases, so platform revenue reporting silently
      // undercounts every agent-subscription past its first month.
      const invoice = event.data.object as {
        id: string;
        billing_reason: string | null;
        amount_paid: number;
        subscription: string | null;
      };
      if (invoice.billing_reason === "subscription_cycle" && invoice.subscription) {
        const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
        const { agent_id, buyer_id } = (subscription.metadata ?? {}) as Record<string, string>;
        if (agent_id && buyer_id) {
          // Same out-of-order-delivery risk as checkout.session.completed
          // above, the other direction: a subscription can already be
          // canceled at Stripe by the time this renewal event is
          // processed (a redelivery, or a cancellation landing in the gap
          // between charge and webhook processing). Recording the
          // subscription's live status here — already fetched above,
          // rather than assuming "paid" purely because an invoice.paid
          // event fired — keeps the purchase row's status consistent with
          // Stripe's actual current state instead of with delivery order.
          const stillActive = subscription.status === "active" || subscription.status === "trialing";
          const { error } = await supabase.from("agently_purchases").insert({
            agent_id,
            buyer_id,
            // Invoices have no Checkout Session of their own — the invoice
            // id itself is unique per renewal, so it fills the same role
            // stripe_checkout_session_id plays for the first payment: one
            // row per real charge, and a Stripe retry of this same event
            // hits the same 23505 dedupe path as the purchase branch above.
            stripe_checkout_session_id: invoice.id,
            amount_cents: invoice.amount_paid,
            platform_fee_cents: Math.round(invoice.amount_paid * (PLATFORM_FEE_PERCENT / 100)),
            status: stillActive ? "paid" : "canceled",
          });
          if (error) {
            console.error("[stripe/webhook] renewal purchase insert failed", {
              eventId: event.id,
              agentId: agent_id,
              buyerId: buyer_id,
              code: error.code,
              message: error.message,
            });
            if (error.code !== "23505") {
              return NextResponse.json({ error: "Failed to record renewal" }, { status: 500 });
            }
            // 23505: this exact renewal was already processed and the
            // creator already notified — a Stripe retry, not a new charge.
          } else if (stillActive) {
            const { data: agent } = await supabase
              .from("agently_agents")
              .select("creator_id, name, currency")
              .eq("id", agent_id)
              .single();
            if (agent) {
              await notifyCreatorOfSale(supabase, {
                creatorId: agent.creator_id,
                agentId: agent_id,
                agentName: agent.name,
                amountCents: invoice.amount_paid,
                currency: agent.currency,
              });
            }
          }
        }
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      // A subscription can be either an Agently membership or a buyer's
      // subscription to one specific paid agent (agent.pricing_model ===
      // 'subscription') — both fire this same event type.
      // subscription_data.metadata (set at checkout time in
      // app/api/membership/checkout and app/api/checkout) is what tells
      // the two apart here; the two never overlap.
      const subscription = event.data.object as {
        id: string;
        customer: string;
        status: string;
        metadata: Record<string, string>;
      };
      const { membership_tier, agent_id, buyer_id } = subscription.metadata ?? {};
      const active = subscription.status === "active";

      if (membership_tier) {
        // Stripe doesn't guarantee webhook delivery order. Two switches in
        // quick succession (Basic -> Pro, then Pro -> Professional) fire two
        // of these events, each carrying a snapshot of the subscription as
        // it was at the moment *that* event was queued. If the older
        // event's webhook is delivered or processed after the newer one
        // (out-of-order delivery, or a retry), trusting its embedded
        // metadata here would overwrite membership_tier back to "pro" even
        // though the subscription — and the user's bill — already moved on
        // to "professional". Re-fetching the subscription live instead of
        // trusting event.data.object makes every delivery converge on
        // Stripe's actual current state, regardless of delivery order.
        const live = await stripe.subscriptions.retrieve(subscription.id);
        const liveActive = live.status === "active";
        const liveTier = live.metadata?.membership_tier;

        // membership_tier drives canUpload() (lib/membership.ts) — it isn't
        // enough to just flip membership_status to 'canceled' here, or a
        // lapsed subscription would keep uploading forever with whatever
        // tier it last had. Reset the tier itself back to 'free' the moment
        // the subscription stops being active.
        //
        // While active, this also writes membership_tier itself (not just
        // status) from the subscription's own metadata — app/api/membership/
        // switch/route.ts changes a subscription's price and metadata
        // together via stripe.subscriptions.update(), which fires this same
        // event. Previously only status was ever touched here post-checkout,
        // so a plan switch's DB write depended entirely on that route's own
        // direct update succeeding, with no webhook backstop if it didn't.
        const { error: subError } = await supabase
          .from("agently_profiles")
          .update({
            membership_status: liveActive ? "active" : "canceled",
            membership_tier: liveActive ? liveTier ?? "free" : "free",
          })
          .eq("stripe_customer_id", subscription.customer);
        if (subError) {
          console.error("[stripe/webhook] subscription status update failed", { eventId: event.id, message: subError.message });
        }
      } else if (agent_id && buyer_id && !active) {
        // A buyer canceling their subscription to one specific agent stops
        // future Stripe invoices, but without this, their existing
        // agently_purchases rows stayed status='paid' forever — the only
        // thing app/agents/[slug]/page.tsx and the file-download gate check
        // — so they kept the delivery link and every downloadable file
        // after they stopped paying. Only fires on a real end (canceled,
        // unpaid, incomplete_expired), never on an in-progress "active"
        // update (a plan change, a payment-method update).
        const { error: purchError } = await supabase
          .from("agently_purchases")
          .update({ status: "canceled" })
          .eq("agent_id", agent_id)
          .eq("buyer_id", buyer_id)
          .eq("status", "paid");
        if (purchError) {
          console.error("[stripe/webhook] agent subscription cancellation update failed", {
            eventId: event.id,
            agentId: agent_id,
            buyerId: buyer_id,
            message: purchError.message,
          });
        }
      }
      break;
    }
    case "account.updated": {
      // Fires as a creator moves through Stripe's onboarding form. Only
      // charges_enabled means Stripe will actually let money reach them —
      // details_submitted alone can still mean "pending verification".
      const account = event.data.object as { id: string; charges_enabled: boolean };
      const { error: acctError } = await supabase
        .from("agently_profiles")
        .update({ stripe_connect_ready: account.charges_enabled })
        .eq("stripe_connect_id", account.id);
      if (acctError) {
        console.error("[stripe/webhook] connect status update failed", { eventId: event.id, message: acctError.message });
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
