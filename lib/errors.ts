// A Supabase PostgrestError (and several other error-shaped values this app
// catches — Stripe errors, thrown strings) is a plain object, not an `Error`
// instance. `err instanceof Error ? err.message : String(err)` silently
// degrades those to the literal text "[object Object]" in logs, which is
// what happened to notifyCreatorOfSale's failure log — the one signal for a
// creator payout notification going missing carried no actual detail.
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
