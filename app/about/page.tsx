const STEPS = [
  {
    n: "01",
    title: "We build the agent",
    body: "Every listing starts as something we actually needed for our own channel — not a demo written to fill a catalog.",
  },
  {
    n: "02",
    title: "It gets reviewed",
    body: "Before anything goes live: what it asks permission for, what it does, whether the listing matches the behavior. Manual today, automated as an agent of its own once there's volume to justify it.",
  },
  {
    n: "03",
    title: "It's found by the problem it solves",
    body: "Not a category tree. You describe what you're stuck on; the listing is written to match that, not a keyword.",
  },
  {
    n: "04",
    title: "You can sell yours too",
    body: "A paid membership — not a per-listing fee — is what unlocks uploading. It's a quality filter as much as a plan.",
  },
];

export default function AboutPage() {
  return (
    <main className="relative overflow-hidden">
      <div className="hero-glow" />
      <div className="relative mx-auto flex max-w-2xl flex-col gap-16 px-6 py-24">
        <div className="flex flex-col gap-5">
          <span className="w-fit rounded-full border border-line bg-surface px-3 py-1 font-mono text-xs uppercase tracking-wide text-ink-soft">
            Why it looks like this
          </span>
          <h1 className="font-display text-4xl font-semibold leading-[1.1] tracking-tight">
            We&apos;re the first customer, <span className="text-accent">not just the platform.</span>
          </h1>
          <p className="text-lg text-ink-soft">
            Agently started because we needed somewhere to put the agents we
            were already building for our own content channel —{" "}
            <a href="https://actually-works-studio.vercel.app" className="text-accent underline">
              Actually Works
            </a>
            . Every agent in the catalog today did a real job before it was
            ever listed for sale.
          </p>
        </div>

        <div className="flex flex-col gap-px overflow-hidden rounded-2xl border border-line bg-line">
          {STEPS.map((s) => (
            <div key={s.n} className="flex gap-5 bg-surface p-6">
              <span className="font-mono text-sm text-accent">{s.n}</span>
              <div>
                <h2 className="font-display font-semibold">{s.title}</h2>
                <p className="mt-1 text-sm text-ink-soft">{s.body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-line bg-surface p-6">
          <h2 className="mb-2 font-display text-sm font-semibold text-accent">What&apos;s not built yet</h2>
          <p className="text-sm text-ink-soft">
            The automated safety-review agent and the concierge that matches
            buyers to agents by problem description — both real, both planned,
            neither live. Today those steps are manual. We&apos;d rather say
            that plainly than let the site imply more than it does.
          </p>
        </div>
      </div>
    </main>
  );
}
