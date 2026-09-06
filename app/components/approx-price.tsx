"use client";

import { useEffect, useState } from "react";
import { approxConvert, currencyForLocale } from "@/lib/currency";

/** Renders a small, secondary "(~$31 USD)" approximation next to a real EUR
 *  price, guessed from the visitor's browser locale — never IP
 *  geolocation. Display-only: Stripe still charges the real EUR amount
 *  in `cents` exactly as shown elsewhere on the page; this component adds
 *  an adjacent approximation, it never replaces the EUR price.
 *
 *  Renders nothing until mounted client-side (same guard style as
 *  `Header`'s scroll-state: `useState` + a `useEffect` that only runs in
 *  the browser) so the server-rendered markup and the first client render
 *  match — `navigator`/`Intl` locale isn't available on the server, and
 *  guessing at the wrong value would just flash and correct itself. */
export function ApproxPrice({ cents }: { cents: number }) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    const locale =
      typeof navigator !== "undefined"
        ? navigator.language || Intl.NumberFormat().resolvedOptions().locale
        : null;
    const currency = currencyForLocale(locale);
    if (!currency) {
      setLabel(null);
      return;
    }
    const amount = approxConvert(cents, currency);
    if (amount == null) {
      setLabel(null);
      return;
    }
    try {
      const formatted = new Intl.NumberFormat(locale ?? undefined, {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(amount);
      setLabel(`~${formatted}`);
    } catch {
      // An unrecognized locale/currency pair from Intl — skip the
      // approximation rather than show something malformed.
      setLabel(null);
    }
  }, [cents]);

  if (!label) return null;

  return <span className="text-ink-faint">({label})</span>;
}
