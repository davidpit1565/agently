"use client";

import { useState } from "react";

// Plain <form action="..." method="POST"> forms give zero feedback while the
// request is in flight — the button stays clickable and looks unchanged
// until the page navigates, which reads as "did that work?" and invites a
// double submit. Disabling on click and swapping the label covers it without
// needing full form state, since these all redirect on success.
//
// The disable has to happen a tick after the click, not inside its handler:
// setting `disabled` synchronously in `onClick` raced the browser's own
// default action for that same click in Chrome, and disabled sometimes won
// — the button visibly flipped to its pending label but the form's POST
// never actually left the browser (confirmed by zero server-side hits for
// clicks that showed "Redirecting…" indefinitely). Deferring the state
// update with setTimeout(0) lets the native form submission fire first.
export function SubmitButton({
  children,
  pendingText,
  className,
  disabled,
  title,
}: {
  children: React.ReactNode;
  pendingText: string;
  className?: string;
  disabled?: boolean;
  title?: string;
}) {
  const [pending, setPending] = useState(false);
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      onClick={() => setTimeout(() => setPending(true), 0)}
      title={title}
      className={`${className ?? ""} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {pending ? pendingText : children}
    </button>
  );
}
