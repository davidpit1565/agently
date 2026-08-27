import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deleteAgentFile } from "@/lib/agent-files";

// Removing a file doesn't bump the listing's version or notify buyers —
// unlike adding one, it's not necessarily "here's something new," and a
// creator fixing a mistaken upload shouldn't spam everyone who owns it.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ error: "Not connected yet — Supabase isn't configured." }, { status: 503 });
  }

  const { id, fileId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/auth/sign-in", request.url));
  }

  const { data: agent } = await supabase.from("agents").select("id, creator_id").eq("id", id).single();
  if (!agent || agent.creator_id !== user.id) {
    return NextResponse.json({ error: "Agent not found, or you don't own it." }, { status: 404 });
  }

  await deleteAgentFile(fileId, id);

  return NextResponse.redirect(new URL(`/dashboard/agents/${id}/edit`, request.url), 303);
}
