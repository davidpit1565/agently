# Connecting Agently — the last step

Everything in this repo is written and waiting on two accounts only you
can create (they need your identity/billing, not something I can do for
you). This is the exact path, phone-friendly, boring-but-reliable.

## Part 1 — Supabase (~5 minutes)

1. Open **supabase.com** in the browser.
2. Top right, tap **"Start your project"**.
3. Sign in with GitHub (the same account this repo lives in — fewer
   passwords to juggle) or an email.
4. Tap **"New project"**.
5. Pick an organization — if this is your first time, Supabase creates
   one named after your account automatically. Use it.
6. **Name**: type `agently`.
7. **Database Password**: tap the **Generate a password** button next to
   the field, then tap the copy icon and paste it somewhere safe (a notes
   app) — you won't need it again unless you connect a database tool
   directly later.
8. **Region**: pick the one closest to where you expect most buyers —
   Frankfurt or Amsterdam for Europe.
9. Leave the pricing plan on **Free**.
10. Tap **"Create new project"** at the bottom. It takes 1-2 minutes —
    a progress screen shows while the database provisions.
11. Once it's ready, on the left sidebar tap the gear icon **⚙ Project
    Settings** (near the bottom).
12. Tap **"Data API"** in the settings list.
13. You'll see **"Project URL"** — tap the copy icon next to it. This is
    what goes into Vercel as `NEXT_PUBLIC_SUPABASE_URL`.
14. Still on that page, find **"anon public"** under API keys — tap copy
    next to it. This goes into Vercel as `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
15. On the same page, find **"service_role"** under API keys — tap
    **"Reveal"**, then copy it. This goes into Vercel as
    `SUPABASE_SERVICE_ROLE_KEY`. It's more powerful than the anon key
    (it skips every access rule in the database), which is exactly why
    only one thing in this repo uses it — the Stripe webhook, the one
    place that has no signed-in visitor to check permissions against.
    Never put this one in anything client-facing.
16. On the left sidebar, tap the **SQL Editor** icon (looks like `>_`).
17. Tap **"New query"**.
18. Open `supabase/schema.sql` from this repo, select all its text, copy
    it, and paste it into the SQL editor box.
19. Tap **"Run"** (bottom right, or Ctrl/Cmd+Enter). A success message
    appears — that's the whole database structure created in one shot.

## Part 2 — Stripe (~5 minutes)

1. Open **stripe.com** in the browser, tap **"Start now"**.
2. Fill in email, name, and a password — no business details required
   yet to get a test/live key.
3. Once in the dashboard, top right, make sure the toggle says
   **"Test mode"** while you're wiring this up (switch to live later,
   same steps).
4. Left sidebar, tap **"Developers"**, then **"API keys"**.
5. Under **"Standard keys"**, find **"Secret key"** — tap **"Reveal test
   key"**, then copy it. This goes into Vercel as `STRIPE_SECRET_KEY`.
6. Still in Developers, tap **"Webhooks"**, then **"Add endpoint"**.
7. **Endpoint URL**: `https://agently-orcin.vercel.app/api/stripe/webhook`
8. Tap **"Select events"**, and check these four: `checkout.session.completed`,
   `customer.subscription.updated`, `customer.subscription.deleted`,
   `account.updated`. Tap **"Add events"**.
9. Tap **"Add endpoint"**.
10. On the endpoint's page, find **"Signing secret"**, tap **"Reveal"**,
    copy it. This goes into Vercel as `STRIPE_WEBHOOK_SECRET`.
11. Left sidebar, **"Settings"** → **"Connect"** → tap **"Get started"**
    to enable Connect on your account (needed for creator payouts —
    a few plain questions about the platform, no bank details required
    at this step).

## Part 3 — Vercel (~2 minutes)

1. Open **vercel.com**, go to the **agently** project.
2. Tap **"Settings"**, then **"Environment Variables"** in the left list.
3. Add each of these one at a time — name, then value, then **"Save"**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
4. Once all five are saved, go to the **"Deployments"** tab, tap the
   **⋯** menu on the latest deployment, tap **"Redeploy"** — new env vars
   only take effect on a fresh build.

That's it — at that point every page and API route in this repo starts
reading and writing real data instead of the seed fallback.
