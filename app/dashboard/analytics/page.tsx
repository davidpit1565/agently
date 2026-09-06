import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCreatorAnalytics } from "@/lib/analytics";
import { formatEuros } from "@/lib/format";
import { Notice } from "@/app/components/form-field";
import { Reveal } from "@/app/components/reveal";
import { CounterUp } from "@/app/components/counter-up";
import { TrustRing } from "@/app/components/trust-ring";
import { TimeSeriesChart } from "@/app/components/charts/time-series-chart";

const STATUS_LABEL: Record<string, string> = {
  approved: "Live",
  pending_review: "Pending review",
  rejected: "Rejected",
  delisted: "Delisted",
};

function euros(cents: number): string {
  return `€${formatEuros(cents)}`;
}

export default async function AnalyticsPage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return (
      <Notice title="Not connected yet">
        This page needs Supabase configured before it can show real earnings.
      </Notice>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <Notice title="Sign in first">You need an account to see your earnings.</Notice>;
  }

  const analytics = await getCreatorAnalytics(user.id);
  const averageNetPerSale = analytics.totalSales > 0 ? Math.round(analytics.totalNetCents / analytics.totalSales) : 0;

  const revenuePoints = analytics.daily.map((d) => ({ date: d.date, value: d.netCents }));
  const salesPoints = analytics.daily.map((d) => ({ date: d.date, value: d.sales }));

  return (
    <main className="mx-auto max-w-4xl px-6 py-16 sm:py-20">
      <div className="mb-8 flex animate-fade-up flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-balance font-display text-2xl font-semibold">Analytics</h1>
          <p className="mt-1 text-sm text-ink-faint">
            What every agent you've listed has actually earned — net of the platform fee.
          </p>
        </div>
        <Link href="/dashboard/agents" className="text-sm text-ink-soft transition-colors hover:text-accent">
          Your agents
        </Link>
      </div>

      {analytics.failed ? (
        <p className="text-sm text-ink-soft">Couldn't load your earnings — try refreshing the page.</p>
      ) : analytics.totalSales === 0 ? (
        <div className="flex animate-reveal-up flex-col items-center gap-3 rounded-2xl border border-dashed border-line py-16 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-ink-faint">
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.4">
              <path d="M4 14.5l4-4 3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <p className="text-sm text-ink-soft">
            No sales yet.{" "}
            <Link href="/dashboard/agents" className="text-accent underline">
              Check your listings
            </Link>
            .
          </p>
        </div>
      ) : (
        <>
          <div className="mb-6 grid animate-fade-up grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Net earned, all time" value={analytics.totalNetCents} format={euros} />
            <StatCard label="Net earned, last 30 days" value={analytics.last30DaysNetCents} format={euros} />
            <StatCard label="Sales, all time" value={analytics.totalSales} />
            <StatCard label="Average net per sale" value={averageNetPerSale} format={euros} />
          </div>

          <div className="mb-6 grid gap-3 sm:grid-cols-2">
            <Reveal delay={60} className="bezel-shell">
              <div className="bezel-core border border-line bg-surface p-5">
                <h2 className="mb-4 text-xs font-medium uppercase tracking-wide text-ink-faint">
                  Net revenue · last 30 days
                </h2>
                <TimeSeriesChart
                  data={revenuePoints}
                  variant="area"
                  formatValue={euros}
                  ariaLabel="Net revenue over the last 30 days"
                />
              </div>
            </Reveal>
            <Reveal delay={120} className="bezel-shell">
              <div className="bezel-core border border-line bg-surface p-5">
                <h2 className="mb-4 text-xs font-medium uppercase tracking-wide text-ink-faint">Sales · last 30 days</h2>
                <TimeSeriesChart
                  data={salesPoints}
                  variant="bars"
                  formatValue={(n) => `${n} sale${n === 1 ? "" : "s"}`}
                  ariaLabel="Number of sales over the last 30 days"
                />
              </div>
            </Reveal>
          </div>

          <Reveal delay={180} className="bezel-shell">
            <div className="bezel-core overflow-x-auto border border-line bg-surface p-2">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-ink-faint">
                    <th scope="col" className="px-3 py-2 font-medium">Agent</th>
                    <th scope="col" className="px-3 py-2 font-medium">Status</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Sales</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Gross</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Platform fee</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.perAgent.map((agent) => (
                    <tr key={agent.agentId} className="border-t border-line transition-colors hover:bg-surface-raised">
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <TrustRing score={agent.trustScore} />
                          <Link href={`/agents/${agent.slug}`} className="min-w-0 truncate font-medium hover:text-accent">
                            {agent.name}
                          </Link>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${
                            agent.status === "approved"
                              ? "bg-accent-soft text-accent"
                              : agent.status === "rejected"
                                ? "bg-red-500/10 text-red-400"
                                : agent.status === "delisted"
                                  ? "bg-orange-500/10 text-orange-400"
                                  : "bg-surface-raised text-ink-faint"
                          }`}
                        >
                          {STATUS_LABEL[agent.status] ?? agent.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums text-ink-soft">{agent.sales}</td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums text-ink-soft">{euros(agent.grossCents)}</td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums text-ink-faint">
                        −{euros(agent.platformFeeCents)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums text-ink">{euros(agent.netCents)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-line font-medium">
                    <td className="px-3 py-3" colSpan={2}>
                      Total
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums">{analytics.totalSales}</td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums">{euros(analytics.totalGrossCents)}</td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-ink-faint">
                      −{euros(analytics.totalPlatformFeeCents)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-accent">
                      {euros(analytics.totalNetCents)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Reveal>
        </>
      )}
    </main>
  );
}

function StatCard({
  label,
  value,
  format,
}: {
  label: string;
  value: number;
  format?: (n: number) => string;
}) {
  return (
    <Reveal className="bezel-shell">
      <div className="bezel-core flex flex-col gap-1 border border-line bg-surface p-4">
        <span className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</span>
        <span className="font-mono text-lg font-semibold tabular-nums text-ink">
          <CounterUp value={value} format={format} duration={800} />
        </span>
      </div>
    </Reveal>
  );
}
