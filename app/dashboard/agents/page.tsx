import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getMyAgents, getPurchaseCounts } from "@/lib/catalog";
import { TrustRing } from "@/app/components/trust-ring";
import { Notice } from "@/app/components/form-field";
import { DelistButton } from "@/app/components/delist-button";
import { DeleteAgentButton } from "@/app/components/delete-agent-button";
import { Reveal } from "@/app/components/reveal";
import { CounterUp } from "@/app/components/counter-up";

const STATUS_LABEL: Record<string, string> = {
  approved: "Live",
  pending_review: "Pending review",
  rejected: "Rejected",
  delisted: "Delisted",
};

export default async function MyAgentsPage({
  searchParams,
}: {
  searchParams: Promise<{ membership?: string; delisted?: string; removed?: string; error?: string }>;
}) {
  const { membership, delisted, removed, error } = await searchParams;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return (
      <Notice title="Not connected yet">
        This page needs Supabase configured before it can list your agents.
      </Notice>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <Notice title="Sign in first">You need an account to see your listings.</Notice>;
  }

  const { agents, failed: agentsFailed } = await getMyAgents(user.id);
  const { counts: purchaseCounts, failed: countsFailed } = await getPurchaseCounts(agents.map((a) => a.id));
  const failed = agentsFailed || countsFailed;

  return (
    <main className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
      {membership && (
        <div className="mb-6 rounded-lg border border-accent/30 bg-accent-soft px-4 py-2.5 text-sm text-accent">
          You're a member — you can list agents now.
        </div>
      )}
      {delisted && (
        <div className="mb-6 rounded-lg border border-line bg-surface px-4 py-2.5 text-sm text-ink-soft">
          Removed from the catalog. Buyers who already own it keep access.
        </div>
      )}
      {removed && (
        <div className="mb-6 rounded-lg border border-line bg-surface px-4 py-2.5 text-sm text-ink-soft">
          Listing deleted for good.
        </div>
      )}
      {error && (
        <p className="mb-6 animate-shake rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </p>
      )}
      <div className="mb-8 flex animate-fade-up items-center justify-between gap-4">
        <h1 className="text-balance font-display text-2xl font-semibold">Your agents</h1>
        <div className="flex shrink-0 items-center gap-3">
          <Link href="/dashboard/analytics" className="text-sm text-ink-soft transition-colors hover:text-accent">
            Analytics
          </Link>
          <Link href="/dashboard/payouts" className="text-sm text-ink-soft transition-colors hover:text-accent">
            Payouts
          </Link>
          <Link href="/dashboard/request" className="text-sm text-ink-soft transition-colors hover:text-accent">
            Request an agent
          </Link>
          <Link
            href="/dashboard/upload"
            className="shine-sweep magnetic-btn rounded-full bg-accent px-4 py-2 text-sm font-medium text-[#04140f] transition-all duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-0.5 hover:opacity-90"
          >
            Upload an agent
          </Link>
        </div>
      </div>

      {failed ? (
        <p className="text-sm text-ink-soft">Couldn't load your agents — try refreshing the page.</p>
      ) : agents.length === 0 ? (
        <div className="flex animate-reveal-up flex-col items-center gap-3 rounded-2xl border border-dashed border-line py-16 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-ink-faint">
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.4">
              <path d="M10 6v4l2.5 2.5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="10" cy="10" r="7.5" />
            </svg>
          </span>
          <p className="text-sm text-ink-soft">
            Nothing listed yet.{" "}
            <Link href="/dashboard/upload" className="text-accent underline">
              Upload your first agent
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {agents.map((agent, i) => (
            <Reveal
              key={agent.id}
              delay={Math.min(i, 6) * 60}
              className="group bezel-shell transition-all duration-300 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-1 hover:shadow-[0_16px_40px_-18px_rgba(47,224,173,0.22)]"
            >
              <div className="bezel-core flex flex-col gap-4 border border-line bg-surface p-4 transition-colors duration-300 group-hover:border-accent/40 group-hover:bg-surface-raised sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  <TrustRing score={agent.trust_score} />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-sm font-semibold">{agent.name}</span>
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
                      <span className="font-mono text-[10px] tabular-nums text-ink-faint">v{agent.version}</span>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-ink-faint">{agent.tagline}</p>
                    {agent.review_notes && agent.status !== "approved" && (
                      <p className="mt-1 truncate text-xs text-ink-faint">{agent.review_notes}</p>
                    )}
                    {agent.status === "approved" && (
                      <p className="mt-1.5 flex items-center gap-3 font-mono text-[11px] tabular-nums text-ink-faint">
                        <span title="Page views — not unique visitors, no bot filtering">
                          <CounterUp value={agent.view_count} duration={800} /> view
                          {agent.view_count === 1 ? "" : "s"}
                        </span>
                        <span>·</span>
                        <span>
                          <CounterUp value={purchaseCounts.get(agent.id) ?? 0} duration={800} /> sale
                          {(purchaseCounts.get(agent.id) ?? 0) === 1 ? "" : "s"}
                        </span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                  <Link
                    href={`/agents/${agent.slug}`}
                    className="magnetic-btn rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors duration-150 hover:border-accent/50 hover:text-accent"
                  >
                    View
                  </Link>
                  <Link
                    href={`/dashboard/agents/${agent.id}/edit`}
                    className="magnetic-btn rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors duration-150 hover:border-accent/50 hover:text-accent"
                  >
                    Edit
                  </Link>
                  {agent.status !== "delisted" && (
                    <DelistButton agentId={agent.id} agentName={agent.name} />
                  )}
                  {(agent.status === "delisted" || agent.status === "rejected") &&
                    (purchaseCounts.get(agent.id) ?? 0) === 0 && (
                      <DeleteAgentButton agentId={agent.id} agentName={agent.name} />
                    )}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      )}
    </main>
  );
}
