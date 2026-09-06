"use client";

import { useId, useState } from "react";

export type TimeSeriesPoint = { date: string; value: number; secondaryLabel?: string };

const CHART_WIDTH = 700;
const CHART_HEIGHT = 160;
const TOP_PADDING = 12;

function formatDateLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

/** A single time-series visualization used for both the revenue (area) and
 *  sales-count (bars) widgets on the analytics dashboard — same scaling,
 *  hover, and tooltip logic either way so the two charts read as one
 *  consistent system instead of two different libraries glued together. */
export function TimeSeriesChart({
  data,
  variant,
  color = "#2fe0ad",
  formatValue,
  ariaLabel,
}: {
  data: TimeSeriesPoint[];
  variant: "area" | "bars";
  color?: string;
  formatValue: (n: number) => string;
  ariaLabel: string;
}) {
  const gradientId = useId();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const max = Math.max(1, ...data.map((d) => d.value));
  const n = data.length;
  const usableHeight = CHART_HEIGHT - TOP_PADDING;

  const xFor = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * CHART_WIDTH);
  const yFor = (value: number) => TOP_PADDING + usableHeight - (value / max) * usableHeight;

  const linePath = data.map((d, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(d.value)}`).join(" ");
  const areaPath = `${linePath} L ${xFor(n - 1)} ${CHART_HEIGHT} L ${xFor(0)} ${CHART_HEIGHT} Z`;

  const barSlotWidth = CHART_WIDTH / Math.max(1, n);
  const barWidth = Math.max(2, barSlotWidth * 0.55);

  const active = hoverIndex !== null ? data[hoverIndex] : null;
  const activeX = hoverIndex !== null ? (variant === "bars" ? hoverIndex * barSlotWidth + barSlotWidth / 2 : xFor(hoverIndex)) : 0;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="h-40 w-full overflow-visible"
        role="img"
        aria-label={ariaLabel}
        preserveAspectRatio="none"
      >
        {variant === "area" && (
          <>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.35" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={areaPath} fill={`url(#${gradientId})`} />
            <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          </>
        )}

        {variant === "bars" &&
          data.map((d, i) => {
            const barHeight = (d.value / max) * usableHeight;
            return (
              <rect
                key={d.date}
                x={i * barSlotWidth + (barSlotWidth - barWidth) / 2}
                y={CHART_HEIGHT - barHeight}
                width={barWidth}
                height={Math.max(barHeight, d.value > 0 ? 2 : 0)}
                rx={Math.min(3, barWidth / 2)}
                fill={color}
                opacity={hoverIndex === null || hoverIndex === i ? 0.85 : 0.35}
              />
            );
          })}

        {hoverIndex !== null && (
          <line x1={activeX} x2={activeX} y1={TOP_PADDING} y2={CHART_HEIGHT} stroke={color} strokeOpacity="0.25" strokeWidth="1" />
        )}

        {/* Invisible hover targets — one per day, spanning the full chart height, so a
            hover anywhere in that day's column shows its tooltip. */}
        {data.map((d, i) => (
          <rect
            key={d.date}
            x={i * barSlotWidth}
            y={0}
            width={barSlotWidth}
            height={CHART_HEIGHT}
            fill="transparent"
            onMouseEnter={() => setHoverIndex(i)}
            onMouseLeave={() => setHoverIndex((cur) => (cur === i ? null : cur))}
          >
            <title>
              {formatDateLabel(d.date)}: {formatValue(d.value)}
            </title>
          </rect>
        ))}
      </svg>

      {active && (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 -translate-y-full rounded-lg border border-line bg-surface-raised px-2.5 py-1.5 text-xs shadow-[0_8px_24px_-8px_rgba(0,0,0,0.5)]"
          style={{ left: `${(activeX / CHART_WIDTH) * 100}%` }}
        >
          <div className="font-mono tabular-nums text-ink">{formatValue(active.value)}</div>
          <div className="text-[10px] text-ink-faint">{formatDateLabel(active.date)}</div>
        </div>
      )}
    </div>
  );
}
