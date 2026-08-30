"use client";

import { useEffect, useState } from "react";

const SIZE = 34;
const STROKE = 3;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function TrustRing({ score }: { score: number }) {
  const targetOffset = CIRCUMFERENCE * (1 - score / 100);
  // Starts fully empty (offset = full circumference) and animates in to the real
  // score on mount — a card that just appeared reads as "measuring," not static.
  const [offset, setOffset] = useState(CIRCUMFERENCE);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setOffset(targetOffset);
      return;
    }
    // One frame delay so the browser paints the empty ring first — without it,
    // React batches both states into the same paint and there's nothing to transition from.
    const frame = requestAnimationFrame(() => setOffset(targetOffset));
    return () => cancelAnimationFrame(frame);
  }, [targetOffset]);

  return (
    <div className="relative flex shrink-0 items-center justify-center" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} className="-rotate-90">
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE}
          className="text-line"
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-accent transition-[stroke-dashoffset] duration-1000 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)]"
        />
      </svg>
      <span className="absolute font-mono text-[10px] font-medium tabular-nums text-ink-soft">{score}</span>
    </div>
  );
}
