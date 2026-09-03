/** Formats a cents amount as euros for display, keeping cents only when
 *  they're non-zero. `.toFixed(0)` alone rounds 250 ("€2.50") to "€3" and
 *  999 ("€9.99") to "€10" — the displayed price doesn't match what Stripe
 *  actually charges. `.toFixed(2)` always would fix that but prints
 *  "€9.00" for round prices, noisier than the whole-euro labels used
 *  throughout the catalog. */
export function formatEuros(cents: number): string {
  const euros = cents / 100;
  return Number.isInteger(euros) ? euros.toFixed(0) : euros.toFixed(2);
}
