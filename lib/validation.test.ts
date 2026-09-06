import { describe, expect, it } from "vitest";
import { sanitizeUrl, isPrivateOrReservedHostname, isSafeExternalUrl } from "./validation";

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

// hosted_webhook_url is the one URL field this app actually fetches
// server-to-server (the invoke route) rather than just rendering as a link
// — sanitizeUrl's scheme check does nothing to stop a private/internal
// target, since a private IP is a perfectly valid https:// URL.
describe("isPrivateOrReservedHostname", () => {
  it("flags localhost and its variants", () => {
    expect(isPrivateOrReservedHostname("localhost")).toBe(true);
    expect(isPrivateOrReservedHostname("foo.localhost")).toBe(true);
    expect(isPrivateOrReservedHostname("box.internal")).toBe(true);
  });

  it("flags loopback, RFC1918, and the cloud metadata address", () => {
    expect(isPrivateOrReservedHostname("127.0.0.1")).toBe(true);
    expect(isPrivateOrReservedHostname("10.0.0.5")).toBe(true);
    expect(isPrivateOrReservedHostname("172.16.0.1")).toBe(true);
    expect(isPrivateOrReservedHostname("192.168.1.1")).toBe(true);
    expect(isPrivateOrReservedHostname("169.254.169.254")).toBe(true); // AWS/GCP metadata
    expect(isPrivateOrReservedHostname("::1")).toBe(true);
  });

  it("passes a real public hostname or IP through", () => {
    expect(isPrivateOrReservedHostname("example.com")).toBe(false);
    expect(isPrivateOrReservedHostname("8.8.8.8")).toBe(false);
  });
});

describe("isSafeExternalUrl", () => {
  it("rejects a literal private address without needing DNS", async () => {
    expect(await isSafeExternalUrl("http://127.0.0.1/hook")).toBe(false);
    expect(await isSafeExternalUrl("http://169.254.169.254/latest/meta-data/")).toBe(false);
    expect(await isSafeExternalUrl("http://localhost:3000/hook")).toBe(false);
  });

  it("rejects a non-http(s) scheme and malformed input", async () => {
    expect(await isSafeExternalUrl("ftp://example.com")).toBe(false);
    expect(await isSafeExternalUrl("not a url")).toBe(false);
  });
});
