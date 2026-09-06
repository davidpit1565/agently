import { randomBytes, createHash } from "crypto";

// Prefixed so a leaked key is instantly recognizable as an Agently hosted-
// agent key in a scan/log — same reason real API-key systems (Stripe's
// sk_live_, OpenAI's sk-) prefix theirs.
export const API_KEY_PREFIX = "ag_live_";

// How much of the real key is shown back in the dashboard (app/dashboard/
// api-keys/page.tsx) after creation — the prefix plus a few characters, never
// the full secret again. Long enough to tell two of a user's own keys apart,
// short enough that it's useless to anyone who only sees this.
const DISPLAY_PREFIX_LENGTH = API_KEY_PREFIX.length + 6;

/**
 * Generates a new API key. The plaintext is returned ONLY here, at creation
 * time (app/api/dashboard/api-keys/route.ts) — nothing else in this codebase
 * ever sees it again. What's actually stored (agently_api_keys.key_hash) is
 * a one-way sha256 hash: sha256 is fine here (unlike a password) because the
 * input itself is 256 bits of real randomness, not something a human chose
 * and a rainbow table could guess.
 */
export function generateApiKey(): { plaintext: string; hash: string; prefix: string } {
  const secret = randomBytes(32).toString("hex");
  const plaintext = `${API_KEY_PREFIX}${secret}`;
  return {
    plaintext,
    hash: hashApiKey(plaintext),
    prefix: plaintext.slice(0, DISPLAY_PREFIX_LENGTH),
  };
}

export function hashApiKey(plaintextKey: string): string {
  return createHash("sha256").update(plaintextKey).digest("hex");
}

/** Pulls the raw key out of a request's Authorization header, or null if it's missing/malformed. */
export function extractBearerKey(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}
