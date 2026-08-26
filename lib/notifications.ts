import { createClient } from "@/lib/supabase/server";

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
    .from("notifications")
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
export async function notifyBuyersOfUpdate(agentId: string, agentName: string) {
  const supabase = await createClient();

  const { data: purchases } = await supabase
    .from("purchases")
    .select("buyer_id")
    .eq("agent_id", agentId)
    .eq("status", "paid");

  const buyerIds = [...new Set((purchases ?? []).map((p) => p.buyer_id))];
  if (buyerIds.length === 0) return;

  await supabase.from("notifications").insert(
    buyerIds.map((buyerId) => ({
      user_id: buyerId,
      agent_id: agentId,
      type: "agent_updated" as const,
      message: `${agentName} was updated by its creator.`,
    }))
  );
}
