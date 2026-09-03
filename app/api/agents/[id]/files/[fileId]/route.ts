import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deleteAgentFile, getAgentFiles } from "@/lib/agent-files";

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

  const { data: agent } = await supabase
    .from("agently_agents")
    .select("id, creator_id, delivery_url")
    .eq("id", id)
    .single();
  if (!agent || agent.creator_id !== user.id) {
    return NextResponse.json({ error: "Agent not found, or you don't own it." }, { status: 404 });
  }

  // Same rule the edit form already enforces when it clears the delivery
  // link: a listing needs a delivery link OR at least one real (non-readme)
  // file. This route is a separate one-click "remove" action with no such
  // check — deleting the last file on a listing with no delivery_url would
  // silently leave every buyer who already paid for it with nothing to
  // download, and a creator could do it by mistake with a single click.
  if (!agent.delivery_url) {
    const files = await getAgentFiles(id);
    const target = files.find((f) => f.id === fileId);
    const deliverableCount = files.filter((f) => !f.is_readme).length;
    if (target && !target.is_readme && deliverableCount <= 1) {
      return NextResponse.json(
        {
          error:
            "This is the only file on a listing with no delivery link — removing it would leave buyers with nothing. Add a delivery link or another file first.",
        },
        { status: 400 }
      );
    }
  }

  await deleteAgentFile(fileId, id);

  return NextResponse.redirect(new URL(`/dashboard/agents/${id}/edit`, request.url), 303);
}
