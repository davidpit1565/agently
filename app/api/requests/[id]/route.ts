import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNotificationEmail } from "@/lib/email";
import { isPlatformOwner } from "@/lib/owner";
import type { AgentRequestStatus } from "@/lib/types";

const VALID_STATUSES: AgentRequestStatus[] = ["pending", "in_progress", "fulfilled", "declined"];

// Owner-only — checked against PLATFORM_OWNER_EMAIL, not a database role,
// since there's no other admin concept in this schema yet (a one-person
// team doesn't need one). Runs through the service-role client because
// there's no RLS policy that could express "the platform owner" — see
// schema.sql's note on agent_requests.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.redirect(
      new URL(
        `/dashboard/admin/requests?error=${encodeURIComponent("Not connected yet — Supabase isn't configured.")}`,
        request.url
      ),
      303
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isPlatformOwner(user?.email)) {
    return NextResponse.redirect(
      new URL(`/dashboard/admin/requests?error=${encodeURIComponent("Not found.")}`, request.url),
      303
    );
  }

  const { id } = await params;
  const form = await request.formData();
  const status = String(form.get("status")) as AgentRequestStatus;
  const adminNotes = (form.get("admin_notes") as string) || null;
  const fulfilledAgentSlug = (form.get("fulfilled_agent_slug") as string) || null;

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.redirect(
      new URL(`/dashboard/admin/requests?error=${encodeURIComponent("Unknown status.")}`, request.url),
      303
    );
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.redirect(
      new URL(
        `/dashboard/admin/requests?error=${encodeURIComponent("SUPABASE_SERVICE_ROLE_KEY not configured")}`,
        request.url
      ),
      303
    );
  }

  let fulfilledAgentId: string | null = null;
  if (status === "fulfilled" && fulfilledAgentSlug) {
    const { data: agent } = await admin.from("agently_agents").select("id").eq("slug", fulfilledAgentSlug).single();
    if (!agent) {
      // A typo'd slug used to fail silently: the request got marked
      // fulfilled, the requester was notified "it's ready," and
      // fulfilled_agent_id just stayed null with no link and no error.
      return NextResponse.redirect(
        new URL(
          `/dashboard/admin/requests?error=${encodeURIComponent(
            `No listed agent has the slug "${fulfilledAgentSlug}". Check the slug and try again.`
          )}`,
          request.url
        ),
        303
      );
    }
    fulfilledAgentId = agent.id;
  }

  const { data: existing } = await admin.from("agently_agent_requests").select("requester_id, status").eq("id", id).single();
  if (!existing) {
    return NextResponse.redirect(
      new URL(`/dashboard/admin/requests?error=${encodeURIComponent("Request not found.")}`, request.url),
      303
    );
  }

  const { error } = await admin
    .from("agently_agent_requests")
    .update({ status, admin_notes: adminNotes, fulfilled_agent_id: fulfilledAgentId })
    .eq("id", id);

  if (error) {
    return NextResponse.redirect(
      new URL(`/dashboard/admin/requests?error=${encodeURIComponent(error.message)}`, request.url),
      303
    );
  }

  if (status === "fulfilled" && existing.status !== "fulfilled") {
    const message = "The agent you requested is ready.";
    await admin.from("agently_notifications").insert({
      user_id: existing.requester_id,
      agent_id: fulfilledAgentId,
      type: "agent_request_fulfilled",
      message,
    });
    const { data: requester } = await admin.auth.admin.getUserById(existing.requester_id);
    await sendNotificationEmail(requester.user?.email, "Your requested agent is ready", message);
  }

  return NextResponse.redirect(new URL("/dashboard/admin/requests?saved=1", request.url), 303);
}
