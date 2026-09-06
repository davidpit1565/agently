import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAllAgentRequests } from "@/lib/requests";
import { Notice } from "@/app/components/form-field";
import { SubmitButton } from "@/app/components/submit-button";
import { Reveal } from "@/app/components/reveal";
import { isPlatformOwner } from "@/lib/owner";

export default async function AdminRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; embedded?: string; skipped?: string; error?: string }>;
}) {
  const { saved, embedded, skipped, error } = await searchParams;

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

  const requests = await getAllAgentRequests();

  return (
    <main className="mx-auto max-w-2xl px-6 py-16 sm:py-20">
      <h1 className="text-balance mb-8 font-display text-2xl font-semibold">Agent requests</h1>

      {saved && (
        <p className="mb-6 rounded-lg border border-accent/30 bg-accent-soft px-4 py-3 text-sm text-accent">
          Saved.
        </p>
      )}
      {error && (
        <p className="mb-6 animate-shake rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </p>
      )}

      {embedded !== undefined && (
        <p className="mb-6 rounded-lg border border-accent/30 bg-accent-soft px-4 py-3 text-sm text-accent">
          Embedded {embedded} listing{embedded === "1" ? "" : "s"}
          {skipped && skipped !== "0" ? ` — skipped ${skipped} (no VOYAGE_API_KEY, or the call failed).` : "."}
        </p>
      )}

      <form action="/api/agents/backfill-embeddings" method="POST" className="mb-8">
        <SubmitButton
          pendingText="Embedding…"
          className="magnetic-btn w-fit rounded-full border border-line px-4 py-2 text-xs font-medium text-ink-soft transition-all duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] hover:border-accent/50 hover:text-accent"
        >
          Embed listings for semantic search
        </SubmitButton>
        <p className="mt-1 text-xs text-ink-faint">
          Catches up any approved listing that predates semantic search (lib/embeddings.ts) — new
          listings get this automatically on upload or edit.
        </p>
      </form>

      {requests.length === 0 ? (
        <div className="flex animate-reveal-up flex-col items-center gap-3 rounded-2xl border border-dashed border-line py-16 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-ink-faint">
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.4">
              <path d="M10 6v4l2.5 2.5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="10" cy="10" r="7.5" />
            </svg>
          </span>
          <p className="text-sm text-ink-soft">Nothing requested yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {requests.map((r, i) => (
            <Reveal
              key={r.id}
              delay={Math.min(i, 6) * 60}
              className="group bezel-shell transition-all duration-300 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-1 hover:shadow-[0_16px_40px_-18px_rgba(47,224,173,0.22)]"
            >
              <div className="bezel-core border border-line bg-surface p-5 transition-colors duration-300 group-hover:border-accent/40 group-hover:bg-surface-raised">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-mono text-xs text-ink-faint">{r.status}</span>
                  <span className="font-mono text-xs text-ink-faint">
                    {new Date(r.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="mb-4 text-sm text-ink">{r.description}</p>

                <form action={`/api/requests/${r.id}`} method="POST" className="flex flex-col gap-3">
                  <select
                    name="status"
                    defaultValue={r.status}
                    aria-label="Request status"
                    className="rounded-lg border border-line bg-surface-raised px-3 py-2 text-sm text-ink outline-none transition-all duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] focus:border-accent focus:shadow-[0_0_0_3px_rgba(47,224,173,0.12)]"
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In progress</option>
                    <option value="fulfilled">Fulfilled</option>
                    <option value="declined">Declined</option>
                  </select>
                  <input
                    type="text"
                    name="fulfilled_agent_slug"
                    aria-label="Agent slug, once it's listed"
                    placeholder="Agent slug, once it's listed (only needed when marking fulfilled)"
                    className="rounded-lg border border-line bg-surface-raised px-3 py-2 text-sm text-ink outline-none transition-all duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] placeholder:text-ink-faint focus:border-accent focus:shadow-[0_0_0_3px_rgba(47,224,173,0.12)]"
                  />
                  <input
                    type="text"
                    name="admin_notes"
                    defaultValue={r.admin_notes ?? ""}
                    aria-label="Note the requester will see"
                    placeholder="Note the requester will see"
                    className="rounded-lg border border-line bg-surface-raised px-3 py-2 text-sm text-ink outline-none transition-all duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] placeholder:text-ink-faint focus:border-accent focus:shadow-[0_0_0_3px_rgba(47,224,173,0.12)]"
                  />
                  <SubmitButton
                    pendingText="Saving…"
                    className="magnetic-btn w-fit rounded-full border border-line px-4 py-2 text-xs font-medium text-ink-soft transition-all duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] hover:border-accent/50 hover:text-accent"
                  >
                    Save
                  </SubmitButton>
                </form>
              </div>
            </Reveal>
          ))}
        </div>
      )}
    </main>
  );
}
