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
  const websiteUrl = sanitizeUrl((form.get("website_url") as string)?.trim() || null);

  if (!displayName) {
    return NextResponse.json({ error: "Display name can't be empty." }, { status: 400 });
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
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.redirect(new URL("/dashboard/settings?saved=1", request.url), 303);
}
