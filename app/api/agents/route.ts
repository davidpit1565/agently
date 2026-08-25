import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Handles the upload form (app/dashboard/upload). Every new agent lands as
// pending_review — nothing here marks an agent approved. That's a separate
// step (manual for now; see report ch. 5 on the safety-review agent).
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/auth/sign-in", request.url));
  }

  const form = await request.formData();
  const pricingModel = String(form.get("pricing_model"));
  const priceEur = form.get("price");

  const { error } = await supabase.from("agents").insert({
    creator_id: user.id,
    slug: slugify(String(form.get("name"))),
    name: form.get("name"),
    tagline: form.get("tagline"),
    problem_solved: form.get("problem_solved"),
    description: form.get("description"),
    category_slug: form.get("category_slug"),
    pricing_model: pricingModel,
    price_cents: pricingModel === "free" ? null : Math.round(Number(priceEur) * 100),
    delivery_url: form.get("delivery_url") || null,
    status: "pending_review",
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.redirect(new URL("/dashboard/upload?submitted=1", request.url));
}

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") +
    "-" +
    Math.random().toString(36).slice(2, 6)
  );
}
