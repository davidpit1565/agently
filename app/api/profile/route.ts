import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizeUrl } from "@/lib/validation";

// display_name and bio render publicly (creator page, agent listings);
// company_name is admin-viewed. None had a length cap, unlike reviews'
// MAX_COMMENT_LENGTH (app/api/reviews/route.ts) — same abuse/bloat vector
// the review cap already guards against.
const MAX_NAME_LENGTH = 200;
const MAX_BIO_LENGTH = 2000;

export async function POST(request: Request) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ error: "Not connected yet — Supabase isn't configured." }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/auth/sign-in", request.url));
  }

  const form = await request.formData();
  const displayName = String(form.get("display_name") ?? "").trim().slice(0, MAX_NAME_LENGTH);
  const accountType = form.get("account_type") === "company" ? "company" : "individual";
  const companyName =
    accountType === "company"
      ? ((form.get("company_name") as string) || "").trim().slice(0, MAX_NAME_LENGTH) || null
      : null;
  const bio = ((form.get("bio") as string)?.trim().slice(0, MAX_BIO_LENGTH)) || null;
  const rawWebsiteUrl = (form.get("website_url") as string)?.trim() || null;
  const websiteUrl = sanitizeUrl(rawWebsiteUrl);

  if (!displayName) {
    return NextResponse.redirect(
      new URL(`/dashboard/settings?error=${encodeURIComponent("Display name can't be empty.")}`, request.url),
      303
    );
  }

  // sanitizeUrl silently returns null for anything that isn't http(s) — fine
  // as a security backstop, but applied to a non-empty value it used to
  // just erase what was typed with zero explanation. A field's own type="url"
  // catches most malformed input before this ever runs, but not a scheme
  // other than http/https (mailto:, ftp:, javascript:), so this still needs
  // its own message rather than silently discarding the input.
  if (rawWebsiteUrl && !websiteUrl) {
    return NextResponse.redirect(
      new URL(
        `/dashboard/settings?error=${encodeURIComponent("Website must be a valid http:// or https:// link.")}`,
        request.url
      ),
      303
    );
  }

  const { error } = await supabase
    .from("agently_profiles")
    .update({
      display_name: displayName,
      account_type: accountType,
      company_name: companyName,
      bio,
      website_url: websiteUrl,
    })
    .eq("id", user.id);

  if (error) {
    // This is a plain HTML <form> POST, not a fetch call — a JSON body here
    // used to render as a raw JSON page instead of the settings form, so a
    // failed save looked like the whole page had broken rather than "try
    // again." Redirecting back with the message keeps the form on screen.
    return NextResponse.redirect(
      new URL(`/dashboard/settings?error=${encodeURIComponent(error.message)}`, request.url),
      303
    );
  }

  return NextResponse.redirect(new URL("/dashboard/settings?saved=1", request.url), 303);
}
