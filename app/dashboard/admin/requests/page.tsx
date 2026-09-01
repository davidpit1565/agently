import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAllAgentRequests } from "@/lib/requests";
import { Notice } from "@/app/components/form-field";
import { SubmitButton } from "@/app/components/submit-button";

export default async function AdminRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; embedded?: string; skipped?: string }>;
}) {
  const { saved, embedded, skipped } = await searchParams;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return <Notice title="Not connected yet">This page needs Supabase configured.</Notice>;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !process.env.PLATFORM_OWNER_EMAIL || user.email !== process.env.PLATFORM_OWNER_EMAIL) {
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
        <p className="text-sm text-ink-soft">Nothing requested yet.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {requests.map((r) => (
            <div key={r.id} className="rounded-xl border border-line bg-surface p-5">
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
                  placeholder="Agent slug, once it's listed (only needed when marking fulfilled)"
                  className="rounded-lg border border-line bg-surface-raised px-3 py-2 text-sm text-ink outline-none transition-all duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] placeholder:text-ink-faint focus:border-accent focus:shadow-[0_0_0_3px_rgba(47,224,173,0.12)]"
                />
                <input
                  type="text"
                  name="admin_notes"
                  defaultValue={r.admin_notes ?? ""}
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
          ))}
        </div>
      )}
    </main>
  );
}
