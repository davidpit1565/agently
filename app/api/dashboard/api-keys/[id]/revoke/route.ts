import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Revokes one of the caller's own keys. Sets revoked_at rather than deleting
// the row — same "never actually erase" instinct as agently_purchases'
// status='refunded'/'canceled': the row (and its last_used_at history) stays
// visible to anyone auditing later, it just stops authenticating anything.
//
// A plain HTML form POST (RemoveFileButton's pattern), not a JSON DELETE
// call — same reasoning as every other write in this app: no client JS
// required for the action itself to work.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

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

  // .eq("user_id", user.id) here is the actual ownership check — without
  // it, any signed-in user could revoke any other user's key by id, since
  // this write goes through the service-role client (which bypasses RLS
  // entirely, same as every other admin-client write in this app).
  const { data: updatedRows, error } = await admin
    .from("agently_api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .select("id");

  if (error || !updatedRows || updatedRows.length === 0) {
    return NextResponse.redirect(
      new URL(
        `/dashboard/api-keys?error=${encodeURIComponent(error ? "Could not revoke the key." : "Key not found, already revoked, or not yours.")}`,
        request.url
      ),
      303
    );
  }

  return NextResponse.redirect(new URL("/dashboard/api-keys?revoked=1", request.url), 303);
}
