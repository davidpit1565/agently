import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getNotifications } from "@/lib/notifications";

export async function GET() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ notifications: [], unreadCount: 0 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ notifications: [], unreadCount: 0 });

  const result = await getNotifications(user.id);
  return NextResponse.json(result);
}
