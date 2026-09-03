import type { MembershipTier } from "./types";

/**
 * Placeholder numbers — the report (ch. 12) deliberately left tier pricing
 * open until there's real usage data. Change these once that data exists;
 * nothing else in the codebase needs to change when you do.
 */
export const MEMBERSHIP_TIERS: Record<
  Exclude<MembershipTier, "free">,
  { name: string; monthlyPriceCents: number; yearlyPriceCents: number; maxActiveListings: number }
> = {
  basic: { name: "Basic", monthlyPriceCents: 900, yearlyPriceCents: 9000, maxActiveListings: 3 },
  pro: { name: "Pro", monthlyPriceCents: 2900, yearlyPriceCents: 29000, maxActiveListings: 15 },
  professional: { name: "Professional", monthlyPriceCents: 9900, yearlyPriceCents: 99000, maxActiveListings: 100 },
};

export const PLATFORM_FEE_PERCENT = 15; // report ch. 6: start low (10-15%), raise once there's liquidity

// Stripe's own processing fee is a near-flat ~€0.25-0.30 per charge — on a
// sale below this, that fee alone can exceed the platform's 15% cut,
// meaning the platform pays out of pocket to process the sale. Found by
// actually running a live €1 test purchase and reading the resulting
// Stripe balance transactions: platform ended up at -€0.13 net on it.
export const MIN_AGENT_PRICE_CENTS = 200;

export function canUpload(tier: MembershipTier): boolean {
  return tier !== "free";
}
