import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Notice } from "@/app/components/form-field";
import { SubmitButton } from "@/app/components/submit-button";

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

  // Accepting used to happen right here, on this GET render — which meant
  // just *loading* the invite URL consumed the one-time seat. An email
  // security scanner (Outlook Safe Links, Google's link-following, a
  // Slack/Teams unfurl) prefetching this URL while the real recipient is
  // signed in elsewhere in the same browser would silently claim the seat
  // before the person ever clicked anything, and they'd land on "Already
  // claimed" with no idea why. Rendering a real confirmation step (a POST
  // a person has to actually click) means loading the link is inert.
  return (
    <main className="mx-auto max-w-md animate-reveal-up px-6 py-24 text-center">
      <h1 className="text-balance mb-2 font-display text-xl font-semibold">
        Join {agent.name}
      </h1>
      <p className="mb-6 text-sm text-ink-soft">
        You&apos;ve been given a seat on this team purchase. Accepting gives
        you the same delivery link and files access as the buyer.
      </p>
      <form action={`/api/invite/${token}/accept`} method="POST">
        <SubmitButton
          pendingText="Joining…"
          className="shine-sweep magnetic-btn rounded-full bg-accent px-6 py-3 text-sm font-medium text-[#04140f] transition-all duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-0.5 hover:opacity-90"
        >
          Accept and join
        </SubmitButton>
      </form>
    </main>
  );
}
