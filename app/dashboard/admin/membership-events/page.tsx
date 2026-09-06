import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Notice } from "@/app/components/form-field";
import { Reveal } from "@/app/components/reveal";
import { AdminNav } from "@/app/components/admin-nav";
import { isPlatformOwner } from "@/lib/owner";
import { UPGRADE_REASON_LABELS } from "@/lib/upgrade-reasons";

const REASON_LABELS: Record<string, string> = {
  too_expensive: "Too expensive",
  missing_features: "Missing features",
  switched_service: "Switched to a different service",
  unused: "Wasn't using it",
  customer_service: "Customer service",
  low_quality: "Low quality",
  other: "Other",
};

type EventRow = {
  id: string;
  event_type: "cancel_scheduled" | "tier_changed";
  from_tier: string | null;
  to_tier: string | null;
  reason_code: string | null;
  reason_comment: string | null;
  created_at: string;
  agently_profiles: { display_name: string } | null;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// Why this exists: the earliest signal Agently has ever had into churn or
// upgrade behavior was David checking Stripe's own dashboard by hand, with
// no reason attached to either. This is the accumulation David asked for —
// real captured events only (agently_membership_events, written by the
// Stripe webhook), never a guessed or invented percentage. A count of "no
// reason given" is shown as plainly as a real reason — Stripe's own
// cancellation survey has to be turned on in the Dashboard before any
// reason ever reaches this table at all.
export default async function AdminMembershipEventsPage() {
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

  const admin = createAdminClient();
  if (!admin) {
    return <Notice title="Not connected yet">This page needs SUPABASE_SERVICE_ROLE_KEY configured.</Notice>;
  }

  const { data } = await admin
    .from("agently_membership_events")
    .select("id, event_type, from_tier, to_tier, reason_code, reason_comment, created_at, agently_profiles(display_name)")
    .order("created_at", { ascending: false })
    .limit(200);

  const events = (data ?? []) as unknown as EventRow[];
  const cancellations = events.filter((e) => e.event_type === "cancel_scheduled");
  const tierChanges = events.filter((e) => e.event_type === "tier_changed");

  const reasonCounts = new Map<string, number>();
  for (const c of cancellations) {
    const key = c.reason_code ? REASON_LABELS[c.reason_code] ?? c.reason_code : "No reason given";
    reasonCounts.set(key, (reasonCounts.get(key) ?? 0) + 1);
  }
  const reasonRows = [...reasonCounts.entries()].sort((a, b) => b[1] - a[1]);

  const tierMoveCounts = new Map<string, number>();
  for (const t of tierChanges) {
    const key = `${t.from_tier ?? "?"} → ${t.to_tier ?? "?"}`;
    tierMoveCounts.set(key, (tierMoveCounts.get(key) ?? 0) + 1);
  }
  const tierMoveRows = [...tierMoveCounts.entries()].sort((a, b) => b[1] - a[1]);

  // Unlike cancellations (Stripe's own survey), an upgrade reason only ever
  // gets here through the optional in-app prompt (app/components/upgrade-reason-prompt.tsx)
  // right after a Checkout purchase or a tier switch — so most rows will
  // read "No reason given" for a long time, and that's shown as plainly as
  // a real one, not smoothed over.
  const upgradeReasonCounts = new Map<string, number>();
  for (const t of tierChanges) {
    const key = t.reason_code ? UPGRADE_REASON_LABELS[t.reason_code] ?? t.reason_code : "No reason given";
    upgradeReasonCounts.set(key, (upgradeReasonCounts.get(key) ?? 0) + 1);
  }
  const upgradeReasonRows = [...upgradeReasonCounts.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-16 sm:py-20">
      <AdminNav active="membership-events" />
      <h1 className="text-balance mb-2 font-display text-2xl font-semibold">Membership events</h1>
      <p className="mb-8 text-sm text-ink-faint">
        Every cancel-initiation and tier switch, captured the moment it happens — not a survey,
        not a guess. Cancellation reasons only appear once Stripe&apos;s own survey is turned on
        (Stripe Dashboard → Settings → Billing → Customer Portal → &quot;Collect a reason for
        cancellation&quot;) — until then every row below reads &quot;No reason given&quot;,
        honestly, instead of a fabricated one.
      </p>

      <section className="mb-10">
        <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-ink-faint">
          Why people cancel ({cancellations.length} total)
        </h2>
        {reasonRows.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-ink-soft">
            No cancellations recorded yet — not enough data to say anything.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {reasonRows.map(([label, count]) => (
              <div key={label} className="flex items-center justify-between rounded-xl border border-line px-4 py-2.5 text-sm">
                <span className="text-ink">{label}</span>
                <span className="font-mono text-xs text-ink-faint">{count}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mb-10">
        <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-ink-faint">
          Tier moves ({tierChanges.length} total)
        </h2>
        {tierMoveRows.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-ink-soft">
            No tier switches recorded yet.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {tierMoveRows.map(([label, count]) => (
              <div key={label} className="flex items-center justify-between rounded-xl border border-line px-4 py-2.5 text-sm">
                <span className="font-mono text-ink">{label}</span>
                <span className="font-mono text-xs text-ink-faint">{count}</span>
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 text-xs text-ink-faint">
          Stripe has no &quot;why did you upgrade&quot; survey — the reasons below come only from
          the optional in-app prompt shown right after a switch, not Stripe.
        </p>
        {upgradeReasonRows.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            {upgradeReasonRows.map(([label, count]) => (
              <div key={label} className="flex items-center justify-between rounded-xl border border-line px-4 py-2.5 text-sm">
                <span className="text-ink">{label}</span>
                <span className="font-mono text-xs text-ink-faint">{count}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-ink-faint">
          Recent activity
        </h2>
        {events.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line py-16 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-ink-faint">
              <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.4">
                <path d="M10 6v4l2.5 2.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="10" cy="10" r="7.5" />
              </svg>
            </span>
            <p className="text-sm text-ink-soft">Nothing yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {events.slice(0, 40).map((e, i) => (
              <Reveal key={e.id} delay={Math.min(i, 6) * 40} className="bezel-shell">
                <div className="flex flex-col gap-1 p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-ink">{e.agently_profiles?.display_name ?? "Deleted user"}</span>
                    <span className="font-mono text-xs text-ink-faint">{formatDate(e.created_at)}</span>
                  </div>
                  {e.event_type === "cancel_scheduled" ? (
                    <>
                      <p className="text-ink-soft">
                        Canceled {e.from_tier ?? "membership"} —{" "}
                        {e.reason_code ? REASON_LABELS[e.reason_code] ?? e.reason_code : "no reason given"}
                      </p>
                      {e.reason_comment && (
                        <p className="text-xs italic text-ink-faint">&quot;{e.reason_comment}&quot;</p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="text-ink-soft">
                        Switched {e.from_tier ?? "?"} → {e.to_tier ?? "?"}
                        {e.reason_code && ` — ${UPGRADE_REASON_LABELS[e.reason_code] ?? e.reason_code}`}
                      </p>
                      {e.reason_comment && (
                        <p className="text-xs italic text-ink-faint">&quot;{e.reason_comment}&quot;</p>
                      )}
                    </>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
