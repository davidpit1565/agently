import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { canUpload } from "@/lib/membership";
import { CATEGORIES_FALLBACK } from "@/data/categories";

export default async function UploadPage() {
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
    .select("membership_tier, membership_status")
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
      <h1 className="mb-2 text-2xl font-semibold">Upload an agent</h1>
      <p className="mb-8 text-sm text-ink/60">
        Goes to <strong>pending review</strong> first — nothing you submit here
        is publicly visible until the safety review clears it.
      </p>

      <form action="/api/agents" method="POST" className="flex flex-col gap-4">
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
            className="rounded-lg border border-ink/15 bg-white px-4 py-2.5 outline-none focus:border-accent"
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
            className="rounded-lg border border-ink/15 bg-white px-4 py-2.5 outline-none focus:border-accent"
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
        />

        <button
          type="submit"
          className="mt-2 rounded-full bg-accent px-6 py-3 text-sm font-medium text-white hover:opacity-90"
        >
          Submit for review
        </button>
      </form>
    </main>
  );
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-md px-6 py-24 text-center">
      <h1 className="mb-2 text-xl font-semibold">{title}</h1>
      <p className="text-sm text-ink/70">{children}</p>
    </main>
  );
}

function Field({
  label,
  name,
  required,
  textarea,
  type = "text",
  hint,
}: {
  label: string;
  name: string;
  required?: boolean;
  textarea?: boolean;
  type?: string;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {textarea ? (
        <textarea
          name={name}
          required={required}
          rows={3}
          className="rounded-lg border border-ink/15 bg-white px-4 py-2.5 outline-none focus:border-accent"
        />
      ) : (
        <input
          type={type}
          name={name}
          required={required}
          className="rounded-lg border border-ink/15 bg-white px-4 py-2.5 outline-none focus:border-accent"
        />
      )}
      {hint && <span className="text-xs text-ink/50">{hint}</span>}
    </label>
  );
}
