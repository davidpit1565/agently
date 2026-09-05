import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLATFORM_FEE_PERCENT, MIN_PLATFORM_FEE_CENTS } from "@/lib/membership";
import { checkRateLimit } from "@/lib/rate-limit";
import { MIN_TEAM_SEATS, MAX_TEAM_SEATS, teamPriceCents } from "@/lib/team-pricing";
import { isPlatformOwner } from "@/lib/owner";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  // Every call past this point either writes a purchase row or calls
  // Stripe's own API to create a real Checkout Session — a signed-in
  // account hitting this route in a loop would rack up real Stripe API
  // calls (and abandoned sessions) for no reason. Generous enough for
  // someone genuinely re-trying a purchase or buying several agents.
  const allowedToCheckout = await checkRateLimit(`checkout:${user.id}`, 20, 60);
  if (!allowedToCheckout) {
    return NextResponse.json({ error: "Too many checkout attempts — wait a moment and try again." }, { status: 429 });
  }

  const { data: agent } = await supabase
    .from("agently_agents")
    .select("*")
    .eq("id", agentId)
    .single();

  if (!agent) {
    return NextResponse.json({ error: "This agent doesn't exist." }, { status: 404 });
  }

  // app/agents/[slug]/page.tsx hides the Buy button for anything that isn't
  // 'approved' (a delisted, rejected, or still-pending listing), but that's
  // only the UI — this route is the actual place every purchase goes
  // through, and nothing here re-checked status. A delisted or rejected
  // agent's id posted directly here would otherwise still be purchasable.
  if (agent.status !== "approved") {
    return NextResponse.json({ error: "This agent isn't available for purchase." }, { status: 404 });
  }

  // A creator "buying" their own agent is free and instant for the "free"
  // pricing model, and it's exactly the setup for gaming the review system:
  // create a purchase row for yourself, then post a "verified buyer" review
  // on your own listing. Nothing about the free-claim RLS policy or the
  // review policy checks buyer_id against the agent's own creator_id, so
  // block it at the one place every purchase path (free claim and paid
  // checkout alike) goes through.
  if (agent.creator_id === user.id) {
    return NextResponse.json({ error: "You can't buy your own agent." }, { status: 403 });
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

  // Team purchase (lib/team-pricing.ts): only for a one_time agent — a
  // subscription's recurring billing has nowhere clean to attach a
  // one-time seat discount, and a free agent has no price to discount in
  // the first place. seats defaults to 1 (an ordinary purchase); anything
  // else must be a real team size with exactly that many teammate emails,
  // validated up front so a malformed request never reaches Stripe.
  const seatsRaw = form.get("seats");
  const seats = seatsRaw ? Number(seatsRaw) : 1;
  let teamEmails: string[] = [];
  if (seats !== 1) {
    if (agent.pricing_model !== "one_time") {
      return NextResponse.json({ error: "Team purchases are only available for a one-time purchase agent." }, { status: 400 });
    }
    if (!Number.isInteger(seats) || seats < MIN_TEAM_SEATS || seats > MAX_TEAM_SEATS) {
      return NextResponse.json(
        { error: `A team purchase needs between ${MIN_TEAM_SEATS} and ${MAX_TEAM_SEATS} seats.` },
        { status: 400 }
      );
    }
    teamEmails = String(form.get("team_emails") ?? "")
      .split(/[\n,]/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const uniqueEmails = [...new Set(teamEmails)];
    if (uniqueEmails.length !== teamEmails.length) {
      return NextResponse.json({ error: "Duplicate teammate email." }, { status: 400 });
    }
    if (teamEmails.length !== seats - 1) {
      return NextResponse.json(
        { error: `${seats} seats needs exactly ${seats - 1} teammate email(s) — you're already covered as one of the seats.` },
        { status: 400 }
      );
    }
    if (teamEmails.some((e) => !EMAIL_RE.test(e))) {
      return NextResponse.json({ error: "One of the teammate emails doesn't look valid." }, { status: 400 });
    }
    if (teamEmails.includes(user.email?.toLowerCase() ?? "")) {
      return NextResponse.json({ error: "You're already covered — don't include your own email in the team list." }, { status: 400 });
    }
  }

  // The platform owner gets free access to any paid agent — a deliberate
  // admin perk for the person who built and runs this marketplace, gated by
  // the same PLATFORM_OWNER_EMAIL env var every other owner-only action here
  // already uses, not something any other account can reach. Recorded as a
  // real (zero-amount) purchase row, so the owner ends up with normal buyer
  // access (delivery link, files, reviewing) exactly like a real purchase —
  // it just never touches Stripe or takes anything from the creator's
  // payout. A subscription-model agent gets a plain 'paid' row with no
  // stripe_subscription_id, since there's no real subscription behind it to
  // ever cancel or expire.
  //
  // Goes through the admin client, not the session-bound one used above for
  // the free-agent claim — the "buyers can claim free agents" RLS policy
  // only allows pricing_model = 'free', so this exact insert would be
  // silently rejected under the caller's own session for anything paid.
  if (isPlatformOwner(user.email)) {
    const admin = createAdminClient();
    if (admin) {
      await admin.from("agently_purchases").upsert(
        {
          agent_id: agent.id,
          buyer_id: user.id,
          stripe_checkout_session_id: `owner_comp_${agent.id}_${user.id}`,
          amount_cents: 0,
          platform_fee_cents: 0,
          status: "paid",
        },
        { onConflict: "stripe_checkout_session_id" }
      );
    }
    const origin = new URL(request.url).origin;
    return NextResponse.redirect(
      agent.delivery_url || `${origin}/agents/${agent.slug}?purchased=1`,
      303
    );
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

  // Goes through the admin client, not the buyer's own session — the
  // "profiles are self-readable" RLS policy (auth.uid() = id) only lets a
  // signed-in user read their own agently_profiles row. A buyer's session
  // reading the *creator's* stripe_connect_ready/stripe_connect_id here
  // would always come back null (not "not ready" — genuinely unreadable),
  // which is what made every real checkout by any buyer, for any paid
  // agent, fail with "hasn't finished payout setup" regardless of whether
  // the creator actually had — this was never a per-agent problem.
  const checkoutAdmin = createAdminClient();
  const { data: creator } = checkoutAdmin
    ? await checkoutAdmin
        .from("agently_profiles")
        .select("stripe_connect_id, stripe_connect_ready")
        .eq("id", agent.creator_id)
        .single()
    : { data: null };
  if (!checkoutAdmin) {
    return NextResponse.json({ error: "Not connected yet — Supabase isn't configured." }, { status: 503 });
  }
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
  // The total charged amount for a team purchase — rounded once on the
  // total (lib/team-pricing.ts), not per seat, so what's charged matches
  // what displaying it as one number implies. A quantity-of-seats line item
  // with a per-seat unit_amount would round each seat separately and could
  // land a cent or two off from that.
  const chargeAmount = seats === 1 ? agent.price_cents : teamPriceCents(agent.price_cents, seats);
  // A one-time sale's application_fee_amount is what's left of the platform's
  // cut after Stripe's own processing fee comes out of it (Stripe deducts
  // its fee from the platform's share, not the creator's) — floored so that
  // never goes negative in practice. See MIN_PLATFORM_FEE_CENTS.
  const platformFee = Math.max(Math.round((chargeAmount * PLATFORM_FEE_PERCENT) / 100), MIN_PLATFORM_FEE_CENTS);
  const origin = new URL(request.url).origin;

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: agent.pricing_model === "subscription" ? "subscription" : "payment",
    line_items: [
      {
        price_data: {
          currency: agent.currency,
          product_data: { name: seats === 1 ? agent.name : `${agent.name} — team (${seats} seats)` },
          unit_amount: chargeAmount,
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
    success_url: `${origin}/agents/${agent.slug}?purchased=1${seats > 1 ? "&team=1" : ""}`,
    cancel_url: `${origin}/agents/${agent.slug}`,
    // seats/team_emails read back in the webhook's checkout.session.completed
    // handler, which is what actually creates the purchase row and the
    // per-teammate invite rows — this route only ever creates the Checkout
    // Session, never writes to agently_purchases for a paid agent itself.
    metadata: {
      agent_id: agent.id,
      buyer_id: user.id,
      ...(seats > 1 ? { seats: String(seats), team_emails: teamEmails.join(",") } : {}),
    },
  };

  let session;
  try {
    session = await stripe.checkout.sessions.create(sessionParams);
  } catch (err) {
    // creator.stripe_connect_id can be stale in one specific way: it was
    // created under a different Stripe key mode (test vs. live) than the
    // one this request is running under — see app/api/stripe/connect/route.ts.
    // Stripe rejects transfer_data.destination pointing at an account that
    // doesn't exist in the current mode with resource_missing, which would
    // otherwise take over a real buyer's checkout attempt as a raw 500. This
    // is the buyer-facing edge of the same bug the payouts page now
    // self-heals on its own visits — reaching it here means the creator
    // hasn't revisited /dashboard/payouts since the key changed, so also
    // reset their cached "ready" state so their own next dashboard visit
    // shows the real status instead of a stale "connected".
    if (err instanceof Stripe.errors.StripeInvalidRequestError && err.code === "resource_missing") {
      const admin = createAdminClient();
      if (admin) {
        await admin
          .from("agently_profiles")
          .update({ stripe_connect_ready: false, stripe_connect_id: null })
          .eq("id", agent.creator_id);
      }
      return NextResponse.json(
        { error: "This creator's payout setup needs to be redone — try again shortly, or contact them directly." },
        { status: 409 }
      );
    }
    throw err;
  }

  return NextResponse.redirect(session.url!, 303);
}
