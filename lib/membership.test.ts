import { describe, expect, it } from "vitest";
import { canUpload, MIN_AGENT_PRICE_CENTS, MIN_PLATFORM_FEE_CENTS, PLATFORM_FEE_PERCENT } from "./membership";

describe("canUpload", () => {
  it("blocks the free tier", () => {
    expect(canUpload("free")).toBe(false);
  });

  it("allows every paid tier", () => {
    expect(canUpload("basic")).toBe(true);
    expect(canUpload("pro")).toBe(true);
    expect(canUpload("professional")).toBe(true);
  });
});

describe("platform fee floor", () => {
  it("the fixed floor actually raises the fee at the minimum agent price — the bug this was written to fix", () => {
    // At MIN_AGENT_PRICE_CENTS, the plain percentage fee alone is exactly
    // what a live €1 test purchase showed loses money once Stripe's own
    // processing fee is subtracted. app/api/checkout/route.ts applies
    // Math.max(percentageFee, MIN_PLATFORM_FEE_CENTS) — this asserts the
    // floor is the one actually winning at the price floor, not silently
    // redundant.
    const percentageFeeAtPriceFloor = Math.round((MIN_AGENT_PRICE_CENTS * PLATFORM_FEE_PERCENT) / 100);
    expect(percentageFeeAtPriceFloor).toBeLessThan(MIN_PLATFORM_FEE_CENTS);
  });

  it("keeps the price floor comfortably above zero", () => {
    expect(MIN_AGENT_PRICE_CENTS).toBeGreaterThan(0);
  });
});
