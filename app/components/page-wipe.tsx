"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** A signature transition on internal navigation — a thin accent-colored line sweeps
 *  the top of the viewport in 350ms, the same device already proven on the videos-ai
 *  studio site (its "brass wipe"). Every page here already fades content in on load
 *  (see the `animate-fade-up` classes throughout); this gives the moment between pages
 *  the same intentional feel instead of the current instant, jarring swap.
 *
 *  Skipped under prefers-reduced-motion and on first paint (no prior pathname to have
 *  moved from) — same rules every other motion effect in this codebase follows. */
export function PageWipe() {
  const path = usePathname();
  const prev = useRef(path);
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (prev.current === path) return;
    prev.current = path;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setKey((k) => k + 1);
  }, [path]);

  if (!key) return null;
  return <div key={key} className="page-wipe" aria-hidden />;
}
