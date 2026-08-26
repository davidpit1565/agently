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
          [Placeholder — needs a real policy before launch. The report
          flags this explicitly: a clear, automatic refund policy should
          exist before the first dispute, not be improvised during one.]
        </Section>
        <Section title="Payments">
          Payment is processed by Stripe. Agently takes a platform fee
          (currently 15%) on each sale; the remainder goes to the creator via
          Stripe Connect.
        </Section>
        <Section title="Data & VAT">
          [Placeholder — VAT handling for EU marketplace transactions and
          data retention need legal review before this is real. See the
          market research report, ch. 7.]
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
