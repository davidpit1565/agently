import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { sendNotificationEmail } from "@/lib/email";

export type Notification = {
  id: string;
  agent_slug: string | null;
  message: string;
  read: boolean;
  created_at: string;
};

export async function getNotifications(userId: string): Promise<{ notifications: Notification[]; unreadCount: number }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("agently_notifications")
    .select("id, message, read, created_at, agents(slug)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  // agent_slug is null when the agent was deleted since the notification
  // was created — the bell links nowhere for those, not to a broken page.
  const notifications = (data ?? []).map((n) => ({
    id: n.id,
    message: n.message,
    read: n.read,
    created_at: n.created_at,
    agent_slug: (n.agents as unknown as { slug: string } | null)?.slug ?? null,
  }));

  return { notifications, unreadCount: notifications.filter((n) => !n.read).length };
}

/** Notifies every distinct buyer of an agent that it changed. Runs with the
 *  creator's own session — the RLS policy on `notifications` only allows an
 *  insert when the caller owns the referenced agent, so this can't be used
 *  to spam notifications for an agent that isn't the caller's. */
export async function notifyBuyersOfUpdate(agentId: string, agentName: string, version: number) {
  const supabase = await createClient();

  const { data: purchases } = await supabase
    .from("agently_purchases")
    .select("buyer_id")
    .eq("agent_id", agentId)
    .eq("status", "paid");

  const buyerIds = [...new Set((purchases ?? []).map((p) => p.buyer_id))];
  if (buyerIds.length === 0) return;

  await supabase.from("agently_notifications").insert(
    buyerIds.map((buyerId) => ({
      user_id: buyerId,
      agent_id: agentId,
      type: "agent_updated" as const,
      message: `${agentName} was updated to v${version}.`,
    }))
  );
}

/** Tells a creator their agent just sold — the one notification, in-app or
 *  email, that didn't exist anywhere before: a creator previously had no way
 *  to know a sale happened short of checking their own dashboard numbers.
 *  Takes the admin client explicitly (not lib/supabase/server's session-bound
 *  one) because the only caller is the Stripe webhook, which runs with no
 *  signed-in session for RLS to check against — same reasoning as every
 *  other webhook write in app/api/stripe/webhook/route.ts.
 *
 *  Never throws: the purchase row this is called after has already been
 *  written successfully by the time this runs. Letting a failure here
 *  (e.g. the 'agent_sale' migration not run yet against this Supabase
 *  project, so the type check constraint rejects the insert) escape as an
 *  unhandled exception would 500 the whole webhook — Stripe would then
 *  retry the same event, hit the purchases table's unique-id dedupe on the
 *  retry, and this notification would never fire at all, for a sale that
 *  already succeeded and was already charged. */
/** Alerts the platform owner by email whenever a listing needs a human
 *  look — a new submission or a content edit that landed in
 *  pending_review. Before this there was no signal at all beyond checking
 *  /dashboard/admin/agents by hand; a listing could sit unreviewed
 *  indefinitely with nothing prompting a look. sendNotificationEmail
 *  already never throws (missing RESEND_API_KEY, or a dead provider, both
 *  just log and return), so this needs no try/catch of its own — a failure
 *  here must never block the create/edit request that triggered it. */
export async function notifyOwnerOfPendingReview(params: {
  agentName: string;
  isEdit: boolean;
  verdict: { risk: string; summary: string; flags: string[] } | null;
  diff?: string;
}) {
  const owner = process.env.PLATFORM_OWNER_EMAIL;
  if (!owner) return;

  const { agentName, isEdit, verdict, diff } = params;
  const verdictLine = verdict
    ? `AI verdict: [${verdict.risk}] ${verdict.summary}${verdict.flags.length ? ` — flags: ${verdict.flags.join("; ")}` : ""}`
    : "No automated verdict came back (check ANTHROPIC_API_KEY) — this one needs a manual look with no AI opinion to go on.";

  const lines = [
    `${agentName} ${isEdit ? "was edited and" : "was submitted and"} is waiting in pending_review.`,
    verdictLine,
    ...(diff ? ["", "What changed in this edit:", diff] : []),
    "",
    "Review it: https://agently-jet.vercel.app/dashboard/admin/agents",
  ];

  await sendNotificationEmail(owner, `${agentName} needs review`, lines.join("\n"));
}

export async function notifyCreatorOfSale(
  admin: SupabaseClient,
  params: { creatorId: string; agentId: string; agentName: string; amountCents: number; currency: string }
) {
  const { creatorId, agentId, agentName, amountCents, currency } = params;
  const amount = (amountCents / 100).toFixed(2);
  const message = `${agentName} sold for ${amount} ${currency.toUpperCase()}.`;

  try {
    const { error } = await admin.from("agently_notifications").insert({
      user_id: creatorId,
      agent_id: agentId,
      type: "agent_sale",
      message,
    });
    if (error) throw error;

    const { data } = await admin.auth.admin.getUserById(creatorId);
    await sendNotificationEmail(data.user?.email, `${agentName} just sold`, message);
  } catch (err) {
    console.error("[notifications] notifyCreatorOfSale failed", {
      creatorId,
      agentId,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
