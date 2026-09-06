import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MEMBERSHIP_TIERS, canUpload, MIN_AGENT_PRICE_CENTS } from "@/lib/membership";
import { reviewAgentSubmission, isAutoApproveEnabled } from "@/lib/safety-review";
import { notifyOwnerOfPendingReview } from "@/lib/notifications";
import { getEmbedding, embeddableText } from "@/lib/embeddings";
import { uploadAgentFiles } from "@/lib/agent-files";
import { sanitizeUrl } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";
import type { MembershipTier } from "@/lib/types";

// Handles the upload form (app/dashboard/upload). A "low" risk verdict from
// the safety-review agent (lib/safety-review.ts) auto-approves; anything
// else — or no ANTHROPIC_API_KEY configured — leaves it pending_review for
// a human, same as before that existed.
export async function POST(request: Request) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.redirect(
      new URL(`/dashboard/upload?error=${encodeURIComponent("Not connected yet — Supabase isn't configured.")}`, request.url),
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

  const { data: profile, error: profileError } = await supabase
    .from("agently_profiles")
    .select("membership_tier, stripe_connect_ready")
    .eq("id", user.id)
    .single();

  // A failed lookup here is not "no membership" — treating it that way told
  // a paying creator "A paid membership is required" on a plain Supabase
  // blip, masking an infra failure as a billing problem.
  if (profileError) {
    return NextResponse.redirect(
      new URL(
        `/dashboard/upload?error=${encodeURIComponent("Couldn't verify your membership — try again in a moment.")}`,
        request.url
      ),
      303
    );
  }

  const tier = (profile?.membership_tier ?? "free") as MembershipTier;

  if (!canUpload(tier)) {
    return NextResponse.redirect(
      new URL(
        `/dashboard/upload?error=${encodeURIComponent("A paid membership is required to list an agent. See /pricing.")}`,
        request.url
      ),
      303
    );
  }

  // The plan page promises "up to N active listings" per tier — enforce it
  // here, not just in copy, or the tiers mean nothing.
  const { count, error: countError } = await supabase
    .from("agently_agents")
    .select("id", { count: "exact", head: true })
    .eq("creator_id", user.id)
    .in("status", ["pending_review", "approved"]);

  // A failed count is not "zero active listings" — treating it that way let
  // a transient query failure bypass the tier's listing cap entirely.
  if (countError) {
    return NextResponse.redirect(
      new URL(
        `/dashboard/upload?error=${encodeURIComponent("Couldn't verify your active listings — try again in a moment.")}`,
        request.url
      ),
      303
    );
  }

  const limit = MEMBERSHIP_TIERS[tier as Exclude<MembershipTier, "free">].maxActiveListings;
  if ((count ?? 0) >= limit) {
    return NextResponse.redirect(
      new URL(
        `/dashboard/upload?error=${encodeURIComponent(`Your ${tier} membership allows up to ${limit} active listings. Delist one, or upgrade at /pricing.`)}`,
        request.url
      ),
      303
    );
  }

  // The active-listing limit above only counts pending_review + approved —
  // a rejected submission never counts against it, and reviewAgentSubmission()
  // + getEmbedding() below still run (real Anthropic + Voyage cost) before a
  // submission is known to be rejected. Without this, one signed-in account
  // could submit unlimited slightly-varied listings (varied enough to dodge
  // the exact-duplicate check further down), burn a paid API call on each,
  // and never trip the tier limit because every one gets rejected. 8 attempts
  // per 10 minutes is well above any real creator submitting real listings.
  const allowedToSubmit = await checkRateLimit(`agent_submit:${user.id}`, 8, 600);
  if (!allowedToSubmit) {
    return NextResponse.redirect(
      new URL(
        `/dashboard/upload?error=${encodeURIComponent("Too many submissions in a short time — wait a few minutes and try again.")}`,
        request.url
      ),
      303
    );
  }

  const form = await request.formData();
  const pricingModel = String(form.get("pricing_model"));
  // Monthly subscription is no longer offered for a new listing — a
  // business decision, not a technical one. Existing subscription-model
  // agents (and their buyers) are untouched; app/dashboard/upload/page.tsx's
  // form doesn't offer the option either, but this is the real gate, not
  // that removed <option>.
  if (pricingModel !== "free" && pricingModel !== "one_time") {
    return NextResponse.redirect(
      new URL(
        `/dashboard/upload?error=${encodeURIComponent("Only 'free' or a one-time purchase are available for a new listing.")}`,
        request.url
      ),
      303
    );
  }
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

  // A paid listing with no connected payout account has nowhere for the
  // money to go — checkout (/api/checkout) already refuses to sell it, but
  // that left a dead listing sitting on the catalog looking purchasable.
  // Catch it here instead, before any paid safety-review/embedding calls run.
  if (pricingModel !== "free" && !profile?.stripe_connect_ready) {
    return NextResponse.redirect(
      new URL(
        `/dashboard/upload?error=${encodeURIComponent("Connect Stripe payouts before listing a paid agent — see /dashboard/payouts.")}`,
        request.url
      ),
      303
    );
  }

  if (pricingModel !== "free") {
    const price = Number(priceEur);
    if (!Number.isFinite(price) || price <= 0) {
      return NextResponse.redirect(
        new URL(`/dashboard/upload?error=${encodeURIComponent("Enter a price for a paid agent.")}`, request.url),
        303
      );
    }
    if (Math.round(price * 100) < MIN_AGENT_PRICE_CENTS) {
      return NextResponse.redirect(
        new URL(
          `/dashboard/upload?error=${encodeURIComponent(`A paid agent must be priced at least €${(MIN_AGENT_PRICE_CENTS / 100).toFixed(2)} — below that, Stripe's own processing fee can cost more than the platform earns on the sale.`)}`,
          request.url
        ),
        303
      );
    }
  }

  // A listing with neither a delivery link nor an attached file has nothing
  // for a buyer to actually receive — this was a real gap: the original 5
  // seed agents all shipped with delivery_url: null and no files, meaning a
  // real purchase would have paid and gotten nothing back.
  if (!deliveryUrl && files.length === 0) {
    return NextResponse.redirect(
      new URL(
        `/dashboard/upload?error=${encodeURIComponent("Add a delivery link or attach at least one file — a buyer needs to actually receive something.")}`,
        request.url
      ),
      303
    );
  }

  // A double form-submit — a slow network causing a browser retry, or a
  // duplicate native submission slipping through SubmitButton's next-tick
  // disable window (app/components/submit-button.tsx: two clicks landing
  // before the first's setTimeout(0) actually disables the button) — would
  // otherwise create a second listing and re-run the paid safety-review and
  // embedding calls below for content that's byte-for-byte what this
  // creator just submitted. Treat an identical listing from the same
  // creator in the last 15s as that same submit landing twice, not a new
  // listing, before spending anything on it.
  //
  // This SELECT alone is only a best-effort fast path, not a real guard:
  // two overlapping requests — the exact double-click this exists for —
  // can both run it before either has inserted anything, both find
  // nothing, and both go on to pay for a review + embedding call and
  // insert a duplicate listing. dedupeBucket below, backed by
  // agently_agents_dedupe_idx (supabase/schema.sql), is what actually
  // closes that: a real unique constraint the database enforces
  // atomically, which a read-then-write here can't.
  const { data: recentDuplicate } = await supabase
    .from("agently_agents")
    .select("id")
    .eq("creator_id", user.id)
    .eq("name", name)
    .eq("tagline", tagline)
    .eq("description", description)
    .gte("created_at", new Date(Date.now() - 15_000).toISOString())
    .limit(1)
    .maybeSingle();

  if (recentDuplicate) {
    return NextResponse.redirect(new URL("/dashboard/upload?submitted=1", request.url));
  }

  const dedupeBucket = Math.floor(Date.now() / 15_000);

  // Two independent network calls (Anthropic, Voyage) over the same input
  // text — neither depends on the other's result, so running them
  // sequentially only ever added their full combined latency to every
  // upload instead of the slower of the two.
  const [verdict, embedding] = await Promise.all([
    reviewAgentSubmission({ name, tagline, problemSolved, description, deliveryUrl }),
    // Null without VOYAGE_API_KEY configured — /api/search falls back to
    // substring matching for any listing with no embedding, same as today.
    getEmbedding(embeddableText({ name, tagline, problem_solved: problemSolved })),
  ]);

  // No verdict (API key missing, or the call failed) means "no automated
  // opinion" — stay pending_review, never auto-approve on a null verdict.
  // isAutoApproveEnabled() is off by default: David decides every listing
  // in practice for now, regardless of score, until that's flipped on
  // purpose once the score has a track record.
  const status = verdict && verdict.risk === "low" && isAutoApproveEnabled() ? "approved" : "pending_review";
  const trustScore = verdict ? verdict.score : 0;

  // Ownership/membership/limit are all verified above with the user's own
  // session. The insert itself goes through the service-role client — the
  // "authenticated" role has no insert privilege at all on agently_agents
  // (see supabase/schema.sql), specifically so nobody can PATCH/POST a row
  // directly with status='approved' and a fabricated trust_score, bypassing
  // reviewAgentSubmission() above.
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.redirect(
      new URL(`/dashboard/upload?error=${encodeURIComponent("Not connected yet — Supabase isn't configured.")}`, request.url),
      303
    );
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
      dedupe_bucket: dedupeBucket,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    // 23505 here is agently_agents_dedupe_idx — an overlapping request with
    // this same creator/name/tagline/description already landed in this
    // 15s window (the race the SELECT above can miss). That's this same
    // submit having already gone through, not a failure.
    if (error?.code === "23505") {
      return NextResponse.redirect(new URL("/dashboard/upload?submitted=1", request.url));
    }
    return NextResponse.redirect(
      new URL(
        `/dashboard/upload?error=${encodeURIComponent(error?.message ?? "Could not save the listing.")}`,
        request.url
      ),
      303
    );
  }

  if (status === "pending_review") {
    await notifyOwnerOfPendingReview({ agentName: name, isEdit: false, verdict });
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
