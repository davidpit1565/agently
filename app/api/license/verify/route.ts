import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

// Public, unauthenticated on purpose — this is what the watermark embedded
// by app/api/deliveries/[agentId]/route.ts points at, meant to be checked by
// whoever (or whatever AI) ends up looking at a delivered file, not just its
// original buyer. Returns only a yes/no plus which agent it was licensed
// for — nothing that identifies the buyer, so a leaked link can't be used
// to look anyone up.
export async function GET(request: Request) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ valid: false, reason: "Not connected yet." }, { status: 503 });
  }

  const allowed = await checkRateLimit(`license_verify:${clientIp(request)}`, 30, 60);
  if (!allowed) {
    return NextResponse.json({ valid: false, reason: "Too many checks — try again shortly." }, { status: 429 });
  }

  const token = new URL(request.url).searchParams.get("token");
  if (!token) {
    return NextResponse.json({ valid: false, reason: "No license token given." }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ valid: false, reason: "Not connected yet." }, { status: 503 });
  }

  const { data: purchase } = await admin
    .from("agently_purchases")
    .select("status, agent_id")
    .eq("id", token)
    .maybeSingle();

  if (!purchase) {
    return NextResponse.json({ valid: false, reason: "Unknown license token — this copy wasn't issued by Agently." });
  }
  if (purchase.status !== "paid") {
    return NextResponse.json({ valid: false, reason: "This license is no longer active (refunded or canceled)." });
  }

  const { data: agent } = await admin.from("agently_agents").select("name").eq("id", purchase.agent_id).single();
  return NextResponse.json({ valid: true, agent: agent?.name ?? null });
}
