# Agently

Catalog for AI agents — upload one, sell it (one-time, subscription, or
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
- **Safety-review agent, first pass** (`lib/safety-review.ts`) — a Claude
  call judges a new submission's description for vague or overly-broad
  access claims. `low` risk auto-approves; `medium`/`high` (or no
  `ANTHROPIC_API_KEY` configured) leaves it `pending_review` for a human,
  same as before this existed. It judges what's *written*, not the agent's
  actual code — that's still a real limit, not solved by this.
- **Semantic search** (`lib/embeddings.ts`, `app/api/search`) — `/browse`
  ranks by meaning (Voyage AI embeddings + cosine similarity) when
  `VOYAGE_API_KEY` is set, falling back to substring matching otherwise —
  same "missing key means fall back, not break" pattern as the safety
  review. `/dashboard/admin/requests` has a one-time button to embed any
  listing that predates this.
- **File attachments** (`lib/agent-files.ts`, upload/edit forms) — a
  listing can carry real files (the package, docs), not just the
  `delivery_url` text field. Stored in a private Supabase Storage bucket;
  download links are signed fresh per page render for the buyer or the
  creator only, never public. A file named `README.md` (or `.txt`) renders
  on the listing page automatically — sanitized (`sanitize-html`) before
  it's ever set as HTML, since it's a creator's own upload, not reviewed
  text.
- **Browse sort + a "has files" signal** — `/browse` sorts by trust score
  or price, not just newest, and a card shows whether a listing has a real
  file attached before you ever click in (relevance still wins while
  actively searching by text).
- **Creator stats** (`/dashboard/agents`) — raw page-view count per
  listing (`increment_agent_view`, atomic, excludes the creator's own
  visits) and a real sale count from `purchases`. Called a page-view count
  on purpose, not "visitors" — there's no dedup or bot filtering, and the
  dashboard says so.

## Not built yet (intentionally — see report ch. 13-14)

- Any hosted execution / sandboxing — that's phase 2, not part of this MVP.

## What I need from you before this goes live

Everything above is written and ready — it just has nothing to connect to
yet. Three things only you can do:

1. **Use an existing Supabase project** — Supabase's free tier caps at 2
   projects per account, so this reuses one rather than paying for Supabase
   Pro. Open that project → SQL Editor → run `supabase/schema.sql` (every
   table it creates is prefixed `agently_`, so it can't collide with
   whatever else already lives in that project) → copy the Project URL and
   `anon` public key into Vercel's Environment Variables as
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Also copy
   the **service_role** key (Project Settings → API) into Vercel as
   `SUPABASE_SERVICE_ROLE_KEY` — the Stripe webhook, admin approve/reject
   routes, and file uploads all use it (no signed-in session for RLS to
   check against) and quietly return an error on every request that needs
   it until it's set.
2. **Create a Stripe account**, enable Connect → copy the secret key into
   Vercel as `STRIPE_SECRET_KEY`. Once the account exists, add a webhook
   pointed at `https://<your-domain>/api/stripe/webhook` for
   `checkout.session.completed`, `charge.refunded`, `invoice.paid`,
   `customer.subscription.*`, and `account.updated` (that last one is
   what turns on a creator's payouts), then put its signing secret in
   Vercel as `STRIPE_WEBHOOK_SECRET`.
3. **Connect this repo to the Vercel project** in its Git settings — the
   deploy exists already, it just isn't wired to `main` yet.
4. **Optional** — add `ANTHROPIC_API_KEY` to Vercel to turn on automated
   safety review for new submissions. Skip it and everything still works
   exactly as it does today: every submission just waits for you.
5. **Optional** — add `VOYAGE_API_KEY` (voyageai.com) to Vercel to turn on
   semantic search. Skip it and `/browse` keeps working with substring
   matching, same as today.
6. **Add `PLATFORM_OWNER_EMAIL`** to Vercel — your own sign-in email,
   exactly as you sign in with it. This isn't optional in practice: it's
   what gates `/dashboard/admin/agents` (approve/reject new listings) and
   `/dashboard/admin/requests` (fulfill custom agent requests) to you and
   no one else. Skip it and both pages 404 for everyone, including you —
   every submission is stuck in `pending_review` forever with no page that
   can move it out.
7. **Optional** — create a free Resend account (resend.dev, 100
   emails/day free) and add `RESEND_API_KEY` to Vercel to turn on email
   for the events that already notify in-app (a listing approved or
   rejected, a requested agent fulfilled) — otherwise a creator or buyer
   only sees those by opening the site and checking the bell. Skip it and
   nothing breaks; those events just stay in-app only, same as today.
   Once you verify your own domain in Resend, also set
   `RESEND_FROM_EMAIL` (e.g. `Agently <notifications@yourdomain.com>`) —
   without it, email sends from Resend's shared `onboarding@resend.dev`
   sandbox address, which works but looks like a test sender.

Nothing here needs a decision from you beyond creating those accounts —
the code already assumes the schema and env var names above. File
attachments need nothing extra: `supabase/schema.sql` creates the private
Storage bucket itself when you run it.

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

