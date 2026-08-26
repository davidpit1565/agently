-- Agently — core schema
-- Run this once against a new Supabase project (SQL Editor, or `supabase db push`).
-- Matches the model decided in the market research report: membership gates
-- uploading, a per-sale platform fee is separate from membership revenue,
-- and every agent carries a visible trust score instead of star ratings.

create extension if not exists "pgcrypto";

-- One row per authenticated user, extending Supabase's built-in auth.users.
create table if not exists profiles (
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

create table if not exists categories (
  slug text primary key,
  name text not null,
  description text
);

insert into categories (slug, name, description) values
  ('content-video', 'Content & Video', 'Editing, captions, pacing, rendering'),
  ('voice-audio', 'Voice & Audio', 'TTS, cleanup, mastering, dubbing'),
  ('research-writing', 'Research & Writing', 'Drafting, summarizing, fact-checking'),
  ('automation', 'Automation', 'Workflows, scraping, scheduled tasks'),
  ('customer-support', 'Customer Support', 'Chat, tickets, FAQ handling'),
  ('other', 'Other', 'Everything else')
on conflict (slug) do nothing;

-- The catalog. `status` is what the safety-review pipeline (report ch. 5) writes to.
create table if not exists agents (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references profiles(id) on delete cascade,
  slug text not null unique,
  name text not null,
  tagline text not null,
  problem_solved text not null, -- what the concierge/search matches against
  description text not null,
  category_slug text not null references categories(slug),
  pricing_model text not null check (pricing_model in ('one_time', 'subscription', 'free')),
  price_cents integer, -- null when pricing_model = 'free'
  currency text not null default 'eur',
  delivery_url text, -- where the buyer gets the agent (file, repo, API endpoint)
  status text not null default 'pending_review' check (status in ('pending_review', 'approved', 'rejected', 'delisted')),
  review_notes text, -- filled by the safety-review agent (or a human, at MVP stage)
  trust_score integer not null default 0 check (trust_score between 0 and 100),
  stripe_product_id text,
  stripe_price_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agents_status_idx on agents (status);
create index if not exists agents_category_idx on agents (category_slug);

create table if not exists purchases (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references agents(id) on delete cascade,
  buyer_id uuid not null references profiles(id) on delete cascade,
  stripe_checkout_session_id text not null unique,
  amount_cents integer not null,
  platform_fee_cents integer not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'refunded')),
  created_at timestamptz not null default now()
);

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references agents(id) on delete cascade,
  buyer_id uuid not null references profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (agent_id, buyer_id)
);

-- Keeps agents.updated_at honest on every edit, so "when was this last
-- changed" is never something the app has to remember to set by hand.
create or replace function touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists agents_touch_updated_at on agents;
create trigger agents_touch_updated_at
  before update on agents
  for each row execute function touch_updated_at();

-- One row per buyer per agent-update. Written by the creator's own edit
-- request (app/api/agents/[id]) on behalf of every buyer who owns that
-- agent — the insert policy below is what makes that legitimate without
-- a service-role key: a creator may only insert rows for an agent they
-- actually own, never impersonate notifications for an agent that isn't theirs.
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  agent_id uuid references agents(id) on delete cascade,
  type text not null default 'agent_updated' check (type in ('agent_updated')),
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on notifications (user_id, read);

-- Row Level Security: catalog is public to read; writes are locked to owners.
alter table profiles enable row level security;
alter table agents enable row level security;
alter table purchases enable row level security;
alter table reviews enable row level security;
alter table notifications enable row level security;

create policy "profiles are self-readable" on profiles for select using (auth.uid() = id);
create policy "profiles are self-updatable" on profiles for update using (auth.uid() = id);
create policy "profiles insert on signup" on profiles for insert with check (auth.uid() = id);

create policy "approved agents are public" on agents for select using (status = 'approved' or creator_id = auth.uid());
create policy "members can insert their own agents" on agents for insert with check (creator_id = auth.uid());
create policy "creators can update their own agents" on agents for update using (creator_id = auth.uid());

create policy "buyers see their own purchases" on purchases for select using (buyer_id = auth.uid());

create policy "reviews are public" on reviews for select using (true);
create policy "buyers can write their own review" on reviews for insert with check (buyer_id = auth.uid());

create policy "users see their own notifications" on notifications for select using (user_id = auth.uid());
create policy "users mark their own notifications read" on notifications for update using (user_id = auth.uid());
create policy "creators notify their own agent's buyers" on notifications for insert
  with check (exists (select 1 from agents where agents.id = agent_id and agents.creator_id = auth.uid()));
