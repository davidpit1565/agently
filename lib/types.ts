export type MembershipTier = "free" | "basic" | "pro" | "professional";

export type PricingModel = "one_time" | "subscription" | "free";

export type AgentStatus = "pending_review" | "approved" | "rejected" | "delisted";

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
  status: AgentStatus;
  review_notes: string | null;
  trust_score: number;
  created_at: string;
};

export type Profile = {
  id: string;
  account_type: "individual" | "company";
  display_name: string;
  company_name: string | null;
  membership_tier: MembershipTier;
  membership_status: "inactive" | "active" | "past_due" | "canceled";
};
