# Agently

Marketplace for AI agents — upload one, sell it (one-time, subscription, or
free), and let buyers find it by describing the problem they have instead of
picking a category.

Two AI pieces do the real work:

- **Reviewer agent** — checks every uploaded agent's requested permissions and
  behavior for risk before it goes live, and writes its listing description.
- **Concierge agent** — takes a buyer's plain-language problem and matches it
  to the agents that solve it.

This is a coming-soon landing page. Nothing beyond the static shell is built
yet — see the market research report for the full plan before the catalog,
payments, and review pipeline get built.

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Deployed on Vercel
- Planned: Supabase (Postgres + Auth + Storage), Stripe Connect for payments

## Local dev

```
npm install
npm run dev
```

## Secrets

Same rule as every other project here: secrets live only in Vercel
environment variables. Never in chat, never in git.
