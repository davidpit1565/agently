import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

// A profile's website_url and an agent's delivery_url are both stored
// as-is and later rendered straight into an <a href>. Neither the upload
// form nor a direct POST (bypassing the form) validated the scheme, so
// `javascript:alert(1)` or a `data:` URL would render and execute on click
// for anyone who opened that profile or listing — not just the person who
// submitted it. http(s)-only, same rule for every place a user-supplied
// link becomes a real href in this app.
export function sanitizeUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return value;
  } catch {
    return null;
  }
}

// hosted_webhook_url is the one URL field in this app that's actually
// *fetched* server-to-server (app/api/agents/[slug]/invoke/route.ts's
// runHostedWorkflow), not just rendered as a clickable link — a different
// threat model than sanitizeUrl above (which only blocks javascript:/data:
// so a click can't execute script). A creator who controls that field could
// point it at an internal/private address and have Agently's own server
// make the request on their behalf: localhost, an RFC1918 address, or the
// cloud metadata endpoint (169.254.169.254) that on most cloud runtimes
// answers with credentials to whoever can reach it. sanitizeUrl's http(s)
// scheme check does nothing to stop that — a private IP is a perfectly
// valid https:// URL.
function isPrivateOrReservedIpv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return true; // malformed — refuse rather than guess
  const [a, b] = parts;
  if (a === 127) return true; // loopback
  if (a === 10) return true; // RFC1918
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
  if (a === 192 && b === 168) return true; // RFC1918
  if (a === 169 && b === 254) return true; // link-local — includes the cloud metadata endpoint
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT (RFC6598)
  if (a === 0) return true; // "this network"
  if (a >= 224) return true; // multicast/reserved
  return false;
}

function isPrivateOrReservedIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true; // loopback / unspecified
  if (lower.startsWith("fe80:") || lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) return true; // link-local fe80::/10
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local fc00::/7
  // IPv4-mapped (::ffff:a.b.c.d) — check the embedded IPv4 address too.
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateOrReservedIpv4(mapped[1]);
  return false;
}

function isPrivateOrReservedIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isPrivateOrReservedIpv4(ip);
  if (version === 6) return isPrivateOrReservedIpv6(ip);
  return true; // not a recognizable IP — refuse rather than guess
}

/** The synchronous half of the check above — no DNS lookup, so it's cheap
 *  enough to run at listing-creation time (validateHostedAgentFields) to
 *  give the creator an immediate, clear form error for the obvious cases
 *  (a literal private IP, localhost, *.internal). It can't catch a hostname
 *  that only resolves to a private address, or resolves differently later —
 *  isSafeExternalUrl's DNS lookup at actual call time is what covers that. */
export function isPrivateOrReservedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return true;
  }
  if (isIP(host)) return isPrivateOrReservedIp(host);
  return false;
}

/**
 * The actual SSRF guard for hosted_webhook_url, called right before the
 * server-to-server fetch (runHostedWorkflow in the invoke route) — not only
 * at creation time. A hostname that resolves to a public address when a
 * creator first saves their listing can start resolving to an internal one
 * later (DNS rebinding, or just a dynamic-DNS host they control), so the
 * check that actually matters is the one done against the address that's
 * about to be dialed, not the one done once at upload time. Rejects if the
 * URL isn't http(s), or if ANY address the hostname resolves to is private/
 * reserved — a hostname that resolves to both a public and a private
 * address is refused entirely rather than racing which one the runtime
 * picks.
 */
export async function isSafeExternalUrl(value: string): Promise<boolean> {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (isPrivateOrReservedHostname(url.hostname)) return false;

  try {
    const addresses = await lookup(url.hostname, { all: true, verbatim: true });
    if (addresses.length === 0) return false;
    return addresses.every((a) => !isPrivateOrReservedIp(a.address));
  } catch {
    return false; // couldn't resolve it — refuse rather than let a broken lookup slip through
  }
}
