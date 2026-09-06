/** Formats a cents amount as euros for display, keeping cents only when
 *  they're non-zero. `.toFixed(0)` alone rounds 250 ("€2.50") to "€3" and
 *  999 ("€9.99") to "€10" — the displayed price doesn't match what Stripe
 *  actually charges. `.toFixed(2)` always would fix that but prints
 *  "€9.00" for round prices, noisier than the whole-euro labels used
 *  throughout the catalog.
 *
 *  Grouped with `toLocaleString` rather than plain `toFixed` so a creator
 *  whose lifetime total clears four figures reads "12,450" instead of the
 *  much harder to scan "12450" — analytics is the first page in this app
 *  where totals routinely get that large. A genuinely negative amount
 *  (the fee edge case aside, still possible after a partial refund) keeps
 *  its own "-" rather than being silently made to look positive. */
export function formatEuros(cents: number): string {
  const euros = cents / 100;
  const digits = Number.isInteger(euros) ? 0 : 2;
  return euros.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
