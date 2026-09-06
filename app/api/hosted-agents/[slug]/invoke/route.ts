import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractBearerKey, hashApiKey } from "@/lib/api-keys";
import { deductCredits, refundCredits, checkInvokeEligibility, checkAndAlertOnFailureRate } from "@/lib/hosted-agents";
import { errorMessage } from "@/lib/errors";
import { isSafeExternalUrl } from "@/lib/validation";

const MAX_INPUT_LENGTH = 20_000; // a reasonable ceiling on the caller's own request body — not a measured limit, just a sane guard.
const WEBHOOK_TIMEOUT_MS = 25_000;

// The actual hosted execution: a buyer with enough wallet credits calls this
// instead of ever receiving delivery_url — an active membership is no
// longer required by itself, a non-member can spend their free trial
// credits the same way (see lib/hosted-agents.ts's checkInvokeEligibility).
// Never applies to a 'file' agent — that's still the plain delivery flow at
// /api/deliveries/[agentId]. Every real call is metered (agently_agent_
// invocations) and either runs an Anthropic call with a hidden system
// prompt ('prompt') or forwards to the creator's own webhook server-to-
// server ('workflow') — see plan/agently-hosted-api-concept.html for the
// full reasoning and app/agents/[slug]/page.tsx for the buyer-facing curl
// example that hits this route.
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ error: "Not connected yet — Supabase isn't configured." }, { status: 503 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Not connected yet — SUPABASE_SERVICE_ROLE_KEY isn't configured." }, { status: 503 });
  }

  // Step 1: the caller. This endpoint is called server-to-server by
  // whatever the buyer built — no Supabase session, no cookies, only the
  // API key they generated at /dashboard/api-keys. Same reasoning as the
  // Stripe webhook using the admin client: there's no auth.uid() here for
  // any RLS policy to check against.
  const apiKey = extractBearerKey(request.headers.get("authorization"));
  if (!apiKey) {
    return NextResponse.json({ error: "Missing or malformed Authorization header — expected 'Bearer <key>'." }, { status: 401 });
  }

  // Step 2: look up the key by its hash. Never the plaintext — that's never
  // stored anywhere (see lib/api-keys.ts).
  const keyHash = hashApiKey(apiKey);
  const { data: keyRow } = await admin
    .from("agently_api_keys")
    .select("id, user_id, revoked_at")
    .eq("key_hash", keyHash)
    .is("revoked_at", null)
    .maybeSingle();

  if (!keyRow) {
    return NextResponse.json({ error: "Invalid or revoked API key." }, { status: 401 });
  }

  // Step 3: the agent. Only an approved, hosted (non-file) agent applies here.
  const { data: agent } = await admin
    .from("agently_agents")
    .select("id, slug, name, status, agent_kind, hosted_system_prompt, hosted_webhook_url, credits_per_call")
    .eq("slug", slug)
    .maybeSingle();

  if (!agent || agent.status !== "approved") {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }
  if (agent.agent_kind === "file") {
    return NextResponse.json(
      { error: "This agent is delivered as a file, not a hosted API — see its listing page for the regular delivery link." },
      { status: 400 }
    );
  }

  // Step 4: the wallet this caller is invoking against. The credit wallet
  // isn't gated behind an active membership any more (David's decision,
  // 2026-09-06) — a non-member can invoke on their own free trial credits
  // alone, since the whole point of the free-credit signup grant is to
  // lower purchase friction before ever asking for payment (see
  // plan/agently-hosted-api-concept.html). Those credits are a one-time,
  // non-renewing grant (the schema's `default 20` on signup — see
  // supabase/schema.sql's comment on agently_profiles.api_credits); nothing
  // refills a non-member's wallet, so repeated fake signups only ever get
  // 20 credits each, never a recurring drip. A one-time-per-agent purchase
  // stays on the existing, untouched delivery/checkout flow either way.
  const { data: profile } = await admin
    .from("agently_profiles")
    .select("membership_status, api_credits")
    .eq("id", keyRow.user_id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Account not found for this API key." }, { status: 404 });
  }

  // Step 5: the access gate — see lib/hosted-agents.ts's checkInvokeEligibility
  // for the full reasoning and the two distinct error messages it can
  // return. This is a cheap up-front check before touching the request body
  // or running anything; the real, race-safe guard is the atomic deduction
  // in step 6 below.
  const cost = agent.credits_per_call ?? 0;
  const eligibility = checkInvokeEligibility(
    { membershipStatus: profile.membership_status, apiCredits: profile.api_credits },
    cost
  );
  if (!eligibility.ok) {
    return NextResponse.json({ error: eligibility.error }, { status: 402 });
  }

  let body: { input?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }
  const input = body?.input;
  if (typeof input !== "string" || !input.trim()) {
    return NextResponse.json({ error: "Request body must include a non-empty string 'input'." }, { status: 400 });
  }
  if (input.length > MAX_INPUT_LENGTH) {
    return NextResponse.json({ error: `'input' is too long — ${MAX_INPUT_LENGTH} characters max.` }, { status: 400 });
  }

  // Step 6: the atomic deduction — see lib/hosted-agents.ts's deductCredits
  // for the full race-condition reasoning. This is the real gate; step 5
  // above was only a fast, non-atomic pre-check.
  const { deducted, error: deductError } = await deductCredits(admin, keyRow.user_id, cost);
  if (deductError) {
    console.error("[invoke] credit deduction failed", { agentSlug: slug, message: deductError });
    return NextResponse.json({ error: "Could not process this call — try again." }, { status: 500 });
  }
  if (!deducted) {
    return NextResponse.json({ error: "Not enough credits for this call." }, { status: 402 });
  }

  // Step 7: run the actual logic. Any failure here refunds the just-
  // deducted credits (step 9's reasoning) before returning an error — a
  // buyer never pays for a call that didn't actually produce a result.
  let result: unknown;
  try {
    result = agent.agent_kind === "prompt"
      ? await runHostedPrompt(agent.hosted_system_prompt!, input)
      : await runHostedWorkflow(agent.hosted_webhook_url!, input);
  } catch (err) {
    await refundCredits(admin, keyRow.user_id, cost);
    console.error("[invoke] hosted call failed, credits refunded", {
      agentSlug: slug,
      agentKind: agent.agent_kind,
      message: errorMessage(err),
    });
    const isTimeout = err instanceof Error && err.name === "TimeoutError";
    // A short, safe classification for the log — the same one already
    // thrown inside runHostedPrompt/runHostedWorkflow ("Anthropic API call
    // failed (529)", "Webhook call failed (503)"), never the buyer-facing
    // generic message below and never anything that could echo
    // hosted_system_prompt content (see runHostedPrompt's own comment).
    const errorClassification = isTimeout ? "Workflow timed out" : errorMessage(err);

    // Log the failure too — before this, a failed call left no trace
    // anywhere but a console.error line, so nobody would find out a hosted
    // agent's webhook or Anthropic calls were failing repeatedly short of a
    // buyer complaining. credits_charged is 0: the deduction above was just
    // refunded, so this call cost the buyer nothing.
    const { error: logError } = await admin.from("agently_agent_invocations").insert({
      agent_id: agent.id,
      user_id: keyRow.user_id,
      credits_charged: 0,
      succeeded: false,
      error_message: errorClassification,
    });
    if (logError) {
      console.error("[invoke] failed-invocation log insert failed", { agentSlug: slug, message: logError.message });
    }

    // Never blocks or slows down the buyer's response — awaited here (this
    // codebase's existing pattern is to await non-critical side effects
    // rather than fire-and-forget) but everything inside it is itself
    // never-throwing.
    await checkAndAlertOnFailureRate(admin, agent.id, agent.name);

    return NextResponse.json(
      { error: isTimeout ? "The agent's workflow timed out." : "The hosted agent failed to produce a result." },
      { status: 502 }
    );
  }

  // Step 8: log the successful call and mark the key as used. Never throws
  // this request into an error state over a logging failure — the buyer
  // already got a real result and already spent the credit.
  const { error: logError } = await admin.from("agently_agent_invocations").insert({
    agent_id: agent.id,
    user_id: keyRow.user_id,
    credits_charged: cost,
    succeeded: true,
    error_message: null,
  });
  if (logError) {
    console.error("[invoke] invocation log insert failed", { agentSlug: slug, message: logError.message });
  }
  const { error: touchError } = await admin
    .from("agently_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", keyRow.id);
  if (touchError) {
    console.error("[invoke] api key last_used_at update failed", { keyId: keyRow.id, message: touchError.message });
  }

  return NextResponse.json({ result });
}

// Same client/pattern already in use for the safety-review agent
// (lib/safety-review.ts) — the raw Anthropic Messages API with fetch, not a
// separate SDK. hosted_system_prompt never appears in any thrown error or
// log line here — only its own presence/absence, never its content.
async function runHostedPrompt(systemPrompt: string, input: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: input }],
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    // Deliberately not including res's body in the thrown message — it's
    // logged by the caller via errorMessage(err), and an Anthropic error
    // body has never been observed to echo the system prompt back, but
    // there's no reason to take that on faith across every failure mode.
    throw new Error(`Anthropic API call failed (${res.status})`);
  }

  const data = await res.json();
  const textBlock = data.content?.find((block: { type: string }) => block.type === "text");
  if (!textBlock) throw new Error("No text response from Anthropic");
  return textBlock.text as string;
}

// Server-to-server call to the creator's own webhook (n8n or similar) — the
// buyer's raw input is forwarded as-is; whatever the webhook returns is
// passed straight back as the result. A slow/dead webhook is exactly the
// third-party-api-resilience case: a hard timeout so the buyer's request
// never hangs indefinitely, and no raw stack trace ever reaches them (the
// caller here only ever sees a generic "workflow timed out"/"failed to
// produce a result" message — see the catch block above).
async function runHostedWorkflow(webhookUrl: string, input: string): Promise<unknown> {
  // Re-checked here, not only at creation time (validateHostedAgentFields,
  // lib/hosted-agents.ts) — a hostname that resolved to a public address
  // when the creator saved the listing can resolve to an internal one by
  // the time it's actually called (DNS rebinding, or just a dynamic-DNS
  // host under the creator's control), and this is the request that
  // actually reaches the network, so this is the check that has to hold.
  // See lib/validation.ts's isSafeExternalUrl for the full reasoning.
  if (!(await isSafeExternalUrl(webhookUrl))) {
    throw new Error("Webhook call failed (blocked: private/internal address)");
  }

  // redirect: "manual" is the other half of this guard — fetch's default
  // ("follow") would happily chase a 3xx from a webhook that passed the
  // isSafeExternalUrl check straight to an internal address (the cloud
  // metadata endpoint, localhost, an RFC1918 host) with no further check at
  // all. A creator's webhook has no legitimate reason to redirect, so any
  // redirect response is treated as a failure rather than re-validated and
  // followed.
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ input }),
    signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    redirect: "manual",
  });

  if (res.type === "opaqueredirect" || (res.status >= 300 && res.status < 400)) {
    throw new Error("Webhook call failed (blocked: redirect not allowed)");
  }

  if (!res.ok) {
    throw new Error(`Webhook call failed (${res.status})`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  return contentType.includes("application/json") ? await res.json() : await res.text();
}
