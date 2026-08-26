import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES_FALLBACK } from "@/data/categories";
import { Field, Notice } from "@/app/components/form-field";

export default async function EditAgentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return <Notice title="Not connected yet">This page needs Supabase configured first.</Notice>;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <Notice title="Sign in first">You need an account to edit an agent.</Notice>;
  }

  const { data: agent } = await supabase.from("agents").select("*").eq("id", id).single();

  if (!agent || agent.creator_id !== user.id) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <h1 className="text-balance mb-2 font-display text-2xl font-semibold">
        Edit {agent.name} <span className="text-ink-faint">· v{agent.version}</span>
      </h1>
      <p className="mb-8 text-sm text-ink-faint">
        Changing the name, tagline, problem, description, or delivery link
        bumps the version, re-runs the safety review, and notifies every
        buyer who owns it — price and category changes alone don&apos;t
        count as a new version.
      </p>

      <form action={`/api/agents/${agent.id}`} method="POST" className="flex flex-col gap-4">
        <Field label="Name" name="name" required defaultValue={agent.name} />
        <Field label="One-line tagline" name="tagline" required defaultValue={agent.tagline} />
        <Field
          label="What problem does it solve?"
          name="problem_solved"
          textarea
          required
          defaultValue={agent.problem_solved}
        />
        <Field label="Full description" name="description" textarea required defaultValue={agent.description} />

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Category</span>
          <select
            name="category_slug"
            required
            defaultValue={agent.category_slug}
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
            defaultValue={agent.pricing_model}
            className="rounded-lg border border-line bg-surface px-4 py-2.5 text-ink outline-none focus:border-accent"
          >
            <option value="one_time">One-time purchase</option>
            <option value="subscription">Monthly subscription</option>
            <option value="free">Free</option>
          </select>
        </label>

        <Field
          label="Price (EUR, leave blank if free)"
          name="price"
          type="number"
          defaultValue={agent.price_cents ? String(agent.price_cents / 100) : undefined}
        />
        <Field
          label="Delivery link (repo, file, or API endpoint)"
          name="delivery_url"
          type="url"
          defaultValue={agent.delivery_url ?? undefined}
        />

        <button
          type="submit"
          className="mt-2 rounded-full bg-accent px-6 py-3 text-sm font-medium text-[#04140f] hover:opacity-90"
        >
          Save and notify buyers
        </button>
      </form>
    </main>
  );
}
