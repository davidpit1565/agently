import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCreatorAnalytics } from "@/lib/analytics";
import { Notice } from "@/app/components/form-field";
import { AnalyticsView } from "@/app/dashboard/analytics/analytics-view";

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
        <AnalyticsView analytics={analytics} />
      )}
    </main>
  );
}
