import { describe, expect, it } from "vitest";
import { currencyForLocale, approxConvert } from "./currency";

describe("currencyForLocale", () => {
  it("maps US, UK/Ireland, Canadian, and Australian English locales", () => {
    expect(currencyForLocale("en-US")).toBe("USD");
    expect(currencyForLocale("en-GB")).toBe("GBP");
    expect(currencyForLocale("en-IE")).toBe("GBP");
    expect(currencyForLocale("en-CA")).toBe("CAD");
    expect(currencyForLocale("fr-CA")).toBe("CAD");
    expect(currencyForLocale("en-AU")).toBe("AUD");
  });

  it("maps Hebrew to ILS", () => {
    expect(currencyForLocale("he")).toBe("ILS");
    expect(currencyForLocale("he-IL")).toBe("ILS");
  });

  it("is case-insensitive", () => {
    expect(currencyForLocale("EN-us")).toBe("USD");
  });

  it("returns null for EUR-using and unmapped locales, so the caller shows plain EUR", () => {
    expect(currencyForLocale("nl-BE")).toBeNull();
    expect(currencyForLocale("fr-BE")).toBeNull();
    expect(currencyForLocale("de-DE")).toBeNull();
    expect(currencyForLocale(undefined)).toBeNull();
    expect(currencyForLocale(null)).toBeNull();
    expect(currencyForLocale("")).toBeNull();
  });
});

describe("approxConvert", () => {
  it("converts EUR cents to a mapped currency's major units", () => {
    expect(approxConvert(1000, "USD")).toBeCloseTo(10.8, 5);
  });

  it("returns null for a currency not in the table", () => {
    expect(approxConvert(1000, "JPY")).toBeNull();
  });
});
