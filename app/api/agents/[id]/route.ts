import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { reviewAgentSubmission } from "@/lib/safety-review";
import { notifyBuyersOfUpdate } from "@/lib/notifications";
import { getEmbedding, embeddableText } from "@/lib/embeddings";

// Edits an existing listing. When the edit is a real new version — the
// delivery link or the buyer-facing content actually changed, not just
// price or category — every buyer who owns it gets notified in-app
// (lib/notifications.ts) and the version /api/version/[slug] reports goes
// up, so a standalone delivered script can also notice on its own.
//
// POST, not PATCH — the edit page submits a plain HTML form (no JS
// required, same pattern as every other write in this app), and forms
// only support GET/POST.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ error: "Not connected yet — Supabase isn't configured." }, { status: 503 });
  }

  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/auth/sign-in", request.url));
  }

  const { data: existing } = await supabase.from("agents").select("*").eq("id", id).single();
  if (!existing || existing.creator_id !== user.id) {
    return NextResponse.json({ error: "Agent not found, or you don't own it." }, { status: 404 });
  }

  const form = await request.formData();
  const name = String(form.get("name"));
  const tagline = String(form.get("tagline"));
  const problemSolved = String(form.get("problem_solved"));
  const description = String(form.get("description"));
  const categorySlug = String(form.get("category_slug"));
  const pricingModel = String(form.get("pricing_model"));
  const priceEur = form.get("price");
  const deliveryUrl = (form.get("delivery_url") as string) || null;

  // Content changed enough to matter for trust/safety re-run only if the
  // parts a buyer actually reads changed — not just price or category.
  const contentChanged =
    name !== existing.name || tagline !== existing.tagline ||
    problemSolved !== existing.problem_solved || description !== existing.description;

  // A real new version — something a buyer running the delivered code
  // would actually want to know about — only when the code's own
  // location changed or its description changed enough to re-review.
  // A price or category edit isn't that.
  const isNewVersion = contentChanged || deliveryUrl !== existing.delivery_url;
  const version = isNewVersion ? existing.version + 1 : existing.version;

  let status = existing.status;
  let trustScore = existing.trust_score;
  let reviewNotes = existing.review_notes;
  let embedding = existing.embedding;

  if (contentChanged) {
    const verdict = await reviewAgentSubmission({ name, tagline, problemSolved, description, deliveryUrl });
    if (verdict) {
      status = verdict.risk === "low" ? "approved" : "pending_review";
      trustScore = { low: 65, medium: 40, high: 15 }[verdict.risk];
      reviewNotes = `[${verdict.risk}] ${verdict.summary}${verdict.flags.length ? ` — flags: ${verdict.flags.join("; ")}` : ""}`;
    } else {
      // No automated opinion available — a real content change still goes
      // back to a human rather than silently keeping the old verdict.
      status = "pending_review";
    }

    // The text a buyer's search matches against changed — re-embed, or the
    // listing keeps ranking against wording it no longer has.
    embedding = await getEmbedding(embeddableText({ name, tagline, problem_solved: problemSolved }));
  }

  const { error } = await supabase
    .from("agents")
    .update({
      name,
      tagline,
      problem_solved: problemSolved,
      description,
      embedding,
      category_slug: categorySlug,
      pricing_model: pricingModel,
      price_cents: pricingModel === "free" ? null : Math.round(Number(priceEur) * 100),
      delivery_url: deliveryUrl,
      status,
      trust_score: trustScore,
      review_notes: reviewNotes,
      version,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Only for a real new version — a price/category-only edit isn't
  // something someone running the delivered code needs to hear about.
  if (isNewVersion) {
    await notifyBuyersOfUpdate(id, name, version);
  }

  const successParam = isNewVersion ? "updated=1" : "saved=1";
  return NextResponse.redirect(new URL(`/agents/${existing.slug}?${successParam}`, request.url), 303);
}
