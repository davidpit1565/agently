/**
 * Approximate, hand-maintained EUR→X rates for DISPLAY ONLY.
 *
 * ASSUMPTION: these are rough, periodically-stale approximations set by
 * hand (roughly current as of when this file was written), not a live
 * feed — same convention as the placeholder tier prices in
 * `lib/membership.ts`. Nothing here is charged: Stripe still charges the
 * real EUR amount exactly as `agently_agents.price_cents` says, in every
 * checkout flow. This table only lets a visitor outside the eurozone see
 * roughly what a price costs them before they click buy, where they'll
 * see the real EUR charge from Stripe itself.
 *
 * Update by hand occasionally (e.g. checking a currency converter) — do
 * NOT wire this to a live FX API. A live call on every page render is
 * unnecessary cost, latency and failure-surface for what is a cosmetic
 * "roughly this much" label, not a payment amount.
 */
export const APPROX_EUR_RATES: Record<string, number> = {
  USD: 1.08,
  GBP: 0.86,
  ILS: 4.0,
  CAD: 1.48,
  AUD: 1.63,
};

/**
 * Maps a BCP-47 locale string (as returned by `navigator.language` or
 * `Intl.NumberFormat().resolvedOptions().locale`) to one of the currency
 * codes above, or `null` when the locale is EUR-using or unmapped —
 * meaning "just show the real EUR price, don't add an approximation."
 *
 * Deliberately a locale→currency guess, not IP geolocation: simpler, no
 * extra infra, and no privacy/GDPR data-collection question to deal with.
 * It's a proxy, not a certainty — a VPN'd or manually-set browser locale
 * can point the wrong way, which is exactly why the result is always
 * labeled "approximate" next to the real EUR price, never used in place
 * of it.
 */
export function currencyForLocale(locale: string | undefined | null): string | null {
  if (!locale) return null;
  const lower = locale.toLowerCase();

  if (lower === "he" || lower.startsWith("he-il") || lower === "he_il") {
    return "ILS";
  }
  if (lower.startsWith("en-ca") || lower.startsWith("fr-ca")) {
    return "CAD";
  }
  if (lower.startsWith("en-au")) {
    return "AUD";
  }
  if (lower.startsWith("en-gb") || lower.startsWith("en-ie")) {
    return "GBP";
  }
  if (lower.startsWith("en-us")) {
    return "USD";
  }

  // nl-BE, fr-BE, he outside IL, and anything else unmapped: EUR is
  // already the real currency (Belgium) or we have no confident mapping —
  // no approximation to add.
  return null;
}

/** Converts a EUR cents amount to the given currency's smallest unit
 *  equivalent (as a plain number of major units, e.g. dollars not cents)
 *  using the approximate table above. Returns `null` for a currency not
 *  in the table. */
export function approxConvert(cents: number, currencyCode: string): number | null {
  const rate = APPROX_EUR_RATES[currencyCode];
  if (rate == null) return null;
  return (cents / 100) * rate;
}
