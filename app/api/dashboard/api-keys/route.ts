import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateApiKey } from "@/lib/api-keys";

// POST creates a new key for the signed-in user. The insert goes through the
// service-role client — same reasoning as agently_agents' insert path:
// agently_api_keys has no insert policy at all (supabase/schema.sql), so a
// direct Supabase REST call with a user's own session can't fabricate a key
// row for someone else's user_id. Ownership here is just "the caller is
// signed in" — there's no separate approval step like a listing has.
//
// Responds with JSON, not a redirect: the plaintext key used to travel back
// to the page as a ?new_key=... query param, which put a real secret in the
// browser's address bar and history, and in any request logging that
// records full URLs. Returning it in the response body instead means it
// only ever exists in this one response and the caller's own in-memory
// state (see app/components/generate-key-button.tsx) — never in a URL.
export async function POST() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ error: "Not connected yet — Supabase isn't configured." }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Not connected yet — SUPABASE_SERVICE_ROLE_KEY isn't configured." }, { status: 503 });
  }

  // The plaintext key exists only in this one variable, for this one
  // request — never persisted anywhere, never logged.
  const { plaintext, hash, prefix } = generateApiKey();

  const { error } = await admin.from("agently_api_keys").insert({
    user_id: user.id,
    key_hash: hash,
    key_prefix: prefix,
  });

  if (error) {
    return NextResponse.json({ error: "Could not create a key — try again." }, { status: 500 });
  }

  return NextResponse.json({ plaintext });
}
