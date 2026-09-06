import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorMessage } from "@/lib/errors";
import { isValidUpgradeReasonCode, UPGRADE_REASON_WINDOW_MS } from "@/lib/upgrade-reasons";

// Answers "why did you upgrade?" — asked once, right after a successful
// upgrade, by app/components/upgrade-reason-prompt.tsx on /dashboard/agents
// (?membership=1, a fresh Checkout purchase) and /pricing (?switched=1, an
// in-place tier switch). There's no new table for this: it updates the
// SAME agently_membership_events row the Stripe webhook already wrote for
// this tier change (event_type = 'tier_changed', reason_code still null),
// the same accumulation pattern the cancellation survey already feeds.
//
// Never blocks the page it's called from — same reasoning as
// lib/membership-events.ts's recordMembershipEvent: this is pure signal,
// answered from a dismissable prompt, so a Supabase hiccup here must never
// surface as an error the client has to handle specially. Every failure
// path below returns 200 with { recorded: false } rather than a non-2xx
// status; only a missing session is worth a real 401, since the client
// has no useful action for anything else.
export async function POST(request: Request) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ recorded: false }, { status: 200 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ recorded: false }, { status: 200 });
  }

  const reasonCode = (body as { reasonCode?: unknown } | null)?.reasonCode;
  const comment = (body as { comment?: unknown } | null)?.comment;

  if (!isValidUpgradeReasonCode(reasonCode)) {
    return NextResponse.json({ recorded: false }, { status: 200 });
  }
  const reasonComment = typeof comment === "string" && comment.trim() ? comment.trim().slice(0, 500) : null;

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ recorded: false }, { status: 200 });
  }

  try {
    // user_id = auth.uid() is what keeps this from ever touching anyone
    // else's row; the recency bound (created_at within the window) is what
    // keeps a delayed answer from attaching itself to some unrelated older
    // tier change once the recent one no longer matches (reason_code no
    // longer null, or there simply isn't one from this session).
    const cutoff = new Date(Date.now() - UPGRADE_REASON_WINDOW_MS).toISOString();
    const { data: candidates, error: selectError } = await admin
      .from("agently_membership_events")
      .select("id")
      .eq("user_id", user.id)
      .eq("event_type", "tier_changed")
      .is("reason_code", null)
      .gt("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(1);

    if (selectError || !candidates || candidates.length === 0) {
      return NextResponse.json({ recorded: false }, { status: 200 });
    }

    const { error: updateError } = await admin
      .from("agently_membership_events")
      .update({ reason_code: reasonCode, reason_comment: reasonComment })
      .eq("id", candidates[0].id);

    if (updateError) {
      console.error("[membership/upgrade-reason] update failed", {
        userId: user.id,
        message: errorMessage(updateError),
      });
      return NextResponse.json({ recorded: false }, { status: 200 });
    }

    return NextResponse.json({ recorded: true }, { status: 200 });
  } catch (err) {
    console.error("[membership/upgrade-reason] unexpected failure", {
      userId: user.id,
      message: errorMessage(err),
    });
    return NextResponse.json({ recorded: false }, { status: 200 });
  }
}
