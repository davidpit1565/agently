import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

// Before this route existed, a buyer subscribed to one specific paid agent
// had no self-service way to cancel it at all — not a portal (that's
// app/api/membership/portal/route.ts, a different Stripe customer entirely,
// reserved for the Agently membership subscription) and no button anywhere
// on the agent page. Only the platform owner, manually in the Stripe
// dashboard, could end one.
//
// Cancels at period end, not immediately — matches the policy already
// stated on app/terms/page.tsx ("cancellation stops future billing but does
// not refund the current period"): the buyer keeps access through what
// they already paid for, then it ends. The webhook's
// customer.subscription.updated/deleted handler (app/api/stripe/webhook/route.ts)
// is still what actually revokes delivery access, once Stripe's own
// subscription status leaves 'active' — this route only asks Stripe to end
// it, the same as the membership portal or a direct Stripe dashboard cancel
// would.
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

  const allowed = await checkRateLimit(`purchase_cancel:${user.id}`, 10, 60);
  if (!allowed) {
    return NextResponse.json({ error: "Too many attempts — wait a moment and try again." }, { status: 429 });
  }

  const { data: purchase, error: purchaseError } = await supabase
    .from("agently_purchases")
    .select("id, buyer_id, agent_id, status, stripe_subscription_id")
    .eq("id", purchaseId)
    .single();

  if (purchaseError || !purchase) {
    return NextResponse.json({ error: "Purchase not found." }, { status: 404 });
  }

  // Same reasoning as app/api/refunds/[purchaseId]/route.ts: RLS also lets a
  // creator SELECT purchases of their own agents, so this can't be skipped.
  if (purchase.buyer_id !== user.id) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  if (!purchase.stripe_subscription_id) {
    return NextResponse.json(
      { error: "This wasn't a subscription purchase — there's nothing to cancel." },
      { status: 400 }
    );
  }

  if (purchase.status !== "paid") {
    return NextResponse.json({ error: "This subscription is already inactive." }, { status: 409 });
  }

  const { data: agent } = await supabase.from("agently_agents").select("slug").eq("id", purchase.agent_id).single();

  const stripe = getStripe();
  try {
    await stripe.subscriptions.update(purchase.stripe_subscription_id, { cancel_at_period_end: true });
  } catch (err) {
    console.error("[purchases/cancel] Stripe cancel failed", {
      purchaseId,
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Couldn't reach Stripe to cancel — try again in a moment." }, { status: 502 });
  }

  return NextResponse.redirect(
    new URL(agent ? `/agents/${agent.slug}?canceled=1` : "/dashboard/agents?canceled=1", request.url),
    303
  );
}
