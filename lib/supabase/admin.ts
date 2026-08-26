import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role client — bypasses RLS entirely. Only for server code with no
// user session to check against, like the Stripe webhook: it's verified by
// Stripe's signature, not by a signed-in user, so `auth.uid()` is always
// null there and every RLS policy in schema.sql (all written as `= auth.uid()`)
// would silently reject the write. Never import this from anything that
// handles a user's own request — use lib/supabase/server.ts for that.
export function createAdminClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;

  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
