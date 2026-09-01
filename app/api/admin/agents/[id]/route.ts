import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AgentStatus } from "@/lib/types";

const VALID_STATUSES: AgentStatus[] = ["pending_review", "approved", "rejected", "delisted"];

// Owner-only, same PLATFORM_OWNER_EMAIL gate as /api/requests/[id] — the
// service-role client is what lets the owner update a listing they don't
// own; there's no RLS policy that could express "the platform owner"
// (agently_agents' insert/update is revoked from `authenticated` entirely,
// see schema.sql).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ error: "Not connected yet — Supabase isn't configured." }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !process.env.PLATFORM_OWNER_EMAIL || user.email !== process.env.PLATFORM_OWNER_EMAIL) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const { id } = await params;
  const form = await request.formData();
  const status = String(form.get("status")) as AgentStatus;

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Unknown status." }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY not configured" }, { status: 500 });
  }

  const { data: existing } = await admin
    .from("agently_agents")
    .select("creator_id, name, status")
    .eq("id", id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }

  const { error } = await admin.from("agently_agents").update({ status }).eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Only worth telling the creator about a decision, not every no-op re-save
  // of the same status.
  if (status !== existing.status && (status === "approved" || status === "rejected")) {
    await admin.from("agently_notifications").insert({
      user_id: existing.creator_id,
      agent_id: id,
      type: status === "approved" ? "agent_approved" : "agent_rejected",
      message:
        status === "approved"
          ? `${existing.name} is now live in the catalog.`
          : `${existing.name} wasn't approved — check your listing for details.`,
    });
  }

  return NextResponse.redirect(new URL("/dashboard/admin/agents?saved=1", request.url), 303);
}
