import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ ok: true });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
  return NextResponse.json({ ok: true });
}
