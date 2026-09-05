import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SEED_AGENTS } from "@/data/seed-agents";
import type { Agent } from "@/lib/types";

function supabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/** Approved agents for the public catalog. Falls back to seed data until Supabase is wired up. */
export async function getApprovedAgents(): Promise<Agent[]> {
  if (!supabaseConfigured()) return SEED_AGENTS;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agently_agents")
    .select("*")
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (error || !data || data.length === 0) return SEED_AGENTS;
  return data as Agent[];
}

// Not filtered by status — a pending or rejected agent still has to be
// fetchable so its own creator can preview it (app/agents/[slug]/page.tsx
// decides visibility for anyone who isn't the creator). RLS still limits
// what a signed-out or non-owner request actually gets back to `approved`
// rows via "approved agents are public".
export async function getAgentBySlug(slug: string): Promise<Agent | null> {
  if (!supabaseConfigured()) {
    return SEED_AGENTS.find((a) => a.slug === slug) ?? null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("agently_agents").select("*").eq("slug", slug).single();

  if (error || !data) return SEED_AGENTS.find((a) => a.slug === slug) ?? null;
  return data as Agent;
}

export type CreatorProfile = {
  id: string;
  display_name: string;
  account_type: "individual" | "company";
  bio: string | null;
  website_url: string | null;
};

const SEED_CREATOR: CreatorProfile = {
  id: "seed-creator",
  display_name: "Agently",
  account_type: "company",
  bio: null,
  website_url: null,
};

export async function getCreatorProfile(creatorId: string): Promise<CreatorProfile | null> {
  if (!supabaseConfigured() || creatorId === "seed-creator") {
    return creatorId === "seed-creator" ? SEED_CREATOR : null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agently_profiles")
    .select("id, display_name, account_type, bio, website_url")
    .eq("id", creatorId)
    .single();

  if (error || !data) return null;
  return data as CreatorProfile;
}

export type AgentsResult = { agents: Agent[]; failed: boolean };

// A genuine Supabase failure used to come back identical to "this creator
// really has zero listings" ([] either way) — a transient blip during a
// page load rendered a false "nothing here" instead of a retryable error.
// `failed` lets the caller tell the two apart.
export async function getAgentsByCreator(creatorId: string): Promise<AgentsResult> {
  if (!supabaseConfigured() || creatorId === "seed-creator") {
    return { agents: SEED_AGENTS.filter((a) => a.creator_id === creatorId), failed: false };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agently_agents")
    .select("*")
    .eq("creator_id", creatorId)
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (error) return { agents: [], failed: true };
  return { agents: (data ?? []) as Agent[], failed: false };
}

/** Every agent a creator owns, any status — for their own dashboard, never
 *  for a public page. RLS's "approved agents are public" policy already
 *  covers this: it reads `status = 'approved' or creator_id = auth.uid()`,
 *  so a signed-in creator querying their own creator_id gets all of theirs
 *  back regardless of status. */
export async function getMyAgents(userId: string): Promise<AgentsResult> {
  if (!supabaseConfigured()) return { agents: [], failed: false };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agently_agents")
    .select("*")
    .eq("creator_id", userId)
    .order("created_at", { ascending: false });

  if (error) return { agents: [], failed: true };
  return { agents: (data ?? []) as Agent[], failed: false };
}

/** Fire-and-forget — a visitor's page render shouldn't wait on this, and a
 *  failed increment (Supabase not configured, the RPC erroring) shouldn't
 *  break the page. Uses the admin client because most viewers are signed
 *  out, and the ones who aren't still don't own this row — the same
 *  "no auth.uid() a policy could check" reasoning as elsewhere in this
 *  codebase for a service-role write. Caller decides who counts as a
 *  view (see app/agents/[slug]/page.tsx: not the listing's own creator). */
export function recordAgentView(agentId: string): void {
  const admin = createAdminClient();
  if (!admin) return;
  void admin.rpc("agently_increment_agent_view", { agent_id: agentId });
}

/** One batched query for a creator's whole dashboard instead of one COUNT
 *  per listing. Only `status = 'paid'` counts — a pending or refunded
 *  checkout was never a real sale. */
export async function getPurchaseCounts(agentIds: string[]): Promise<{ counts: Map<string, number>; failed: boolean }> {
  const counts = new Map<string, number>();
  if (!supabaseConfigured() || agentIds.length === 0) return { counts, failed: false };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agently_purchases")
    .select("agent_id")
    .in("agent_id", agentIds)
    .eq("status", "paid");

  if (error) return { counts, failed: true };
  for (const row of data ?? []) {
    counts.set(row.agent_id, (counts.get(row.agent_id) ?? 0) + 1);
  }
  return { counts, failed: false };
}

export type PurchasedAgent = {
  purchaseId: string;
  purchasedAt: string;
  amountPaidCents: number;
  agent: Agent;
};

/** A buyer's own "library" — every agent they hold real paid access to,
 *  newest first. Team seats (lib/team-invites.ts) aren't included: those are
 *  a separate acceptance flow with their own access, not something this
 *  buyer purchased. RLS ("buyers see their own purchases") already scopes
 *  this to the signed-in user's own rows, and the single agent_id foreign
 *  key on agently_purchases lets Supabase embed the related row directly. */
export async function getMyPurchases(userId: string): Promise<{ purchases: PurchasedAgent[]; failed: boolean }> {
  if (!supabaseConfigured()) return { purchases: [], failed: false };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agently_purchases")
    .select("id, created_at, amount_cents, agently_agents(*)")
    .eq("buyer_id", userId)
    .eq("status", "paid")
    .order("created_at", { ascending: false });

  if (error) return { purchases: [], failed: true };
  return {
    purchases: (data ?? [])
      .filter((row) => row.agently_agents)
      .map((row) => ({
        purchaseId: row.id,
        purchasedAt: row.created_at,
        amountPaidCents: row.amount_cents ?? 0,
        agent: row.agently_agents as unknown as Agent,
      })),
    failed: false,
  };
}
