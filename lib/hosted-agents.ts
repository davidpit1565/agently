import { sanitizeUrl, isPrivateOrReservedHostname } from "@/lib/validation";
import { sendNotificationEmail } from "@/lib/email";
import { SITE_URL } from "@/lib/site";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AgentKind = "file" | "prompt" | "workflow";

export type HostedAgentFields = {
  agentKind: string;
  hostedSystemPrompt: string | null;
  hostedWebhookUrl: string | null;
  creditsPerCall: number | null;
};

/**
 * Server-side validation for the agent_kind choice on upload/edit
 * (app/api/agents/route.ts, app/api/agents/[id]/route.ts) — mirrors the
 * check constraint in supabase/schema.sql
 * (agently_agents_credits_per_call_check) so a bad submission gets a clear
 * form error instead of a raw Postgres constraint-violation message, and so
 * hosted_webhook_url gets the same http(s)-only scheme check every other
 * user-supplied URL in this app gets (lib/validation.ts's sanitizeUrl).
 */
export function validateHostedAgentFields(input: {
  agentKind: string;
  hostedSystemPrompt: string | null;
  hostedWebhookUrl: string | null;
  creditsPerCall: string | null;
}): { ok: true; fields: HostedAgentFields } | { ok: false; error: string } {
  const { agentKind } = input;

  if (agentKind !== "file" && agentKind !== "prompt" && agentKind !== "workflow") {
    return { ok: false, error: "Unknown agent type." };
  }

  if (agentKind === "file") {
    return { ok: true, fields: { agentKind, hostedSystemPrompt: null, hostedWebhookUrl: null, creditsPerCall: null } };
  }

  const creditsPerCall = Number(input.creditsPerCall);
  if (!Number.isFinite(creditsPerCall) || !Number.isInteger(creditsPerCall) || creditsPerCall <= 0) {
    return { ok: false, error: "A hosted agent needs a positive whole-number credit cost per call." };
  }

  if (agentKind === "prompt") {
    const hostedSystemPrompt = (input.hostedSystemPrompt ?? "").trim();
    if (!hostedSystemPrompt) {
      return { ok: false, error: "A hosted prompt agent needs its system prompt." };
    }
    return { ok: true, fields: { agentKind, hostedSystemPrompt, hostedWebhookUrl: null, creditsPerCall } };
  }

  // agentKind === "workflow"
  const hostedWebhookUrl = sanitizeUrl(input.hostedWebhookUrl);
  if (!hostedWebhookUrl) {
    return { ok: false, error: "A hosted workflow agent needs a valid http:// or https:// webhook URL." };
  }
  // sanitizeUrl above only guards the javascript:/data: XSS threat model — a
  // private IP or localhost is a perfectly valid https:// URL, and this
  // field is actually fetched server-to-server (the invoke route), unlike
  // every other URL field in this app which is only ever rendered as a
  // link. Catches the obvious cases immediately as a form error; the real,
  // DNS-lookup-backed guard runs again right before every call (see
  // isSafeExternalUrl in lib/validation.ts and its use in the invoke
  // route), since a hostname can resolve differently by the time it's
  // actually dialed than it did here at save time.
  if (isPrivateOrReservedHostname(new URL(hostedWebhookUrl).hostname)) {
    return { ok: false, error: "That webhook URL points at a private or internal address, which isn't allowed." };
  }
  return { ok: true, fields: { agentKind, hostedSystemPrompt: null, hostedWebhookUrl, creditsPerCall } };
}

/**
 * The access gate for invoke (app/api/hosted-agents/[slug]/invoke/route.ts, steps
 * 4-5) — decided by David 2026-09-06: a non-member can invoke on their own
 * free trial credits alone, no active membership required, because the
 * whole point of the free-credit signup grant is to lower purchase friction
 * *before* asking for payment (plan/agently-hosted-api-concept.html). Those
 * credits are a one-time, non-renewing grant (the schema's `default 20` on
 * signup, never refilled again without an actual paid membership event —
 * see lib/membership.ts and both refill sites in
 * app/api/stripe/webhook/route.ts) — so this only ever loosens the *gate*,
 * it does not create any new source of free credits. Repeated fake
 * signups still only ever get 20 credits each, never a recurring drip.
 *
 * Pure so it's unit-testable without a live Supabase client — the actual
 * atomic spend-check in step 6 (deductCredits) is the real, race-safe gate;
 * this is the fast up-front check that also produces the right one of two
 * distinct error messages:
 *  - no active membership AND no credits left at all → "sign up for real
 *    credits or become a member" (this is the only case that message means).
 *  - some credits left, but not enough for this call's cost → the plain
 *    "insufficient credits" message, same one the atomic deduction (step 6)
 *    returns on its own race-safe path — kept identical wording so a caller
 *    sees the same message whichever path produced it.
 */
export function checkInvokeEligibility(
  profile: { membershipStatus: string | null; apiCredits: number },
  cost: number
): { ok: true } | { ok: false; error: string } {
  const isMember = profile.membershipStatus === "active";

  if (!isMember && profile.apiCredits <= 0) {
    return {
      ok: false,
      error:
        "No active membership and no free credits left. Become a member for a monthly credit refill, or see /pricing.",
    };
  }

  if (profile.apiCredits < cost) {
    return { ok: false, error: "Not enough credits for this call." };
  }

  return { ok: true };
}

/**
 * The actual race-condition guard for invoke (app/api/hosted-agents/[slug]/invoke/
 * route.ts, step 6): two concurrent calls on a wallet with just enough
 * credits for one of them must not both succeed and both deduct, dropping
 * the balance below zero. A plain "read balance, check >= cost, then
 * update" from application code is exactly that race — two requests can
 * both pass the read before either writes.
 *
 * supabase-js's own `.update()` can only set literal values, not a
 * column-relative expression like `api_credits = api_credits - cost` — so
 * the guarded decrement itself lives in a single Postgres statement
 * (agently_deduct_credits, supabase/schema.sql), called here via `.rpc()`.
 * That function's UPDATE ... WHERE api_credits >= cost is one atomic
 * statement; Postgres's row lock during that UPDATE is what actually
 * prevents two concurrent calls from both reading the same pre-deduction
 * balance. `deducted: false` means either the profile doesn't exist or
 * didn't have enough credit left *at the instant this ran* — treat it as
 * insufficient credits, never as "retry."
 */
export async function deductCredits(
  admin: SupabaseClient,
  userId: string,
  cost: number
): Promise<{ deducted: boolean; error?: string }> {
  const { data, error } = await admin.rpc("agently_deduct_credits", { profile_id: userId, cost });
  if (error) return { deducted: false, error: error.message };
  return { deducted: data === true };
}

/** Reverses a deduction after a failed hosted call (invoke route, step 9) — see agently_add_credits. */
export async function refundCredits(admin: SupabaseClient, userId: string, amount: number): Promise<void> {
  const { error } = await admin.rpc("agently_add_credits", { profile_id: userId, amount });
  if (error) {
    console.error("[hosted-agents] credit refund failed", { userId, amount, message: error.message });
  }
}

const FAILURE_ALERT_THRESHOLD = 3;
const FAILURE_ALERT_WINDOW = 10;
const ALERT_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour — see agently_agents.last_alert_sent_at in supabase/schema.sql

/**
 * Called from the invoke route's failure path only
 * (app/api/hosted-agents/[slug]/invoke/route.ts's catch block), after that
 * call's failed-invocation row is already logged. Before this, the only way
 * anyone found out a hosted agent's webhook died, or that Anthropic calls
 * to a specific agent were failing repeatedly, was a buyer complaining —
 * possibly long after it broke.
 *
 * Looks at the last FAILURE_ALERT_WINDOW logged invocations for this agent
 * (success or failure, oldest-first doesn't matter — only the count of
 * `succeeded: false` among them). If at least FAILURE_ALERT_THRESHOLD of
 * those are failures — which also covers the "fewer than 10 logged so far"
 * case, since the query only ever returns what actually exists — and this
 * agent hasn't already alerted within the last hour (last_alert_sent_at),
 * sends one alert email to the platform owner and stamps last_alert_sent_at
 * so the next several failures on the same broken agent don't each send
 * their own email.
 *
 * Never throws and never blocks the buyer's actual response: every read/
 * write error here is logged and swallowed, same "a side-channel failure
 * must never turn into a 500 for the request that triggered it" reasoning
 * as refundCredits above and notifyOwnerOfPendingReview in
 * lib/notifications.ts. sendNotificationEmail itself already no-ops
 * cleanly when PLATFORM_OWNER_EMAIL/RESEND_API_KEY aren't set.
 */
export async function checkAndAlertOnFailureRate(
  admin: SupabaseClient,
  agentId: string,
  agentName: string
): Promise<void> {
  const { data: recent, error: recentError } = await admin
    .from("agently_agent_invocations")
    .select("succeeded, error_message")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(FAILURE_ALERT_WINDOW);

  if (recentError) {
    console.error("[hosted-agents] failure-rate check: could not read recent invocations", {
      agentId,
      message: recentError.message,
    });
    return;
  }

  const rows = (recent ?? []) as { succeeded: boolean; error_message: string | null }[];
  const failures = rows.filter((r) => r.succeeded === false);
  if (failures.length < FAILURE_ALERT_THRESHOLD) return;

  const { data: agentRow, error: agentError } = await admin
    .from("agently_agents")
    .select("last_alert_sent_at")
    .eq("id", agentId)
    .maybeSingle();

  if (agentError) {
    console.error("[hosted-agents] failure-rate check: could not read last_alert_sent_at", {
      agentId,
      message: agentError.message,
    });
    return;
  }

  const lastAlertSentAt = (agentRow as { last_alert_sent_at: string | null } | null)?.last_alert_sent_at ?? null;
  if (lastAlertSentAt && Date.now() - new Date(lastAlertSentAt).getTime() < ALERT_COOLDOWN_MS) {
    return; // already alerted recently — the cooldown that keeps one broken agent from spamming the inbox
  }

  const mostRecentError = failures[0]?.error_message ?? "unknown error";
  const owner = process.env.PLATFORM_OWNER_EMAIL;
  await sendNotificationEmail(
    owner,
    `${agentName} is failing repeatedly`,
    [
      `${agentName} has failed ${failures.length} of its last ${rows.length} logged calls.`,
      `Most recent error: ${mostRecentError}`,
      "",
      `Check it: ${SITE_URL}/dashboard/agents/${agentId}/edit`,
    ].join("\n")
  );

  const { error: updateError } = await admin
    .from("agently_agents")
    .update({ last_alert_sent_at: new Date().toISOString() })
    .eq("id", agentId);
  if (updateError) {
    console.error("[hosted-agents] failure-rate check: could not stamp last_alert_sent_at", {
      agentId,
      message: updateError.message,
    });
  }
}
