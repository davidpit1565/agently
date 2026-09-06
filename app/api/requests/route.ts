import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

// Same cap as reviews' MAX_COMMENT_LENGTH (app/api/reviews/route.ts) —
// without one, this field had no limit at all, unlike every other
// publicly-rendered or admin-viewed free-text field in the app.
const MAX_DESCRIPTION_LENGTH = 2000;

// Submits a custom-agent request. Professional-tier only — enforced here
// and again at the database (schema.sql's "professional members can
// request an agent" policy), since a Professional-only perk that only the
// UI hides isn't actually gated.
export async function POST(request: Request) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.redirect(
      new URL(`/dashboard/request?error=${encodeURIComponent("Not connected yet — Supabase isn't configured.")}`, request.url),
      303
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/auth/sign-in", request.url));
  }

  const { data: profile } = await supabase
    .from("agently_profiles")
    .select("membership_tier")
    .eq("id", user.id)
    .single();

  if (profile?.membership_tier !== "professional") {
    return NextResponse.redirect(
      new URL(`/dashboard/request?error=${encodeURIComponent("Requesting a custom agent is a Professional-membership perk.")}`, request.url),
      303
    );
  }

  // A Professional member could otherwise flood agently_agent_requests —
  // every one of these is meant to reach a human (a creator matching
  // against it, or admin triage), so a burst of junk submissions is a
  // real annoyance to someone else, not just a wasted DB row.
  const allowed = await checkRateLimit(`agent_request:${user.id}`, 5, 600);
  if (!allowed) {
    return NextResponse.redirect(
      new URL(`/dashboard/request?error=${encodeURIComponent("Too many requests in a short time — wait a few minutes and try again.")}`, request.url),
      303
    );
  }

  const form = await request.formData();
  const description = String(form.get("description") ?? "").trim().slice(0, MAX_DESCRIPTION_LENGTH);

  if (!description) {
    return NextResponse.redirect(
      new URL(`/dashboard/request?error=${encodeURIComponent("Describe what you need.")}`, request.url),
      303
    );
  }

  const { error } = await supabase.from("agently_agent_requests").insert({
    requester_id: user.id,
    description,
  });

  if (error) {
    return NextResponse.redirect(
      new URL(`/dashboard/request?error=${encodeURIComponent(error.message)}`, request.url),
      303
    );
  }

  return NextResponse.redirect(new URL("/dashboard/request?submitted=1", request.url), 303);
}
