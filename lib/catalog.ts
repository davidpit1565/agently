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
