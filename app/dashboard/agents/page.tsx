import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getMyAgents } from "@/lib/catalog";
import { TrustRing } from "@/app/components/trust-ring";
import { Notice } from "@/app/components/form-field";
import { DelistButton } from "@/app/components/delist-button";
import { Reveal } from "@/app/components/reveal";

const STATUS_LABEL: Record<string, string> = {
  approved: "Live",
  pending_review: "Pending review",
  rejected: "Rejected",
  delisted: "Delisted",
};

export default async function MyAgentsPage({
  searchParams,
}: {
  searchParams: Promise<{ membership?: string; delisted?: string }>;
}) {
  const { membership, delisted } = await searchParams;

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

  const agents = await getMyAgents(user.id);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
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
      <div className="mb-8 flex animate-fade-up items-center justify-between gap-4">
        <h1 className="text-balance font-display text-2xl font-semibold">Your agents</h1>
        <div className="flex shrink-0 items-center gap-3">
          <Link href="/dashboard/payouts" className="text-sm text-ink-soft transition-colors hover:text-accent">
            Payouts
          </Link>
          <Link href="/dashboard/request" className="text-sm text-ink-soft transition-colors hover:text-accent">
            Request an agent
          </Link>
          <Link
            href="/dashboard/upload"
            className="shine-sweep rounded-full bg-accent px-4 py-2 text-sm font-medium text-[#04140f] transition-transform duration-200 hover:-translate-y-0.5 hover:opacity-90"
          >
            Upload an agent
          </Link>
        </div>
      </div>

      {agents.length === 0 ? (
        <p className="text-sm text-ink-soft">
          Nothing listed yet.{" "}
          <Link href="/dashboard/upload" className="text-accent underline">
            Upload your first agent
          </Link>
          .
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {agents.map((agent, i) => (
            <Reveal
              key={agent.id}
              delay={Math.min(i, 6) * 60}
              className="flex items-center gap-4 rounded-xl border border-line bg-surface p-4 transition-all duration-200 hover:border-accent/30 hover:bg-surface-raised"
            >
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
              </div>

              <div className="flex shrink-0 items-center gap-3 text-sm">
                <Link href={`/agents/${agent.slug}`} className="text-ink-soft hover:text-accent">
                  View
                </Link>
                <Link href={`/dashboard/agents/${agent.id}/edit`} className="text-ink-soft hover:text-accent">
                  Edit
                </Link>
                {agent.status !== "delisted" && (
                  <DelistButton agentId={agent.id} agentName={agent.name} />
                )}
              </div>
            </Reveal>
          ))}
        </div>
      )}
    </main>
  );
}
