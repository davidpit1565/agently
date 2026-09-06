export type MembershipTier = "free" | "basic" | "pro" | "professional";

export type PricingModel = "one_time" | "subscription" | "free";

export type AgentStatus = "pending_review" | "approved" | "rejected" | "delisted";

export type AgentKind = "file" | "prompt" | "workflow";

export type Category = {
  slug: string;
  name: string;
  description: string | null;
  color: string;
};

export type Agent = {
  id: string;
  creator_id: string;
  slug: string;
  name: string;
  tagline: string;
  problem_solved: string;
  description: string;
  category_slug: string;
  pricing_model: PricingModel;
  price_cents: number | null;
  currency: string;
  delivery_url: string | null;
  agent_kind: AgentKind;
  // hosted_system_prompt and hosted_webhook_url are deliberately NOT on this
  // type — both have their column-level SELECT revoked from
  // authenticated/anon entirely (supabase/schema.sql), specifically so
  // nothing that reads an Agent through the buyer-facing/shared code path
  // (lib/catalog.ts) can ever hold either in memory next to everything else
  // that gets rendered, and so a plain `select("*")` from those code paths
  // doesn't hit a permission-denied error by referencing a column the
  // caller has no grant on. Server code that genuinely needs either (the
  // invoke route; the edit page, for its own owner) selects it by name
  // directly through the admin client instead of going through this type.
  credits_per_call: number | null;
  status: AgentStatus;
  review_notes: string | null;
  trust_score: number;
  version: number;
  embedding: number[] | null;
  view_count: number;
  created_at: string;
  updated_at: string;
};

export type Profile = {
  id: string;
  account_type: "individual" | "company";
  display_name: string;
  company_name: string | null;
  membership_tier: MembershipTier;
  membership_status: "inactive" | "active" | "past_due" | "canceled";
  api_credits: number;
};

export type AgentRequestStatus = "pending" | "in_progress" | "fulfilled" | "declined";

export type AgentRequest = {
  id: string;
  requester_id: string;
  description: string;
  status: AgentRequestStatus;
  admin_notes: string | null;
  fulfilled_agent_id: string | null;
  created_at: string;
  updated_at: string;
};
