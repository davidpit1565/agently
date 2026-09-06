"use client";

import { MIN_TEAM_SEATS, MAX_TEAM_SEATS, teamPriceCents, teamDiscountPercent } from "@/lib/team-pricing";
import { formatEuros } from "@/lib/format";

// The seat <select> used to have no visible price at all — a buyer could set
// seats to 10 and the only total they'd ever see is whatever Stripe charges
// after checkout. This keeps the same "seats" field name/values (so the
// server-side handling in app/api/checkout is untouched) but adds a live
// total that updates as the selection changes, using the same
// teamPriceCents math the checkout route itself uses.
//
// Controlled from the parent (app/components/purchase-button.tsx) rather
// than owning its own state — the Buy button above this picker needs the
// same seats value to update its own price label, and two independent
// useState calls for the same field would drift the moment one updates
// without the other.
export function TeamSeatsPicker({
  basePriceCents,
  seats,
  onSeatsChange,
}: {
  basePriceCents: number;
  seats: number;
  onSeatsChange: (seats: number) => void;
}) {
  const discount = teamDiscountPercent(seats);
  const total = teamPriceCents(basePriceCents, seats);

  return (
    <>
      <label className="flex flex-col gap-1 text-xs text-ink-soft">
        Seats
        <select
          name="seats"
          value={seats}
          onChange={(e) => onSeatsChange(Number(e.target.value))}
          className="w-32 rounded-lg border border-line bg-surface-raised px-2 py-1.5 text-sm text-ink"
        >
          <option value="1">Just me</option>
          {Array.from(
            { length: MAX_TEAM_SEATS - MIN_TEAM_SEATS + 1 },
            (_, i) => MIN_TEAM_SEATS + i
          ).map((n) => (
            <option key={n} value={n}>
              {n} seats
            </option>
          ))}
        </select>
      </label>

      {seats >= MIN_TEAM_SEATS && (
        <p className="font-mono text-sm font-medium tabular-nums text-accent">
          €{formatEuros(total)} total
          {discount > 0 && <span className="ml-1 text-xs font-normal text-ink-faint">({discount}% off per seat)</span>}
        </p>
      )}
    </>
  );
}
