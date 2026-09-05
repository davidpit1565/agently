"use client";

import { SubmitButton } from "@/app/components/submit-button";

export function CancelSubscriptionButton({ purchaseId }: { purchaseId: string }) {
  return (
    <form
      action={`/api/purchases/${purchaseId}/cancel`}
      method="POST"
      onSubmit={(e) => {
        if (!confirm("Cancel this subscription? You keep access through the end of what you've already paid for, then billing stops for good.")) {
          e.preventDefault();
        }
      }}
    >
      <SubmitButton
        pendingText="Canceling…"
        className="rounded-full border border-line px-4 py-2 text-xs text-ink-soft hover:border-red-400/50 hover:text-red-400"
      >
        Cancel subscription
      </SubmitButton>
    </form>
  );
}
