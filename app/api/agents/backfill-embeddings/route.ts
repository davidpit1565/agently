import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEmbedding, embeddableText } from "@/lib/embeddings";
import { isPlatformOwner } from "@/lib/owner";

// One-time (well, run-as-needed) catch-up for listings created before
// semantic search existed — /api/agents and /api/agents/[id] only compute
// an embedding on create or content-change, so every agent already in the
// catalog when that shipped has `embedding: null` and never gets picked up
// by /api/search until something re-embeds it. Owner-gated the same way as
// /dashboard/admin/requests; uses the admin client because this walks every
// creator's listings, not just the caller's own (RLS's "creators can update
// their own agents" would block that with the session client).
export async function POST(request: Request) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ error: "Not connected yet — Supabase isn't configured." }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isPlatformOwner(user?.email)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Service role key not configured." }, { status: 503 });
  }
  const db = admin;

  const { data: agents, error } = await db
    .from("agently_agents")
    .select("id, name, tagline, problem_solved")
    .eq("status", "approved")
    .is("embedding", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  let embedded = 0;
  let skipped = 0;

  // One at a time here meant a catalog with a couple hundred backfill
  // candidates could run long enough to risk the platform's serverless
  // function timeout, failing the whole batch after doing most of the
  // work. Voyage's embedding calls are independent per agent, so a small
  // fixed concurrency (not unbounded — this can still be tripped by hand
  // against hundreds of rows) gets through the batch faster without
  // hammering the embeddings API harder than a person clicking the button
  // a few times in a row already would.
  const CONCURRENCY = 5;
  const queue = [...(agents ?? [])];

  async function worker() {
    let agent;
    while ((agent = queue.shift())) {
      const embedding = await getEmbedding(embeddableText(agent));
      if (!embedding) {
        // No VOYAGE_API_KEY, or this one call failed — leave it null, try
        // again on the next run rather than fail the whole batch.
        skipped++;
        continue;
      }
      await db.from("agently_agents").update({ embedding }).eq("id", agent.id);
      embedded++;
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));

  return NextResponse.redirect(
    new URL(`/dashboard/admin/requests?embedded=${embedded}&skipped=${skipped}`, request.url),
    303
  );
}
