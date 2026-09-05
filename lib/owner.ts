/** Every owner-only gate in this app compares a signed-in user's email
 *  against PLATFORM_OWNER_EMAIL directly (`user.email !== process.env...`) —
 *  exact string equality, case-sensitive, no trimming. A Vercel env var
 *  entered with different casing or a trailing space than the address
 *  actually signed up with (Supabase itself lowercases auth emails, but the
 *  env var is typed by hand) would silently lock the owner out of every
 *  admin route at once — /dashboard/admin/agents 404s, the owner
 *  comp-purchase path in checkout stops working — with nothing beyond a
 *  generic "not found" to explain why. One normalized comparison here
 *  instead of six copies of the fragile one. */
export function isPlatformOwner(email: string | null | undefined): boolean {
  const owner = process.env.PLATFORM_OWNER_EMAIL;
  if (!owner || !email) return false;
  return email.trim().toLowerCase() === owner.trim().toLowerCase();
}
