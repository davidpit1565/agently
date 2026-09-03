import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Sends a creator to Stripe's hosted onboarding so they can receive payouts.
// Without this, a sale has nowhere to send the creator's share — see the
// fix in app/api/checkout/route.ts for why this had to exist before that
// route could honestly claim to split payment with the creator.
export async function POST(request: Request) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ error: "Not connected yet — Supabase isn't configured." }, { status: 503 });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Not connected yet — Stripe isn't configured." }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/auth/sign-in", request.url));
  }

  const stripe = getStripe();
  const origin = new URL(request.url).origin;

  const { data: profile, error: profileError } = await supabase
    .from("agently_profiles")
    .select("stripe_connect_id")
    .eq("id", user.id)
    .single();

  // A failed lookup here is not "no Connect account yet" — treating it that
  // way on a transient Supabase error would create a second Stripe Connect
  // account for someone who already onboarded one, then overwrite their real
  // stripe_connect_id with the new (unonboarded) one below, orphaning the
  // original account that checkout's payouts actually point to.
  if (profileError) {
    return NextResponse.json(
      { error: "Couldn't verify your payout account — try again in a moment." },
      { status: 503 }
    );
  }

  let accountId = profile?.stripe_connect_id ?? null;

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      email: user.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });
    accountId = account.id;
    // stripe_connect_id isn't in the self-updatable column grant (see
    // supabase/schema.sql) — a signed-in user's own session can no longer
    // write it directly, so this write goes through the service-role
    // client, same as every other Stripe-driven profile field.
    const admin = createAdminClient();
    if (admin) {
      await admin.from("agently_profiles").update({ stripe_connect_id: accountId }).eq("id", user.id);
    }
  }

  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${origin}/dashboard/payouts`,
    return_url: `${origin}/dashboard/payouts?onboarded=1`,
    type: "account_onboarding",
  });

  return NextResponse.redirect(link.url, 303);
}
