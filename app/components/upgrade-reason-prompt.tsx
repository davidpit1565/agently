"use client";

import { useEffect, useState } from "react";
import { UPGRADE_REASON_LABELS } from "@/lib/upgrade-reasons";

const CHIP_ORDER = Object.keys(UPGRADE_REASON_LABELS).filter((code) => code !== "other");

/** Small, dismissable, optional — never a blocker. Shown once per upgrade
 *  (`storageKey` is unique to the source page + a day-scoped stamp, good
 *  enough to stop it reappearing on a back-button revisit to the same
 *  ?membership=1 / ?switched=1 URL after it's already been answered or
 *  skipped, without needing a real per-event id client-side). Whatever the
 *  member picks is sent to /api/membership/upgrade-reason, which attaches it
 *  to the tier_changed row the Stripe webhook already wrote — a Skip sends
 *  nothing, there's nothing to record. */
export function UpgradeReasonPrompt({ storageKey }: { storageKey: string }) {
  const [visible, setVisible] = useState(false);
  const [sent, setSent] = useState(false);
  const [showOther, setShowOther] = useState(false);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(storageKey)) return;
    } catch {
      // Private mode / storage blocked — fall through and show it anyway;
      // worst case it can reappear on a revisit, never worse than that.
    }
    setVisible(true);
  }, [storageKey]);

  function dismiss() {
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      // Nothing to persist against — the prompt just may show again later.
    }
    setVisible(false);
  }

  async function submit(reasonCode: string, reasonComment?: string) {
    setSubmitting(true);
    try {
      await fetch("/api/membership/upgrade-reason", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reasonCode, comment: reasonComment }),
      });
    } catch {
      // Pure signal — a failed request here isn't worth telling the member
      // about, the upgrade itself already succeeded regardless.
    }
    setSubmitting(false);
    setSent(true);
    dismiss();
  }

  if (!visible) return null;

  return (
    <div className="bezel-shell mb-6 animate-reveal-up">
      <div className="bezel-core flex flex-col gap-3 p-4">
        {sent ? (
          <p className="text-sm text-ink-soft">Thanks — that helps.</p>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-ink">What made you upgrade?</p>
              <button
                type="button"
                onClick={dismiss}
                className="shrink-0 text-xs text-ink-faint transition-colors duration-150 hover:text-ink-soft"
              >
                Skip
              </button>
            </div>

            {!showOther ? (
              <div className="flex flex-wrap gap-2">
                {CHIP_ORDER.map((code) => (
                  <button
                    key={code}
                    type="button"
                    disabled={submitting}
                    onClick={() => submit(code)}
                    className="magnetic-btn rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink-soft transition-all duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] hover:border-accent/50 hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {UPGRADE_REASON_LABELS[code]}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setShowOther(true)}
                  className="magnetic-btn rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink-soft transition-all duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] hover:border-accent/50 hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {UPGRADE_REASON_LABELS.other}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  autoFocus
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Say a bit more (optional)"
                  className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition-all duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] focus:border-accent focus:shadow-[0_0_0_3px_rgba(47,224,173,0.12)]"
                />
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => submit("other", comment)}
                  className="magnetic-btn shrink-0 rounded-full bg-accent px-4 py-2 text-xs font-medium text-[#04140f] transition-all duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-0.5 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Send
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
