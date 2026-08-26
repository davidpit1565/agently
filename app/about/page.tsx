import type { Metadata } from "next";

const title = "About — Agently";
const description = "The catalog for AI agents, built the way we'd want to buy from it — every listing does a real job before it's ever offered for sale.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, type: "website" },
  twitter: { card: "summary_large_image", title, description },
};

const STEPS = [
  {
    n: "01",
    title: "We build the agent",
    body: "Every listing starts as something we actually needed for our own channel — not a demo written to fill a catalog.",
  },
  {
    n: "02",
    title: "It gets reviewed",
    body: "A first automated pass judges the listing itself — vague or overly-broad access claims get flagged for a human; a clear, narrow description can auto-approve. It reads what's written, not the agent's actual code — that's a real limit, not a solved problem.",
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
            About Agently
          </span>
          <h1 className="text-balance font-display text-4xl font-semibold leading-[1.1] tracking-tight">
            A catalog built the way <span className="text-accent">we&apos;d want to buy from it.</span>
          </h1>
          <p className="text-pretty text-lg leading-relaxed text-ink-soft">
            Most tool catalogs launch empty and hope creators show up.
            Agently didn&apos;t: every agent listed here already does a
            real job on our own content channel,{" "}
            <a href="https://actually-works-studio.vercel.app" className="text-accent underline">
              Actually Works
            </a>
            , before it&apos;s ever offered for sale. If it isn&apos;t good
            enough for us to run ourselves, it doesn&apos;t go in the
            catalog. That&apos;s the whole standard — not a slogan, a
            filter every listing has already passed before you see it.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-balance font-display text-lg font-semibold">How a listing gets here</h2>
          <div className="flex flex-col gap-px overflow-hidden rounded-2xl border border-line bg-line">
            {STEPS.map((s) => (
              <div key={s.n} className="flex gap-5 bg-surface p-6">
                <span className="font-mono text-sm text-accent">{s.n}</span>
                <div>
                  <h3 className="text-balance font-display font-semibold">{s.title}</h3>
                  <p className="mt-1 text-pretty text-sm leading-relaxed text-ink-soft">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-line bg-surface p-6">
          <h2 className="mb-2 font-display text-sm font-semibold text-accent">Where we draw the line</h2>
          <p className="text-pretty text-sm leading-relaxed text-ink-soft">
            The concierge that matches a buyer&apos;s problem to an agent by
            meaning, not exact words — search today is real text matching,
            not that. And the safety review only reads a listing&apos;s
            description; it can&apos;t inspect what the agent&apos;s code
            actually does. We&apos;d rather say that plainly than let the
            site imply more than it does.
          </p>
        </div>
      </div>
    </main>
  );
}
