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

export async function getAgentBySlug(slug: string): Promise<Agent | null> {
  if (!supabaseConfigured()) {
    return SEED_AGENTS.find((a) => a.slug === slug) ?? null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .eq("slug", slug)
    .eq("status", "approved")
    .single();

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
