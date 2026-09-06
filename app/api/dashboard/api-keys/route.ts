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
export async function POST(request: Request) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.redirect(
      new URL(`/dashboard/api-keys?error=${encodeURIComponent("Not connected yet — Supabase isn't configured.")}`, request.url),
      303
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/auth/sign-in", request.url));
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.redirect(
      new URL(`/dashboard/api-keys?error=${encodeURIComponent("Not connected yet — Supabase isn't configured.")}`, request.url),
      303
    );
  }

  // The plaintext key exists only in this one variable, for this one
  // request — never persisted anywhere, never logged. It's carried back to
  // the page in the redirect's query string (a plain HTML form POST has no
  // other channel), same pattern this app already uses for every other
  // one-time success message (?submitted=1, ?saved=1) — it's a one-time
  // reveal, not something the URL itself needs to stay secret past this
  // single redirect/render.
  const { plaintext, hash, prefix } = generateApiKey();

  const { error } = await admin.from("agently_api_keys").insert({
    user_id: user.id,
    key_hash: hash,
    key_prefix: prefix,
  });

  if (error) {
    return NextResponse.redirect(
      new URL(`/dashboard/api-keys?error=${encodeURIComponent("Could not create a key — try again.")}`, request.url),
      303
    );
  }

  return NextResponse.redirect(
    new URL(`/dashboard/api-keys?new_key=${encodeURIComponent(plaintext)}`, request.url),
    303
  );
}
