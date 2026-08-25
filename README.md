# Agently

Marketplace for AI agents — upload one, sell it (one-time, subscription, or
free), and let buyers find it by describing the problem they have instead of
picking a category. Membership (not per-listing fees) is what gates who can
upload — see the market research report, chapters 12 and 14, for why.

## What's built

- **Catalog** (`/browse`, `/agents/[slug]`) — reads from Supabase, falls back
  to five real seed agents (`data/seed-agents.ts`) so the site has something
  genuine to show before the database is connected.
- **Membership** (`/pricing`) — three tiers, prices marked as placeholders
  until there's real usage data to price against (report ch. 12).
- **Auth** (`/auth/sign-in`) — Supabase magic-link, no password.
- **Upload** (`/dashboard/upload`) — gated on an active paid membership;
  submissions land as `pending_review`, never auto-published.
- **Payments** — Stripe Checkout for one-time/subscription agent purchases,
  split via Stripe Connect (`application_fee_amount` + `transfer_data` to
  the creator's connected account — both have to be set together, or the
  fee split silently doesn't happen), plus a webhook
  (`app/api/stripe/webhook`) that records purchases, membership status, and
  when a creator's payout account becomes chargeable.
- **Creator payouts** (`/dashboard/payouts`, `app/api/stripe/connect`) —
  Stripe Express onboarding for creators. Checkout refuses to sell a paid
  agent whose creator hasn't finished this — there'd be nowhere for their
  share of the sale to go.
- **Reviews** (`lib/reviews.ts`, `app/api/reviews`) — star rating + comment
  per buyer per agent, shown on the agent page. One review per buyer,
  editable, not duplicable.
- **Membership limits enforced server-side** — the "up to N listings" per
  tier on `/pricing` is checked in `app/api/agents` at insert time, not
  just displayed as copy.
- **Database schema** (`supabase/schema.sql`) — profiles, agents,
  categories, purchases, reviews, with row-level security so buyers only see
  approved listings and everyone only edits their own rows.

## Not built yet (intentionally — see report ch. 13-14)

- The safety-review agent and the concierge/matching agent — phase 1 uses
  manual review; both are AI work that comes after there's real supply to
  review and real searches to match.
- Any hosted execution / sandboxing — that's phase 2, not part of this MVP.

## What I need from you before this goes live

Everything above is written and ready — it just has nothing to connect to
yet. Three things only you can do:

1. **Create a Supabase project** (supabase.com, free tier is enough to
   start) → run `supabase/schema.sql` in its SQL editor → copy the Project
   URL and `anon` public key into Vercel's Environment Variables as
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
2. **Create a Stripe account**, enable Connect → copy the secret key into
   Vercel as `STRIPE_SECRET_KEY`. Once the account exists, add a webhook
   pointed at `https://<your-domain>/api/stripe/webhook` for
   `checkout.session.completed`, `customer.subscription.*`, and
   `account.updated` (that last one is what turns on a creator's payouts),
   then put its signing secret in Vercel as `STRIPE_WEBHOOK_SECRET`.
3. **Connect this repo to the Vercel project** in its Git settings — the
   deploy exists already, it just isn't wired to `main` yet.

Nothing here needs a decision from you beyond creating those two accounts —
the code already assumes the schema and env var names above.

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind
- Supabase — Postgres, Auth, row-level security
- Stripe — Checkout + Connect for the marketplace fee split
- Deployed on Vercel

## Local dev

```
npm install
cp .env.example .env.local   # fill in after you've created the accounts above
npm run dev
```

## Secrets

Same rule as every other project here: secrets live only in Vercel
environment variables. Never in chat, never in git.
