import { createClient } from "@/lib/supabase/server";

export type Review = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

export type ReviewSummary = {
  reviews: Review[];
  average: number | null;
  count: number;
};

const EMPTY: ReviewSummary = { reviews: [], average: null, count: 0 };

export async function getReviewsForAgent(agentId: string): Promise<ReviewSummary> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return EMPTY;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reviews")
    .select("id, rating, comment, created_at")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false });

  if (error || !data || data.length === 0) return EMPTY;

  const average = data.reduce((sum, r) => sum + r.rating, 0) / data.length;
  return { reviews: data, average, count: data.length };
}
