import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

// A review is free text rendered straight onto a public listing page
// (app/agents/[slug]/page.tsx) — with no cap, one upsert could paste in
// megabytes of text, bloating the page and the database for every visitor
// who loads it. Generous enough for a real review, nowhere near enough to
// be used as free storage.
const MAX_COMMENT_LENGTH = 2000;

// One review per buyer per agent — re-submitting updates the existing row
// (the schema's unique(agent_id, buyer_id) constraint), it doesn't duplicate.
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

  // The upsert below can only ever touch one row per (agent, buyer) pair —
  // it can't be used to spam multiple reviews — but nothing stopped rapid
  // repeated resubmission (a script hammering this route) from generating
  // a write for every request. Same "stop a tight-loop script" goal as the
  // other two scopes this limiter already covers.
  const allowed = await checkRateLimit(`review_submit:${user.id}`, 10, 60);
  if (!allowed) {
    return NextResponse.json({ error: "Too many review submissions — wait a moment and try again." }, { status: 429 });
  }

  const form = await request.formData();
  const agentId = String(form.get("agentId"));
  const rating = Number(form.get("rating"));
  const rawComment = form.get("comment");
  const comment = typeof rawComment === "string" ? rawComment.trim().slice(0, MAX_COMMENT_LENGTH) : null;

  if (!agentId || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "A rating from 1 to 5 is required." }, { status: 400 });
  }

  // Reviewing your own listing is blocked at the source — /api/checkout
  // refuses to record a purchase for an agent's own creator, so the "paid
  // purchase" RLS check below (agently_reviews' insert policy) can never be
  // satisfied by an owner. This is a second, explicit check for the same
  // rule, so the failure a creator sees names the actual reason instead of
  // a generic RLS-denied error.
  const { data: agent } = await supabase.from("agently_agents").select("slug, creator_id").eq("id", agentId).single();
  if (agent?.creator_id === user.id) {
    return NextResponse.json({ error: "You can't review your own agent." }, { status: 403 });
  }

  const { error } = await supabase
    .from("agently_reviews")
    .upsert(
      { agent_id: agentId, buyer_id: user.id, rating, comment: comment || null },
      { onConflict: "agent_id,buyer_id" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const redirectTo = agent?.slug ? `/agents/${agent.slug}?reviewed=1` : "/browse";
  return NextResponse.redirect(new URL(redirectTo, request.url));
}
