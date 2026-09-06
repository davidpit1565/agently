import { createClient } from "@/lib/supabase/server";
import { Notice } from "@/app/components/form-field";
import { SubmitButton } from "@/app/components/submit-button";
import { Reveal } from "@/app/components/reveal";

function formatDate(iso: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// Where a hosted ('prompt'/'workflow') agent's buyer actually gets and
// manages the credential they call /api/agents/[slug]/invoke with — see
// plan/agently-hosted-api-concept.html. The full plaintext key is only ever
// visible once, right after generating it (the ?new_key= redirect param
// below) — every key already on the list only ever shows its prefix.
export default async function ApiKeysPage({
  searchParams,
}: {
  searchParams: Promise<{ new_key?: string; revoked?: string; error?: string }>;
}) {
  const { new_key: newKey, revoked, error } = await searchParams;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return <Notice title="Not connected yet">This page needs Supabase configured first.</Notice>;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <Notice title="Sign in first">You need an account to get an API key.</Notice>;
  }

  const { data: profile } = await supabase
    .from("agently_profiles")
    .select("api_credits, membership_status")
    .eq("id", user.id)
    .single();

  const { data: keys } = await supabase
    .from("agently_api_keys")
    .select("id, key_prefix, created_at, last_used_at, revoked_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const activeKeys = (keys ?? []).filter((k) => !k.revoked_at);
  const revokedKeys = (keys ?? []).filter((k) => k.revoked_at);

  return (
    <main className="mx-auto max-w-2xl px-6 py-16 sm:py-20">
      <h1 className="text-balance mb-2 font-display text-2xl font-semibold">API keys</h1>
      <p className="mb-8 text-sm text-ink-faint">
        For calling a hosted agent (a &quot;prompt&quot; or &quot;workflow&quot; listing) directly from your own code
        — every real call spends credits from your wallet below. No membership required to invoke: your
        free signup credits work the same way, they just don&apos;t refill on their own.
      </p>

      {error && (
        <p className="mb-6 animate-shake rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </p>
      )}
      {revoked && (
        <p className="mb-6 rounded-lg border border-accent/30 bg-accent-soft px-4 py-3 text-sm text-accent">
          Key revoked — anything still using it will start getting 401s immediately.
        </p>
      )}

      {newKey && (
        <div className="mb-8 rounded-2xl border border-accent/30 bg-accent-soft p-5">
          <h2 className="mb-2 font-display text-sm font-semibold text-accent">Your new key</h2>
          <p className="mb-3 text-xs text-ink-faint">
            Copy it now — this is the only time it&apos;s shown. Losing it means generating a new one.
          </p>
          <code className="block break-all rounded-lg border border-line bg-surface px-4 py-3 font-mono text-sm text-ink">
            {newKey}
          </code>
        </div>
      )}

      <Reveal className="bezel-shell mb-8">
        <div className="bezel-core border border-line bg-surface p-5">
          <h2 className="mb-3 font-display text-sm font-semibold text-accent">Credit wallet</h2>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-2xl font-semibold tabular-nums text-ink">
              {profile?.api_credits ?? 0}
            </span>
            <span className="text-sm text-ink-faint">credits</span>
          </div>
          <p className="mt-2 text-xs text-ink-faint">
            {profile?.membership_status === "active"
              ? "Resets to your membership tier's monthly amount on renewal — it doesn't carry over."
              : "A one-time free grant from signup — it doesn't refill on its own. Becoming a member adds a monthly refill instead of a one-off balance."}
          </p>
        </div>
      </Reveal>

      <form action="/api/dashboard/api-keys" method="POST" className="mb-10">
        <SubmitButton
          pendingText="Generating…"
          className="magnetic-btn rounded-full bg-accent px-6 py-3 text-sm font-medium text-[#04140f] transition-all duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-0.5 hover:opacity-90"
        >
          Generate new key
        </SubmitButton>
      </form>

      <section className="mb-10">
        <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-ink-faint">
          Your keys
        </h2>
        {activeKeys.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-ink-soft">
            No keys yet — generate one above to start calling hosted agents.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {activeKeys.map((k) => (
              <div
                key={k.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3 text-sm"
              >
                <div className="flex flex-col gap-0.5">
                  <code className="font-mono text-ink">{k.key_prefix}…</code>
                  <span className="text-xs text-ink-faint">
                    Created {formatDate(k.created_at)} · Last used {formatDate(k.last_used_at)}
                  </span>
                </div>
                <form action={`/api/dashboard/api-keys/${k.id}/revoke`} method="POST">
                  <SubmitButton
                    pendingText="Revoking…"
                    className="rounded-full border border-line px-3 py-1.5 text-xs text-ink-faint hover:border-red-500/50 hover:text-red-400"
                  >
                    Revoke
                  </SubmitButton>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>

      {revokedKeys.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-ink-faint">
            Revoked
          </h2>
          <div className="flex flex-col gap-2">
            {revokedKeys.map((k) => (
              <div key={k.id} className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3 text-sm opacity-50">
                <code className="font-mono text-ink-faint">{k.key_prefix}…</code>
                <span className="text-xs text-ink-faint">Revoked {formatDate(k.revoked_at)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
