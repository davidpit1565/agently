import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { reviewAgentSubmission, isAutoApproveEnabled } from "@/lib/safety-review";
import { notifyBuyersOfUpdate, notifyOwnerOfPendingReview } from "@/lib/notifications";
import { buildAgentEditDiff } from "@/lib/agent-diff";
import { getEmbedding, embeddableText } from "@/lib/embeddings";
import { uploadAgentFiles, getAgentIdsWithFiles } from "@/lib/agent-files";
import { sanitizeUrl } from "@/lib/validation";
import { MIN_AGENT_PRICE_CENTS } from "@/lib/membership";

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
  const { id } = await params;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.redirect(
      new URL(
        `/dashboard/agents/${id}/edit?error=${encodeURIComponent("Not connected yet — Supabase isn't configured.")}`,
        request.url
      ),
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

  const { data: existing } = await supabase.from("agently_agents").select("*").eq("id", id).single();
  if (!existing || existing.creator_id !== user.id) {
    return NextResponse.redirect(
      new URL(
        `/dashboard/agents/${id}/edit?error=${encodeURIComponent("Agent not found, or you don't own it.")}`,
        request.url
      ),
      303
    );
  }

  const form = await request.formData();
  const name = String(form.get("name"));
  const tagline = String(form.get("tagline"));
  const problemSolved = String(form.get("problem_solved"));
  const description = String(form.get("description"));
  const categorySlug = String(form.get("category_slug"));
  const pricingModel = String(form.get("pricing_model"));
  const priceEur = form.get("price");
  const deliveryUrl = sanitizeUrl((form.get("delivery_url") as string) || null);
  const newFiles = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);

  // Monthly subscription is no longer offered — same business decision as
  // app/api/agents/route.ts (creating a new listing). An agent that's
  // already subscription-priced can stay that way (existing buyers keep
  // their access, and the edit form still shows that one option for this
  // specific agent) but can't be switched into it from something else, and
  // no other listing can be switched into it either.
  if (pricingModel === "subscription" && existing.pricing_model !== "subscription") {
    return NextResponse.redirect(
      new URL(
        `/dashboard/agents/${id}/edit?error=${encodeURIComponent("Monthly subscription is no longer available for a listing — choose free or a one-time purchase.")}`,
        request.url
      ),
      303
    );
  }
  if (pricingModel !== "free" && pricingModel !== "one_time" && pricingModel !== "subscription") {
    return NextResponse.redirect(
      new URL(`/dashboard/agents/${id}/edit?error=${encodeURIComponent("Unknown pricing model.")}`, request.url),
      303
    );
  }

  // Same enforcement as creating a listing (app/api/agents/route.ts) — an
  // edit switching an existing free/rejected listing to paid needs the same
  // gate, or it becomes the back door around the create-time check.
  if (pricingModel !== "free") {
    const { data: profile } = await supabase
      .from("agently_profiles")
      .select("stripe_connect_ready")
      .eq("id", user.id)
      .single();
    if (!profile?.stripe_connect_ready) {
      return NextResponse.redirect(
        new URL(
          `/dashboard/agents/${id}/edit?error=${encodeURIComponent("Connect Stripe payouts before listing a paid agent — see /dashboard/payouts.")}`,
          request.url
        ),
        303
      );
    }
    const price = Number(priceEur);
    if (!Number.isFinite(price) || price <= 0) {
      return NextResponse.redirect(
        new URL(`/dashboard/agents/${id}/edit?error=${encodeURIComponent("Enter a price for a paid agent.")}`, request.url),
        303
      );
    }
    if (Math.round(price * 100) < MIN_AGENT_PRICE_CENTS) {
      return NextResponse.redirect(
        new URL(
          `/dashboard/agents/${id}/edit?error=${encodeURIComponent(`A paid agent must be priced at least €${(MIN_AGENT_PRICE_CENTS / 100).toFixed(2)} — below that, Stripe's own processing fee can cost more than the platform earns on the sale.`)}`,
          request.url
        ),
        303
      );
    }
  }

  // Same rule as creating a listing: clearing the delivery link with no
  // files (existing or newly attached) left to fall back on would leave a
  // buyer with nothing to receive.
  if (!deliveryUrl && newFiles.length === 0) {
    const hasExistingFiles = (await getAgentIdsWithFiles([id])).has(id);
    if (!hasExistingFiles) {
      return NextResponse.redirect(
        new URL(
          `/dashboard/agents/${id}/edit?error=${encodeURIComponent("Add a delivery link or attach at least one file — a buyer needs to actually receive something.")}`,
          request.url
        ),
        303
      );
    }
  }

  // Content changed enough to matter for trust/safety re-run only if the
  // parts a buyer actually reads changed — not just price or category.
  const contentChanged =
    name !== existing.name || tagline !== existing.tagline ||
    problemSolved !== existing.problem_solved || description !== existing.description;

  // A real new version — something a buyer running the delivered code
  // would actually want to know about — only when the code's own
  // location changed, new files were attached, or its description changed
  // enough to re-review. A price or category edit isn't that.
  const isNewVersion = contentChanged || deliveryUrl !== existing.delivery_url || newFiles.length > 0;
  const version = isNewVersion ? existing.version + 1 : existing.version;

  let status = existing.status;
  let trustScore = existing.trust_score;
  let reviewNotes = existing.review_notes;
  let embedding = existing.embedding;

  // Computed even in the null-verdict branch below — a human re-reviewing
  // this needs to see what a creator actually changed, not just the AI's
  // (possibly absent) opinion on the new text.
  let editDiff: string | undefined;
  let verdict: Awaited<ReturnType<typeof reviewAgentSubmission>> = null;

  if (contentChanged) {
    editDiff = buildAgentEditDiff(existing, { name, tagline, problemSolved, description });
    verdict = await reviewAgentSubmission({ name, tagline, problemSolved, description, deliveryUrl });
    if (verdict) {
      // isAutoApproveEnabled() is off by default — see lib/safety-review.ts.
      status = verdict.risk === "low" && isAutoApproveEnabled() ? "approved" : "pending_review";
      trustScore = verdict.score;
      reviewNotes = `[${verdict.risk}] ${verdict.summary}${verdict.flags.length ? ` — flags: ${verdict.flags.join("; ")}` : ""}\n\nWhat changed:\n${editDiff}`;
    } else {
      // No automated opinion available — a real content change still goes
      // back to a human rather than silently keeping the old verdict. The
      // diff is the only thing a reviewer has to go on here, so it still
      // needs to land in review_notes rather than leaving the old AI note
      // (about a since-changed version of the listing) in place.
      status = "pending_review";
      reviewNotes = `No automated verdict (check ANTHROPIC_API_KEY).\n\nWhat changed:\n${editDiff}`;
    }

    // The text a buyer's search matches against changed — re-embed, or the
    // listing keeps ranking against wording it no longer has.
    embedding = await getEmbedding(embeddableText({ name, tagline, problem_solved: problemSolved }));
  }

  // Ownership was already checked above with the user's own session. The
  // write itself goes through the service-role client — "authenticated" has
  // no update privilege at all on agently_agents (see supabase/schema.sql),
  // specifically so a creator can't PATCH their own row directly to
  // status='approved'/trust_score=100, bypassing the safety-review verdict
  // computed just above.
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.redirect(
      new URL(
        `/dashboard/agents/${id}/edit?error=${encodeURIComponent("Not connected yet — Supabase isn't configured.")}`,
        request.url
      ),
      303
    );
  }

  // Optimistic lock on `version`: a double form-submit (slow network
  // retry, or two native submissions slipping past SubmitButton's
  // next-tick disable window) sends two nearly-simultaneous POSTs that
  // both read the same `existing.version` above and both compute the same
  // bumped `version`. Without `.eq("version", existing.version)` here,
  // both writes would land, and — worse — notifyBuyersOfUpdate below would
  // fire twice, putting two "agent was updated" notifications in front of
  // every buyer for what was really one edit. Whichever request loses the
  // race updates zero rows and is handled as a no-op below, not an error.
  const { data: updatedRows, error } = await admin
    .from("agently_agents")
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
    .eq("id", id)
    .eq("version", existing.version)
    .select("id");

  if (error) {
    return NextResponse.redirect(
      new URL(`/dashboard/agents/${id}/edit?error=${encodeURIComponent(error.message)}`, request.url),
      303
    );
  }

  const successParam = isNewVersion ? "updated=1" : "saved=1";
  const redirectUrl = new URL(`/agents/${existing.slug}?${successParam}`, request.url);

  if (!updatedRows || updatedRows.length === 0) {
    // Lost the race to an identical duplicate submit that already applied
    // this exact edit — don't re-upload files or re-notify buyers for it.
    return NextResponse.redirect(redirectUrl, 303);
  }

  let rejectedNames: string[] = [];
  if (newFiles.length > 0) {
    const uploadResult = await uploadAgentFiles(id, newFiles);
    rejectedNames = uploadResult.rejected.map((r) => r.name);
  }

  // Only for a real new version — a price/category-only edit isn't
  // something someone running the delivered code needs to hear about.
  if (isNewVersion) {
    await notifyBuyersOfUpdate(id, name, version);
  }

  if (contentChanged && status === "pending_review") {
    await notifyOwnerOfPendingReview({ agentName: name, isEdit: true, verdict, diff: editDiff });
  }

  if (rejectedNames.length > 0) {
    redirectUrl.searchParams.set("skipped_files", rejectedNames.join(", "));
  }
  return NextResponse.redirect(redirectUrl, 303);
}
