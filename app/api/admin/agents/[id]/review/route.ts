import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformOwner } from "@/lib/owner";
import { reviewAgentSubmission } from "@/lib/safety-review";

// Approving a listing from /dashboard/admin/agents only ever flips `status`
// (app/api/admin/agents/[id]/route.ts) — it never calls the safety-review
// model, so a listing that got no verdict at submission time (no
// ANTHROPIC_API_KEY configured then, or the call failing) stays at
// trust_score=0 forever, even after a human approves it, with no way to
// get a real score short of the creator editing the listing enough to
// trigger a re-review. This lets the owner ask for that re-review directly,
// without touching status — same "David decides in practice" gating as
// everywhere else in the safety-review pipeline, this only ever updates the
// score and note, never approves or rejects on its own.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.redirect(
      new URL(
        `/dashboard/admin/agents?error=${encodeURIComponent("Not connected yet — Supabase isn't configured.")}`,
        request.url
      ),
      303
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isPlatformOwner(user?.email)) {
    return NextResponse.redirect(
      new URL(`/dashboard/admin/agents?error=${encodeURIComponent("Not found.")}`, request.url),
      303
    );
  }

  const { id } = await params;
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.redirect(
      new URL(
        `/dashboard/admin/agents?error=${encodeURIComponent("SUPABASE_SERVICE_ROLE_KEY not configured")}`,
        request.url
      ),
      303
    );
  }

  const { data: agent } = await admin
    .from("agently_agents")
    .select("name, tagline, problem_solved, description, delivery_url")
    .eq("id", id)
    .single();

  if (!agent) {
    return NextResponse.redirect(
      new URL(`/dashboard/admin/agents?error=${encodeURIComponent("Agent not found.")}`, request.url),
      303
    );
  }

  const verdict = await reviewAgentSubmission({
    name: agent.name,
    tagline: agent.tagline,
    problemSolved: agent.problem_solved,
    description: agent.description,
    deliveryUrl: agent.delivery_url,
  });

  if (!verdict) {
    return NextResponse.redirect(
      new URL(
        `/dashboard/admin/agents?error=${encodeURIComponent(
          "No automated verdict came back — check ANTHROPIC_API_KEY, or try again in a moment."
        )}`,
        request.url
      ),
      303
    );
  }

  const { error } = await admin
    .from("agently_agents")
    .update({
      trust_score: verdict.score,
      review_notes: `[${verdict.risk}] ${verdict.summary}${verdict.flags.length ? ` — flags: ${verdict.flags.join("; ")}` : ""}`,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.redirect(
      new URL(`/dashboard/admin/agents?error=${encodeURIComponent(error.message)}`, request.url),
      303
    );
  }

  return NextResponse.redirect(new URL("/dashboard/admin/agents?reviewed=1", request.url), 303);
}
