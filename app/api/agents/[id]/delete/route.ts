import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteAllAgentFiles } from "@/lib/agent-files";

// Hard delete — actually removes the row, unlike /delist which only sets
// status: 'delisted'. Only ever allowed when the agent has never had a
// single row in agently_purchases (any status, not just 'paid' — a
// refunded or canceled one still means a real buyer once had it and its
// history shouldn't disappear). agently_agents' foreign keys cascade the
// rest (agently_agent_files, agently_downloads, agently_reviews, team
// seats) once that's confirmed zero; Storage blobs aren't part of that
// cascade and are removed explicitly first.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ error: "Not connected yet — Supabase isn't configured." }, { status: 503 });
  }

  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/auth/sign-in", request.url));
  }

  const { data: existing } = await supabase.from("agently_agents").select("creator_id").eq("id", id).single();
  if (!existing || existing.creator_id !== user.id) {
    return NextResponse.json({ error: "Agent not found, or you don't own it." }, { status: 404 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Not connected yet — Supabase isn't configured." }, { status: 503 });
  }

  const { count, error: countError } = await admin
    .from("agently_purchases")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", id);
  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 400 });
  }
  if (count && count > 0) {
    return NextResponse.json(
      { error: "This agent has purchase history — remove it from the catalog instead of deleting it." },
      { status: 409 }
    );
  }

  await deleteAllAgentFiles(id);

  const { error } = await admin.from("agently_agents").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.redirect(new URL("/dashboard/agents?removed=1", request.url), 303);
}
