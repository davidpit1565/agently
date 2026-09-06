import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Notice } from "@/app/components/form-field";
import { SubmitButton } from "@/app/components/submit-button";
import { isPlatformOwner } from "@/lib/owner";
import type { Agent } from "@/lib/types";

// The other half of the safety-review pipeline (lib/safety-review.ts): a
// "low" verdict auto-approves, but anything else — or no ANTHROPIC_API_KEY
// configured at all, which leaves every listing here — was designed to
// "wait on a quick human look" (see app/dashboard/upload's copy) with no
// screen that human could actually use. Same owner-only gate as
// /dashboard/admin/requests.
export default async function AdminAgentsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; reviewed?: string; error?: string }>;
}) {
  const { saved, reviewed, error } = await searchParams;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return <Notice title="Not connected yet">This page needs Supabase configured.</Notice>;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isPlatformOwner(user?.email)) {
    notFound();
  }

  // The regular client's RLS ("approved agents are public") would hide every
  // other creator's pending/rejected agent from this owner-only page — the
  // admin client is what makes reviewing someone else's listing possible.
  const admin = createAdminClient();
  if (!admin) {
    return <Notice title="Not connected yet">This page needs SUPABASE_SERVICE_ROLE_KEY configured.</Notice>;
  }

  const { data } = await admin
    .from("agently_agents")
    .select("*, agently_profiles!agently_agents_creator_id_fkey(display_name)")
    .neq("status", "approved")
    .order("created_at", { ascending: false });

  const agents = (data ?? []) as (Agent & { agently_profiles: { display_name: string } | null })[];

  // Approving a listing above never runs the safety-review model (it only
  // flips `status` — app/api/admin/agents/[id]/route.ts) — so an already-approved
  // listing that got no verdict at submission time (no ANTHROPIC_API_KEY
  // configured then, or the call failing) is stuck at trust_score=0 forever
  // with no button anywhere to fix that, unless the creator edits it enough
  // to trigger a fresh review. This surfaces exactly those, separately from
  // the queue above, since they need no approval decision — only a re-run.
  const { data: unscoredApprovedData } = await admin
    .from("agently_agents")
    .select("*, agently_profiles!agently_agents_creator_id_fkey(display_name)")
    .eq("status", "approved")
    .eq("trust_score", 0)
    .order("created_at", { ascending: false });

  const unscoredApproved = (unscoredApprovedData ?? []) as (Agent & {
    agently_profiles: { display_name: string } | null;
  })[];

  return (
    <main className="mx-auto max-w-2xl px-6 py-16 sm:py-20">
      <h1 className="text-balance mb-2 font-display text-2xl font-semibold">Listings to review</h1>
      <p className="mb-8 text-sm text-ink-faint">
        Only pending, rejected, or delisted agents show here — approved ones need no action and
        are just noise on this screen.
      </p>

      {saved && (
        <p className="mb-6 rounded-lg border border-accent/30 bg-accent-soft px-4 py-3 text-sm text-accent">
          Saved.
        </p>
      )}
      {reviewed && (
        <p className="mb-6 rounded-lg border border-accent/30 bg-accent-soft px-4 py-3 text-sm text-accent">
          Re-reviewed — trust score updated.
        </p>
      )}
      {error && (
        <p className="mb-6 animate-shake rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </p>
      )}

      {agents.length === 0 ? (
        <p className="text-sm text-ink-soft">Nothing waiting on review.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {agents.map((agent) => (
            <div key={agent.id} className="rounded-xl border border-line bg-surface p-5">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-xs text-ink-faint">{agent.status}</span>
                <span className="text-xs text-ink-faint">
                  by {agent.agently_profiles?.display_name ?? "unknown"}
                </span>
              </div>
              <h2 className="mb-1 font-display text-sm font-semibold">{agent.name}</h2>
              <p className="mb-2 text-sm text-ink-soft">{agent.tagline}</p>
              <p className="mb-2 text-xs text-ink-faint">
                <strong className="text-ink-soft">Problem solved:</strong> {agent.problem_solved}
              </p>
              <p className="mb-3 text-xs text-ink-faint">{agent.description}</p>
              {agent.delivery_url && (
                <a
                  href={agent.delivery_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mb-3 block text-xs text-accent underline"
                >
                  {agent.delivery_url}
                </a>
              )}
              {agent.review_notes ? (
                <p className="mb-3 whitespace-pre-line rounded-lg border border-line bg-surface-raised p-3 text-xs text-ink-soft">
                  <strong>Automated review:</strong> {agent.review_notes}
                </p>
              ) : (
                <p className="mb-3 rounded-lg border border-line bg-surface-raised p-3 text-xs text-ink-faint">
                  No automated verdict (ANTHROPIC_API_KEY not configured, or the call failed) —
                  this one has had zero review so far.
                </p>
              )}

              <form action={`/api/admin/agents/${agent.id}`} method="POST" className="flex items-center gap-2">
                <select
                  name="status"
                  defaultValue={agent.status}
                  aria-label="Listing status"
                  className="rounded-lg border border-line bg-surface-raised px-3 py-2 text-sm text-ink outline-none transition-all duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] focus:border-accent focus:shadow-[0_0_0_3px_rgba(47,224,173,0.12)]"
                >
                  <option value="pending_review">Pending review</option>
                  <option value="approved">Approve</option>
                  <option value="rejected">Reject</option>
                  <option value="delisted">Delist</option>
                </select>
                <SubmitButton
                  pendingText="Saving…"
                  className="magnetic-btn w-fit rounded-full border border-line px-4 py-2 text-xs font-medium text-ink-soft transition-all duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] hover:border-accent/50 hover:text-accent"
                >
                  Save
                </SubmitButton>
              </form>
            </div>
          ))}
        </div>
      )}

      {unscoredApproved.length > 0 && (
        <>
          <h2 className="text-balance mb-2 mt-12 font-display text-lg font-semibold">
            Approved, never AI-reviewed
          </h2>
          <p className="mb-6 text-sm text-ink-faint">
            Already live — no approval decision needed here. These just never got a real
            safety-review score (missing ANTHROPIC_API_KEY at submission time, or the call
            failed), so they're stuck showing trust_score=0. Re-run to get a real one.
          </p>
          <div className="flex flex-col gap-4">
            {unscoredApproved.map((agent) => (
              <div key={agent.id} className="rounded-xl border border-line bg-surface p-5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-mono text-xs text-ink-faint">{agent.status}</span>
                  <span className="text-xs text-ink-faint">
                    by {agent.agently_profiles?.display_name ?? "unknown"}
                  </span>
                </div>
                <h3 className="mb-1 font-display text-sm font-semibold">{agent.name}</h3>
                <p className="mb-3 text-sm text-ink-soft">{agent.tagline}</p>
                <form action={`/api/admin/agents/${agent.id}/review`} method="POST">
                  <SubmitButton
                    pendingText="Reviewing…"
                    className="magnetic-btn w-fit rounded-full border border-line px-4 py-2 text-xs font-medium text-ink-soft transition-all duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] hover:border-accent/50 hover:text-accent"
                  >
                    Re-run AI review
                  </SubmitButton>
                </form>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
