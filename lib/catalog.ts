import { createClient } from "@/lib/supabase/server";
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
    .from("agents")
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
  const { data, error } = await supabase.from("agents").select("*").eq("slug", slug).single();

  if (error || !data) return SEED_AGENTS.find((a) => a.slug === slug) ?? null;
  return data as Agent;
}

export type CreatorProfile = {
  id: string;
  display_name: string;
  account_type: "individual" | "company";
};

const SEED_CREATOR: CreatorProfile = {
  id: "seed-creator",
  display_name: "Agently",
  account_type: "company",
};

export async function getCreatorProfile(creatorId: string): Promise<CreatorProfile | null> {
  if (!supabaseConfigured() || creatorId === "seed-creator") {
    return creatorId === "seed-creator" ? SEED_CREATOR : null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, account_type")
    .eq("id", creatorId)
    .single();

  if (error || !data) return null;
  return data as CreatorProfile;
}

export async function getAgentsByCreator(creatorId: string): Promise<Agent[]> {
  if (!supabaseConfigured() || creatorId === "seed-creator") {
    return SEED_AGENTS.filter((a) => a.creator_id === creatorId);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .eq("creator_id", creatorId)
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as Agent[];
}

/** Every agent a creator owns, any status — for their own dashboard, never
 *  for a public page. RLS's "approved agents are public" policy already
 *  covers this: it reads `status = 'approved' or creator_id = auth.uid()`,
 *  so a signed-in creator querying their own creator_id gets all of theirs
 *  back regardless of status. */
export async function getMyAgents(userId: string): Promise<Agent[]> {
  if (!supabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .eq("creator_id", userId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as Agent[];
}
