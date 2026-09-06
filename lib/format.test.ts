import { describe, expect, it } from "vitest";
import { formatEuros } from "./format";

describe("formatEuros", () => {
  it("drops cents for a whole-euro amount", () => {
    expect(formatEuros(1000)).toBe("10");
    expect(formatEuros(0)).toBe("0");
  });

  it("keeps cents for a non-whole amount, without rounding away the price a buyer is actually charged", () => {
    expect(formatEuros(250)).toBe("2.50");
    expect(formatEuros(999)).toBe("9.99");
  });
});
