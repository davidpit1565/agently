"use client";

import { SubmitButton } from "@/app/components/submit-button";

export function RefundButton({ purchaseId }: { purchaseId: string }) {
  return (
    <form
      action={`/api/refunds/${purchaseId}`}
      method="POST"
      onSubmit={(e) => {
        if (!confirm("Request a refund? This revokes your access to the delivery link and files once Stripe confirms it.")) {
          e.preventDefault();
        }
      }}
    >
      <SubmitButton
        pendingText="Requesting…"
        className="rounded-full border border-line px-4 py-2 text-xs text-ink-soft hover:border-red-400/50 hover:text-red-400"
      >
        Request a refund
      </SubmitButton>
    </form>
  );
}
