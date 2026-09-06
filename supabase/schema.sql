-- Agently — core schema
-- Run this once against a new Supabase project (SQL Editor, or `supabase db push`).
-- Matches the model decided in the market research report: membership gates
-- uploading, a per-sale platform fee is separate from membership revenue,
-- and every agent carries a visible trust score instead of star ratings.
--
-- Every table carries an agently_ prefix. This Postgres project is shared
-- with another app (videos-ai's studio) — there's no name collision today,
-- but the prefix means there never will be, without needing a separate
-- Postgres schema or any manual "exposed schemas" setup in Supabase.

create extension if not exists "pgcrypto";

-- One row per authenticated user, extending Supabase's built-in auth.users.
create table if not exists agently_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  account_type text not null default 'individual' check (account_type in ('individual', 'company')),
  display_name text not null,
  company_name text,
  membership_tier text not null default 'free' check (membership_tier in ('free', 'basic', 'pro', 'professional')),
  membership_status text not null default 'inactive' check (membership_status in ('inactive', 'active', 'past_due', 'canceled')),
  membership_renews_at timestamptz,
  stripe_customer_id text,
  stripe_connect_id text,
  stripe_connect_ready boolean not null default false,
  created_at timestamptz not null default now()
);

-- Nothing else in this file, and nothing in the app, ever inserted a
-- agently_profiles row — the "profiles insert on signup" policy below existed
-- with no code path that ever used it. Every real sign-in created an
-- auth.users row with no matching agently_profiles row, silently breaking
-- everything that reads or writes one: membership (the webhook's UPDATE
-- agently_profiles ... WHERE id = user_id affects zero rows with nothing to
-- update), canUpload() defaulting to the 'free' tier forever, payouts,
-- every page showing a creator's display name. This is the standard
-- Supabase pattern for provisioning one automatically: a trigger on
-- auth.users itself, since nothing in application code runs at the
-- moment a user is actually created. security definer is required —
-- this fires as part of Supabase's own auth flow, before there's a
-- signed-in session for RLS's `auth.uid() = id` check to match against.
create or replace function agently_handle_new_user() returns trigger as $$
begin
  insert into public.agently_profiles (id, display_name)
  values (new.id, coalesce(split_part(new.email, '@', 1), 'there'));
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function agently_handle_new_user();

-- Safe to re-run against a project that already ran this file before these
-- existed — same "create table if not exists" limitation as agents.version
-- below. Both nullable: a blank profile page shouldn't block anyone.
alter table agently_profiles add column if not exists bio text;
alter table agently_profiles add column if not exists website_url text;

create table if not exists agently_categories (
  slug text primary key,
  name text not null,
  description text
);

insert into agently_categories (slug, name, description) values
  ('content-video', 'Content & Video', 'Editing, captions, pacing, rendering'),
  ('voice-audio', 'Voice & Audio', 'TTS, cleanup, mastering, dubbing'),
  ('research-writing', 'Research & Writing', 'Drafting, summarizing, fact-checking'),
  ('automation', 'Automation', 'Workflows, scraping, scheduled tasks'),
  ('customer-support', 'Customer Support', 'Chat, tickets, FAQ handling'),
  ('coding-dev', 'Coding & Development', 'Code review, security, testing, developer tooling'),
  ('data-analytics', 'Data & Analytics', 'Dashboards, reporting, data pipelines'),
  ('design-ux', 'Design & UX', 'Visual design, animation, UI polish'),
  ('trading-finance', 'Trading & Finance', 'Money math, trading bots, financial correctness'),
  ('sales-marketing', 'Sales & Marketing', 'Ads, copywriting, growth'),
  ('other', 'Other', 'Everything else')
on conflict (slug) do nothing;

-- The catalog. `status` is what the safety-review pipeline (report ch. 5) writes to.
create table if not exists agently_agents (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references agently_profiles(id) on delete cascade,
  slug text not null unique,
  name text not null,
  tagline text not null,
  problem_solved text not null, -- what the concierge/search matches against
  description text not null,
  category_slug text not null references agently_categories(slug),
  pricing_model text not null check (pricing_model in ('one_time', 'subscription', 'free')),
  price_cents integer, -- null when pricing_model = 'free'
  currency text not null default 'eur',
  delivery_url text, -- where the buyer gets the agent (file, repo, API endpoint)
  status text not null default 'pending_review' check (status in ('pending_review', 'approved', 'rejected', 'delisted')),
  review_notes text, -- filled by the safety-review agent (or a human, at MVP stage)
  trust_score integer not null default 0 check (trust_score between 0 and 100),
  stripe_product_id text,
  stripe_price_id text,
  -- Bumped whenever an edit changes what a buyer actually reads or where the
  -- code lives (app/api/agents/[id]/route.ts) — not on every save (a price
  -- or category tweak doesn't mean new code exists). This is what
  -- /api/agents/[slug]/version exists for: an agent delivered as a
  -- standalone script has no reason to ever load the Agently site again,
  -- so it can't see the in-app notification bell. Pinging that endpoint on
  -- its own is the only update signal that reaches it.
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Safe to re-run against a project that already ran this file before
-- `version` existed — `create table if not exists` above wouldn't add it.
alter table agently_agents add column if not exists version integer not null default 1;

-- Raw pageview count for the creator's own dashboard — every render of an
-- approved listing by someone other than its own creator, no dedup, no
-- bot filtering. That's a real limit, said plainly here and in the
-- dashboard copy, not smoothed into "visitors" or "unique views."
alter table agently_agents add column if not exists view_count integer not null default 0;

-- A plain `update agently_agents set view_count = view_count + 1` from application
-- code is a read-modify-write race under real concurrent traffic — two
-- visitors landing in the same instant can both read the same old count
-- and both write old+1, silently dropping a view. This function makes the
-- increment one atomic statement instead.
create or replace function agently_increment_agent_view(agent_id uuid) returns void as $$
begin
  update agently_agents set view_count = view_count + 1 where id = agent_id;
end;
$$ language plpgsql;

-- Semantic search (lib/embeddings.ts) — a listing's name+tagline+problem_solved
-- run through Voyage AI, stored as a plain JSON float array rather than
-- pgvector so this file stays a single SQL Editor paste with no extension
-- step. Ranking is done in application code (cosineSimilarity), which is
-- fine at catalog sizes an early marketplace actually has; a pgvector
-- column + index is the upgrade once that stops being true. Null until
-- VOYAGE_API_KEY is configured — search falls back to substring matching
-- until then, same pattern as trust_score falling back to 0 without
-- ANTHROPIC_API_KEY.
alter table agently_agents add column if not exists embedding jsonb;

create index if not exists agently_agents_status_idx on agently_agents (status);

-- Closes a real race in POST /api/agents: two overlapping submissions from
-- the same creator with identical content (a double-click, or a browser
-- retry) can both pass that route's "was this submitted in the last 15s"
-- SELECT before either request has actually inserted a row — a
-- check-then-insert isn't atomic under real concurrency. dedupe_bucket
-- buckets a submission into a 15-second window computed in application
-- code; this unique index then makes the database itself reject the loser
-- of two concurrent identical inserts with a real constraint violation
-- (23505) — the same dedupe pattern already used for
-- stripe_checkout_session_id in the Stripe webhook — instead of relying on
-- a race-prone read-then-write.
alter table agently_agents add column if not exists dedupe_bucket bigint;
create unique index if not exists agently_agents_dedupe_idx
  on agently_agents (creator_id, name, tagline, md5(description), dedupe_bucket);

-- Backs lib/rate-limit.ts — the only two endpoints that trigger a paid
-- third-party call per request (/api/search's Voyage embedding, and
-- reachable-by-anyone-signed-in /api/agents' Anthropic + Voyage calls).
-- No RLS policy: only the service-role client (lib/supabase/admin.ts)
-- ever touches this table, from server code that isn't acting on behalf
-- of a signed-in user's own session.
create table if not exists agently_rate_limits (
  id uuid primary key default gen_random_uuid(),
  scope text not null, -- e.g. 'search:<ip>' or 'agent_submit:<user_id>'
  created_at timestamptz not null default now()
);

create index if not exists agently_rate_limits_scope_idx on agently_rate_limits (scope, created_at);
create index if not exists agently_agents_category_idx on agently_agents (category_slug);
-- getAgentsByCreator/getMyAgents (lib/catalog.ts) and the active-listing-limit
-- count in app/api/agents/route.ts all filter on creator_id — every creator
-- profile page and dashboard load was a sequential scan without this.
create index if not exists agently_agents_creator_id_idx on agently_agents (creator_id, status);

create table if not exists agently_purchases (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references agently_agents(id) on delete cascade,
  buyer_id uuid not null references agently_profiles(id) on delete cascade,
  stripe_checkout_session_id text not null unique,
  amount_cents integer not null,
  platform_fee_cents integer not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'refunded', 'canceled')),
  created_at timestamptz not null default now()
);

-- app/agents/[slug]/page.tsx checks agent_id+buyer_id+status on every single
-- agent page view (to decide whether to show buy/review UI), and
-- notifyBuyersOfUpdate() (lib/notifications.ts) filters by agent_id+status
-- on every listing edit — both were sequential scans without this.
create index if not exists agently_purchases_agent_buyer_idx on agently_purchases (agent_id, buyer_id, status);
-- getMyPurchases() (lib/catalog.ts) and the "buyers see their own purchases"
-- RLS policy below both filter by buyer_id alone, which isn't a usable
-- prefix of the composite index above (agent_id first) — every load of
-- /dashboard/purchases was a full-table scan on this column for every
-- signed-in user.
create index if not exists agently_purchases_buyer_idx on agently_purchases (buyer_id, status, created_at desc);

-- A buyer of a per-agent subscription (agent.pricing_model = 'subscription')
-- who cancels needs their access revoked, not just their next Stripe
-- invoice stopped — app/agents/[slug]/page.tsx and the file-download gate
-- both read status = 'paid' to decide whether to keep serving the
-- delivery link and files. 'refunded' would be the wrong word for
-- "canceled and stopped paying, no money given back."
alter table agently_purchases drop constraint if exists agently_purchases_status_check;
alter table agently_purchases add constraint agently_purchases_status_check
  check (status in ('pending', 'paid', 'refunded', 'canceled'));

-- Set the first time a buyer actually retrieves the delivery link or a file
-- (app/api/deliveries/[agentId]/route.ts — every real download or delivery
-- redirect goes through there now, not a direct link to the raw
-- destination). app/api/refunds/[purchaseId]/route.ts refuses a
-- self-service refund once this is set: without it, a one-time buyer could
-- download the product and refund it immediately after, keeping both.
alter table agently_purchases add column if not exists delivery_accessed_at timestamptz;

-- Set on a subscription purchase's own insert (checkout.session.completed)
-- so app/api/purchases/[purchaseId]/cancel/route.ts can cancel the exact
-- subscription a buyer is looking at. Before this, there was no way to
-- reach it at all: it isn't the same Stripe customer as an Agently
-- membership (app/api/membership/portal/route.ts's portal only ever
-- covers that one), and app/api/checkout/route.ts never attaches this
-- checkout to a customer record in the first place. Null for a one_time
-- purchase, which has no subscription to cancel.
alter table agently_purchases add column if not exists stripe_subscription_id text;

-- One row per real delivery access (a file download or the delivery_url
-- redirect) through app/api/deliveries/[agentId]/route.ts, for one purchase
-- to keep piling up — the actual signal behind the abuse alert email sent
-- from that same route. Not a general-purpose analytics table: it exists
-- only to answer "how many times has this one purchase's content been
-- retrieved," so an unusually high count on one purchase (well past what a
-- legitimate buyer running their own agent would ever need to redownload)
-- is visible to the platform owner instead of invisible.
create table if not exists agently_downloads (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references agently_purchases(id) on delete cascade,
  file_id uuid references agently_agent_files(id) on delete set null, -- null = the delivery_url itself
  created_at timestamptz not null default now()
);

create index if not exists agently_downloads_purchase_idx on agently_downloads (purchase_id);

-- Written only via the service-role client (app/api/deliveries/[agentId]/route.ts,
-- same as agently_agent_files) — no policy here grants any role direct
-- access, matching that table's own "every access goes through the
-- service-role client" pattern.
alter table agently_downloads enable row level security;

-- How many people a one-time purchase covers (the buyer plus invited
-- teammates) — 1 for every ordinary purchase, only ever >1 for a team
-- purchase (see lib/team-pricing.ts). Drives both the discounted price
-- charged at checkout and how many rows get created below.
alter table agently_purchases add column if not exists seats integer not null default 1;

-- One row per teammate a buyer invites on a team purchase (never the buyer
-- themselves — they already have access via buyer_id on the purchase
-- itself). Created by the webhook right after a team purchase completes
-- (app/api/stripe/webhook/route.ts), emailed via lib/email.ts, and claimed
-- by whoever signs in at app/invite/[token]/page.tsx with a matching email.
-- accepted_by is what every access check (app/agents/[slug]/page.tsx,
-- app/api/deliveries/[agentId]/route.ts) actually looks at — a team member
-- only ever gets delivery access, never refund/cancel/review rights, which
-- stay tied to buyer_id alone.
create table if not exists agently_team_invites (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references agently_purchases(id) on delete cascade,
  -- Denormalized from purchase_id's own agent_id, set once at insert time.
  -- Every access check below needs "does this signed-in user have an
  -- accepted invite for this specific agent," and RLS on agently_purchases
  -- (buyer-only, or the agent's own creator) wouldn't let a team member's
  -- session read the join target to get there — a direct column keeps the
  -- check to one table the policy below already covers, no join needed.
  agent_id uuid not null references agently_agents(id) on delete cascade,
  email text not null,
  token uuid not null default gen_random_uuid() unique,
  accepted_by uuid references agently_profiles(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (purchase_id, email)
);

create index if not exists agently_team_invites_purchase_idx on agently_team_invites (purchase_id);
create index if not exists agently_team_invites_accepted_by_idx on agently_team_invites (accepted_by);

-- Service-role-only, same pattern as agently_downloads and
-- agently_agent_files — every access goes through the admin client.
-- Claiming one (app/invite/[token]/page.tsx) has to work for someone who
-- doesn't have an account yet, so the invite token itself is what proves
-- the right to claim it, not a session. Checking whether a signed-in user
-- already has an accepted seat (app/agents/[slug]/page.tsx,
-- app/api/deliveries/[agentId]/route.ts) also goes through the admin
-- client rather than a narrower RLS policy — that check needs to join to
-- agently_purchases for its live status (so a refunded/canceled purchase's
-- team members lose access too, not just its buyer), and RLS on
-- agently_purchases wouldn't let a team member's own session read that
-- join target.
alter table agently_team_invites enable row level security;

create table if not exists agently_reviews (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references agently_agents(id) on delete cascade,
  buyer_id uuid not null references agently_profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (agent_id, buyer_id)
);

-- getReviewsForAgent (lib/reviews.ts) filters/orders by agent_id+created_at
-- on every agent detail page load; the unique(agent_id, buyer_id) above
-- doesn't serve an agent_id-only filter as well as a dedicated index does.
create index if not exists agently_reviews_agent_id_idx on agently_reviews (agent_id, created_at desc);

-- Keeps agently_agents.updated_at honest on every edit, so "when was this last
-- changed" is never something the app has to remember to set by hand.
create or replace function agently_touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists agents_touch_updated_at on agently_agents;
create trigger agents_touch_updated_at
  before update on agently_agents
  for each row execute function agently_touch_updated_at();

-- One row per buyer per agent-update. Written by the creator's own edit
-- request (app/api/agents/[id]) on behalf of every buyer who owns that
-- agent — the insert policy below is what makes that legitimate without
-- a service-role key: a creator may only insert rows for an agent they
-- actually own, never impersonate notifications for an agent that isn't theirs.
create table if not exists agently_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references agently_profiles(id) on delete cascade,
  agent_id uuid references agently_agents(id) on delete cascade,
  type text not null default 'agent_updated' check (type in ('agent_updated')),
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists agently_notifications_user_idx on agently_notifications (user_id, read);

-- Notifications now also cover a fulfilled agent request, not just an
-- update to an agent someone bought.
alter table agently_notifications drop constraint if exists notifications_type_check;
alter table agently_notifications add constraint notifications_type_check
  check (type in ('agent_updated', 'agent_request_fulfilled'));

-- The admin review screen (/dashboard/admin/agents) tells a creator when
-- their pending listing was decided on.
alter table agently_notifications drop constraint if exists notifications_type_check;
alter table agently_notifications add constraint notifications_type_check
  check (type in ('agent_updated', 'agent_request_fulfilled', 'agent_approved', 'agent_rejected'));

-- A creator previously had no way to know a sale happened — not even
-- in-app — short of checking their own dashboard numbers. Written by the
-- Stripe webhook (service-role client), not the buyer-facing insert policy
-- below (that one only covers a creator notifying their own buyers).
alter table agently_notifications drop constraint if exists notifications_type_check;
alter table agently_notifications add constraint notifications_type_check
  check (type in ('agent_updated', 'agent_request_fulfilled', 'agent_approved', 'agent_rejected', 'agent_sale'));

-- A real bank chargeback (app/api/stripe/webhook/route.ts's
-- charge.dispute.created handler) is time-sensitive — the creator (and the
-- platform owner, by email) needs to know immediately, not just see it
-- eventually in Stripe's own dashboard.
alter table agently_notifications drop constraint if exists notifications_type_check;
alter table agently_notifications add constraint notifications_type_check
  check (type in ('agent_updated', 'agent_request_fulfilled', 'agent_approved', 'agent_rejected', 'agent_sale', 'agent_disputed'));

-- "Describe a problem, get a custom agent built for it" — a Professional-
-- tier perk. Fulfillment itself is manual (someone on the team actually
-- builds it and marks the request fulfilled); there's no automated
-- pipeline that turns a description into working code. status tracks
-- where a request is; fulfilled_agent_id links to the real listing once
-- one exists, so the requester's notification can point straight at it.
create table if not exists agently_agent_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references agently_profiles(id) on delete cascade,
  description text not null,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'fulfilled', 'declined')),
  admin_notes text,
  fulfilled_agent_id uuid references agently_agents(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists agent_requests_touch_updated_at on agently_agent_requests;
create trigger agent_requests_touch_updated_at
  before update on agently_agent_requests
  for each row execute function agently_touch_updated_at();

-- Every membership cancel-initiation and tier switch, so David can actually
-- see over time why people leave and why they upgrade instead of guessing.
-- Written only by the Stripe webhook (app/api/stripe/webhook/route.ts), the
-- one place that ever learns about either event — same "no per-row owner
-- concept RLS can check" reasoning as agently_agent_requests above, so this
-- has no RLS policies at all: RLS is enabled with zero grants, meaning even
-- a signed-in user gets nothing back through the regular client, and only
-- the service-role admin client (webhook writes, the admin dashboard reads)
-- can touch it.
--
-- stripe_event_id is the same natural-key idempotency already used for
-- purchases/invoices elsewhere in this file: it's the Stripe event.id that
-- caused this row, unique so a webhook retry of the exact same delivery
-- can't double-count one cancellation or one upgrade.
--
-- reason_code/reason_comment come from Stripe's own cancellation survey
-- (subscription.cancellation_details) once "Collect a reason for
-- cancellation" is turned on in the Stripe Dashboard's Customer Portal
-- settings — until then they're always null, which the admin view must
-- show as "no reason given", never fabricate. Stripe has no equivalent
-- upgrade-reason survey, so tier_changed rows only ever carry from/to tier
-- (what changed), not why — an in-app prompt would be needed for that,
-- and doesn't exist yet.
create table if not exists agently_membership_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null,
  user_id uuid references agently_profiles(id) on delete set null,
  stripe_subscription_id text not null,
  event_type text not null check (event_type in ('cancel_scheduled', 'tier_changed')),
  from_tier text,
  to_tier text,
  reason_code text,
  reason_comment text,
  period_end timestamptz,
  created_at timestamptz not null default now(),
  -- Not stripe_event_id alone: one delivery of customer.subscription.updated
  -- can legitimately produce both a cancel_scheduled and a tier_changed row
  -- (see app/api/stripe/webhook/route.ts) — a bare unique column would
  -- reject the second insert as a false duplicate of the first.
  unique (stripe_event_id, event_type)
);

create index if not exists agently_membership_events_user_idx on agently_membership_events (user_id);
create index if not exists agently_membership_events_type_idx on agently_membership_events (event_type, created_at desc);

alter table agently_membership_events enable row level security;
-- No policies on purpose (see comment above the table) — service role only.

-- Real files attached to a listing (README, the delivered package, docs) —
-- not just the single delivery_url text field a creator can also still
-- set. Stored in the private 'agently-files' Storage bucket below: never
-- public, because a paid agent's file must not be downloadable by
-- copy-pasting a guessed URL — a gap delivery_url as a plain link already
-- couldn't prevent, so this doesn't repeat it. Every read/write to both
-- this table and the bucket goes through the service-role client
-- (lib/supabase/admin.ts, see lib/agent-files.ts) from server code that
-- has already checked ownership or purchase itself — same reasoning as
-- the Stripe webhook and the agent-request admin routes: there's no single
-- auth.uid() a Storage RLS policy could check that covers "the buyer of
-- this specific paid agent," so the app enforces it before ever touching
-- Storage, not Storage's own RLS.
create table if not exists agently_agent_files (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references agently_agents(id) on delete cascade,
  file_name text not null,
  storage_path text not null unique,
  size_bytes integer not null,
  is_readme boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists agently_agent_files_agent_idx on agently_agent_files (agent_id);

insert into storage.buckets (id, name, public)
values ('agently-files', 'agently-files', false)
on conflict (id) do nothing;

-- Hosted-execution agents (plan/agently-hosted-api-concept.html, decided
-- 6.9.2026): a 'prompt' or 'workflow' agent never hands its actual logic to
-- the buyer at all — it runs on Agently's own infrastructure, and the buyer
-- gets an API key + credit wallet instead of a delivery_url. 'file' (the
-- default) is every listing that exists today, completely unchanged —
-- delivery_url/pricing_model keep meaning exactly what they already mean.
-- Deliberately NOT in scope yet, per that doc's own phased rollout: arbitrary
-- untrusted creator-submitted code (would need E2B/Modal/Northflank-style
-- sandboxing) — there are zero external creators today, so there's nothing
-- to sandbox against yet.
alter table agently_agents add column if not exists agent_kind text not null default 'file' check (agent_kind in ('file', 'prompt', 'workflow'));
-- 'prompt' only. Never sent to the buyer in any response — the whole point
-- of this model (see the doc's "trade secret, not classic IP" framing) is
-- that the buyer gets to call the agent, never to read it. Treated with the
-- same "never log this" discipline as a real secret, even though it isn't
-- one of the app's env-var secrets — see app/api/agents/[slug]/invoke/route.ts.
alter table agently_agents add column if not exists hosted_system_prompt text;
-- 'workflow' only. David's own n8n (or similar) endpoint that Agently calls
-- server-to-server on invoke — never exposed to the buyer, same reasoning as
-- hosted_system_prompt above (a leaked webhook URL is a direct line to the
-- creator's own automation, unrelated to the credit wallet that's supposed
-- to gate it).
alter table agently_agents add column if not exists hosted_webhook_url text;
-- Null when agent_kind = 'file' (no metering applies to a plain download);
-- required for 'prompt'/'workflow' — enforced below, not by a plain
-- `not null`, since the requirement is conditional on agent_kind.
alter table agently_agents add column if not exists credits_per_call integer;
alter table agently_agents drop constraint if exists agently_agents_credits_per_call_check;
alter table agently_agents add constraint agently_agents_credits_per_call_check
  check (
    (agent_kind = 'file' and credits_per_call is null)
    or (agent_kind in ('prompt', 'workflow') and credits_per_call is not null and credits_per_call > 0)
  );

-- The credit wallet backing hosted-agent calls (a monthly allotment, not a
-- balance that accumulates across months — see MEMBERSHIP_TIERS.monthlyCredits
-- in lib/membership.ts and app/api/stripe/webhook/route.ts's refill logic).
-- Default of 20 on every profile (member or not) is ASSUMPTION, same as
-- MEMBERSHIP_TIERS's own placeholder pricing — chosen to be enough to try a
-- hosted agent a handful of times, not measured against real usage.
--
-- JUDGMENT CALL, flagged for David: the concept doc frames a free-call quota
-- as lowering purchase friction "before requiring an active membership," but
-- app/api/agents/[slug]/invoke/route.ts (this build's concrete spec, step 4)
-- requires membership_status = 'active' on every call regardless of
-- api_credits — so these 20 credits currently sit unusable until someone
-- becomes a paying member, which doesn't actually deliver the doc's
-- friction-lowering intent. Left as spec'd rather than silently reinterpreted;
-- worth a real decision on whether a signed-up-but-not-yet-a-member caller
-- should get limited invoke access on their free credits alone.
alter table agently_profiles add column if not exists api_credits integer not null default 20;
alter table agently_profiles add column if not exists api_credits_refreshed_at timestamptz;

-- Same atomic-increment reasoning as agently_increment_agent_view above,
-- applied to refunding credits (app/api/agents/[slug]/invoke/route.ts, step
-- 9: a failed hosted call refunds what step 6 already deducted) — a plain
-- `update ... set api_credits = api_credits + :n` from application code
-- would be a read-modify-write race under concurrent refunds/deductions on
-- the same wallet, same class of bug this function exists to avoid for
-- view_count.
create or replace function agently_add_credits(profile_id uuid, amount integer) returns void as $$
begin
  update agently_profiles set api_credits = api_credits + amount where id = profile_id;
end;
$$ language plpgsql;

-- The other half of the same problem, the direction that actually needs a
-- guard: app/api/agents/[slug]/invoke/route.ts must deduct `cost` credits
-- ONLY if the wallet still has at least that much, in one atomic statement —
-- a separate "read balance, check, then update" from application code is
-- exactly the race two concurrent calls on a nearly-empty wallet would hit,
-- both passing the check before either writes, dropping the balance below
-- zero. Returns whether a row was actually updated: false means either the
-- profile doesn't exist or didn't have enough credit left *at the instant
-- this ran* — which the caller must treat as "insufficient credits," not
-- retry, since retrying would just contend for the same already-spent
-- balance again.
create or replace function agently_deduct_credits(profile_id uuid, cost integer) returns boolean as $$
declare
  affected integer;
begin
  update agently_profiles set api_credits = api_credits - cost
    where id = profile_id and api_credits >= cost;
  get diagnostics affected = row_count;
  return affected > 0;
end;
$$ language plpgsql;

-- Only a hash is ever stored — same principle as a real password or API-key
-- system: the plaintext key is shown to its owner exactly once, at creation
-- (app/api/dashboard/api-keys/route.ts), and never recoverable after that.
-- key_prefix is what the dashboard shows instead, so someone with several
-- keys can tell them apart without the full secret ever being displayed or
-- logged again.
create table if not exists agently_api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references agently_profiles(id) on delete cascade,
  key_hash text not null unique,
  key_prefix text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists agently_api_keys_user_idx on agently_api_keys (user_id) where revoked_at is null;

-- The data a future creator-payout feature (per-agent, per-usage) would
-- aggregate from — deliberately not building that feature now (there is
-- exactly one creator, David, so there's nothing to split payouts between
-- yet), just making sure every real hosted call is logged against the right
-- agent_id/user_id so it can be built on top of this later without a
-- backfill.
create table if not exists agently_agent_invocations (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references agently_agents(id) on delete cascade,
  user_id uuid not null references agently_profiles(id) on delete cascade,
  credits_charged integer not null,
  created_at timestamptz not null default now()
);

create index if not exists agently_agent_invocations_agent_idx on agently_agent_invocations (agent_id, created_at desc);

-- Same "no per-row owner concept RLS can usefully check" reasoning as
-- agently_agent_requests and agently_membership_events above: every read or
-- write of an invocation log goes through the service-role client from
-- server code (the invoke route) that already authenticated the caller by
-- their API key, not a Supabase session — RLS enabled, zero policies,
-- service-role only.
alter table agently_agent_invocations enable row level security;

alter table agently_api_keys enable row level security;
-- Unlike agently_agent_invocations, a signed-in user DOES have a legitimate
-- reason to read this table directly: listing their own keys' prefix/dates
-- on /dashboard/api-keys. key_hash is a one-way hash, not the secret itself
-- (see the comment on the table above), so selecting it changes nothing
-- about security even though the column isn't filtered out below — there's
-- nothing useful to do with a hash you can't reverse. No insert/update/delete
-- policy on purpose: generating a key (which must return the plaintext
-- exactly once) and revoking one both go through the service-role client
-- from app/api/dashboard/api-keys/route.ts, which has already checked the
-- caller owns the row being touched — the same reasoning as every other
-- service-role-only write path in this file.
drop policy if exists "users see their own api keys" on agently_api_keys;
create policy "users see their own api keys" on agently_api_keys for select using (user_id = auth.uid());

-- Row Level Security: catalog is public to read; writes are locked to owners.
alter table agently_profiles enable row level security;
alter table agently_agents enable row level security;
alter table agently_purchases enable row level security;
alter table agently_reviews enable row level security;
alter table agently_notifications enable row level security;
alter table agently_agent_requests enable row level security;
-- No direct-access policies on agently_agent_files — see the comment above the
-- table: every access goes through the service-role client instead.
alter table agently_agent_files enable row level security;
-- Was missing from this list — Supabase's security advisor flagged
-- agently_categories as publicly writable with no RLS at all (not just
-- readable): the fixed list above, seeded once at setup, was never meant
-- to be edited by any client, so read is the only policy it needs.
alter table agently_categories enable row level security;

-- Every policy below is preceded by `drop policy if exists` — a bare
-- `create policy` errors ("already exists") on any re-run, which is exactly
-- what happened the first time this file was pasted twice. Every other
-- statement in this file already tolerates a re-run (`if not exists`, `or
-- replace`); policies are the one DDL form Postgres has no `if not exists`
-- for, so this is the manual equivalent.
drop policy if exists "profiles are self-readable" on agently_profiles;
create policy "profiles are self-readable" on agently_profiles for select using (auth.uid() = id);
drop policy if exists "profiles are self-updatable" on agently_profiles;
create policy "profiles are self-updatable" on agently_profiles for update using (auth.uid() = id);
drop policy if exists "profiles insert on signup" on agently_profiles;
create policy "profiles insert on signup" on agently_profiles for insert with check (auth.uid() = id);

-- RLS policies are row-level only — "self-updatable" above has no way to
-- say *which columns* a user may change. Without the column-privilege lock
-- below, any signed-in user can call the Supabase REST API directly with
-- their own session (the anon key is public, by design) and PATCH their
-- own row to set membership_tier='professional'/membership_status='active'
-- — a full paywall bypass with no payment — since the app's own
-- /api/profile route only ever writes the safe columns, but RLS never
-- stopped a *different* client from writing the rest. Revoking UPDATE
-- entirely and re-granting only the columns Settings actually edits means
-- Postgres itself rejects any write to a money/trust column before RLS is
-- even evaluated; the membership columns are now only ever written by the
-- Stripe webhook's service-role client (lib/supabase/admin.ts), which
-- bypasses grants and RLS alike.
revoke update on agently_profiles from authenticated;
grant update (display_name, account_type, company_name, bio, website_url) on agently_profiles to authenticated;

drop policy if exists "approved agents are public" on agently_agents;
create policy "approved agents are public" on agently_agents for select using (status = 'approved' or creator_id = auth.uid());

drop policy if exists "categories are public" on agently_categories;
create policy "categories are public" on agently_categories for select using (true);

-- Same class of gap as agently_profiles above, for status/trust_score/
-- review_notes: RLS's "creators can update their own agents" (row-level:
-- creator_id = auth.uid()) placed no limit on *which* columns, so a
-- creator could PATCH their own listing directly to status='approved' and
-- trust_score=100, self-approving a rejected or never-reviewed listing and
-- fabricating its trust score — bypassing reviewAgentSubmission() (the
-- safety-review pipeline) entirely. Revoking insert/update from
-- `authenticated` outright (rather than granting a safe column subset, as
-- above) is correct here specifically because app/api/agents/route.ts and
-- app/api/agents/[id]/route.ts now write every agently_agents row through
-- the service-role client after checking ownership/membership in code —
-- there is no longer any legitimate insert or update from a user's own
-- session to carve an exception for.
revoke insert, update on agently_agents from authenticated;

-- Column-level, not the row-level policy above: "approved agents are
-- public" makes every column of an approved row selectable by anyone with
-- the public anon key (by design, same as any other listing field) unless a
-- specific column is locked down separately — Postgres/Supabase grant SELECT
-- on every column of a table to anon/authenticated by default, and RLS only
-- filters *rows*, never columns. hosted_system_prompt is the whole trade
-- secret this hosted-agent model exists to protect (see
-- plan/agently-hosted-api-concept.html) — without this, anyone could read it
-- straight off the Supabase REST API for any approved 'prompt' agent, the
-- exact leak the entire "never hand over the implementation" design is
-- meant to prevent, even though no page in this app ever renders that
-- column. hosted_webhook_url gets the same treatment: it's the creator's own
-- internal automation endpoint, not something a buyer calling through the
-- metered /api/agents/[slug]/invoke route (app code, using the service-role
-- client — unaffected by this revoke) has any legitimate reason to see
-- directly.
revoke select (hosted_system_prompt, hosted_webhook_url) on agently_agents from authenticated, anon;

drop policy if exists "buyers see their own purchases" on agently_purchases;
create policy "buyers see their own purchases" on agently_purchases for select using (buyer_id = auth.uid());
-- Without this, notifyBuyersOfUpdate() (lib/notifications.ts) queries
-- agently_purchases with the creator's own session to find who to notify, and RLS
-- silently returns zero rows — a creator can never see their own agent's
-- buyer list, and the update-notification feature never fires.
drop policy if exists "creators see purchases of their own agents" on agently_purchases;
create policy "creators see purchases of their own agents" on agently_purchases for select
  using (exists (select 1 from agently_agents where agently_agents.id = agent_id and agently_agents.creator_id = auth.uid()));
-- Paid purchases are written by the webhook via the service-role key (bypasses
-- RLS — see lib/supabase/admin.ts). This policy only covers the one purchase
-- a signed-in user can legitimately record for themselves: claiming a free
-- agent, which never touches Stripe.
--
-- /api/checkout already refuses to let a creator "buy" their own agent, but
-- that's app code, not the database — this is the actual backstop. Without
-- the creator_id exclusion below, a creator could insert a free-agent
-- purchase row for their own listing directly (bypassing the app check
-- entirely) and use it to satisfy "buyers can write their own review"
-- further down: a free, instant path to a verified-buyer review on your
-- own agent.
drop policy if exists "buyers can claim free agents" on agently_purchases;
create policy "buyers can claim free agents" on agently_purchases for insert
  with check (
    buyer_id = auth.uid()
    and exists (
      select 1 from agently_agents
      where agently_agents.id = agent_id
        and agently_agents.pricing_model = 'free'
        and agently_agents.creator_id <> auth.uid()
    )
  );
-- The free-agent claim in app/api/checkout/route.ts upserts on a
-- deterministic conflict key (free_<agent>_<buyer>), so re-clicking "Get
-- this agent" always hits the ON CONFLICT DO UPDATE branch, not a fresh
-- insert. RLS checks that branch as an UPDATE — without this, the very
-- first claim would succeed and every one after it would fail.
-- Missing a WITH CHECK here (before this fix) meant Postgres reused USING
-- for the new row too — which never excluded creator_id = auth.uid(), unlike
-- the INSERT policy right above it. Concrete exploit: a creator who already
-- holds any free-agent purchase row (buyer_id = self) could call the
-- Supabase REST API directly with their own session — bypassing
-- app/api/checkout/route.ts's explicit self-buy check entirely — and PATCH
-- that row's agent_id to their own free listing, self-servicing a
-- fabricated status='paid' purchase and unlocking a "verified buyer" review
-- on their own agent. WITH CHECK re-validates the *new* row against the same
-- creator exclusion the INSERT policy already enforces.
drop policy if exists "buyers can re-claim free agents" on agently_purchases;
create policy "buyers can re-claim free agents" on agently_purchases for update
  using (
    buyer_id = auth.uid()
    and exists (select 1 from agently_agents where agently_agents.id = agent_id and agently_agents.pricing_model = 'free')
  )
  with check (
    buyer_id = auth.uid()
    and exists (
      select 1 from agently_agents
      where agently_agents.id = agent_id
        and agently_agents.pricing_model = 'free'
        and agently_agents.creator_id <> auth.uid()
    )
  );
-- Belt-and-suspenders alongside the WITH CHECK above, matching the pattern
-- already used for agently_profiles/agently_agents: the only legitimate
-- update through this policy (app/api/checkout/route.ts's free-agent
-- upsert, re-clicking "Get this agent") only ever re-sets status to the
-- same 'paid' value — agent_id, buyer_id, and the amount columns never need
-- to change. Revoking broad UPDATE means a direct REST call can't touch
-- agent_id even if some future edit to the policy above reopened the gap.
revoke update on agently_purchases from authenticated;
grant update (status) on agently_purchases to authenticated;

drop policy if exists "reviews are public" on agently_reviews;
create policy "reviews are public" on agently_reviews for select using (true);
-- A review requires an actual (paid) purchase row for that agent — without
-- this, any signed-in visitor could review any agent, including one they
-- never bought or their own listing, which is exactly what the trust score
-- and safety review exist to prevent.
drop policy if exists "buyers can write their own review" on agently_reviews;
create policy "buyers can write their own review" on agently_reviews for insert
  with check (
    buyer_id = auth.uid()
    and exists (
      select 1 from agently_purchases
      where agently_purchases.agent_id = agently_reviews.agent_id
        and agently_purchases.buyer_id = auth.uid()
        and agently_purchases.status = 'paid'
    )
  );
-- The reviews route upserts (ON CONFLICT (agent_id, buyer_id) DO UPDATE) so
-- a buyer re-submitting their review updates it instead of erroring on the
-- unique constraint — but RLS checks the actual UPDATE that runs on a
-- conflict, and without this policy there was none, so the row a buyer
-- already owns could be inserted once and never touched again.
-- Same missing-WITH CHECK gap as agently_purchases above: without one, a
-- buyer could PATCH their own existing review row's agent_id directly via
-- the Supabase REST API to point at a different agent — including one they
-- never bought or their own listing — fabricating a "verified" review with
-- no re-check against agently_purchases. WITH CHECK re-runs the same
-- paid-purchase-exists condition the INSERT policy already requires,
-- against the row's new agent_id.
drop policy if exists "buyers can update their own review" on agently_reviews;
create policy "buyers can update their own review" on agently_reviews for update
  using (buyer_id = auth.uid())
  with check (
    buyer_id = auth.uid()
    and exists (
      select 1 from agently_purchases
      where agently_purchases.agent_id = agently_reviews.agent_id
        and agently_purchases.buyer_id = auth.uid()
        and agently_purchases.status = 'paid'
    )
  );
-- Same belt-and-suspenders as agently_purchases/agently_profiles: the only
-- legitimate update through this policy (app/api/reviews/route.ts's upsert
-- on re-submitting a review) only ever touches rating/comment — agent_id
-- and buyer_id never need to change on an existing review row.
revoke update on agently_reviews from authenticated;
grant update (rating, comment) on agently_reviews to authenticated;

drop policy if exists "users see their own notifications" on agently_notifications;
create policy "users see their own notifications" on agently_notifications for select using (user_id = auth.uid());
drop policy if exists "users mark their own notifications read" on agently_notifications;
create policy "users mark their own notifications read" on agently_notifications for update using (user_id = auth.uid());
-- Originally checked only that the caller owns the agent — not that
-- `user_id` is an actual buyer of it, so a creator could insert an
-- arbitrary "notification" targeting any known user id as long as they own
-- some agent. Now also requires a real paid purchase row linking that
-- buyer to that agent, matching what the message is supposed to mean.
drop policy if exists "creators notify their own agent's buyers" on agently_notifications;
create policy "creators notify their own agent's buyers" on agently_notifications for insert
  with check (
    exists (select 1 from agently_agents where agently_agents.id = agent_id and agently_agents.creator_id = auth.uid())
    and exists (
      select 1 from agently_purchases
      where agently_purchases.agent_id = agently_notifications.agent_id
        and agently_purchases.buyer_id = agently_notifications.user_id
        and agently_purchases.status = 'paid'
    )
  );

drop policy if exists "requesters see their own agent requests" on agently_agent_requests;
create policy "requesters see their own agent requests" on agently_agent_requests for select
  using (requester_id = auth.uid());
-- Enforced here too, not just in app/api/requests/route.ts — a
-- Professional-tier perk isn't real if only the UI hides the form for
-- everyone else.
drop policy if exists "professional members can request an agent" on agently_agent_requests;
create policy "professional members can request an agent" on agently_agent_requests for insert
  with check (
    requester_id = auth.uid()
    and exists (
      select 1 from agently_profiles
      where agently_profiles.id = auth.uid() and agently_profiles.membership_tier = 'professional'
    )
  );
-- No admin update/select policy here on purpose — the fulfillment routes
-- (app/api/requests/[id]/route.ts) run through the service-role client
-- (lib/supabase/admin.ts), same as the Stripe webhook, since there's no
-- per-row "is this person the platform owner" concept RLS can check.
