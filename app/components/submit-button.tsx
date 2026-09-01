"use client";

import { useState } from "react";

// Plain <form action="..." method="POST"> forms give zero feedback while the
// request is in flight — the button stays clickable and looks unchanged
// until the page navigates, which reads as "did that work?" and invites a
// double submit. Disabling on click and swapping the label covers it without
// needing full form state, since these all redirect on success.
export function SubmitButton({
  children,
  pendingText,
  className,
  disabled,
}: {
  children: React.ReactNode;
  pendingText: string;
  className?: string;
  disabled?: boolean;
}) {
  const [pending, setPending] = useState(false);
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      onClick={() => setPending(true)}
      className={`${className ?? ""} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {pending ? pendingText : children}
    </button>
  );
}
