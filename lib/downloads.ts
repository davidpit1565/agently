import type { SupabaseClient } from "@supabase/supabase-js";
import { sendNotificationEmail } from "@/lib/email";

// Every 5th download of the same purchase's content — not every one, or
// this would just be noise. A legitimate buyer redownloading their own
// purchase a handful of times (a new machine, a lost copy) never reaches
// this; a purchase climbing past it repeatedly is the actual signal that
// something's being redistributed rather than just used.
const ALERT_EVERY = 5;

export async function logDownloadAndMaybeAlert(
  admin: SupabaseClient,
  params: { purchaseId: string; fileId: string | null; agentId: string; agentName: string; buyerId: string }
) {
  const { purchaseId, fileId, agentId, agentName, buyerId } = params;

  await admin.from("agently_downloads").insert({ purchase_id: purchaseId, file_id: fileId });

  const { count } = await admin
    .from("agently_downloads")
    .select("id", { count: "exact", head: true })
    .eq("purchase_id", purchaseId);

  const total = count ?? 0;
  // Fires again at every further multiple of ALERT_EVERY (10, 15, ...) —
  // once isn't enough to say "keep watching this," but every single
  // download past the first alert would be alert fatigue.
  if (total > 0 && total % ALERT_EVERY === 0) {
    const { data: buyer } = await admin.auth.admin.getUserById(buyerId);
    await sendNotificationEmail(
      process.env.PLATFORM_OWNER_EMAIL,
      `Unusual download activity — ${agentName}`,
      `Purchase ${purchaseId} (agent: ${agentName}, agent id: ${agentId}, buyer: ${buyer.user?.email ?? buyerId}) has been downloaded ${total} times. Worth a look if it keeps climbing — a legitimate buyer rarely needs this many redownloads of the same purchase.`
    );
  }
}
