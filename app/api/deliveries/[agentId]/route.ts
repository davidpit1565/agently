import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAgentFiles, getSignedFileUrl } from "@/lib/agent-files";
import { isWatermarkableText, watermarkText } from "@/lib/watermark";
import { logDownloadAndMaybeAlert } from "@/lib/downloads";

// Every real delivery — the external delivery_url, or a downloadable file —
// goes through here now instead of a direct <a href> to the raw
// destination. The one reason this route exists: marking
// delivery_accessed_at on the buyer's own purchase row the first time they
// actually retrieve what they paid for. app/api/refunds/[purchaseId]/route.ts
// refuses a self-service refund once that's set — without this, downloading
// a one-time purchase and then refunding it would be a free way to keep
// both the product and the money, which nothing before this route stopped.
// A creator viewing their own listing's files has no purchase row and
// nothing is marked for them.
export async function GET(request: Request, { params }: { params: Promise<{ agentId: string }> }) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ error: "Not connected yet — Supabase isn't configured." }, { status: 503 });
  }

  const { agentId } = await params;
  const fileId = new URL(request.url).searchParams.get("file");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/auth/sign-in", request.url));
  }

  const { data: agent } = await supabase
    .from("agently_agents")
    .select("id, creator_id, delivery_url, name")
    .eq("id", agentId)
    .single();
  if (!agent) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }

  const isOwner = agent.creator_id === user.id;

  const { data: purchase } = await supabase
    .from("agently_purchases")
    .select("id, delivery_accessed_at")
    .eq("agent_id", agentId)
    .eq("buyer_id", user.id)
    .eq("status", "paid")
    .maybeSingle();

  if (!isOwner && !purchase) {
    return NextResponse.json({ error: "You don't have access to this." }, { status: 403 });
  }

  // Everything from here on is logged and (past a threshold) alerted on
  // for a real purchase, whether it's the first access or the fiftieth —
  // an owner previewing their own listing has no purchase row and none of
  // this runs for them.
  if (purchase) {
    const admin = createAdminClient();
    if (admin) {
      if (!purchase.delivery_accessed_at) {
        await admin
          .from("agently_purchases")
          .update({ delivery_accessed_at: new Date().toISOString() })
          .eq("id", purchase.id);
      }
      await logDownloadAndMaybeAlert(admin, {
        purchaseId: purchase.id,
        fileId,
        agentId,
        agentName: agent.name,
        buyerId: user.id,
      });
    }
  }

  if (fileId) {
    const files = await getAgentFiles(agentId);
    const file = files.find((f) => f.id === fileId && !f.is_readme);
    if (!file) {
      return NextResponse.json({ error: "File not found." }, { status: 404 });
    }
    const signedUrl = await getSignedFileUrl(file.storage_path);
    if (!signedUrl) {
      return NextResponse.json({ error: "Couldn't generate a download link — try again." }, { status: 500 });
    }

    // Watermarking needs an actual purchase to attribute the copy to and a
    // safe text format to inject into — an owner previewing their own
    // listing (no purchase row) or a binary/unrecognized file just gets the
    // plain signed URL, same as before.
    if (purchase && isWatermarkableText(file.file_name)) {
      const fileResponse = await fetch(signedUrl);
      if (fileResponse.ok) {
        const content = await fileResponse.text();
        const watermarked = watermarkText(file.file_name, content, purchase.id, agent.name);
        return new NextResponse(watermarked, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Content-Disposition": `attachment; filename="${file.file_name}"`,
          },
        });
      }
      // Signed URL fetch failed for some reason — fall through to the
      // plain redirect rather than blocking a legitimate download over a
      // watermarking failure.
    }

    return NextResponse.redirect(signedUrl);
  }

  if (!agent.delivery_url) {
    return NextResponse.json({ error: "No delivery link set." }, { status: 404 });
  }
  return NextResponse.redirect(agent.delivery_url);
}
