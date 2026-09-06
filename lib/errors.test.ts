import { describe, expect, it } from "vitest";
import { errorMessage } from "./errors";

describe("errorMessage", () => {
  it("uses the message of a real Error", () => {
    expect(errorMessage(new Error("boom"))).toBe("boom");
  });

  it("reads .message off a plain error-shaped object (e.g. a Supabase PostgrestError)", () => {
    expect(errorMessage({ message: "duplicate key", code: "23505" })).toBe("duplicate key");
  });

  it("never degrades to the literal text '[object Object]' — the whole reason this function exists", () => {
    const result = errorMessage({ code: "23505" });
    expect(result).not.toBe("[object Object]");
  });

  it("stringifies a plain object with no .message", () => {
    expect(errorMessage({ code: "23505" })).toBe('{"code":"23505"}');
  });

  it("falls back to String() for a primitive", () => {
    expect(errorMessage("a thrown string")).toBe('"a thrown string"');
    expect(errorMessage(42)).toBe("42");
  });
});
