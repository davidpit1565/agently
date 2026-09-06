import { describe, expect, it } from "vitest";
import { sanitizeUrl } from "./validation";

describe("sanitizeUrl", () => {
  it("passes through a real http(s) URL unchanged", () => {
    expect(sanitizeUrl("https://example.com/agent")).toBe("https://example.com/agent");
    expect(sanitizeUrl("http://example.com")).toBe("http://example.com");
  });

  it("rejects javascript: and data: URLs — the whole reason this function exists", () => {
    expect(sanitizeUrl("javascript:alert(1)")).toBeNull();
    expect(sanitizeUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
  });

  it("rejects malformed input instead of throwing", () => {
    expect(sanitizeUrl("not a url")).toBeNull();
  });

  it("passes null/undefined/empty straight through as null", () => {
    expect(sanitizeUrl(null)).toBeNull();
    expect(sanitizeUrl(undefined)).toBeNull();
    expect(sanitizeUrl("")).toBeNull();
  });
});
