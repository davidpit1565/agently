import { createClient } from "@/lib/supabase/server";

// The chart/table only ever show the last 30 days, but the daily buckets go back
// 90 so a client-side range toggle (7/30/90) and the prior-30-vs-current-30
// comparison badge can both slice this same array — no second Supabase round trip.
const DAILY_WINDOW_DAYS = 90;
const COMPARISON_WINDOW_DAYS = 30;
// Per-agent sparkline: a cheap trend indicator built from rows already in memory,
// deliberately shorter than the full daily window so a quiet agent's line isn't
// mostly flat zeros.
const SPARKLINE_WINDOW_DAYS = 14;

function supabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export type DailyPoint = { date: string; netCents: number; grossCents: number; sales: number };

export type AgentEarnings = {
  agentId: string;
  name: string;
  slug: string;
  status: string;
  trustScore: number;
  sales: number;
  grossCents: number;
  platformFeeCents: number;
  netCents: number;
  /** Net revenue per day for the last SPARKLINE_WINDOW_DAYS days, oldest first. */
  sparkline: number[];
};

export type CreatorAnalytics = {
  totalSales: number;
  totalGrossCents: number;
  totalPlatformFeeCents: number;
  totalNetCents: number;
  last30DaysNetCents: number;
  last30DaysSales: number;
  /** The 30 days immediately before last30Days*, for the comparison badge. */
  prev30DaysNetCents: number;
  prev30DaysSales: number;
  perAgent: AgentEarnings[];
  /** Oldest-first, DAILY_WINDOW_DAYS long — a client-side range toggle slices from the end. */
  daily: DailyPoint[];
  failed: boolean;
};

function emptyAnalytics(failed: boolean): CreatorAnalytics {
  return {
    totalSales: 0,
    totalGrossCents: 0,
    totalPlatformFeeCents: 0,
    totalNetCents: 0,
    last30DaysNetCents: 0,
    last30DaysSales: 0,
    prev30DaysNetCents: 0,
    prev30DaysSales: 0,
    perAgent: [],
    daily: [],
    failed,
  };
}

function dateKey(iso: string): string {
  return iso.slice(0, 10); // "2026-09-06T..." -> "2026-09-06", UTC calendar day
}

/** Every paid sale across every agent this creator owns, with money broken
 *  down two ways: by agent (the per-listing table) and by day (the chart).
 *  Net = amount_cents - platform_fee_cents — what Stripe's destination
 *  charge actually sends to the creator's connected account, not the raw
 *  price a buyer paid (see app/api/checkout/route.ts's application_fee_amount).
 *  RLS ("creators see purchases of their own agents", supabase/schema.sql)
 *  already scopes every row to agents this signed-in user owns — no
 *  explicit creator_id filter needed on the purchases query itself. */
export async function getCreatorAnalytics(userId: string): Promise<CreatorAnalytics> {
  if (!supabaseConfigured()) return emptyAnalytics(false);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agently_purchases")
    .select(
      "agent_id, amount_cents, platform_fee_cents, created_at, agently_agents(name, slug, status, trust_score)"
    )
    .eq("status", "paid")
    .order("created_at", { ascending: true });

  if (error) return emptyAnalytics(true);

  const rows = (data ?? []) as unknown as {
    agent_id: string;
    amount_cents: number;
    platform_fee_cents: number;
    created_at: string;
    agently_agents: { name: string; slug: string; status: string; trust_score: number } | null;
  }[];

  const perAgentMap = new Map<string, AgentEarnings>();
  let totalSales = 0;
  let totalGrossCents = 0;
  let totalPlatformFeeCents = 0;

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const windowStart = new Date(today);
  windowStart.setUTCDate(windowStart.getUTCDate() - (DAILY_WINDOW_DAYS - 1));

  const dailyMap = new Map<string, DailyPoint>();
  for (let i = 0; i < DAILY_WINDOW_DAYS; i++) {
    const d = new Date(windowStart);
    d.setUTCDate(d.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    dailyMap.set(key, { date: key, netCents: 0, grossCents: 0, sales: 0 });
  }

  // Index into the sparkline array (oldest first) for each date within its window,
  // so per-agent sparklines can be filled in the same pass instead of a second query.
  const sparklineStart = new Date(today);
  sparklineStart.setUTCDate(sparklineStart.getUTCDate() - (SPARKLINE_WINDOW_DAYS - 1));
  const sparklineIndex = new Map<string, number>();
  for (let i = 0; i < SPARKLINE_WINDOW_DAYS; i++) {
    const d = new Date(sparklineStart);
    d.setUTCDate(d.getUTCDate() + i);
    sparklineIndex.set(d.toISOString().slice(0, 10), i);
  }

  for (const row of rows) {
    if (!row.agently_agents) continue; // agent deleted since — nothing left to attribute this sale to

    const net = row.amount_cents - row.platform_fee_cents;
    totalSales++;
    totalGrossCents += row.amount_cents;
    totalPlatformFeeCents += row.platform_fee_cents;

    const existing = perAgentMap.get(row.agent_id);
    if (existing) {
      existing.sales++;
      existing.grossCents += row.amount_cents;
      existing.platformFeeCents += row.platform_fee_cents;
      existing.netCents += net;
    } else {
      perAgentMap.set(row.agent_id, {
        agentId: row.agent_id,
        name: row.agently_agents.name,
        slug: row.agently_agents.slug,
        status: row.agently_agents.status,
        trustScore: row.agently_agents.trust_score,
        sales: 1,
        grossCents: row.amount_cents,
        platformFeeCents: row.platform_fee_cents,
        netCents: net,
        sparkline: new Array(SPARKLINE_WINDOW_DAYS).fill(0),
      });
    }

    const key = dateKey(row.created_at);
    const bucket = dailyMap.get(key);
    if (bucket) {
      bucket.sales++;
      bucket.grossCents += row.amount_cents;
      bucket.netCents += net;
    }

    const sparkIdx = sparklineIndex.get(key);
    if (sparkIdx !== undefined) {
      // Look the entry back up rather than reusing `existing` — it may have
      // just been created a few lines above, in this same iteration.
      perAgentMap.get(row.agent_id)!.sparkline[sparkIdx] += net;
    }
  }

  const daily = [...dailyMap.values()];
  const last30 = daily.slice(-COMPARISON_WINDOW_DAYS);
  const prev30 = daily.slice(-COMPARISON_WINDOW_DAYS * 2, -COMPARISON_WINDOW_DAYS);
  const last30DaysNetCents = last30.reduce((sum, d) => sum + d.netCents, 0);
  const last30DaysSales = last30.reduce((sum, d) => sum + d.sales, 0);
  const prev30DaysNetCents = prev30.reduce((sum, d) => sum + d.netCents, 0);
  const prev30DaysSales = prev30.reduce((sum, d) => sum + d.sales, 0);

  const perAgent = [...perAgentMap.values()].sort((a, b) => b.netCents - a.netCents);

  return {
    totalSales,
    totalGrossCents,
    totalPlatformFeeCents,
    totalNetCents: totalGrossCents - totalPlatformFeeCents,
    last30DaysNetCents,
    last30DaysSales,
    prev30DaysNetCents,
    prev30DaysSales,
    perAgent,
    daily,
    failed: false,
  };
}
