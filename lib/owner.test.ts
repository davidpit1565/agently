import { describe, it, expect, afterEach } from "vitest";
import { isPlatformOwner } from "./owner";

describe("isPlatformOwner", () => {
  const ORIGINAL_ENV = process.env.PLATFORM_OWNER_EMAIL;

  afterEach(() => {
    process.env.PLATFORM_OWNER_EMAIL = ORIGINAL_ENV;
  });

  it("matches an exact, identically-cased match", () => {
    process.env.PLATFORM_OWNER_EMAIL = "owner@example.com";
    expect(isPlatformOwner("owner@example.com")).toBe(true);
  });

  it("ignores case on both sides", () => {
    process.env.PLATFORM_OWNER_EMAIL = "Owner@Example.com";
    expect(isPlatformOwner("owner@example.com")).toBe(true);
    expect(isPlatformOwner("OWNER@EXAMPLE.COM")).toBe(true);
  });

  it("ignores surrounding whitespace on both sides", () => {
    process.env.PLATFORM_OWNER_EMAIL = "  owner@example.com  ";
    expect(isPlatformOwner("owner@example.com")).toBe(true);
    expect(isPlatformOwner(" owner@example.com ")).toBe(true);
  });

  it("rejects a different email", () => {
    process.env.PLATFORM_OWNER_EMAIL = "owner@example.com";
    expect(isPlatformOwner("someone-else@example.com")).toBe(false);
  });

  it("returns false when PLATFORM_OWNER_EMAIL is unset", () => {
    delete process.env.PLATFORM_OWNER_EMAIL;
    expect(isPlatformOwner("owner@example.com")).toBe(false);
  });

  it("returns false when the candidate email is null/undefined/empty", () => {
    process.env.PLATFORM_OWNER_EMAIL = "owner@example.com";
    expect(isPlatformOwner(null)).toBe(false);
    expect(isPlatformOwner(undefined)).toBe(false);
    expect(isPlatformOwner("")).toBe(false);
  });
});
