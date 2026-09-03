import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

// Self-service refunds for one-time purchases, matching the window already
// promised in app/terms/page.tsx ("within 7 days... doesn't work as
// described") — until now the only way to actually get one was emailing
// support and waiting for a manual Stripe-dashboard refund. This route does
// the Stripe side directly; it deliberately does NOT touch agently_purchases
// itself. app/api/stripe/webhook/route.ts's charge.refunded handler is the
// one place that flips a purchase to status='refunded' and revokes delivery
// access, regardless of whether the refund was triggered here, from the
// Stripe dashboard, or by a dispute — one source of truth instead of two
// paths that could disagree.
const REFUND_WINDOW_DAYS = 7;

export async function POST(request: Request, { params }: { params: Promise<{ purchaseId: string }> }) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ error: "Not connected yet — Supabase isn't configured." }, { status: 503 });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Not connected yet — Stripe isn't configured." }, { status: 503 });
  }

  const { purchaseId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/auth/sign-in", request.url));
  }

  // Real Stripe API calls (a session retrieve, a refund) on every hit —
  // same "don't let a signed-in account loop this for free" reasoning as
  // every other Stripe-calling route here.
  const allowed = await checkRateLimit(`refund:${user.id}`, 5, 3600);
  if (!allowed) {
    return NextResponse.json({ error: "Too many refund attempts — wait a moment and try again." }, { status: 429 });
  }

  const { data: purchase, error: purchaseError } = await supabase
    .from("agently_purchases")
    .select("id, buyer_id, agent_id, status, created_at, stripe_checkout_session_id, delivery_accessed_at")
    .eq("id", purchaseId)
    .single();

  if (purchaseError || !purchase) {
    return NextResponse.json({ error: "Purchase not found." }, { status: 404 });
  }

  // RLS on agently_purchases also lets a creator SELECT purchases of their
  // own agents (so notifyBuyersOfUpdate can find who to notify) — without
  // this explicit check, a creator could pass a buyer's purchase id for
  // their own agent and trigger a refund the buyer never asked for.
  if (purchase.buyer_id !== user.id) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const { data: agent } = await supabase
    .from("agently_agents")
    .select("pricing_model, slug")
    .eq("id", purchase.agent_id)
    .single();

  if (!agent) {
    return NextResponse.json({ error: "This agent no longer exists." }, { status: 404 });
  }

  // Matches app/terms/page.tsx's Refunds section: subscriptions (both an
  // Agently membership and a per-agent one) are handled by canceling —
  // future billing stops, the current period isn't refunded. Only a
  // one-time purchase gets a real refund here.
  if (agent.pricing_model !== "one_time") {
    return NextResponse.json(
      {
        error:
          "Subscriptions aren't refunded through this — cancel it from your dashboard to stop future billing instead.",
      },
      { status: 400 }
    );
  }

  if (purchase.status !== "paid") {
    return NextResponse.json(
      { error: "This purchase isn't eligible for a refund (already refunded, or never completed)." },
      { status: 409 }
    );
  }

  // The delivery link and every downloadable file now go through
  // app/api/deliveries/[agentId]/route.ts, which sets this the first time
  // they're actually retrieved. Refusing self-service once it's set closes
  // the obvious abuse this would otherwise open: download a one-time
  // purchase, then instantly refund it and keep both. A real dispute after
  // legitimately trying the product still has the email/creator-contact
  // path in app/terms/page.tsx, which goes to a human instead of an
  // automatic Stripe refund.
  if (purchase.delivery_accessed_at) {
    return NextResponse.json(
      {
        error:
          "You've already accessed the delivery link or files for this purchase, so it isn't eligible for an automatic refund. Contact the creator directly, or email support, to work it out.",
      },
      { status: 409 }
    );
  }

  const daysSincePurchase = (Date.now() - new Date(purchase.created_at).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSincePurchase > REFUND_WINDOW_DAYS) {
    return NextResponse.json(
      { error: "The 7-day refund window has passed. Contact the creator directly, or email support." },
      { status: 409 }
    );
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(purchase.stripe_checkout_session_id);
  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;

  if (!paymentIntentId) {
    return NextResponse.json({ error: "Couldn't find the original payment — email support instead." }, { status: 500 });
  }

  try {
    await stripe.refunds.create({ payment_intent: paymentIntentId });
  } catch (err) {
    if (err instanceof Stripe.errors.StripeInvalidRequestError && err.code === "charge_already_refunded") {
      return NextResponse.json({ error: "This purchase was already refunded." }, { status: 409 });
    }
    throw err;
  }

  return NextResponse.redirect(new URL(`/agents/${agent.slug}?refunded=1`, request.url), 303);
}
