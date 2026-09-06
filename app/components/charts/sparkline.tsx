const WIDTH = 64;
const HEIGHT = 22;

/** A per-agent trend at a glance — deliberately not interactive (no hover, no tooltip):
 *  it's a glance-cue for the table row, and the row's own TimeSeriesChart-scale detail
 *  lives one click away on the agent page. Built entirely from the sparkline array
 *  getCreatorAnalytics already derives from the same rows as everything else on this
 *  page, so it costs nothing extra to compute or fetch. */
export function Sparkline({ values, color = "#2fe0ad" }: { values: number[]; color?: string }) {
  const n = values.length;
  if (n === 0) return null;

  const max = Math.max(1, ...values);
  const min = Math.min(0, ...values);
  const range = Math.max(1, max - min);

  const xFor = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * WIDTH);
  const yFor = (v: number) => HEIGHT - ((v - min) / range) * HEIGHT;

  const flat = values.every((v) => v === values[0]);
  const path = values.map((v, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(v)}`).join(" ");
  const totalUp = values[n - 1] >= values[0];

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width={WIDTH}
      height={HEIGHT}
      className="shrink-0 overflow-visible"
      role="img"
      aria-label={flat ? "No change over the last 14 days" : totalUp ? "Trending up over the last 14 days" : "Trending down over the last 14 days"}
    >
      <path
        d={path}
        fill="none"
        stroke={flat ? "currentColor" : color}
        strokeOpacity={flat ? 0.3 : 0.9}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={flat ? "text-ink-faint" : undefined}
      />
      <circle cx={xFor(n - 1)} cy={yFor(values[n - 1])} r={1.6} fill={flat ? "currentColor" : color} className={flat ? "text-ink-faint" : undefined} />
    </svg>
  );
}
