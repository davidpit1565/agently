import { describe, expect, it } from "vitest";
import { MAX_TEAM_SEATS, MIN_TEAM_SEATS, teamDiscountPercent, teamPriceCents } from "./team-pricing";

describe("teamDiscountPercent", () => {
  it("gives no discount below the minimum seat count", () => {
    expect(teamDiscountPercent(1)).toBe(0);
    expect(teamDiscountPercent(2)).toBe(0);
  });

  it("gives no discount above the maximum seat count", () => {
    expect(teamDiscountPercent(11)).toBe(0);
    expect(teamDiscountPercent(100)).toBe(0);
  });

  it("matches each documented tier boundary exactly", () => {
    expect(teamDiscountPercent(3)).toBe(15);
    expect(teamDiscountPercent(4)).toBe(15);
    expect(teamDiscountPercent(5)).toBe(25);
    expect(teamDiscountPercent(7)).toBe(25);
    expect(teamDiscountPercent(8)).toBe(35);
    expect(teamDiscountPercent(10)).toBe(35);
  });
});

describe("teamPriceCents", () => {
  it("charges exactly seats * base price with no discount below MIN_TEAM_SEATS", () => {
    expect(teamPriceCents(1000, 1)).toBe(1000);
    expect(teamPriceCents(1000, 2)).toBe(2000);
  });

  it("rounds the discounted total once, matching the documented formula", () => {
    const basePriceCents = 1001;
    const seats = 3;
    const discount = teamDiscountPercent(seats);
    const expected = Math.round(basePriceCents * seats * (1 - discount / 100));
    expect(teamPriceCents(basePriceCents, seats)).toBe(expected);
  });

  it("applies the correct discount at each real tier", () => {
    expect(teamPriceCents(1000, 3)).toBe(Math.round(1000 * 3 * 0.85));
    expect(teamPriceCents(1000, 5)).toBe(Math.round(1000 * 5 * 0.75));
    expect(teamPriceCents(1000, 8)).toBe(Math.round(1000 * 8 * 0.65));
  });

  it("never produces a negative price for any valid seat count", () => {
    for (let seats = MIN_TEAM_SEATS; seats <= MAX_TEAM_SEATS; seats++) {
      expect(teamPriceCents(200, seats)).toBeGreaterThan(0);
    }
  });
});
