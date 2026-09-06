import type { Metadata } from "next";

// Same status as app/terms/page.tsx: real and live, not a placeholder, but
// not yet reviewed by a lawyer — that caveat is stated plainly at the bottom
// instead of smoothed over.
const title = "Privacy policy — Agently";
const description = "How Agently collects, uses, and stores your data.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, type: "website" },
  twitter: { card: "summary_large_image", title, description },
};

// Same placeholder as app/terms/page.tsx — a real inbox, not the final one.
const SUPPORT_EMAIL = "dp@solfaygroup.com";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-balance mb-6 font-display text-2xl font-semibold">Privacy policy</h1>

      <div className="flex flex-col gap-6 text-sm leading-relaxed text-ink-soft">
        <Section title="What's collected">
          Your account email (via Supabase Auth, used to sign in and to send
          order/notification emails), the listings and purchases tied to
          your account, and any agent files or descriptions a creator
          uploads. If you buy an agent for a team, the teammate emails you
          enter are stored to send them their own access invite.
        </Section>
        <Section title="What's not collected by Agently">
          Payment details (card numbers etc.) are handled entirely by
          Stripe — Agently never sees or stores them. What an agent itself
          collects once you run it is between you and its creator, not
          covered here.
        </Section>
        <Section title="Who it's shared with">
          Stripe (for payment processing and payouts to creators), Supabase
          (database and authentication), and Resend (transactional email —
          order confirmations, team invites, notifications). No data is
          sold or shared for advertising.
        </Section>
        <Section title="Your choices">
          You can request your account and its data be deleted, or ask what
          is stored about you, by emailing{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-accent underline">
            {SUPPORT_EMAIL}
          </a>
          . Purchase records tied to a completed Stripe payment are kept
          for accounting even after a deletion request, as required to
          reconcile payouts and refunds.
        </Section>
        <Section title="EU data protection">
          This section is intentionally incomplete: a proper GDPR-compliant
          policy (lawful basis for each use, data retention periods, a
          named data controller, a real process for access/erasure
          requests) needs a real lawyer, not an AI-generated guess. Until
          that review happens, email requests above are honored manually,
          case by case.
        </Section>
      </div>

      <p className="mt-10 text-xs text-ink-faint">
        This policy hasn&apos;t been reviewed by a lawyer. If something here
        doesn&apos;t cover your situation, email{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">
          {SUPPORT_EMAIL}
        </a>{" "}
        and it&apos;ll be resolved directly rather than left to the text above.
      </p>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-1 font-display text-sm font-semibold text-accent">{title}</h2>
      <p className="text-pretty">{children}</p>
    </div>
  );
}
