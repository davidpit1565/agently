import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// The actual accept action — separated from app/invite/[token]/page.tsx so
// that loading the invite link (a GET) never by itself consumes the
// one-time seat. Every check the page already did to decide whether to
// show the "Accept and join" button is re-verified here, since this is the
// real write and the only page-rendered check isn't a security boundary.
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ error: "Not connected yet — Supabase isn't configured." }, { status: 503 });
  }

  const { token } = await params;
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Not connected yet — the service role key isn't configured." }, { status: 503 });
  }

  const { data: invite } = await admin
    .from("agently_team_invites")
    .select("id, email, purchase_id, accepted_by")
    .eq("token", token)
    .maybeSingle();
  if (!invite) {
    return NextResponse.json({ error: "This invite link isn't valid." }, { status: 404 });
  }
  if (invite.accepted_by) {
    return NextResponse.redirect(new URL(`/invite/${token}`, request.url), 303);
  }

  const { data: purchase } = await admin
    .from("agently_purchases")
    .select("agent_id, status")
    .eq("id", invite.purchase_id)
    .single();
  const agent = purchase
    ? (await admin.from("agently_agents").select("slug").eq("id", purchase.agent_id).single()).data
    : null;
  if (!purchase || purchase.status !== "paid" || !agent) {
    return NextResponse.json({ error: "This invite isn't active anymore (refunded or canceled)." }, { status: 409 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL(`/auth/sign-in?next=${encodeURIComponent(`/invite/${token}`)}`, request.url));
  }
  if ((user.email ?? "").toLowerCase() !== invite.email.toLowerCase()) {
    return NextResponse.redirect(new URL(`/invite/${token}`, request.url), 303);
  }

  const { error } = await admin
    .from("agently_team_invites")
    .update({ accepted_by: user.id, accepted_at: new Date().toISOString() })
    .eq("id", invite.id)
    .is("accepted_by", null); // last-write-wins guard: don't reassign a seat someone else's concurrent accept already claimed
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.redirect(new URL(`/agents/${agent.slug}?joined=1`, request.url), 303);
}
