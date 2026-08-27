import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

  const form = await request.formData();
  const agentId = String(form.get("agentId"));
  const rating = Number(form.get("rating"));
  const comment = form.get("comment");

  if (!agentId || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "A rating from 1 to 5 is required." }, { status: 400 });
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

  const agent = await supabase.from("agently_agents").select("slug").eq("id", agentId).single();
  const redirectTo = agent.data?.slug ? `/agents/${agent.data.slug}?reviewed=1` : "/browse";
  return NextResponse.redirect(new URL(redirectTo, request.url));
}
