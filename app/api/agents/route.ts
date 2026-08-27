import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MEMBERSHIP_TIERS, canUpload } from "@/lib/membership";
import { reviewAgentSubmission } from "@/lib/safety-review";
import { getEmbedding, embeddableText } from "@/lib/embeddings";
import { uploadAgentFiles } from "@/lib/agent-files";
import { sanitizeUrl } from "@/lib/validation";
import type { MembershipTier } from "@/lib/types";

// Handles the upload form (app/dashboard/upload). A "low" risk verdict from
// the safety-review agent (lib/safety-review.ts) auto-approves; anything
// else — or no ANTHROPIC_API_KEY configured — leaves it pending_review for
// a human, same as before that existed.
export async function POST(request: Request) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ error: "Not connected yet — Supabase isn't configured." }, { status: 503 });
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

  const tier = (profile?.membership_tier ?? "free") as MembershipTier;

  if (!canUpload(tier)) {
    return NextResponse.json(
      { error: "A paid membership is required to list an agent. See /pricing." },
      { status: 403 }
    );
  }

  // The plan page promises "up to N active listings" per tier — enforce it
  // here, not just in copy, or the tiers mean nothing.
  const { count } = await supabase
    .from("agently_agents")
    .select("id", { count: "exact", head: true })
    .eq("creator_id", user.id)
    .in("status", ["pending_review", "approved"]);

  const limit = MEMBERSHIP_TIERS[tier as Exclude<MembershipTier, "free">].maxActiveListings;
  if ((count ?? 0) >= limit) {
    return NextResponse.json(
      {
        error: `Your ${tier} membership allows up to ${limit} active listings. Delist one, or upgrade at /pricing.`,
      },
      { status: 403 }
    );
  }

  const form = await request.formData();
  const pricingModel = String(form.get("pricing_model"));
  const priceEur = form.get("price");
  const name = String(form.get("name"));
  const tagline = String(form.get("tagline"));
  const problemSolved = String(form.get("problem_solved"));
  const description = String(form.get("description"));
  const deliveryUrl = sanitizeUrl((form.get("delivery_url") as string) || null);
  // A file input still submits one zero-size entry when nothing was
  // picked — filtered out in uploadAgentFiles, not here, so this stays
  // the single place that decides what counts as "no file."
  const files = form.getAll("files").filter((f): f is File => f instanceof File);

  const verdict = await reviewAgentSubmission({
    name,
    tagline,
    problemSolved,
    description,
    deliveryUrl,
  });

  // No verdict (API key missing, or the call failed) means "no automated
  // opinion" — stay pending_review, never auto-approve on a null verdict.
  const status = verdict?.risk === "low" ? "approved" : "pending_review";
  const trustScore = verdict ? { low: 65, medium: 40, high: 15 }[verdict.risk] : 0;

  // Null without VOYAGE_API_KEY configured — /api/search falls back to
  // substring matching for any listing with no embedding, same as today.
  const embedding = await getEmbedding(embeddableText({ name, tagline, problem_solved: problemSolved }));

  // Ownership/membership/limit are all verified above with the user's own
  // session. The insert itself goes through the service-role client — the
  // "authenticated" role has no insert privilege at all on agently_agents
  // (see supabase/schema.sql), specifically so nobody can PATCH/POST a row
  // directly with status='approved' and a fabricated trust_score, bypassing
  // reviewAgentSubmission() above.
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Not connected yet — Supabase isn't configured." }, { status: 503 });
  }

  const { data: inserted, error } = await admin
    .from("agently_agents")
    .insert({
      creator_id: user.id,
      slug: slugify(name),
      name,
      tagline,
      problem_solved: problemSolved,
      description,
      embedding,
      category_slug: form.get("category_slug"),
      pricing_model: pricingModel,
      price_cents: pricingModel === "free" ? null : Math.round(Number(priceEur) * 100),
      delivery_url: deliveryUrl,
      status,
      trust_score: trustScore,
      review_notes: verdict ? `[${verdict.risk}] ${verdict.summary}${verdict.flags.length ? ` — flags: ${verdict.flags.join("; ")}` : ""}` : null,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return NextResponse.json({ error: error?.message ?? "Could not save the listing." }, { status: 400 });
  }

  let rejectedNames: string[] = [];
  if (files.length > 0) {
    const uploadResult = await uploadAgentFiles(inserted.id, files);
    rejectedNames = uploadResult.rejected.map((r) => r.name);
  }

  const redirectUrl = new URL("/dashboard/upload?submitted=1", request.url);
  if (rejectedNames.length > 0) {
    redirectUrl.searchParams.set("skipped_files", rejectedNames.join(", "));
  }
  return NextResponse.redirect(redirectUrl);
}

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") +
    "-" +
    Math.random().toString(36).slice(2, 6)
  );
}
