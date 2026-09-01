"use client";

import { useEffect, useState } from "react";

/** Counts up from 0 to `value` on mount — the same "just measured, not static" feel
 *  TrustRing already gives its ring, applied to the number itself instead of the stroke.
 *  Mount-triggered like TrustRing (not IntersectionObserver) because every call site here
 *  already sits inside a Reveal-wrapped card or an above-the-fold hero element, so mount
 *  time is the right moment to start. */
export function CounterUp({
  value,
  duration = 900,
  className,
  format,
}: {
  value: number;
  duration?: number;
  className?: string;
  format?: (n: number) => string;
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setDisplay(value);
      return;
    }

    let raf: number;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(eased * value));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  return (
    <span className={className} aria-hidden={false}>
      {format ? format(display) : display}
    </span>
  );
}
