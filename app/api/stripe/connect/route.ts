import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

// Sends a creator to Stripe's hosted onboarding so they can receive payouts.
// Without this, a sale has nowhere to send the creator's share — see the
// fix in app/api/checkout/route.ts for why this had to exist before that
// route could honestly claim to split payment with the creator.
export async function POST(request: Request) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ error: "Not connected yet — Supabase isn't configured." }, { status: 503 });
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_connect_id")
    .eq("id", user.id)
    .single();

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
    await supabase.from("profiles").update({ stripe_connect_id: accountId }).eq("id", user.id);
  }

  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${origin}/dashboard/payouts`,
    return_url: `${origin}/dashboard/payouts?onboarded=1`,
    type: "account_onboarding",
  });

  return NextResponse.redirect(link.url, 303);
}
