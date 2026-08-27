import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Soft-delete — sets status to 'delisted' rather than removing the row.
// A hard delete would orphan real purchase and review history that has
// to survive the listing (refunds, past buyers' access, the trust
// record). Ownership is checked below with the user's own session; the
// actual write goes through the service-role client, since "authenticated"
// has no update privilege at all on agently_agents (see supabase/schema.sql).
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

  const { data: existing } = await supabase.from("agently_agents").select("creator_id, slug").eq("id", id).single();
  if (!existing || existing.creator_id !== user.id) {
    return NextResponse.json({ error: "Agent not found, or you don't own it." }, { status: 404 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Not connected yet — Supabase isn't configured." }, { status: 503 });
  }

  const { error } = await admin.from("agently_agents").update({ status: "delisted" }).eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.redirect(new URL("/dashboard/agents?delisted=1", request.url), 303);
}
