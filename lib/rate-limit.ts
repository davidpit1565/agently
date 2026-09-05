import { createAdminClient } from "@/lib/supabase/admin";

/**
 * A rough, good-enough rate limiter backed by the agently_rate_limits table
 * (supabase/schema.sql) — not a queue or a sliding-window algorithm, just
 * "how many rows for this scope in the last N seconds," which is all two
 * genuinely paid-per-call endpoints (search's Voyage embedding, agent
 * submission's Anthropic + Voyage calls) need. Not perfectly atomic under
 * concurrent requests from the same scope — acceptable here since the goal
 * is stopping a tight-loop script, not enforcing an exact quota.
 *
 * Returns true (allowed) when Supabase isn't configured at all, same
 * "missing config means don't break the feature" pattern as everywhere
 * else in this codebase — this is defense against cost abuse, not a
 * feature to gate correctness on.
 */
export async function checkRateLimit(scope: string, limit: number, windowSeconds: number): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) return true;

  const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString();

  const { count } = await admin
    .from("agently_rate_limits")
    .select("id", { count: "exact", head: true })
    .eq("scope", scope)
    .gte("created_at", windowStart);

  if ((count ?? 0) >= limit) return false;

  await admin.from("agently_rate_limits").insert({ scope });
  // Best-effort trim so the table doesn't grow forever — cheap since it's
  // indexed on (scope, created_at) and only ever touches this scope's rows.
  // Every call already tolerates rows older than the window (the count
  // query above filters them out), so nothing depends on this running on
  // every call — only on it running often enough. Doing it here 1-in-20
  // times instead of always cuts this function's typical cost from 3
  // round trips to 2 without changing what it enforces.
  if (Math.random() < 0.05) {
    await admin.from("agently_rate_limits").delete().eq("scope", scope).lt("created_at", windowStart);
  }

  return true;
}

/** Best-effort client IP for anonymous rate limiting — Vercel sets this. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}
