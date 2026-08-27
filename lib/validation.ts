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
