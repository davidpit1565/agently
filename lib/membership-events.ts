import type { SupabaseClient } from "@supabase/supabase-js";
import { sendNotificationEmail } from "@/lib/email";
import { errorMessage } from "@/lib/errors";
import { SITE_URL } from "@/lib/site";

type CancellationDetails = { reason: string | null; comment: string | null } | null | undefined;

const REASON_LABELS: Record<string, string> = {
  too_expensive: "Too expensive",
  missing_features: "Missing features",
  switched_service: "Switched to a different service",
  unused: "Wasn't using it",
  customer_service: "Customer service",
  low_quality: "Low quality",
  other: "Other",
};

function reasonLabel(code: string | null | undefined) {
  if (!code) return null;
  return REASON_LABELS[code] ?? code;
}

/** Records a membership cancel-initiation or tier change, and — for a
 *  cancellation — emails both the canceling user (a plain confirmation) and
 *  the platform owner (the reason, if Stripe's cancellation survey is
 *  turned on and the customer gave one). Called once per Stripe event from
 *  the subscription.updated/.deleted handler in app/api/stripe/webhook —
 *  the unique stripe_event_id constraint on agently_membership_events is
 *  what makes a webhook retry of the same delivery a no-op insert instead
 *  of a duplicate row and a duplicate pair of emails.
 *
 *  Never throws: the membership_status/tier update in the caller has
 *  already been written by the time this runs, same reasoning as every
 *  other webhook-triggered write in this codebase — a failure here (a
 *  missing migration, a dead email provider) must never turn an
 *  already-succeeded subscription update into a 500 that Stripe retries. */
export async function recordMembershipEvent(
  admin: SupabaseClient,
  params: {
    eventId: string;
    eventType: "cancel_scheduled" | "tier_changed";
    userId: string;
    subscriptionId: string;
    fromTier?: string | null;
    toTier?: string | null;
    cancellationDetails?: CancellationDetails;
    periodEnd?: number | null;
  }
) {
  const { eventId, eventType, userId, subscriptionId, fromTier, toTier, cancellationDetails, periodEnd } = params;

  try {
    const { error } = await admin.from("agently_membership_events").insert({
      stripe_event_id: eventId,
      user_id: userId,
      stripe_subscription_id: subscriptionId,
      event_type: eventType,
      from_tier: fromTier ?? null,
      to_tier: toTier ?? null,
      reason_code: cancellationDetails?.reason ?? null,
      reason_comment: cancellationDetails?.comment ?? null,
      period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    });

    if (error) {
      // Postgres unique_violation on stripe_event_id — this exact webhook
      // delivery already recorded this event (a Stripe retry). The emails
      // below already went out the first time; nothing left to do.
      if (error.code === "23505") return;
      throw error;
    }

    if (eventType !== "cancel_scheduled") return;

    const { data } = await admin.auth.admin.getUserById(userId);
    const email = data.user?.email;
    const reason = reasonLabel(cancellationDetails?.reason);
    const endDate = periodEnd
      ? new Date(periodEnd * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
      : "the end of your billing period";

    await sendNotificationEmail(
      email,
      "Your Agently membership is canceled",
      `We've canceled your membership as requested. You'll keep access until ${endDate}, and you won't be charged again after that.\n\nChanged your mind? You can restart your membership any time: ${SITE_URL}/pricing`
    );

    const owner = process.env.PLATFORM_OWNER_EMAIL;
    if (owner) {
      const lines = [
        `${email ?? userId} canceled their ${fromTier ?? "membership"} membership (access ends ${endDate}).`,
        reason
          ? `Reason given: ${reason}`
          : "No reason given — Stripe's cancellation survey may still be off (Stripe Dashboard → Settings → Billing → Customer Portal → \"Collect a reason for cancellation\").",
        ...(cancellationDetails?.comment ? ["", `Their comment: "${cancellationDetails.comment}"`] : []),
        "",
        `See all cancellations and upgrades: ${SITE_URL}/dashboard/admin/membership-events`,
      ];
      await sendNotificationEmail(owner, "A membership was canceled", lines.join("\n"));
    }
  } catch (err) {
    console.error("[membership-events] recordMembershipEvent failed", {
      eventId,
      eventType,
      userId,
      message: errorMessage(err),
    });
  }
}
