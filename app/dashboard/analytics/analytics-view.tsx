"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { CreatorAnalytics } from "@/lib/analytics";
import { formatEuros } from "@/lib/format";
import { Reveal } from "@/app/components/reveal";
import { CounterUp } from "@/app/components/counter-up";
import { TrustRing } from "@/app/components/trust-ring";
import { TimeSeriesChart } from "@/app/components/charts/time-series-chart";
import { Sparkline } from "@/app/components/charts/sparkline";

const STATUS_LABEL: Record<string, string> = {
  approved: "Live",
  pending_review: "Pending review",
  rejected: "Rejected",
  delisted: "Delisted",
};

const RANGE_OPTIONS = [7, 30, 90] as const;
type Range = (typeof RANGE_OPTIONS)[number];

function euros(cents: number): string {
  return `€${formatEuros(cents)}`;
}

function negativeEuros(cents: number): string {
  return cents > 0 ? `−${euros(cents)}` : euros(cents);
}

/** Everything below the page header — stats, comparison badge, best-agent callout,
 *  the range-toggled charts, and the per-agent table — as one client component so the
 *  7/30/90 toggle can re-slice the 90-day array getCreatorAnalytics already fetched,
 *  with no second Supabase round trip. The zero-sales and failed states stay server-side
 *  in page.tsx, since they need no interactivity. */
export function AnalyticsView({ analytics }: { analytics: CreatorAnalytics }) {
  const [range, setRange] = useState<Range>(30);

  const averageNetPerSale = analytics.totalSales > 0 ? Math.round(analytics.totalNetCents / analytics.totalSales) : 0;

  const rangedDaily = useMemo(() => analytics.daily.slice(-range), [analytics.daily, range]);
  const revenuePoints = useMemo(() => rangedDaily.map((d) => ({ date: d.date, value: d.netCents })), [rangedDaily]);
  const salesPoints = useMemo(() => rangedDaily.map((d) => ({ date: d.date, value: d.sales })), [rangedDaily]);

  const bestAgent = analytics.perAgent[0];
  const isNearEmpty = analytics.totalSales > 0 && analytics.totalSales <= 2;

  return (
    <>
      {isNearEmpty && (
        <div className="mb-6 flex animate-fade-up items-start gap-2.5 rounded-xl border border-dashed border-line bg-surface/60 px-4 py-3 text-sm text-ink-soft">
          <svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" fill="none" stroke="currentColor" strokeWidth="1.4">
            <circle cx="10" cy="10" r="7.3" />
            <path d="M10 6.5v4M10 13.2h.01" strokeLinecap="round" />
          </svg>
          <p>
            Just getting started — {analytics.totalSales} sale{analytics.totalSales === 1 ? "" : "s"} so far. The
            charts below will mean more once there's a bit more history to show a real pattern.
          </p>
        </div>
      )}

      <div className="mb-6 grid animate-fade-up grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Net earned, all time" value={analytics.totalNetCents} format={euros} />
        <StatCard label="Net earned, last 30 days" value={analytics.last30DaysNetCents} format={euros}>
          <ComparisonBadge current={analytics.last30DaysNetCents} previous={analytics.prev30DaysNetCents} />
        </StatCard>
        <StatCard label="Sales, all time" value={analytics.totalSales} />
        <StatCard label="Average net per sale" value={averageNetPerSale} format={euros} />
      </div>

      {bestAgent && (
        <Reveal delay={40} className="bezel-shell mb-6">
          <div className="bezel-core flex items-center gap-4 border border-accent/15 bg-gradient-to-br from-accent-soft/60 to-surface p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
              <svg viewBox="0 0 20 20" className="h-4.5 w-4.5" fill="currentColor">
                <path d="M10 1.5l2.4 4.9 5.4.8-3.9 3.8.9 5.4L10 13.9l-4.8 2.5.9-5.4-3.9-3.8 5.4-.8L10 1.5z" />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] uppercase tracking-wide text-ink-faint">Top earner, last 30 days</div>
              <Link href={`/agents/${bestAgent.slug}`} className="truncate font-medium text-ink hover:text-accent">
                {bestAgent.name}
              </Link>
            </div>
            <div className="text-right">
              <div className="font-mono text-lg font-semibold tabular-nums text-accent">{euros(bestAgent.netCents)}</div>
              <div className="text-[11px] text-ink-faint">
                {bestAgent.sales} sale{bestAgent.sales === 1 ? "" : "s"}
              </div>
            </div>
          </div>
        </Reveal>
      )}

      <div className="mb-3 flex animate-fade-up items-center justify-between gap-3">
        <h2 className="text-xs font-medium uppercase tracking-wide text-ink-faint">Trends</h2>
        <RangeToggle range={range} onChange={setRange} />
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <Reveal delay={60} className="bezel-shell">
          <div className="bezel-core border border-line bg-surface p-5">
            <h3 className="mb-4 text-xs font-medium uppercase tracking-wide text-ink-faint">
              Net revenue · last {range} days
            </h3>
            <TimeSeriesChart
              data={revenuePoints}
              variant="area"
              formatValue={euros}
              ariaLabel={`Net revenue over the last ${range} days`}
              legendLabel="Net revenue"
            />
          </div>
        </Reveal>
        <Reveal delay={120} className="bezel-shell">
          <div className="bezel-core border border-line bg-surface p-5">
            <h3 className="mb-4 text-xs font-medium uppercase tracking-wide text-ink-faint">
              Sales · last {range} days
            </h3>
            <TimeSeriesChart
              data={salesPoints}
              variant="bars"
              formatValue={(n) => `${n} sale${n === 1 ? "" : "s"}`}
              ariaLabel={`Number of sales over the last ${range} days`}
              legendLabel="Sales"
            />
          </div>
        </Reveal>
      </div>

      <Reveal delay={180} className="bezel-shell">
        <div className="bezel-core border border-line bg-surface p-2">
          {/* Table for wider screens — a 6-column table genuinely doesn't fit a phone,
              overflow-x-auto or not, without turning into a horizontal-scroll guessing
              game over which cell belongs to which column header. */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[620px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-ink-faint">
                  <th scope="col" className="px-3 py-2 font-medium">Agent</th>
                  <th scope="col" className="px-3 py-2 font-medium">Status</th>
                  <th scope="col" className="px-3 py-2 font-medium">Trend (14d)</th>
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
                      <StatusPill status={agent.status} />
                    </td>
                    <td className="px-3 py-3">
                      <Sparkline values={agent.sparkline} />
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-ink-soft">{agent.sales}</td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-ink-soft">{euros(agent.grossCents)}</td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-ink-faint">
                      {negativeEuros(agent.platformFeeCents)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-ink">{euros(agent.netCents)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-line font-medium">
                  <td className="px-3 py-3" colSpan={3}>
                    Total
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">{analytics.totalSales}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">{euros(analytics.totalGrossCents)}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-ink-faint">
                    {negativeEuros(analytics.totalPlatformFeeCents)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-accent">
                    {euros(analytics.totalNetCents)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Card list for phones — the same rows, stacked, instead of the same table
              squeezed and scrolled sideways. */}
          <ul className="sm:hidden">
            {analytics.perAgent.map((agent) => (
              <li key={agent.agentId} className="border-t border-line px-3 py-3 first:border-t-0">
                <div className="mb-2 flex items-center gap-3">
                  <TrustRing score={agent.trustScore} />
                  <Link href={`/agents/${agent.slug}`} className="min-w-0 flex-1 truncate font-medium hover:text-accent">
                    {agent.name}
                  </Link>
                  <StatusPill status={agent.status} />
                </div>
                <div className="mb-2 flex items-center justify-between">
                  <Sparkline values={agent.sparkline} />
                  <span className="text-xs text-ink-faint">
                    {agent.sales} sale{agent.sales === 1 ? "" : "s"}
                  </span>
                </div>
                <dl className="grid grid-cols-3 gap-2 text-right font-mono text-xs tabular-nums">
                  <div>
                    <dt className="mb-0.5 text-[10px] uppercase text-ink-faint">Gross</dt>
                    <dd className="text-ink-soft">{euros(agent.grossCents)}</dd>
                  </div>
                  <div>
                    <dt className="mb-0.5 text-[10px] uppercase text-ink-faint">Fee</dt>
                    <dd className="text-ink-faint">{negativeEuros(agent.platformFeeCents)}</dd>
                  </div>
                  <div>
                    <dt className="mb-0.5 text-[10px] uppercase text-ink-faint">Net</dt>
                    <dd className="text-ink">{euros(agent.netCents)}</dd>
                  </div>
                </dl>
              </li>
            ))}
            <li className="border-t border-line px-3 py-3 font-medium">
              <div className="mb-2 flex items-center justify-between">
                <span>Total</span>
                <span className="text-xs font-normal text-ink-faint">
                  {analytics.totalSales} sale{analytics.totalSales === 1 ? "" : "s"}
                </span>
              </div>
              <dl className="grid grid-cols-3 gap-2 text-right font-mono text-xs tabular-nums">
                <div>
                  <dt className="mb-0.5 text-[10px] uppercase text-ink-faint">Gross</dt>
                  <dd>{euros(analytics.totalGrossCents)}</dd>
                </div>
                <div>
                  <dt className="mb-0.5 text-[10px] uppercase text-ink-faint">Fee</dt>
                  <dd className="text-ink-faint">{negativeEuros(analytics.totalPlatformFeeCents)}</dd>
                </div>
                <div>
                  <dt className="mb-0.5 text-[10px] uppercase text-ink-faint">Net</dt>
                  <dd className="text-accent">{euros(analytics.totalNetCents)}</dd>
                </div>
              </dl>
            </li>
          </ul>
        </div>
      </Reveal>
    </>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${
        status === "approved"
          ? "bg-accent-soft text-accent"
          : status === "rejected"
            ? "bg-red-500/10 text-red-400"
            : status === "delisted"
              ? "bg-orange-500/10 text-orange-400"
              : "bg-surface-raised text-ink-faint"
      }`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

/** Up/down/flat vs the prior 30-day window. A previous window of exactly €0 makes a
 *  percentage meaningless (division by zero, or a nonsensical "+∞%") so that case gets
 *  its own "new" label instead of a fabricated number. */
function ComparisonBadge({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) {
    if (current === 0) return null;
    return (
      <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium text-accent">
        New
      </span>
    );
  }

  const deltaPct = ((current - previous) / previous) * 100;
  const rounded = Math.round(deltaPct);
  if (rounded === 0) {
    return <span className="mt-1 inline-flex w-fit text-[10px] font-medium text-ink-faint">Flat vs prior 30d</span>;
  }

  const up = rounded > 0;
  return (
    <span
      className={`mt-1 inline-flex w-fit items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
        up ? "bg-accent-soft text-accent" : "bg-red-500/10 text-red-400"
      }`}
      title={`${euros(current)} this 30d vs ${euros(previous)} the prior 30d`}
    >
      <svg viewBox="0 0 10 10" className={`h-2.5 w-2.5 ${up ? "" : "rotate-180"}`} fill="currentColor">
        <path d="M5 1.5l3.5 4H6v3H4V5.5H1.5z" />
      </svg>
      {Math.abs(rounded)}% vs prior 30d
    </span>
  );
}

function RangeToggle({ range, onChange }: { range: Range; onChange: (r: Range) => void }) {
  return (
    <div role="group" aria-label="Time range" className="flex gap-0.5 rounded-full border border-line bg-surface p-0.5">
      {RANGE_OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={range === option}
          onClick={() => onChange(option)}
          className={`magnetic-btn rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
            range === option ? "bg-accent-soft text-accent" : "text-ink-faint hover:text-ink"
          }`}
        >
          {option}D
        </button>
      ))}
    </div>
  );
}

function StatCard({
  label,
  value,
  format,
  children,
}: {
  label: string;
  value: number;
  format?: (n: number) => string;
  children?: React.ReactNode;
}) {
  return (
    <Reveal className="bezel-shell">
      <div className="bezel-core flex flex-col gap-1 border border-line bg-surface p-4">
        <span className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</span>
        <span className="font-mono text-lg font-semibold tabular-nums text-ink">
          <CounterUp value={value} format={format} duration={800} />
        </span>
        {children}
      </div>
    </Reveal>
  );
}
