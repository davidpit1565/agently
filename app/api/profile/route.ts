import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
  const displayName = String(form.get("display_name") ?? "").trim();
  const accountType = form.get("account_type") === "company" ? "company" : "individual";
  const companyName = accountType === "company" ? (form.get("company_name") as string) || null : null;

  if (!displayName) {
    return NextResponse.json({ error: "Display name can't be empty." }, { status: 400 });
  }

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName, account_type: accountType, company_name: companyName })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.redirect(new URL("/dashboard/settings?saved=1", request.url), 303);
}
