import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getMyAgentRequests } from "@/lib/requests";
import { Notice } from "@/app/components/form-field";
import { RequestForm } from "@/app/components/request-form";
import type { AgentRequestStatus } from "@/lib/types";

const STATUS_LABEL: Record<AgentRequestStatus, string> = {
  pending: "Pending",
  in_progress: "In progress",
  fulfilled: "Fulfilled",
  declined: "Declined",
};

export default async function RequestAgentPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  const { submitted } = await searchParams;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return (
      <Notice title="Not connected yet">
        This page needs Supabase configured before requests can be saved.
      </Notice>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <Notice title="Sign in first">You need an account to request a custom agent.</Notice>;
  }

  const { data: profile } = await supabase
    .from("agently_profiles")
    .select("membership_tier")
    .eq("id", user.id)
    .single();

  if (profile?.membership_tier !== "professional") {
    return (
      <Notice title="Professional membership required">
        Requesting a custom agent is a Professional-tier perk — we&apos;re
        building something specifically for you, so it&apos;s reserved for
        the top tier.{" "}
        <Link href="/pricing" className="text-accent underline">
          See membership tiers
        </Link>
        .
      </Notice>
    );
  }

  const requests = await getMyAgentRequests(user.id);

  return (
    <main className="mx-auto max-w-xl px-6 py-16 sm:py-20">
      <h1 className="text-balance mb-2 font-display text-2xl font-semibold">Request an agent</h1>
      <p className="mb-8 text-sm text-ink-faint">
        Describe a problem, not a product — we build it and let you know
        when it&apos;s ready. This is a real request to a real person, not
        an automated build: there&apos;s no pipeline that turns a
        description into working code on its own.
      </p>

      {submitted && (
        <p className="mb-6 rounded-lg border border-accent/30 bg-accent-soft px-4 py-3 text-sm text-accent">
          Sent. You&apos;ll get a notification here once it&apos;s ready.
        </p>
      )}

      <RequestForm />

      {requests.length > 0 && (
        <div className="mt-12 flex flex-col gap-3">
          <h2 className="font-display text-sm font-semibold text-accent">Your requests</h2>
          {requests.map((r) => (
            <div key={r.id} className="rounded-lg border border-line bg-surface p-4">
              <div className="mb-1 flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${
                    r.status === "fulfilled"
                      ? "bg-accent-soft text-accent"
                      : r.status === "declined"
                        ? "bg-red-500/10 text-red-400"
                        : "bg-surface-raised text-ink-faint"
                  }`}
                >
                  {STATUS_LABEL[r.status]}
                </span>
              </div>
              <p className="text-sm text-ink-soft">{r.description}</p>
              {r.admin_notes && <p className="mt-1 text-xs text-ink-faint">{r.admin_notes}</p>}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
