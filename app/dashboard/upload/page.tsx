import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { canUpload } from "@/lib/membership";
import { CATEGORIES_FALLBACK } from "@/data/categories";
import { Field, Notice } from "@/app/components/form-field";

export default async function UploadPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string; skipped_files?: string }>;
}) {
  const { submitted, skipped_files: skippedFiles } = await searchParams;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return (
      <Notice title="Not connected yet">
        This page needs Supabase configured (see README) before anyone can
        actually sign in and upload. The catalog and pricing pages work
        without it — this one doesn't, because it writes data.
      </Notice>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <Notice title="Sign in first">
        You need an account to upload an agent.{" "}
        <Link href="/auth/sign-in" className="text-accent underline">
          Sign in
        </Link>
        .
      </Notice>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("membership_tier, membership_status, stripe_connect_ready")
    .eq("id", user.id)
    .single();

  const tier = profile?.membership_tier ?? "free";

  if (!canUpload(tier)) {
    return (
      <Notice title="Membership required">
        Browsing and buying is free. Listing your own agent needs a paid
        membership — it's the platform's main quality filter (see the market
        research report, ch. 12).{" "}
        <Link href="/pricing" className="text-accent underline">
          See membership tiers
        </Link>
        .
      </Notice>
    );
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <h1 className="text-balance mb-2 font-display text-2xl font-semibold">Upload an agent</h1>
      <p className="mb-6 text-sm text-ink-faint">
        Goes to <strong className="text-ink-soft">pending review</strong> first — nothing you submit here
        is publicly visible until the safety review clears it.
      </p>

      {submitted && (
        <p className="mb-6 rounded-lg border border-accent/30 bg-accent-soft px-4 py-3 text-sm text-accent">
          Submitted. Check <Link href="/dashboard/agents" className="underline">your listings</Link> for
          the review result — approved ones go live right away, others wait on a
          quick human look.
        </p>
      )}

      {skippedFiles && (
        <p className="mb-6 rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink-soft">
          Everything else made it, but this didn&apos;t upload: <strong>{skippedFiles}</strong> (over the 50MB
          limit, or the upload failed). Try again from the edit page once your listing is saved.
        </p>
      )}

      {!profile?.stripe_connect_ready && (
        <p className="mb-8 rounded-lg border border-line bg-surface p-4 text-sm text-ink-soft">
          You can list a free agent without this, but a paid one won&apos;t be
          purchasable until payouts are set up.{" "}
          <Link href="/dashboard/payouts" className="text-accent underline">
            Connect Stripe
          </Link>
          .
        </p>
      )}

      <form action="/api/agents" method="POST" encType="multipart/form-data" className="flex flex-col gap-4">
        <Field label="Name" name="name" required />
        <Field label="One-line tagline" name="tagline" required />
        <Field
          label="What problem does it solve?"
          name="problem_solved"
          textarea
          required
          hint="This is what the search matches against — describe the situation someone is in, not what the agent is built with."
        />
        <Field label="Full description" name="description" textarea required />

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Category</span>
          <select
            name="category_slug"
            required
            className="rounded-lg border border-line bg-surface px-4 py-2.5 text-ink outline-none focus:border-accent"
          >
            {CATEGORIES_FALLBACK.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Pricing</span>
          <select
            name="pricing_model"
            required
            className="rounded-lg border border-line bg-surface px-4 py-2.5 text-ink outline-none focus:border-accent"
          >
            <option value="one_time">One-time purchase</option>
            <option value="subscription">Monthly subscription</option>
            <option value="free">Free</option>
          </select>
        </label>

        <Field label="Price (EUR, leave blank if free)" name="price" type="number" />
        <Field
          label="Delivery link (repo, file, or API endpoint)"
          name="delivery_url"
          type="url"
          hint="Optional if you're attaching the files below instead."
        />

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Files (optional)</span>
          <input
            type="file"
            name="files"
            multiple
            className="rounded-lg border border-line bg-surface px-4 py-2.5 text-ink outline-none file:mr-3 file:rounded-full file:border-0 file:bg-accent-soft file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-accent"
          />
          <span className="text-xs text-ink-faint">
            The actual package, docs, anything a buyer should get. A file named{" "}
            <code className="text-ink-soft">README.md</code> (or <code className="text-ink-soft">.txt</code>)
            is shown on the listing page automatically. Only the buyer and you can download these —
            never public.
          </span>
        </label>

        <button
          type="submit"
          className="mt-2 rounded-full bg-accent px-6 py-3 text-sm font-medium text-[#04140f] hover:opacity-90"
        >
          Submit for review
        </button>
      </form>
    </main>
  );
}
