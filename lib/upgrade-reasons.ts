// Vocabulary for "why did you upgrade" — deliberately distinct from the
// cancellation REASON_LABELS in lib/membership-events.ts (too_expensive,
// missing_features, ...) because those describe *leaving*; these describe
// *choosing more*. Kept small on purpose — 5 chips plus "other", matching
// the UI (app/components/upgrade-reason-prompt.tsx).
export const UPGRADE_REASON_LABELS: Record<string, string> = {
  more_listings: "Needed higher upload limits",
  priority_support: "Wanted priority support",
  team_growing: "My team is growing",
  recommended: "Recommended by someone",
  other: "Other",
};

export const UPGRADE_REASON_CODES = Object.keys(UPGRADE_REASON_LABELS);

export function isValidUpgradeReasonCode(code: unknown): code is string {
  return typeof code === "string" && UPGRADE_REASON_CODES.includes(code);
}

export function upgradeReasonLabel(code: string | null | undefined) {
  if (!code) return null;
  return UPGRADE_REASON_LABELS[code] ?? code;
}

// How long after a tier switch an upgrade-reason answer is still allowed to
// attach to it. The prompt fires right after the redirect from
// /api/membership/checkout or /api/membership/switch, but the row it needs
// to update is written asynchronously — by the webhook for a fresh Checkout
// purchase, or synchronously by /switch itself but the user could still sit
// on the page a while before answering. An hour comfortably covers both
// without risking a late answer landing on some unrelated older tier change
// for the same user.
export const UPGRADE_REASON_WINDOW_MS = 60 * 60 * 1000;

/** Pure so it's testable without a database: given the row's created_at and
 *  "now", is it still fresh enough for an upgrade-reason answer to attach to? */
export function isWithinUpgradeReasonWindow(
  createdAtIso: string,
  now: Date = new Date(),
  windowMs: number = UPGRADE_REASON_WINDOW_MS
): boolean {
  const createdAt = new Date(createdAtIso).getTime();
  if (Number.isNaN(createdAt)) return false;
  return now.getTime() - createdAt <= windowMs && now.getTime() - createdAt >= 0;
}
