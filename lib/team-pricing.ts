// Team licensing for a one-time-purchase agent: 3-10 seats (the buyer plus
// 2-9 invited teammates), with the per-seat price dropping in tiers as the
// seat count goes up — the buyer's own request was "the more seats, the
// cheaper it gets," not a flat multiply-by-seats price.
export const MIN_TEAM_SEATS = 3;
export const MAX_TEAM_SEATS = 10;

const DISCOUNT_TIERS: { minSeats: number; maxSeats: number; percentOff: number }[] = [
  { minSeats: 3, maxSeats: 4, percentOff: 15 },
  { minSeats: 5, maxSeats: 7, percentOff: 25 },
  { minSeats: 8, maxSeats: 10, percentOff: 35 },
];

export function teamDiscountPercent(seats: number): number {
  const tier = DISCOUNT_TIERS.find((t) => seats >= t.minSeats && seats <= t.maxSeats);
  return tier?.percentOff ?? 0;
}

/** Total price for the whole team purchase, in cents. Per-seat price times
 *  seats, minus the tier discount — rounded once on the total rather than
 *  per seat, so the number a buyer actually sees and pays matches what
 *  displaying it as "total" implies (rounding each seat separately and
 *  summing can land a cent or two off from rounding the total directly). */
export function teamPriceCents(basePriceCents: number, seats: number): number {
  const discount = teamDiscountPercent(seats);
  return Math.round(basePriceCents * seats * (1 - discount / 100));
}
