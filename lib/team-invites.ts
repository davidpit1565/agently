import type { SupabaseClient } from "@supabase/supabase-js";
import { sendNotificationEmail } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";

// Same hardcoded-base-URL pattern already used in app/sitemap.ts,
// app/robots.ts, and lib/watermark.ts — this app has no custom domain yet.
const SITE_URL = "https://agently-jet.vercel.app";

/** Creates one agently_team_invites row per teammate email and emails each
 *  one an accept link — called once, right after a team purchase's
 *  purchase row is successfully inserted (app/api/stripe/webhook/route.ts).
 *  Never throws: an email or invite-row failure here shouldn't turn an
 *  already-successful, already-charged purchase into a failed webhook that
 *  Stripe retries — the buyer paid and owns their own seat regardless of
 *  whether every teammate's invite went out cleanly. */
export async function createTeamInvitesAndNotify(
  admin: SupabaseClient,
  params: { purchaseId: string; agentId: string; agentName: string; agentSlug: string; emails: string[] }
) {
  const { purchaseId, agentId, agentName, agentSlug, emails } = params;

  for (const email of emails) {
    try {
      const { data: invite, error } = await admin
        .from("agently_team_invites")
        .insert({ purchase_id: purchaseId, agent_id: agentId, email })
        .select("token")
        .single();
      if (error || !invite) {
        console.error("[team-invites] insert failed", { purchaseId, email, message: error?.message });
        continue;
      }

      const acceptUrl = `${SITE_URL}/invite/${invite.token}`;
      await sendNotificationEmail(
        email,
        `You've been added to ${agentName} on Agently`,
        `Someone on your team bought ${agentName} on Agently and added you to it.\n\nAccept your seat: ${acceptUrl}\n\nIf you don't have an Agently account yet, this link will take you through sign-in first and then straight to the agent.\n\nAgent: ${SITE_URL}/agents/${agentSlug}`
      );
    } catch (err) {
      console.error("[team-invites] unexpected failure", {
        purchaseId,
        email,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

/** The team purchase a signed-in user has claimed access to for this agent,
 *  if any — used everywhere a buyer's own `hasPurchased` is checked
 *  (app/agents/[slug]/page.tsx, app/api/deliveries/[agentId]/route.ts) as
 *  the second way to get delivery access, alongside being the buyer
 *  themselves. Always goes through the admin client: the join to
 *  agently_purchases.status is what makes a refunded or canceled team
 *  purchase revoke every team member's access too, not just the buyer's,
 *  and RLS on agently_purchases wouldn't let a team member's own session
 *  read that far. Returns the purchase id (not just a boolean) so a
 *  teammate's own downloads still log and alert against the real purchase,
 *  same as the buyer's. Never grants refund, cancel, or review rights —
 *  those stay tied to buyer_id alone. */
export async function getAcceptedTeamPurchaseId(agentId: string, userId: string): Promise<string | null> {
  const admin = createAdminClient();
  if (!admin) return null;

  const { data } = await admin
    .from("agently_team_invites")
    .select("purchase_id, agently_purchases!inner(status)")
    .eq("agent_id", agentId)
    .eq("accepted_by", userId)
    .eq("agently_purchases.status", "paid")
    .maybeSingle();

  return data?.purchase_id ?? null;
}
