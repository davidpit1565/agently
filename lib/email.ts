import { Resend } from "resend";
import { errorMessage } from "@/lib/errors";

// Every event that reaches lib/notifications.ts's agently_notifications table
// today only shows up in-app (the bell icon) — there's no email at all, so a
// creator whose agent gets approved, or a buyer whose custom request gets
// fulfilled, only finds out if they happen to reopen the site. This mirrors
// each of those same in-app events into an email, best-effort, without ever
// making an email failure block the in-app notification (which already
// succeeded by the time this is called) or the request that triggered it.
//
// No-ops with a clear log line when RESEND_API_KEY isn't set — same "missing
// config means don't break the feature" pattern as every other integration
// in this codebase — so this can ship now and start working the moment the
// key is added in Vercel, no code change needed.
//
// TODO(david): RESEND_FROM_EMAIL is currently set to a mail.actually-works.com
// address (the channel's domain) as a stopgap — Agently doesn't have its own
// domain yet. Once a domain is bought specifically for Agently, verify it in
// Resend and update RESEND_FROM_EMAIL in Vercel to use it instead. Until
// then, every Agently email goes out under the videos channel's name, which
// looks off to a buyer/creator who has no idea what "actually-works" is.
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Agently <onboarding@resend.dev>";

let client: Resend | null = null;
function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!client) client = new Resend(process.env.RESEND_API_KEY);
  return client;
}

export async function sendNotificationEmail(to: string | null | undefined, subject: string, body: string) {
  if (!to) return;
  const resend = getResend();
  if (!resend) {
    console.log("[email] RESEND_API_KEY not set — skipping", { to, subject });
    return;
  }
  try {
    await resend.emails.send({ from: FROM_EMAIL, to, subject, text: body });
  } catch (err) {
    // Never throw from here: the in-app notification this mirrors has
    // already been written by the time this is called, and the action that
    // triggered it (an admin approving a listing, fulfilling a request)
    // already succeeded and redirected. A dead email provider shouldn't
    // turn either of those into a 500.
    console.error("[email] send failed", { to, subject, message: errorMessage(err) });
  }
}
