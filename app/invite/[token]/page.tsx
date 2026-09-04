import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Notice } from "@/app/components/form-field";

// Where a team-purchase invite email (lib/team-invites.ts) actually points.
// Uses the admin client throughout — no RLS policy grants any role direct
// access to agently_team_invites (schema.sql), the same "service-role only"
// pattern as agently_agent_files and agently_downloads, since claiming a
// seat has to work for someone who doesn't have an account (and so no
// session-scoped RLS check could ever apply) yet.
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return <Notice title="Not connected yet">This page needs Supabase configured first.</Notice>;
  }

  const admin = createAdminClient();
  if (!admin) {
    return <Notice title="Not connected yet">This page needs the service role key configured first.</Notice>;
  }

  const { data: invite } = await admin
    .from("agently_team_invites")
    .select("id, email, purchase_id, accepted_by")
    .eq("token", token)
    .maybeSingle();

  if (!invite) {
    return <Notice title="Invite not found">This link isn't valid — check it was copied in full.</Notice>;
  }

  const { data: purchase } = await admin
    .from("agently_purchases")
    .select("agent_id, status")
    .eq("id", invite.purchase_id)
    .single();
  const { data: agent } = purchase
    ? await admin.from("agently_agents").select("slug, name").eq("id", purchase.agent_id).single()
    : { data: null };

  if (invite.accepted_by) {
    return (
      <Notice title="Already claimed">
        This invite has already been used.
        {agent && (
          <>
            {" "}
            If it was you, you already have access —{" "}
            <a href={`/agents/${agent.slug}`} className="text-accent underline">
              go to {agent.name}
            </a>
            .
          </>
        )}
      </Notice>
    );
  }

  if (!purchase || purchase.status !== "paid" || !agent) {
    return (
      <Notice title="No longer active">
        The purchase behind this invite isn&apos;t active anymore (refunded or canceled).
      </Notice>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth/sign-in?next=${encodeURIComponent(`/invite/${token}`)}`);
  }

  if ((user.email ?? "").toLowerCase() !== invite.email.toLowerCase()) {
    return (
      <Notice title="Wrong account">
        <>
          This invite was sent to <strong>{invite.email}</strong>, but you&apos;re signed in as{" "}
          <strong>{user.email}</strong>.
          <form action="/auth/sign-out" method="POST" className="mt-4">
            <button type="submit" className="text-accent underline">
              Sign out
            </button>
          </form>{" "}
          and sign in with the invited address instead.
        </>
      </Notice>
    );
  }

  await admin
    .from("agently_team_invites")
    .update({ accepted_by: user.id, accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  redirect(`/agents/${agent.slug}?joined=1`);
}
