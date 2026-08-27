import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Agent, AgentRequest } from "@/lib/types";

const STOPWORDS = new Set([
  "that", "this", "with", "have", "from", "your", "would", "could", "should",
  "there", "their", "about", "which", "when", "what", "into", "just", "like",
  "want", "need", "some", "them", "then", "than", "will", "does", "doing",
]);

function keywords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOPWORDS.has(w))
  );
}

/** Plain keyword overlap, not semantic matching — the About page says as
 *  much ("search today is real text matching"). Good enough to catch "you
 *  described something that already exists" before someone requests a
 *  duplicate, not a claim of understanding meaning. */
export function findSimilarAgents(description: string, agents: Agent[], limit = 3): Agent[] {
  const queryWords = keywords(description);
  if (queryWords.size === 0) return [];

  const scored = agents
    .map((agent) => {
      const agentWords = keywords(`${agent.name} ${agent.tagline} ${agent.problem_solved}`);
      let overlap = 0;
      for (const w of queryWords) if (agentWords.has(w)) overlap++;
      return { agent, overlap };
    })
    .filter((s) => s.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap);

  return scored.slice(0, limit).map((s) => s.agent);
}

export async function getMyAgentRequests(userId: string): Promise<AgentRequest[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agently_agent_requests")
    .select("*")
    .eq("requester_id", userId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as AgentRequest[];
}

/** Every request, any requester — the admin queue. Uses the service-role
 *  client because there's no per-row "is this the platform owner" concept
 *  RLS can check; the caller (app/dashboard/admin/requests) is what
 *  actually gates who reaches this. */
export async function getAllAgentRequests(): Promise<AgentRequest[]> {
  const supabase = createAdminClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("agently_agent_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as AgentRequest[];
}
