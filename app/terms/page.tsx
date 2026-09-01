import type { Metadata } from "next";

// noindex, not a full title/OG treatment — this is explicitly a draft, not
// reviewed by a lawyer yet (see the notice below); it shouldn't be what a
// search result sends someone to before it's real.
export const metadata: Metadata = {
  title: "Terms of Service (draft) — Agently",
  robots: { index: false, follow: true },
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <div className="mb-8 rounded-xl border border-line bg-surface p-5 text-sm leading-relaxed text-ink-soft">
        <strong className="text-ink">Draft — not legal advice, not reviewed by a lawyer.</strong>{" "}
        The market research report (ch. 7) flags this as required before
        public launch. This page exists so the structure is ready for that
        review, not to stand in for it — don&apos;t treat it as binding yet.
      </div>

      <h1 className="text-balance mb-6 font-display text-2xl font-semibold">Terms of Service (draft)</h1>

      <div className="flex flex-col gap-6 text-sm leading-relaxed text-ink-soft">
        <Section title="What Agently is">
          A catalog of AI agents built by real creators, sold directly to
          the people who need them. Agently lists agents, processes
          payment, and takes a platform fee on each sale — it does not
          build, own, or guarantee the agents themselves.
        </Section>
        <Section title="Creator responsibility">
          The creator of an agent is responsible for what it does, what data
          it accesses, and whether its listing accurately describes its
          behavior. A safety review happens before listing — a first
          automated pass today, with anything it flags going to a human (see
          /about) — but that review is a check, not a warranty.
        </Section>
        <Section title="Buyer responsibility">
          Buying an agent means running software built by a third party.
          Review what permissions or API access it requests before granting
          them.
        </Section>
        <Section title="Refunds">
          One-time purchases are refundable within 7 days of purchase if the
          agent doesn&apos;t work as its listing describes — request one by
          contacting the creator directly (their page links out, where
          provided) or emailing support with the order and a description of
          the problem. Once a refund is issued, the buyer&apos;s access to
          the agent&apos;s delivery link and files is revoked. A refund is
          not available once 7 days have passed, or for a working agent you
          simply changed your mind about. Subscriptions (both a membership
          and a per-agent subscription) can be canceled any time from your
          dashboard — cancellation stops future billing but does not refund
          the current period. This is a starting policy, not a legally
          reviewed one; it will be revisited once there&apos;s a real dispute
          to learn from.
        </Section>
        <Section title="Payments">
          Payment is processed by Stripe. Agently takes a platform fee
          (currently 15%) on each sale; the remainder goes to the creator via
          Stripe Connect.
        </Section>
        <Section title="Data & VAT">
          Agently stores what&apos;s needed to run the marketplace: your
          account email, the listings and purchases tied to it, and
          whatever an agent&apos;s own creator collects if you choose to run
          it — that part is between you and them, not covered here. This
          section is intentionally incomplete: EU digital-goods VAT (the
          OSS scheme, reverse-charge rules for B2B sales, threshold
          registration) genuinely needs a real accountant or lawyer before
          Agently can state a compliant policy here, not an AI-generated
          guess at tax law. Until that review happens, prices shown are
          treated as VAT-inclusive placeholders, not a compliance claim.
        </Section>
      </div>
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
